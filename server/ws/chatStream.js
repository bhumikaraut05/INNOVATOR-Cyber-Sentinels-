// WebSocket Chat Stream — Real-time AI responses
const Session = require("../models/Session");
const { callOpenAI, SYSTEM_PROMPT } = require("../routes/chat");

// In-memory sessions for unauthenticated/quick use
const memorySessions = new Map();

async function handleWSMessage(ws, data) {
    const { type, message, sessionId, language, emotion, token } = data;

    if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
    }

    if (type !== "chat") return;

    // Get/create session messages
    let messages = [{ role: "system", content: SYSTEM_PROMPT }];
    let sid = sessionId || "anon-" + Date.now();

    if (memorySessions.has(sid)) {
        messages = memorySessions.get(sid);
    } else {
        memorySessions.set(sid, messages);
    }

    // Add user message
    messages.push({ role: "user", content: message });

    // Send typing indicator
    ws.send(JSON.stringify({ type: "typing", sessionId: sid }));

    try {
        // Get AI reply
        const reply = await callOpenAI(messages);

        // Store in memory
        messages.push({ role: "assistant", content: reply });
        memorySessions.set(sid, messages);

        // Send reply
        ws.send(JSON.stringify({
            type: "reply",
            message: reply,
            sessionId: sid,
            language,
        }));
    } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "Sorry, something went wrong. Please try again." }));
    }
}

module.exports = { handleWSMessage };
