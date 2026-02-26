// ============================================================
// WhatsApp Cloud API — Full integration with AI chat engine
// Receives messages → gets AI reply → sends back → syncs with web
// ============================================================
const router = require("express").Router();
const { callOpenAI, SYSTEM_PROMPT } = require("./chat");

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "chatbot_verify";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

// In-memory WhatsApp conversation history (per phone number)
const waConversations = new Map();
// In-memory log for frontend display
const waMessageLog = [];

// ── Webhook Verification (GET) ───────────────────────
router.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ WhatsApp webhook verified");
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// ── Incoming Messages (POST) ─────────────────────────
router.post("/webhook", async (req, res) => {
    try {
        const body = req.body;
        if (body.object !== "whatsapp_business_account") return res.sendStatus(404);

        for (const entry of (body.entry || [])) {
            for (const change of (entry.changes || [])) {
                const messages = change.value?.messages || [];
                for (const msg of messages) {
                    const from = msg.from;
                    const text = msg.text?.body || "";
                    if (!text) continue;

                    console.log(`📱 WhatsApp from ${from}: ${text}`);

                    // Log incoming
                    waMessageLog.push({ direction: "in", from, text, timestamp: new Date().toISOString() });

                    // Get/create conversation history
                    if (!waConversations.has(from)) {
                        waConversations.set(from, [{ role: "system", content: SYSTEM_PROMPT }]);
                    }
                    const history = waConversations.get(from);
                    history.push({ role: "user", content: text });

                    // Get AI reply
                    const reply = await callOpenAI(history);
                    history.push({ role: "assistant", content: reply });

                    // Keep history manageable (last 20 messages + system)
                    if (history.length > 21) {
                        waConversations.set(from, [history[0], ...history.slice(-20)]);
                    }

                    // Log outgoing
                    waMessageLog.push({ direction: "out", to: from, text: reply, timestamp: new Date().toISOString() });

                    // Send reply via WhatsApp
                    await sendWhatsAppMessage(from, reply);
                }
            }
        }
        res.sendStatus(200);
    } catch (err) {
        console.error("WhatsApp webhook error:", err);
        res.sendStatus(500);
    }
});

// ── Send Message from Web UI ─────────────────────────
router.post("/send", async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) return res.status(400).json({ error: "to and message required" });

        await sendWhatsAppMessage(to, message);
        waMessageLog.push({ direction: "out", to, text: message, timestamp: new Date().toISOString(), source: "web" });

        res.json({ success: true, message: "Sent via WhatsApp" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get Message Log (for frontend sync) ──────────────
router.get("/log", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json({ messages: waMessageLog.slice(-limit) });
});

// ── Get Status ───────────────────────────────────────
router.get("/status", (req, res) => {
    res.json({
        configured: !!(WHATSAPP_TOKEN && PHONE_ID),
        phoneId: PHONE_ID ? PHONE_ID.substring(0, 4) + "••••" : null,
        totalConversations: waConversations.size,
        totalMessages: waMessageLog.length,
    });
});

// ── Send WhatsApp Message ────────────────────────────
async function sendWhatsAppMessage(to, text) {
    if (!WHATSAPP_TOKEN || !PHONE_ID) {
        console.log(`📱 [Simulated WhatsApp → ${to}]: ${text.substring(0, 80)}...`);
        return { simulated: true };
    }

    const resp = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: text },
        }),
    });
    const data = await resp.json();
    if (!resp.ok) console.error("WhatsApp API error:", data);
    else console.log("WhatsApp sent:", data.messages?.[0]?.id);
    return data;
}

// ── Send Template (OTP, statements, alerts) ──────────
async function sendWhatsAppTemplate(to, templateName, params = []) {
    if (!WHATSAPP_TOKEN || !PHONE_ID) {
        console.log(`📱 [Simulated Template → ${to}]: ${templateName}`, params);
        return { simulated: true };
    }

    const resp = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
                name: templateName,
                language: { code: "en" },
                components: params.length ? [{
                    type: "body",
                    parameters: params.map(p => ({ type: "text", text: p })),
                }] : undefined,
            },
        }),
    });
    return resp.json();
}

module.exports = router;
module.exports.sendWhatsAppMessage = sendWhatsAppMessage;
module.exports.sendWhatsAppTemplate = sendWhatsAppTemplate;
