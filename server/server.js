// ============================================================
// Express + WebSocket Server
// Serves frontend, handles auth, chat (OpenAI), WhatsApp
// ============================================================
require("dotenv").config();
const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const whatsappRoutes = require("./routes/whatsapp");
const servicenowRoutes = require("./routes/servicenow");
const { handleWSMessage } = require("./ws/chatStream");

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────
app.use(express.json());
app.use(require("cors")());

// ── Static frontend ──────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public"), {
    maxAge: 0,
    etag: false,
}));

// ── API Routes ───────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/servicenow", servicenowRoutes);

// ── Health check ─────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
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
