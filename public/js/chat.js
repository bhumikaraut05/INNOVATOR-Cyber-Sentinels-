// ============================================================
// Chat Module — WebSocket connection + message handling
// ============================================================

let ws = null;
let sessionId = null;
let onReplyCallback = null;
let onTypingCallback = null;
let onErrorCallback = null;
let reconnectTimer = null;

function initChat({ onReply, onTyping, onError }) {
    onReplyCallback = onReply;
    onTypingCallback = onTyping;
    onErrorCallback = onError;
    connect();
}

function connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws`;

    try {
        ws = new WebSocket(url);
    } catch {
        console.warn("WebSocket not available — using REST fallback");
        return;
    }

    ws.onopen = () => console.log("✅ WebSocket connected");

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === "reply") {
                sessionId = data.sessionId;
                if (onReplyCallback) onReplyCallback(data.message, data.language);
            } else if (data.type === "typing") {
                if (onTypingCallback) onTypingCallback();
            } else if (data.type === "error") {
                if (onErrorCallback) onErrorCallback(data.message);
            }
        } catch (e) {
            console.error("WS parse error:", e);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected — reconnecting in 3s");
        reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
        console.warn("WebSocket error");
    };
}

function sendMessage(text, language = "en", emotion = "neutral") {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "chat",
            message: text,
            sessionId,
            language,
            emotion,
        }));
    } else {
        // REST fallback
        sendREST(text, language, emotion);
    }
}

async function sendREST(text, language, emotion) {
    if (onTypingCallback) onTypingCallback();
    try {
        const token = localStorage.getItem("sb_token");
        const res = await fetch("/api/chat/message", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message: text, sessionId, language, emotion }),
        });
        const data = await res.json();
        if (data.reply) {
            sessionId = data.sessionId;
            if (onReplyCallback) onReplyCallback(data.reply, language);
        } else if (data.error) {
            if (onErrorCallback) onErrorCallback(data.error);
        }
    } catch (err) {
        if (onErrorCallback) onErrorCallback("Connection error. Please try again.");
    }
}

function resetChat() {
    sessionId = null;
}

function destroyChat() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
}

export { initChat, sendMessage, resetChat, destroyChat };
