// ============================================================
// WhatsApp Route — Twilio WhatsApp Sandbox ONLY (no Meta API)
// Send/receive WhatsApp messages via Twilio
// ============================================================

const router = require("express").Router();
const twilio = require("twilio");
const { callOpenAI, SYSTEM_PROMPT } = require("./chat");

// ── Twilio Config ────────────────────────────────────
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const WA_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886";

let client = null;
function getClient() {
    if (client) return client;
    if (ACCOUNT_SID && AUTH_TOKEN) {
        client = twilio(ACCOUNT_SID, AUTH_TOKEN);
        return client;
    }
    return null;
}

// In-memory conversation history (per phone number)
const waConversations = new Map();
// In-memory log for frontend display
const waMessageLog = [];

// ── Send WhatsApp Message via Twilio ─────────────────
async function sendWhatsAppMessage(to, text) {
    const c = getClient();
    if (!c) {
        console.log(`📱 [SIM WA → ${to}]: ${text.substring(0, 80)}...`);
        return { simulated: true, sid: `SIM_${Date.now()}` };
    }

    // Ensure correct format
    const fromWA = `whatsapp:${WA_NUMBER}`;
    const toWA = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    console.log(`📤 Sending WhatsApp: from=${fromWA} to=${toWA}`);

    try {
        const msg = await c.messages.create({
            body: text,
            from: fromWA,
            to: toWA,
        });
        console.log(`✅ WhatsApp sent! SID: ${msg.sid} Status: ${msg.status}`);
        return { simulated: false, sid: msg.sid, status: msg.status };
    } catch (err) {
        console.error(`❌ Twilio WhatsApp Error:`, err.message);
        console.error(`   Code: ${err.code}, Status: ${err.status}`);
        throw err;
    }
}

// ── POST /api/whatsapp/send — Manual send from UI ────
router.post("/send", async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: "to and message required" });

        const result = await sendWhatsAppMessage(to, message);
        waMessageLog.push({
            direction: "out", to, text: message,
            timestamp: new Date().toISOString(),
            sid: result.sid, simulated: result.simulated, source: "web",
        });

        res.json({ success: true, message: "Sent via WhatsApp", sid: result.sid, simulated: result.simulated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/whatsapp/webhook — Incoming Twilio webhook ─
router.post("/webhook", async (req, res) => {
    try {
        const from = req.body.From;   // "whatsapp:+919876543210"
        const body = req.body.Body;   // message text
        const sid = req.body.MessageSid || "";

        console.log(`\n📱 WhatsApp IN from ${from}: "${body}" (SID: ${sid})`);

        if (!from || !body) return res.status(200).send("OK");

        // Log incoming
        waMessageLog.push({ direction: "in", from, text: body, timestamp: new Date().toISOString(), sid });

        // Build conversation history for OpenAI
        if (!waConversations.has(from)) {
            waConversations.set(from, [{ role: "system", content: SYSTEM_PROMPT }]);
        }
        const history = waConversations.get(from);
        history.push({ role: "user", content: body });

        // Keep last 20 messages + system
        if (history.length > 21) {
            waConversations.set(from, [history[0], ...history.slice(-20)]);
        }

        // Get AI reply
        let reply;
        try {
            reply = await callOpenAI(history);
            console.log(`🤖 AI reply: "${reply.substring(0, 100)}..."`);
        } catch (err) {
            console.error(`❌ OpenAI error: ${err.message}`);
            reply = "I'm sorry, I'm having technical issues. Please try again.";
        }
        history.push({ role: "assistant", content: reply });

        // Log outgoing
        waMessageLog.push({ direction: "out", to: from, text: reply, timestamp: new Date().toISOString() });

        // Send reply via Twilio
        await sendWhatsAppMessage(from, reply);

        res.status(200).send("OK");
    } catch (err) {
        console.error("WhatsApp webhook error:", err.message);
        res.status(200).send("OK"); // Always 200 to Twilio
    }
});

// ── GET /api/whatsapp/log ────────────────────────────
router.get("/log", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ messages: waMessageLog.slice(-limit) });
});

// ── GET /api/whatsapp/status ─────────────────────────
router.get("/status", (req, res) => {
    res.json({
        configured: !!(ACCOUNT_SID && AUTH_TOKEN),
        whatsappNumber: WA_NUMBER,
        totalConversations: waConversations.size,
        totalMessages: waMessageLog.length,
    });
});

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
