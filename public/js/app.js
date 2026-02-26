// ============================================================
// App Controller — Wires Auth + Avatar + Chat + Voice + Emotion
// ============================================================
import { setLanguage, t, getLang, getVoiceLang } from "./i18n.js";
import { apiSignUp, apiSignIn, apiSendOtp, apiVerifyOtp, getToken, getUser, isLoggedIn, logout } from "./auth.js";
import { initChat, sendMessage, resetChat } from "./chat.js";
import { initAvatar, startLipSync, stopLipSync, setListeningPose, setEmotion } from "./avatar.js";
import { initVoice, startListening, stopListeningVoice, getIsListening, speak, stopSpeaking, toggleTTS, isTTSEnabled } from "./voice.js";
import { startEmotionDetection, stopEmotionDetection, getCurrentEmotion, getEmotionEmoji } from "./emotion.js";

// ── DOM Elements ─────────────────────────────────────
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const langSelector = document.getElementById("langSelector");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const tabOtp = document.getElementById("tabOtp");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const otpForm = document.getElementById("otpForm");
const siError = document.getElementById("siError");
const suError = document.getElementById("suError");
const otpError = document.getElementById("otpError");

const avatarCanvasWrapper = document.getElementById("avatarCanvasWrapper");
const avatarLoading = document.getElementById("avatarLoading");
const avatarAura = document.getElementById("avatarAura");
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileInitial = document.getElementById("profileInitial");
const micBtn = document.getElementById("micBtn");
const cameraBtn = document.getElementById("cameraBtn");
const chatToggleBtn = document.getElementById("chatToggleBtn");
const chatOverlay = document.getElementById("chatOverlay");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const quickActions = document.getElementById("quickActions");
const ttsToggle = document.getElementById("ttsToggle");
const ttsIcon = document.getElementById("ttsIcon");
const ttsLabel = document.getElementById("ttsLabel");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");
const holoEmotion = document.getElementById("holoEmotion");
const holoEmotionValue = document.getElementById("holoEmotionValue");
const webcamOverlay = document.getElementById("webcamOverlay");
const webcamCloseBtn = document.getElementById("webcamCloseBtn");
const webcamVideo = document.getElementById("webcamVideo");
const webcamCanvas = document.getElementById("webcamCanvas");
const webcamCaptureBtn = document.getElementById("webcamCaptureBtn");
const webcamEmojiEl = document.getElementById("webcamEmoji");
const webcamEmotionTextEl = document.getElementById("webcamEmotionText");

// ServiceNow
const snowBtn = document.getElementById("snowBtn");
const snowOverlay = document.getElementById("snowOverlay");
const snowCloseBtn = document.getElementById("snowCloseBtn");
const snowCreateBtn = document.getElementById("snowCreateBtn");
const snowRefreshBtn = document.getElementById("snowRefreshBtn");
const snowResult = document.getElementById("snowResult");
const snowIncidents = document.getElementById("snowIncidents");

// WhatsApp
const waBtn = document.getElementById("waBtn");
const waOverlay = document.getElementById("waOverlay");
const waCloseBtn = document.getElementById("waCloseBtn");
const waSendBtn = document.getElementById("waSendBtn");
const waLogRefreshBtn = document.getElementById("waLogRefreshBtn");
const waResult = document.getElementById("waResult");
const waStatusDot = document.getElementById("waStatusDot");
const waStatusTitle = document.getElementById("waStatusTitle");
const waStatusSub = document.getElementById("waStatusSub");
const waLog = document.getElementById("waLog");

// State
let chatOpen = false;
let isProcessing = false;
let currentEmotion = "neutral";
let otpSent = false;

// ════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
    // Language
    langSelector.addEventListener("change", (e) => setLanguage(e.target.value));
    setLanguage("en");

    if (isLoggedIn()) {
        launchApp(getUser());
    } else {
        initAuthUI();
    }
});

// ════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════

