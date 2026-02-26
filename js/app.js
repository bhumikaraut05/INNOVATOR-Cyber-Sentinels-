// ============================================================
// App Controller — Auth + Avatar + Chat + Voice + Fraud
// Mobile-first with slide-up chat overlay
// ============================================================

import { signUp, signIn, getCurrentUser, logout, isLoggedIn } from "./auth.js";
import { processMessage, getWelcomeMessage, resetContext, setElderly } from "./chatEngine.js";
import { initVoiceInput, startListening, stopListening, getIsListening } from "./voiceInput.js";
import { startFaceDetection, stopFaceDetection, getCurrentEmotion, getEmotionEmoji, getCurrentGender, getCurrentAge } from "./faceDetect.js";
import { initAvatar, switchAvatar, startLipSync, stopLipSync, setListening } from "./avatar.js";
import { getFraudState, resetFraudState, getAuraColor } from "./fraudEngine.js";
import { formatIncidentAlert, resetIncidents } from "./serviceNow.js";
import { speak, stop as stopTTS, toggleTTS, isTTSEnabled } from "./tts.js";

// ── DOM: Auth ────────────────────────────────────────────
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");
const signinError = document.getElementById("signinError");
const signupError = document.getElementById("signupError");
const faceLoginBtn = document.getElementById("faceLoginBtn");

// ── DOM: App ─────────────────────────────────────────────
const avatarCanvasWrapper = document.getElementById("avatarCanvasWrapper");
const avatarLoading = document.getElementById("avatarLoading");
const avatarAura = document.getElementById("avatarAura");
const riskBadge = document.getElementById("riskBadge");
const riskLabel = document.getElementById("riskLabel");

// Top bar
const profileBtn = document.getElementById("profileBtn");
const profileDropdown = document.getElementById("profileDropdown");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileInitial = document.getElementById("profileInitial");

// Bottom bar
const micBtn = document.getElementById("micBtn");
const cameraBtn = document.getElementById("cameraBtn");
const chatToggleBtn = document.getElementById("chatToggleBtn");

// Chat overlay
const chatOverlay = document.getElementById("chatOverlay");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const langSelect = document.getElementById("langSelect");
const quickActions = document.getElementById("quickActions");

// Profile menu
const ttsToggle = document.getElementById("ttsToggle");
const ttsIcon = document.getElementById("ttsIcon");
const ttsLabel = document.getElementById("ttsLabel");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Holo panels
const holoEmotion = document.getElementById("holoEmotion");
const holoEmotionValue = document.getElementById("holoEmotionValue");
const holoFraud = document.getElementById("holoFraud");
const holoFraudValue = document.getElementById("holoFraudValue");

// SN Alert
const snAlertPanel = document.getElementById("snAlertPanel");
const snAlertBody = document.getElementById("snAlertBody");
const snAlertClose = document.getElementById("snAlertClose");

// Webcam
const webcamOverlay = document.getElementById("webcamOverlay");
const webcamCloseBtn = document.getElementById("webcamCloseBtn");
const webcamVideo = document.getElementById("webcamVideo");
const webcamCanvas = document.getElementById("webcamCanvas");
const webcamCaptureBtn = document.getElementById("webcamCaptureBtn");
const webcamEmojiEl = document.getElementById("webcamEmoji");
const webcamEmotionTextEl = document.getElementById("webcamEmotionText");

// ── State ────────────────────────────────────────────────
let isProcessing = false;
let currentFaceEmotion = "neutral";
let avatarSwitched = false;
let chatOpen = false;

// ================================================================
// AUTH FLOW
// ================================================================

function initAuth() {
    // Check if already logged in
    if (isLoggedIn()) {
        launchApp(getCurrentUser());
        return;
    }

    // Tab switching
    tabSignIn.addEventListener("click", () => switchTab("signin"));
    tabSignUp.addEventListener("click", () => switchTab("signup"));

    // Sign In
    signinForm.addEventListener("submit", (e) => {
        e.preventDefault();
        signinError.textContent = "";
        const id = document.getElementById("siIdentifier").value;
        const pw = document.getElementById("siPassword").value;
        const result = signIn(id, pw);
        if (result.success) {
            launchApp(result.user);
        } else {
            signinError.textContent = result.error;
        }
    });

    // Sign Up
    signupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        signupError.textContent = "";
        const result = signUp({
            name: document.getElementById("suName").value,
            phone: document.getElementById("suPhone").value,
            email: document.getElementById("suEmail").value,
            gender: document.getElementById("suGender").value,
            password: document.getElementById("suPassword").value,
        });
        if (result.success) {
            launchApp(result.user);
        } else {
            signupError.textContent = result.error;
        }
    });

    // Face login
    faceLoginBtn.addEventListener("click", () => {
        openWebcamForLogin();
    });
}

