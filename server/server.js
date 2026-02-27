// ============================================================
// Express + WebSocket Server
// Serves frontend, handles auth, chat, alerts, fraud, ServiceNow
// ============================================================
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

// Routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const whatsappRoutes = require("./routes/whatsapp");
const servicenowRoutes = require("./routes/servicenow");
const smsRoutes = require("./routes/sms");
const fraudController = require("./routes/fraudController");
const alertController = require("./routes/alertController");
const twilioWhatsappWebhook = require("./routes/twilioWhatsappWebhook");
const twilioSmsWebhook = require("./routes/twilioSmsWebhook");

// Middleware
const { apiLimiter, authLimiter, alertLimiter } = require("./middleware/rateLimiter");
const auditLogger = require("./middleware/auditLogger");

const { handleWSMessage } = require("./ws/chatStream");

const app = express();
const server = http.createServer(app);

// ── Global Middleware ────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio webhooks send form data
app.use(require("cors")());
app.use(auditLogger); // Log all API requests

// ── Static frontend ──────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public"), {
    maxAge: 0,
    etag: false,
}));

// ── Twilio Webhooks (no auth, no rate limit) ────────
app.use("/webhook/whatsapp", twilioWhatsappWebhook);
app.use("/webhook/sms", twilioSmsWebhook);

// ── API Routes ───────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/chat", apiLimiter, chatRoutes);
app.use("/api/whatsapp", apiLimiter, whatsappRoutes);
app.use("/api/servicenow", apiLimiter, servicenowRoutes);
app.use("/api/sms", alertLimiter, smsRoutes);
app.use("/api/fraud", apiLimiter, fraudController);
app.use("/api/alerts", alertLimiter, alertController);

// ── POST /send-sms — Direct Twilio SMS ───────────────
app.post("/send-sms", async (req, res) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: "to and message are required" });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
            return res.status(500).json({ error: "Twilio credentials not configured in .env" });
        }

        const twilioClient = require("twilio")(accountSid, authToken);

        const msg = await twilioClient.messages.create({
            body: message,
            from: fromNumber,
            to: to,
        });

        console.log(`✅ SMS sent! SID: ${msg.sid} | To: ${to} | Status: ${msg.status}`);
        res.json({ success: true, sid: msg.sid, status: msg.status, to, from: fromNumber });
    } catch (err) {
        console.error(`❌ SMS Error: ${err.message} | Code: ${err.code}`);
        res.status(500).json({ error: err.message, code: err.code });
    }
});

// ── Health check ─────────────────────────────────────
app.get("/api/health", (req, res) => {
    const twilioService = require("./services/twilioService");
    const serviceNowService = require("./services/serviceNowService");
    res.json({
        status: "ok",
        uptime: process.uptime(),
        services: {
            twilio: twilioService.isConfigured(),
            serviceNow: serviceNowService.isConfigured(),
            mongodb: require("mongoose").connection.readyState === 1,
        },
    });
});

// ── SPA fallback ─────────────────────────────────────
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ── WebSocket (real-time chat stream) ────────────────
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
    console.log("WebSocket client connected");

    ws.on("message", async (raw) => {
        try {
            const data = JSON.parse(raw);
            // Authenticate
            if (data.token) {
                try {
                    ws.user = jwt.verify(data.token, process.env.JWT_SECRET);
                } catch { /* invalid token */ }
            }
            await handleWSMessage(ws, data);
        } catch (err) {
            ws.send(JSON.stringify({ type: "error", message: err.message }));
        }
    });

    ws.on("close", () => console.log("WebSocket client disconnected"));
});

// ── MongoDB Connection ───────────────────────────────
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai_avatar_chatbot";

async function start() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("✅ MongoDB connected");
    } catch (err) {
        console.warn("⚠️ MongoDB not available — running in memory mode:", err.message);
    }

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`\n🚀 AI Avatar Chatbot running at http://localhost:${PORT}\n`);
    });
}

start();