function initAuthUI() {
    // Tab switching
    tabSignIn.addEventListener("click", () => switchTab("signin"));
    tabSignUp.addEventListener("click", () => switchTab("signup"));
    tabOtp.addEventListener("click", () => switchTab("otp"));

    // Sign In
    signinForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        siError.textContent = "";
        try {
            const data = await apiSignIn(
                document.getElementById("siEmail").value,
                document.getElementById("siPassword").value
            );
            launchApp(data.user, data.isNew);
        } catch (err) {
            siError.textContent = err.message;
        }
    });

    // Sign Up
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        suError.textContent = "";
        try {
            const data = await apiSignUp({
                name: document.getElementById("suName").value,
                email: document.getElementById("suEmail").value,
                phone: document.getElementById("suPhone").value,
                password: document.getElementById("suPassword").value,
                gender: document.getElementById("suGender").value,
                language: document.getElementById("suLang").value,
            });
            launchApp(data.user, true);
        } catch (err) {
            suError.textContent = err.message;
        }
    });

    // OTP
    otpForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        otpError.textContent = "";
        const phone = document.getElementById("otpPhone").value;

        if (!otpSent) {
            try {
                const data = await apiSendOtp(phone);
                otpSent = true;
                document.getElementById("otpCodeGroup").style.display = "";
                document.getElementById("otpSubmitBtn").textContent = t("verifyOtp");
                if (data.hint) otpError.textContent = `Dev OTP: ${data.hint}`;
            } catch (err) { otpError.textContent = err.message; }
        } else {
            try {
                const data = await apiVerifyOtp(phone, document.getElementById("otpCode").value);
                launchApp(data.user, data.isNew);
            } catch (err) { otpError.textContent = err.message; }
        }
    });

    // Google (no-op if not configured)
    document.getElementById("googleLoginBtn").addEventListener("click", () => {
        siError.textContent = "Google OAuth requires GOOGLE_CLIENT_ID in .env";
    });
}

function switchTab(tab) {
    [tabSignIn, tabSignUp, tabOtp].forEach(t => t.classList.remove("auth-tab--active"));
    [signinForm, signupForm, otpForm].forEach(f => f.style.display = "none");

    if (tab === "signin") { tabSignIn.classList.add("auth-tab--active"); signinForm.style.display = ""; }
    else if (tab === "signup") { tabSignUp.classList.add("auth-tab--active"); signupForm.style.display = ""; }
    else { tabOtp.classList.add("auth-tab--active"); otpForm.style.display = ""; }
}

// ════════════════════════════════════════════════════
//  LAUNCH APP
// ════════════════════════════════════════════════════

async function launchApp(user, isNew = false) {
    authScreen.style.display = "none";
    appScreen.style.display = "flex";

    // Set language
    if (user?.language) {
        setLanguage(user.language);
        langSelector.value = user.language;
    }

    // Profile
    profileInitial.textContent = user?.name ? user.name.charAt(0).toUpperCase() : "👤";
    profileName.textContent = user?.name || "User";
    profileEmail.textContent = user?.email || "";

    // Init avatar
    try {
        await initAvatar(avatarCanvasWrapper, () => {
            avatarLoading.style.display = "none";
        });
    } catch {
        avatarLoading.innerHTML = "<span>Avatar ready</span>";
        setTimeout(() => { avatarLoading.style.display = "none"; }, 1000);
    }

    // Init chat (WebSocket)
    initChat({
        onReply: (message, lang) => {
            removeTyping();
            addBotMessage(message);
            isProcessing = false;

            // Voice output + lip-sync
            speak(message, getLang(), {
                onStart: (dur) => startLipSync(dur),
                onEnd: () => stopLipSync(),
            });
        },
        onTyping: () => showTypingIndicator(),
        onError: (msg) => {
            removeTyping();
            addBotMessage(`⚠️ ${msg}`);
            isProcessing = false;
        },
    });

    // Init voice
    initVoice(onVoiceResult, onVoiceStatus);

    // Greeting
    const greeting = isNew ? t("welcome") : t("welcomeBack", { name: user?.name || "User" });
    addBotMessage(greeting);
    speak(greeting, getLang(), {
        onStart: (dur) => startLipSync(dur),
        onEnd: () => stopLipSync(),
    });

    wireAppEvents();
}

// ════════════════════════════════════════════════════
//  APP EVENTS
// ════════════════════════════════════════════════════

