// ============================================================
// Twilio WhatsApp Webhook — Full AI chatbot flow
// 1. Receives WhatsApp message from Twilio Sandbox
// 2. Sends to OpenAI API for intelligent reply
// 3. Sends AI reply back to user via Twilio WhatsApp
// ============================================================

const router = require("express").Router();
const twilio = require("twilio");
const { callOpenAI, SYSTEM_PROMPT } = require("./chat");

// Twilio client
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_WA_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886";

let client = null;
function getTwilioClient() {
    if (client) return client;
    const twilio = require("twilio");
    if (TWILIO_API_KEY && TWILIO_API_SECRET && TWILIO_SID) {
        client = twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_SID });
        console.log("✅ Twilio WhatsApp client initialized (API Key)");
        return client;
    }
    if (TWILIO_SID && TWILIO_TOKEN) {
        client = twilio(TWILIO_SID, TWILIO_TOKEN);
        console.log("✅ Twilio WhatsApp client initialized (Auth Token)");
        return client;
    }
    console.error("❌ Twilio credentials missing — cannot send WhatsApp messages");
    return null;
}

// Per-user conversation history for OpenAI context
const conversations = new Map();

// ── POST /webhook/whatsapp — Twilio Sandbox Webhook ──
router.post("/", async (req, res) => {
    try {
        // 1. Extract sender number and message from Twilio's POST data
        const from = req.body.From;   // e.g. "whatsapp:+919876543210"
        const body = req.body.Body;   // The user's message text
        const messageSid = req.body.MessageSid || "";

        console.log(`\n📱 ═══════════════════════════════════════════════`);
        console.log(`📱 WhatsApp IN from ${from}: "${body}"`);
        console.log(`📱 MessageSid: ${messageSid}`);
        console.log(`📱 ═══════════════════════════════════════════════`);

        if (!from || !body) {
            console.warn("⚠️ Webhook received but missing From or Body");
            return res.status(400).send("Missing From or Body");
        }

        // 2. Build/get conversation history for this user
        if (!conversations.has(from)) {
            conversations.set(from, [
                { role: "system", content: SYSTEM_PROMPT },
            ]);
            console.log(`🆕 New conversation started for ${from}`);
        }

        const history = conversations.get(from);
        history.push({ role: "user", content: body });

        // Keep history manageable (system + last 20 messages)
        if (history.length > 21) {
            conversations.set(from, [history[0], ...history.slice(-20)]);
        }

        // 3. Call OpenAI API for intelligent reply
        console.log(`🤖 Calling OpenAI for reply...`);
        let aiReply;
        try {
            aiReply = await callOpenAI(history);
            console.log(`🤖 OpenAI reply: "${aiReply.substring(0, 100)}..."`);
        } catch (err) {
            console.error(`❌ OpenAI error: ${err.message}`);
            aiReply = "I'm sorry, I'm experiencing technical difficulties. Please try again in a moment.";
        }

        // Save assistant reply to history
        history.push({ role: "assistant", content: aiReply });

        // 4. Send AI reply back to the same WhatsApp number via Twilio
        const twilioClient = getTwilioClient();
        if (!twilioClient) {
            console.error("❌ Cannot send reply — Twilio client not initialized");
            return res.status(500).send("Twilio not configured");
        }

        console.log(`📤 Sending WhatsApp reply to ${from}...`);
        console.log(`📤 From: whatsapp:${TWILIO_WA_NUMBER}`);
        console.log(`📤 To: ${from}`);

        const sentMessage = await twilioClient.messages.create({
            body: aiReply,
            from: `whatsapp:${TWILIO_WA_NUMBER}`,
            to: from,  // Already in format "whatsapp:+919876543210"
        });

        console.log(`✅ WhatsApp reply sent! SID: ${sentMessage.sid}`);
        console.log(`✅ Status: ${sentMessage.status}`);

        // 5. Return 200 to Twilio (MUST respond quickly)
        res.status(200).send("OK");

    } catch (err) {
        console.error(`\n❌ ═══════════════════════════════════════════════`);
        console.error(`❌ WhatsApp Webhook Error: ${err.message}`);
        console.error(err.stack);
        console.error(`❌ ═══════════════════════════════════════════════\n`);
        res.status(500).send("Internal Server Error");
    }
});

// ── GET /webhook/whatsapp — Health check ──────────────
router.get("/", (req, res) => {
    res.json({
        status: "Twilio WhatsApp webhook is active",
        twilioConfigured: !!(TWILIO_SID && TWILIO_TOKEN),
        whatsappNumber: TWILIO_WA_NUMBER,
        activeConversations: conversations.size,
    });
});

module.exports = router;
