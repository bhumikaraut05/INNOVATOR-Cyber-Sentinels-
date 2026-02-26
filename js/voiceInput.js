// ============================================================
// Voice Input — Web Speech API
// ============================================================

let recognition = null;
let isListening = false;
let onResultCallback = null;
let onStatusCallback = null;

/**
 * Initialize speech recognition.
 * @param {function} onResult - Called with (transcribedText, lang)
 * @param {function} onStatus - Called with ("listening" | "stopped" | "error", message)
 */
function initVoiceInput(onResult, onStatus) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        if (onStatus) onStatus("error", "Speech recognition not supported in this browser. Try Chrome.");
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    onResultCallback = onResult;
    onStatusCallback = onStatus;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (onResultCallback) onResultCallback(transcript);
    };

    recognition.onend = () => {
        isListening = false;
        if (onStatusCallback) onStatusCallback("stopped", "");
    };

    recognition.onerror = (event) => {
        isListening = false;
        let msg = "Voice recognition error";
        if (event.error === "no-speech") msg = "No speech detected. Try again.";
        else if (event.error === "not-allowed") msg = "Microphone access denied. Please allow microphone.";
        else if (event.error === "network") msg = "Network error. Check your connection.";
        if (onStatusCallback) onStatusCallback("error", msg);
    };

    return true;
}

/**
 * Start listening.
 * @param {string} lang - BCP-47 language code: "en-IN", "hi-IN", "mr-IN"
 */
function startListening(lang = "en-IN") {
    if (!recognition) return;
    if (isListening) {
        stopListening();
        return;
    }

    recognition.lang = lang;
    isListening = true;

    try {
        recognition.start();
        if (onStatusCallback) onStatusCallback("listening", "");
    } catch (e) {
        isListening = false;
        if (onStatusCallback) onStatusCallback("error", "Could not start voice recognition.");
    }
}

/**
 * Stop listening.
 */
function stopListening() {
    if (!recognition) return;
    isListening = false;
    try {
        recognition.stop();
    } catch (e) {
        // Already stopped
    }
}

/**
 * Check if currently listening.
 */
function getIsListening() {
    return isListening;
}

export { initVoiceInput, startListening, stopListening, getIsListening };