function wireAppEvents() {
    chatToggleBtn.addEventListener("click", toggleChat);
    chatCloseBtn.addEventListener("click", closeChat);

    sendBtn.addEventListener("click", handleSend);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    chatInput.addEventListener("input", () => {
        chatInput.style.height = "auto";
        chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + "px";
        sendBtn.disabled = !chatInput.value.trim();
    });

    micBtn.addEventListener("click", handleMic);
    cameraBtn.addEventListener("click", openWebcam);
    webcamCloseBtn.addEventListener("click", closeWebcam);
    webcamCaptureBtn.addEventListener("click", captureEmotion);
    webcamOverlay.addEventListener("click", (e) => { if (e.target === webcamOverlay) closeWebcam(); });

    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.style.display = profileDropdown.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", () => { profileDropdown.style.display = "none"; });

    ttsToggle.addEventListener("click", () => {
        const on = toggleTTS();
        ttsIcon.textContent = on ? "🔊" : "🔇";
        ttsLabel.textContent = on ? "On" : "Off";
        if (!on) stopLipSync();
    });

    resetBtn.addEventListener("click", () => {
        chatMessages.innerHTML = "";
        resetChat();
        stopSpeaking();
        stopLipSync();
        quickActions.style.display = "flex";
        currentEmotion = "neutral";
        holoEmotion.style.display = "none";
        profileDropdown.style.display = "none";
        const user = getUser();
        addBotMessage(t("welcomeBack", { name: user?.name || "User" }));
    });

    logoutBtn.addEventListener("click", () => { logout(); location.reload(); });

    quickActions.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (chip) {
            chatInput.value = chip.dataset.msg;
            sendBtn.disabled = false;
            handleSend();
        }
    });

    // ServiceNow
    snowBtn.addEventListener("click", toggleSnow);
    snowCloseBtn.addEventListener("click", closeSnow);
    snowCreateBtn.addEventListener("click", createIncident);
    snowRefreshBtn.addEventListener("click", loadIncidents);

    // WhatsApp
    waBtn.addEventListener("click", toggleWA);
    waCloseBtn.addEventListener("click", closeWA);
    waSendBtn.addEventListener("click", sendWhatsApp);
    waLogRefreshBtn.addEventListener("click", loadWALog);
}

// ── Chat ─────────────────────────────────────────────

function toggleChat() {
    chatOpen = !chatOpen;
    chatOverlay.style.display = chatOpen ? "flex" : "none";
    if (chatOpen) { scrollBottom(); chatInput.focus(); }
}
function closeChat() { chatOpen = false; chatOverlay.style.display = "none"; }

function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isProcessing) return;
    isProcessing = true;
    addUserMessage(text);
    chatInput.value = "";
    chatInput.style.height = "auto";
    sendBtn.disabled = true;
    quickActions.style.display = "none";

    sendMessage(text, getLang(), currentEmotion);
    checkForFraud(text);
}

// ── Mic ──────────────────────────────────────────────

function handleMic() {
    if (getIsListening()) {
        stopListeningVoice();
        setListeningPose(false);
    } else {
        if (!chatOpen) toggleChat();
        startListening(getVoiceLang());
        setListeningPose(true);
    }
}

function onVoiceResult(text) {
    setListeningPose(false);
    if (!chatOpen) toggleChat();
    chatInput.value = text;
    sendBtn.disabled = false;
    handleSend();
}

function onVoiceStatus(status, msg) {
    if (status === "listening") {
        micBtn.classList.add("recording");
    } else {
        micBtn.classList.remove("recording");
        setListeningPose(false);
    }
    if (status === "error" && msg) {
        if (!chatOpen) toggleChat();
        addBotMessage(`⚠️ ${msg}`);
    }
}

// ── Camera / Emotion ─────────────────────────────────

async function openWebcam() {
    webcamOverlay.style.display = "flex";
    webcamEmojiEl.textContent = "🔍";
    webcamEmotionTextEl.textContent = "Loading...";
    const ok = await startEmotionDetection(webcamVideo, webcamCanvas, (emotion, emoji) => {
        if (emotion === "error") return;
        webcamEmojiEl.textContent = emoji;
        webcamEmotionTextEl.textContent = emotion;
    });
    if (!ok) { webcamEmotionTextEl.textContent = "Camera denied"; }
}

function captureEmotion() {
    currentEmotion = getCurrentEmotion();
    closeWebcam();
    setEmotion(currentEmotion);
    holoEmotionValue.textContent = `${getEmotionEmoji(currentEmotion)} ${cap(currentEmotion)}`;
    holoEmotion.style.display = "block";
    if (!chatOpen) toggleChat();
    const msg = `I can see you're feeling ${currentEmotion}. I'll adjust my responses accordingly.`;
    addBotMessage(`${getEmotionEmoji(currentEmotion)} ${msg}`);
    speak(msg, getLang(), { onStart: d => startLipSync(d), onEnd: () => stopLipSync() });
}

