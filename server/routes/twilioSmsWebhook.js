// ============================================================
// Twilio SMS Webhook — Full AI chatbot flow via SMS
// 1. Receives SMS from Twilio
// 2. Sends to OpenAI API for intelligent reply
// 3. Sends AI reply back to same phone number via Twilio SMS
// ============================================================

const router = require("express").Router();
const twilio = require("twilio");
const { callOpenAI, SYSTEM_PROMPT } = require("./chat");

// Twilio client
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY_SID;
const TWILIO_API_SECRET = process.env.TWILIO_API_KEY_SECRET;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

let client = null;
function getTwilioClient() {
    if (client) return client;
    const twilio = require("twilio");
    if (TWILIO_API_KEY && TWILIO_API_SECRET && TWILIO_SID) {
        client = twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_SID });
        console.log("✅ Twilio SMS client initialized (API Key)");
        return client;
    }
    if (TWILIO_SID && TWILIO_TOKEN) {
        client = twilio(TWILIO_SID, TWILIO_TOKEN);
        console.log("✅ Twilio SMS client initialized (Auth Token)");
        return client;
    }
    console.error("❌ Twilio credentials missing — cannot send SMS");
    return null;
}

// Per-user conversation history for OpenAI context
const conversations = new Map();

// ── POST /webhook/sms — Twilio SMS Webhook ───────────
router.post("/", async (req, res) => {
    try {
        // 1. Extract sender number and message from Twilio's POST data
        const from = req.body.From;   // e.g. "+919876543210"
        const body = req.body.Body;   // The user's SMS text
        const messageSid = req.body.MessageSid || "";

        console.log(`\n📲 ═══════════════════════════════════════════════`);
        console.log(`📲 SMS IN from ${from}: "${body}"`);
        console.log(`📲 MessageSid: ${messageSid}`);
        console.log(`📲 ═══════════════════════════════════════════════`);

        if (!from || !body) {
            console.warn("⚠️ SMS Webhook received but missing From or Body");
            return res.status(400).send("Missing From or Body");
        }

        // 2. Build/get conversation history for this user
        if (!conversations.has(from)) {
            conversations.set(from, [
                { role: "system", content: SYSTEM_PROMPT + "\n\nIMPORTANT: You are replying via SMS. Keep responses SHORT (under 160 characters when possible). Be concise." },
            ]);
            console.log(`🆕 New SMS conversation started for ${from}`);
        }

        const history = conversations.get(from);
        history.push({ role: "user", content: body });

        // Keep history manageable (system + last 10 messages for SMS)
        if (history.length > 11) {
            conversations.set(from, [history[0], ...history.slice(-10)]);
        }

        // 3. Call OpenAI API for intelligent reply
        console.log(`🤖 Calling OpenAI for SMS reply...`);
        let aiReply;
        try {
            aiReply = await callOpenAI(history);
            console.log(`🤖 OpenAI reply: "${aiReply.substring(0, 100)}..."`);
        } catch (err) {
            console.error(`❌ OpenAI error: ${err.message}`);
            aiReply = "Sorry, I'm experiencing issues. Please try again shortly. — SecureBank";
        }

        // Save assistant reply to history
        history.push({ role: "assistant", content: aiReply });

        // 4. Send AI reply back via Twilio SMS
        const twilioClient = getTwilioClient();
        if (!twilioClient) {
            console.error("❌ Cannot send SMS reply — Twilio client not initialized");
            return res.status(500).send("Twilio not configured");
        }

        console.log(`📤 Sending SMS reply to ${from}...`);
        console.log(`📤 From: ${TWILIO_PHONE}`);
        console.log(`📤 To: ${from}`);

        const sentMessage = await twilioClient.messages.create({
            body: aiReply,
            from: TWILIO_PHONE,
            to: from,
        });

        console.log(`✅ SMS reply sent! SID: ${sentMessage.sid}`);
        console.log(`✅ Status: ${sentMessage.status}`);

        // 5. Return 200 to Twilio
        res.status(200).send("OK");

    } catch (err) {
        console.error(`\n❌ ═══════════════════════════════════════════════`);
        console.error(`❌ SMS Webhook Error: ${err.message}`);
        console.error(err.stack);
        console.error(`❌ ═══════════════════════════════════════════════\n`);
        res.status(500).send("Internal Server Error");
    }
});

// ── GET /webhook/sms — Health check ──────────────────
router.get("/", (req, res) => {
    res.json({
        status: "Twilio SMS webhook is active",
        twilioConfigured: !!(TWILIO_SID && TWILIO_TOKEN),
        phoneNumber: TWILIO_PHONE,
        activeConversations: conversations.size,
    });
});

module.exports = router;
