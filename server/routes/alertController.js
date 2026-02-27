// ============================================================
// Alert Controller — Manual alert management
// POST /api/alerts/sms      — Send SMS
// POST /api/alerts/whatsapp — Send WhatsApp message
// POST /api/alerts/call     — Make voice call
// GET  /api/alerts/log      — Get alert history
// POST /api/alerts/webhook  — Incoming Twilio webhook (SMS/WA replies)
// ============================================================

const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const twilioValidator = require("../middleware/twilioValidator");
const twilioService = require("../services/twilioService");
const audit = require("../services/auditService");

// In-memory alert log
const alertLog = [];

function logAlert(entry) {
    alertLog.push({ ...entry, timestamp: new Date().toISOString() });
    if (alertLog.length > 500) alertLog.shift();
}

// ── POST /api/alerts/sms ─────────────────────────────
router.post("/sms", authMiddleware, async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: "Phone number and message required." });

        const result = await twilioService.sendSMS(to, message);
        logAlert({ channel: "sms", to, message, ...result, userId: req.user?.id, source: "manual" });

        await audit.logAlertSent({
            channel: "sms", to, sid: result.sid, simulated: result.simulated, userId: req.user?.id,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        await audit.error("SMS_SEND_FAILED", { message: err.message, userId: req.user?.id });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/alerts/whatsapp ────────────────────────
router.post("/whatsapp", authMiddleware, async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: "Phone number and message required." });

        const result = await twilioService.sendWhatsApp(to, message);
        logAlert({ channel: "whatsapp", to, message, ...result, userId: req.user?.id, source: "manual" });

        await audit.logAlertSent({
            channel: "whatsapp", to, sid: result.sid, simulated: result.simulated, userId: req.user?.id,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        await audit.error("WHATSAPP_SEND_FAILED", { message: err.message, userId: req.user?.id });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/alerts/call ────────────────────────────
router.post("/call", authMiddleware, async (req, res) => {
    try {
        const { to, message, language = "en" } = req.body;
        if (!to || !message) return res.status(400).json({ error: "Phone number and message required." });

        const result = await twilioService.makeVoiceCall(to, message, language);
        logAlert({ channel: "voice", to, message, ...result, userId: req.user?.id, source: "manual" });

        await audit.logAlertSent({
            channel: "voice", to, sid: result.sid, simulated: result.simulated, userId: req.user?.id,
        });

        res.json({ success: true, ...result });
    } catch (err) {
        await audit.error("VOICE_CALL_FAILED", { message: err.message, userId: req.user?.id });
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/alerts/log ──────────────────────────────
router.get("/log", authMiddleware, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const channel = req.query.channel;
    let logs = [...alertLog];
    if (channel) logs = logs.filter(l => l.channel === channel);
    res.json({ alerts: logs.slice(-limit) });
});

// ── GET /api/alerts/status ───────────────────────────
router.get("/status", (req, res) => {
    res.json({
        twilio: {
            configured: twilioService.isConfigured(),
            channels: {
                sms: true,
                whatsapp: true,
                voice: true,
            },
        },
        totalAlerts: alertLog.length,
        byChannel: {
            sms: alertLog.filter(a => a.channel === "sms").length,
            whatsapp: alertLog.filter(a => a.channel === "whatsapp").length,
            voice: alertLog.filter(a => a.channel === "voice").length,
        },
    });
});

// ── POST /api/alerts/webhook — Incoming Twilio webhook ─
router.post("/webhook", twilioValidator, async (req, res) => {
    try {
        const { From, Body, MessageSid, SmsStatus, CallSid, CallStatus } = req.body;

        // SMS / WhatsApp incoming
        if (Body) {
            const channel = From?.startsWith("whatsapp:") ? "whatsapp" : "sms";
            const from = From?.replace("whatsapp:", "") || "unknown";

            console.log(`📥 Incoming ${channel} from ${from}: ${Body.substring(0, 100)}`);

            logAlert({
                channel,
                direction: "in",
                from,
                message: Body,
                sid: MessageSid,
                source: "webhook",
            });

            await audit.info("WEBHOOK_RECEIVED", {
                message: `Incoming ${channel} from ${from}`,
                meta: { from, body: Body.substring(0, 200), sid: MessageSid },
            });

            // Auto-reply
            const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Thank you for your message. A SecureBank representative will contact you shortly. Your message has been logged for security purposes.</Message></Response>`;
            res.type("text/xml").send(twiml);
            return;
        }

        // Call status callback
        if (CallSid) {
            console.log(`📞 Call ${CallSid} status: ${CallStatus}`);
            await audit.info("CALL_STATUS_UPDATE", {
                meta: { callSid: CallSid, status: CallStatus },
            });
        }

        res.status(200).send("OK");
    } catch (err) {
        console.error("Webhook error:", err.message);
        res.status(500).send("Error");
    }
});

// ── GET /api/alerts/audit ────────────────────────────
router.get("/audit", authMiddleware, async (req, res) => {
    try {
        const logs = await audit.getLogs({
            level: req.query.level,
            action: req.query.action,
        }, parseInt(req.query.limit) || 100);

        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