function closeWebcam() { stopEmotionDetection(); webcamOverlay.style.display = "none"; }

// ── Messages ─────────────────────────────────────────

function addUserMessage(text) {
    chatMessages.insertAdjacentHTML("beforeend", `
    <div class="message message--user">
        <div class="message__avatar">👤</div>
        <div><div class="message__bubble">${esc(text)}</div><div class="message__time">${time()}</div></div>
    </div>`);
    scrollBottom();
}

function addBotMessage(text) {
    chatMessages.insertAdjacentHTML("beforeend", `
    <div class="message message--bot">
        <div class="message__avatar">🤖</div>
        <div><div class="message__bubble">${esc(text)}</div><div class="message__time">${time()}</div></div>
    </div>`);
    scrollBottom();
}

function showTypingIndicator() {
    if (chatMessages.querySelector(".typing-indicator")) return;
    chatMessages.insertAdjacentHTML("beforeend", `
    <div class="typing-indicator">
        <div class="typing-indicator__avatar">🤖</div>
        <div class="typing-indicator__dots">
            <span class="typing-indicator__dot"></span>
            <span class="typing-indicator__dot"></span>
            <span class="typing-indicator__dot"></span>
        </div>
    </div>`);
    scrollBottom();
}

function removeTyping() {
    chatMessages.querySelector(".typing-indicator")?.remove();
}

function scrollBottom() { requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }); }
function time() { return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
function esc(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function apiCall(path, opts = {}) {
    const token = getToken();
    return fetch(path, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...opts.headers,
        },
    }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
    });
}

// ════════════════════════════════════════════════════
//  SERVICENOW
// ════════════════════════════════════════════════════

let snowOpen = false;
function toggleSnow() {
    snowOpen = !snowOpen;
    snowOverlay.style.display = snowOpen ? "flex" : "none";
    chatOverlay.style.display = "none"; chatOpen = false;
    waOverlay.style.display = "none";
    if (snowOpen) loadIncidents();
}
function closeSnow() { snowOpen = false; snowOverlay.style.display = "none"; }

async function createIncident() {
    const desc = document.getElementById("snowDesc").value.trim();
    if (!desc) { showSnowResult("Please enter a description.", true); return; }

    snowCreateBtn.disabled = true;
    snowCreateBtn.textContent = "Creating...";
    try {
        const data = await apiCall("/api/servicenow/incident", {
            method: "POST",
            body: JSON.stringify({
                shortDescription: desc,
                category: document.getElementById("snowCategory").value,
                priority: document.getElementById("snowPriority").value,
                description: document.getElementById("snowDetails").value,
                riskScore: 0,
                emotion: currentEmotion,
                callerName: getUser()?.name || "",
                callerEmail: getUser()?.email || "",
            }),
        });
        showSnowResult(`✅ ${data.ticketNumber} created — ${data.priority || "High"}`, false);
        document.getElementById("snowDesc").value = "";
        document.getElementById("snowDetails").value = "";
        loadIncidents();
    } catch (err) {
        showSnowResult(`❌ ${err.message}`, true);
    } finally {
        snowCreateBtn.disabled = false;
        snowCreateBtn.textContent = "🎫 Create Incident";
    }
}

async function loadIncidents() {
    try {
        const data = await apiCall("/api/servicenow/incidents");
        const incidents = data.incidents || [];
        if (!incidents.length) {
            snowIncidents.innerHTML = '<p class="snow-empty">No incidents yet.</p>';
            return;
        }
        snowIncidents.innerHTML = incidents.map(i => `
            <div class="snow-card">
                <div class="snow-card__header">
                    <span class="snow-card__number">${esc(i.number)}</span>
                    <span class="snow-card__priority snow-card__priority--${i.priority}">${esc(String(i.priority))}</span>
                </div>
                <div class="snow-card__desc">${esc(i.short_description)}</div>
                <div class="snow-card__meta">${i.category || ""} · ${i.state} · ${new Date(i.created_on).toLocaleString()}</div>
            </div>
        `).join("");
    } catch { snowIncidents.innerHTML = '<p class="snow-empty">Failed to load.</p>'; }
}