function switchTab(tab) {
    if (tab === "signin") {
        tabSignIn.classList.add("auth-tab--active");
        tabSignUp.classList.remove("auth-tab--active");
        signinForm.style.display = "";
        signupForm.style.display = "none";
    } else {
        tabSignUp.classList.add("auth-tab--active");
        tabSignIn.classList.remove("auth-tab--active");
        signupForm.style.display = "";
        signinForm.style.display = "none";
    }
}

function openWebcamForLogin() {
    webcamOverlay.style.display = "flex";
    webcamEmojiEl.textContent = "🔍";
    webcamEmotionTextEl.textContent = "Looking for your face...";

    startFaceDetection(webcamVideo, webcamCanvas, (emotion, emoji, gender, age) => {
        if (emotion === "error") return;
        webcamEmojiEl.textContent = emoji;
        webcamEmotionTextEl.textContent = "Face detected! Tap capture to continue.";
    });
}

// ================================================================
// LAUNCH APP (after auth)
// ================================================================

async function launchApp(user) {
    authScreen.style.display = "none";
    appScreen.style.display = "flex";

    // Profile
    const initial = user.name ? user.name.charAt(0).toUpperCase() : "👤";
    profileInitial.textContent = initial;
    profileName.textContent = user.name || "User";
    profileEmail.textContent = user.email || "";

    // Load avatar based on user gender
    try {
        await initAvatar(avatarCanvasWrapper, () => {
            avatarLoading.style.display = "none";
        });
        // Switch based on gender from CRM
        if (user.gender) {
            switchAvatar(user.gender);
            avatarSwitched = true;
        }
    } catch (e) {
        avatarLoading.innerHTML = "<span>Avatar ready</span>";
        setTimeout(() => { avatarLoading.style.display = "none"; }, 1000);
    }

    // Personalized greeting
    let greeting;
    if (user.isNew) {
        greeting = "Welcome! 🎉 I'm your AI banking assistant. How may I help you today?";
    } else {
        greeting = `Hey ${user.name} 👋 Welcome back. How can I assist you today?`;
    }

    // Speak greeting
    speak(greeting, "en-IN", {
        onStart: (dur) => startLipSync(dur),
        onEnd: () => stopLipSync(),
    });

    // Add to chat (open chat briefly to show greeting)
    addBotMessage(greeting, false);

    // Init voice
    const voiceOk = initVoiceInput(onVoiceResult, onVoiceStatus);
    if (!voiceOk) {
        micBtn.style.opacity = "0.3";
        micBtn.style.cursor = "not-allowed";
    }

    // Wire events
    wireAppEvents();
}

// ================================================================
// APP EVENT WIRING
// ================================================================

function wireAppEvents() {
    // Chat toggle
    chatToggleBtn.addEventListener("click", toggleChat);
    chatCloseBtn.addEventListener("click", closeChat);

    // Send
    sendBtn.addEventListener("click", handleSend);
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    chatInput.addEventListener("input", () => {
        autoResize();
        sendBtn.disabled = chatInput.value.trim().length === 0;
    });

    // Mic
    micBtn.addEventListener("click", handleMic);

    // Camera
    cameraBtn.addEventListener("click", openWebcamDetect);
    webcamCloseBtn.addEventListener("click", closeWebcam);
    webcamCaptureBtn.addEventListener("click", captureEmotion);
    webcamOverlay.addEventListener("click", (e) => { if (e.target === webcamOverlay) closeWebcam(); });

    // Profile
    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        profileDropdown.style.display = profileDropdown.style.display === "none" ? "block" : "none";
    });
    document.addEventListener("click", () => { profileDropdown.style.display = "none"; });

    // TTS toggle
    ttsToggle.addEventListener("click", handleTTSToggle);

    // Reset
    resetBtn.addEventListener("click", handleReset);

    // Logout
    logoutBtn.addEventListener("click", () => {
        logout();
        location.reload();
    });

    // SN alert close
    snAlertClose.addEventListener("click", () => { snAlertPanel.style.display = "none"; });

    // Quick actions
    quickActions.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (chip) {
            chatInput.value = chip.dataset.msg;
            sendBtn.disabled = false;
            handleSend();
        }
    });
}

