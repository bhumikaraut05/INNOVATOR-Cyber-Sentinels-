// ============================================================
// TTS Engine — Text-to-Speech for Avatar
// ============================================================

let ttsEnabled = true;
let currentUtterance = null;

const LANG_MAP = {
    "en-IN": "en-IN",
    "hi-IN": "hi-IN",
    "mr-IN": "mr-IN",
    english: "en-IN",
    hindi: "hi-IN",
    marathi: "mr-IN",
    hinglish: "hi-IN",
};

/**
 * Speak text using Web Speech Synthesis.
 * @param {string} text - Text to speak
 * @param {string} lang - Language code or name
 * @param {object} options - { onEnd, onStart, slow }
 */
function speak(text, lang = "en-IN", options = {}) {
    const { onEnd = null, onStart = null, slow = false } = (typeof options === "function") ? { onEnd: options } : (options || {});

    if (!ttsEnabled) {
        if (onEnd) onEnd();
        return;
    }
    if (!window.speechSynthesis) {
        console.warn("Speech synthesis not supported");
        if (onEnd) onEnd();
        return;
    }

    stop();

    const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .replace(/[━═─│┤├┼┬┴]/g, "")
        .replace(/\n+/g, ". ")
        .trim();

    if (!cleanText) {
        if (onEnd) onEnd();
        return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_MAP[lang] || "en-IN";
    utterance.rate = slow ? 0.75 : 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const targetLang = LANG_MAP[lang] || "en-IN";
    const matchingVoice = voices.find(v => v.lang === targetLang) ||
        voices.find(v => v.lang.startsWith(targetLang.split("-")[0]));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => {
        if (onStart) onStart(cleanText.length * 60); // rough duration in ms
    };

    utterance.onend = () => {
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    utterance.onerror = () => {
        currentUtterance = null;
        if (onEnd) onEnd();
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

/**
 * Stop current speech.
 */
function stop() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}

/**
 * Toggle TTS on/off.
 */
function toggleTTS() {
    ttsEnabled = !ttsEnabled;
    if (!ttsEnabled) stop();
    return ttsEnabled;
}

/**
 * Check if TTS is enabled.
 */
function isTTSEnabled() {
    return ttsEnabled;
}

/**
 * Check if currently speaking.
 */
function isSpeaking() {
    return window.speechSynthesis ? window.speechSynthesis.speaking : false;
}

// Preload voices
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

export { speak, stop, toggleTTS, isTTSEnabled, isSpeaking };