function showSnowResult(msg, isError) {
    snowResult.textContent = msg;
    snowResult.className = `snow-result ${isError ? "error" : "success"}`;
    setTimeout(() => { snowResult.textContent = ""; }, 5000);
}

// Auto-create incident on fraud detection
function checkForFraud(text) {
    const fraudKeywords = /fraud|scam|hack|hera|chori|चोरी|धोखा|फ्रॉड|फसवणूक|suspicious|unauthorized|stolen/i;
    if (fraudKeywords.test(text)) {
        apiCall("/api/servicenow/incident", {
            method: "POST",
            body: JSON.stringify({
                shortDescription: `Potential fraud reported via AI Chatbot`,
                category: "Financial Fraud",
                priority: "1",
                description: `Customer message: "${text}"\nEmotion: ${currentEmotion}`,
                riskScore: 75,
                emotion: currentEmotion,
                transcript: text,
                callerName: getUser()?.name || "",
                callerEmail: getUser()?.email || "",
            }),
        }).then(data => {
            addBotMessage(`🚨 A security incident (${data.ticketNumber}) has been auto-created and assigned to the Fraud Response Team. Your account is being monitored.`);
        }).catch(() => { });
    }
}

// ════════════════════════════════════════════════════
//  WHATSAPP
// ════════════════════════════════════════════════════

let waOpen = false;
function toggleWA() {
    waOpen = !waOpen;
    waOverlay.style.display = waOpen ? "flex" : "none";
    chatOverlay.style.display = "none"; chatOpen = false;
    snowOverlay.style.display = "none";
    if (waOpen) { loadWAStatus(); loadWALog(); }
}
function closeWA() { waOpen = false; waOverlay.style.display = "none"; }

async function loadWAStatus() {
    try {
        const data = await apiCall("/api/whatsapp/status");
        waStatusDot.className = `wa-status-dot ${data.configured ? "connected" : "disconnected"}`;
        waStatusTitle.textContent = data.configured ? "Connected" : "Not Configured";
        waStatusSub.textContent = data.configured
            ? `Phone: ${data.phoneId} · ${data.totalConversations} conversations · ${data.totalMessages} messages`
            : "Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID to .env";
    } catch {
        waStatusDot.className = "wa-status-dot disconnected";
        waStatusTitle.textContent = "Error";
        waStatusSub.textContent = "Could not check status";
    }
}

async function sendWhatsApp() {
    const phone = document.getElementById("waPhone").value.trim();
    const msg = document.getElementById("waMessage").value.trim();
    if (!phone || !msg) { showWAResult("Phone and message required.", true); return; }

    waSendBtn.disabled = true;
    waSendBtn.textContent = "Sending...";
    try {
        await apiCall("/api/whatsapp/send", {
            method: "POST",
            body: JSON.stringify({ to: phone, message: msg }),
        });
        showWAResult("✅ Message sent via WhatsApp!", false);
        document.getElementById("waMessage").value = "";
        loadWALog();
    } catch (err) {
        showWAResult(`❌ ${err.message}`, true);
    } finally {
        waSendBtn.disabled = false;
        waSendBtn.textContent = "📱 Send via WhatsApp";
    }
}

async function loadWALog() {
    try {
        const data = await apiCall("/api/whatsapp/log");
        const messages = data.messages || [];
        if (!messages.length) {
            waLog.innerHTML = '<p class="snow-empty">No messages yet.</p>';
            return;
        }
        waLog.innerHTML = messages.slice(-20).map(m => `
            <div class="wa-log-msg wa-log-msg--${m.direction}">
                <div class="wa-log-msg__from">${m.direction === "in" ? "📥 From: " + (m.from || "") : "📤 To: " + (m.to || "")}</div>
                <div class="wa-log-msg__text">${esc(m.text.substring(0, 200))}</div>
                <div class="wa-log-msg__time">${new Date(m.timestamp).toLocaleString()}</div>
            </div>
        `).join("");
    } catch { waLog.innerHTML = '<p class="snow-empty">Failed to load log.</p>'; }
}

function showWAResult(msg, isError) {
    waResult.textContent = msg;
    waResult.className = `snow-result ${isError ? "error" : "success"}`;
    setTimeout(() => { waResult.textContent = ""; }, 5000);
}
