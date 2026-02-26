// ============================================================
// Voice Module — Speech-to-Text + Text-to-Speech
// Multilingual: en-IN, hi-IN, mr-IN
// ============================================================

// ── Speech Recognition (STT) ─────────────────────────
let recognition = null;
let isListening = false;
let onResultCb = null;
let onStatusCb = null;

function initVoice(onResult, onStatus) {
    onResultCb = onResult;
    onStatusCb = onStatus;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        onStatus?.("error", "Speech recognition not supported. Use Chrome.");
        return false;
    }

    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        onResultCb?.(text);
    };
    recognition.onend = () => { isListening = false; onStatusCb?.("stopped"); };
    recognition.onerror = (e) => {
        isListening = false;
        let msg = "Voice error";
        if (e.error === "no-speech") msg = "No speech detected.";
        else if (e.error === "not-allowed") msg = "Microphone blocked.";
        onStatusCb?.("error", msg);
    };
    return true;
}

function startListening(lang = "en-IN") {
    if (!recognition || isListening) return;
    recognition.lang = lang;
    isListening = true;
    try {
        recognition.start();
        onStatusCb?.("listening");
    } catch {
        isListening = false;
        onStatusCb?.("error", "Could not start voice.");
    }
}

function stopListeningVoice() {
    if (recognition && isListening) {
        isListening = false;
        try { recognition.stop(); } catch { }
    }
}

function getIsListening() { return isListening; }

// ── Text-to-Speech (TTS) ─────────────────────────────
let ttsEnabled = true;

const LANG_MAP = {
    en: "en-IN", hi: "hi-IN", mr: "mr-IN",
    "en-IN": "en-IN", "hi-IN": "hi-IN", "mr-IN": "mr-IN",
};

function speak(text, lang = "en", { onStart, onEnd, slow } = {}) {
    if (!ttsEnabled || !window.speechSynthesis) {
        onEnd?.();
        return;
    }

    window.speechSynthesis.cancel();

    const clean = text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .replace(/\n+/g, ". ")
        .trim();

    if (!clean) { onEnd?.(); return; }

    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = LANG_MAP[lang] || "en-IN";
    utt.rate = slow ? 0.75 : 0.92;
    utt.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.lang === utt.lang) || voices.find(v => v.lang.startsWith(utt.lang.split("-")[0]));
    if (match) utt.voice = match;

    utt.onstart = () => onStart?.(clean.length * 55);
    utt.onend = () => onEnd?.();
    utt.onerror = () => onEnd?.();

    window.speechSynthesis.speak(utt);
}

function stopSpeaking() {
    window.speechSynthesis?.cancel();
}

function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    if (!ttsEnabled) stopSpeaking();
    return ttsEnabled;
}

function isTTSEnabled() { return ttsEnabled; }

// Preload voices
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export { initVoice, startListening, stopListeningVoice, getIsListening, speak, stopSpeaking, toggleTTS, isTTSEnabled };