// ── Chat Toggle ──────────────────────────────────────────
function toggleChat() {
    chatOpen = !chatOpen;
    chatOverlay.style.display = chatOpen ? "flex" : "none";
    if (chatOpen) {
        scrollToBottom();
        chatInput.focus();
    }
}
function closeChat() {
    chatOpen = false;
    chatOverlay.style.display = "none";
}

// ── Handle Send ──────────────────────────────────────────
async function handleSend() {
    const text = chatInput.value.trim();
    if (!text || isProcessing) return;

    isProcessing = true;
    sendBtn.disabled = true;

    addUserMessage(text);
    chatInput.value = "";
    autoResize();

    if (quickActions.style.display !== "none") quickActions.style.display = "none";

    const typingEl = showTypingIndicator();
    scrollToBottom();

    await sleep(400 + Math.random() * 600);

    const result = processMessage(text, currentFaceEmotion);

    typingEl.remove();
    addBotMessage(result.text);
    scrollToBottom();

    // Update UI
    updateRiskUI(result.riskLevel, result.aura);
    updateHoloPanels(result);

    if (result.incident) showServiceNowAlert(result.incident);

    // TTS + lip-sync + head nods
    speak(result.text, langSelect.value, {
        slow: result.speakSlow || false,
        onStart: (dur) => startLipSync(dur),
        onEnd: () => stopLipSync(),
    });

    isProcessing = false;
    sendBtn.disabled = chatInput.value.trim().length === 0;
}

// ── Mic ──────────────────────────────────────────────────
function handleMic() {
    if (getIsListening()) {
        stopListening();
        setListening(false);
    } else {
        // Open chat if not open
        if (!chatOpen) toggleChat();
        startListening(langSelect.value);
        setListening(true);
    }
}

function onVoiceResult(transcript) {
    setListening(false);
    if (!chatOpen) toggleChat();
    chatInput.value = transcript;
    sendBtn.disabled = false;
    autoResize();
    handleSend();
}

function onVoiceStatus(status, message) {
    if (status === "listening") {
        micBtn.classList.add("recording");
    } else {
        micBtn.classList.remove("recording");
        setListening(false);
    }
    if (status === "error" && message) {
        if (!chatOpen) toggleChat();
        addBotMessage(`⚠️ ${message}`);
    }
}

// ── Camera (emotion detect) ──────────────────────────────
async function openWebcamDetect() {
    webcamOverlay.style.display = "flex";
    webcamEmojiEl.textContent = "🔍";
    webcamEmotionTextEl.textContent = "Loading models...";

    const ok = await startFaceDetection(webcamVideo, webcamCanvas, onFaceData);
    if (!ok) {
        webcamEmotionTextEl.textContent = "Camera denied";
        webcamEmojiEl.textContent = "❌";
    } else {
        webcamEmotionTextEl.textContent = "Detecting face...";
    }
}

function onFaceData(emotion, emoji, gender, age) {
    if (emotion === "error") return;
    webcamEmojiEl.textContent = emoji;
    webcamEmotionTextEl.textContent = emotion;

    // Gender-based avatar (once)
    if (gender && !avatarSwitched) {
        avatarSwitched = true;
        switchAvatar(gender);
    }

    if (age && age > 55) setElderly(true);
}

function captureEmotion() {
    currentFaceEmotion = getCurrentEmotion();
    closeWebcam();

    if (holoEmotionValue) {
        holoEmotionValue.textContent = `${getEmotionEmoji(currentFaceEmotion)} ${capitalize(currentFaceEmotion)}`;
        holoEmotion.style.display = "block";
    }

    // Speak the emotion detection
    const msg = `I can see you're feeling ${currentFaceEmotion}. I'll adjust my responses accordingly.`;
    speak(msg, "en-IN", {
        onStart: (d) => startLipSync(d),
        onEnd: () => stopLipSync(),
    });

    if (!chatOpen) toggleChat();
    addBotMessage(`${getEmotionEmoji(currentFaceEmotion)} ${msg}`);
}

function closeWebcam() {
    stopFaceDetection();
    webcamOverlay.style.display = "none";
}

