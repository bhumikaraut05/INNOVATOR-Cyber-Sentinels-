// ============================================================
// SMS Route — Uses centralized twilioService
// Legacy compatibility layer + SMS-specific endpoints
// ============================================================
const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const twilioService = require("../services/twilioService");
const audit = require("../services/auditService");

// In-memory SMS log (for SMS panel display)
const smsLog = [];

// ── Send SMS ─────────────────────────────────────────
router.post("/send", authMiddleware, async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: "Phone number and message required." });

        const result = await twilioService.sendSMS(to, message);
        smsLog.push({
            direction: "out", to, message,
            timestamp: new Date().toISOString(),
            simulated: result.simulated, sid: result.sid, source: "manual",
        });

        await audit.logAlertSent({
            channel: "sms", to, sid: result.sid,
            simulated: result.simulated, userId: req.user?.id,
        });

        res.json({ success: true, message: "SMS sent successfully", sid: result.sid, simulated: result.simulated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Send Fraud Alert SMS ─────────────────────────────
router.post("/fraud-alert", authMiddleware, async (req, res) => {
    try {
        const { to, riskScore, incidentId, customerName, language = "en" } = req.body;
        if (!to) return res.status(400).json({ error: "Phone number required." });

        const messages = twilioService.getFraudAlertMessages(language, customerName || "Customer", riskScore || 0, incidentId || "N/A");
        const result = await twilioService.sendSMS(to, messages.sms);

        smsLog.push({
            direction: "out", to, message: messages.sms,
            timestamp: new Date().toISOString(),
            simulated: result.simulated, sid: result.sid,
            source: "fraud-alert", riskScore, incidentId,
        });

        await audit.logAlertSent({
            channel: "sms", to, sid: result.sid,
            simulated: result.simulated, incidentId, userId: req.user?.id,
        });

        res.json({ success: true, message: "Fraud alert SMS sent", sid: result.sid, simulated: result.simulated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get Status ───────────────────────────────────────
router.get("/status", (req, res) => {
    res.json({
        configured: twilioService.isConfigured(),
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
            ? process.env.TWILIO_PHONE_NUMBER.substring(0, 4) + "••••"
            : null,
        totalSent: smsLog.length,
    });
});

// ── Get SMS Log ──────────────────────────────────────
router.get("/log", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ messages: smsLog.slice(-limit) });
});

module.exports = router;