// ── Holo Panels ──────────────────────────────────────────
function updateHoloPanels(result) {
    if (holoEmotionValue && currentFaceEmotion !== "neutral") {
        holoEmotionValue.textContent = `${getEmotionEmoji(currentFaceEmotion)} ${capitalize(currentFaceEmotion)}`;
        holoEmotion.style.display = "block";
    }

    if (holoFraudValue) {
        const fraud = getFraudState();
        const label = result.riskLevel === "high" ? "🔴 HIGH" : result.riskLevel === "medium" ? "🟡 MEDIUM" : "🟢 LOW";
        holoFraudValue.textContent = `${label} — ${fraud.riskScore}/100`;
        holoFraud.style.display = "block";
    }
}

// ── Risk UI ──────────────────────────────────────────────
function updateRiskUI(riskLevel, aura) {
    riskBadge.className = "risk-badge" + (riskLevel !== "low" ? " " + riskLevel : "");
    riskLabel.textContent = aura.label;
    avatarAura.className = "avatar-aura" + (riskLevel !== "low" ? " " + riskLevel : "");
}

// ── ServiceNow Alert ─────────────────────────────────────
function showServiceNowAlert(incident) {
    snAlertBody.innerHTML = `
    <div class="sn-row"><span class="sn-key">Incident</span><span class="sn-val danger">${incident.id}</span></div>
    <div class="sn-row"><span class="sn-key">Priority</span><span class="sn-val danger">${incident.priority}</span></div>
    <div class="sn-row"><span class="sn-key">Category</span><span class="sn-val">${incident.category}</span></div>
    <div class="sn-row"><span class="sn-key">Assignment</span><span class="sn-val">${incident.assignmentGroup}</span></div>
    <div class="sn-row"><span class="sn-key">Risk</span><span class="sn-val danger">${incident.riskScore}/100</span></div>
    <div class="sn-row"><span class="sn-key">SLA</span><span class="sn-val">2 hours</span></div>
  `;
    snAlertPanel.style.display = "block";
}

// ── TTS ──────────────────────────────────────────────────
function handleTTSToggle() {
    const enabled = toggleTTS();
    ttsIcon.textContent = enabled ? "🔊" : "🔇";
    ttsLabel.textContent = enabled ? "On" : "Off";
    if (!enabled) stopLipSync();
}

// ── Reset ────────────────────────────────────────────────
function handleReset() {
    chatMessages.innerHTML = "";
    resetContext();
    resetFraudState();
    resetIncidents();
    stopTTS();
    stopLipSync();
    snAlertPanel.style.display = "none";
    quickActions.style.display = "flex";
    currentFaceEmotion = "neutral";
    holoEmotion.style.display = "none";
    holoFraud.style.display = "none";
    updateRiskUI("low", getAuraColor());

    const user = getCurrentUser();
    const greeting = user ? `Hey ${user.name} 👋 How can I help you?` : getWelcomeMessage();
    addBotMessage(greeting, false);
    profileDropdown.style.display = "none";
}

// ── Messages ─────────────────────────────────────────────
function addUserMessage(text) {
    const el = document.createElement("div");
    el.className = "message message--user";
    el.innerHTML = `
    <div class="message__avatar">👤</div>
    <div>
      <div class="message__bubble">${escapeHtml(text)}</div>
      <div class="message__time">${getTime()}</div>
    </div>`;
    chatMessages.appendChild(el);
    scrollToBottom();
}

function addBotMessage(text, animate = true) {
    const el = document.createElement("div");
    el.className = "message message--bot";
    el.innerHTML = `
    <div class="message__avatar">🤖</div>
    <div>
      <div class="message__bubble">${escapeHtml(text)}</div>
      <div class="message__time">${getTime()}</div>
    </div>`;
    if (!animate) el.style.animation = "none";
    chatMessages.appendChild(el);
    scrollToBottom();
}

function showTypingIndicator() {
    const el = document.createElement("div");
    el.className = "typing-indicator";
    el.innerHTML = `
    <div class="typing-indicator__avatar">🤖</div>
    <div class="typing-indicator__dots">
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
    </div>`;
    chatMessages.appendChild(el);
    return el;
}

// ── Utils ────────────────────────────────────────────────
function scrollToBottom() { requestAnimationFrame(() => { chatMessages.scrollTop = chatMessages.scrollHeight; }); }
function autoResize() { chatInput.style.height = "auto"; chatInput.style.height = Math.min(chatInput.scrollHeight, 80) + "px"; }
function getTime() { return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
function escapeHtml(t) { const d = document.createElement("div"); d.textContent = t; return d.innerHTML; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── Launch ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initAuth);
