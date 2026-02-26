// ============================================================
// Language Detection — English, Hindi, Marathi, Hinglish
// ============================================================

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

const MARATHI_MARKERS = [
    "कसे", "आहे", "काय", "माझ", "तुमच", "कृपया", "धन्यवाद", "नाही", "होय",
    "मला", "हवे", "हवा", "सांगा", "कधी", "केव्हा", "मिळेल", "झाले", "करा",
    "आम्ही", "तुम्ही", "पाहिजे", "असेल", "नको", "बोला", "समजत"
];

const HINDI_MARKERS = [
    "है", "हैं", "का", "की", "के", "में", "मेरा", "मेरी", "कहाँ", "कहां",
    "क्या", "कब", "कैसे", "कृपया", "धन्यवाद", "नहीं", "हाँ", "चाहिए",
    "बताइए", "बताओ", "मुझे", "आप", "यह", "वह", "कर", "करो", "दो",
    "मिलेगा", "हो", "रहा", "रही", "वाला", "वाली", "अभी", "जल्दी"
];

const HINGLISH_MARKERS = [
    "mera", "meri", "kaha", "kahan", "kab", "kaise", "kya", "hai", "hain",
    "nahi", "nahin", "haan", "ji", "bhai", "yaar", "chahiye", "batao",
    "bataiye", "aur", "ya", "mujhe", "aap", "apna", "apni",
    "kar", "karo", "do", "de", "mil", "milega", "ho", "raha", "rahi",
    "wala", "wali", "abhi", "jaldi", "theek", "accha", "sahi", "galat",
    "samajh", "samjha", "samjho", "dekho", "dekh", "suno"
];

/**
 * Detect the language of user text.
 * Returns: "hindi" | "marathi" | "hinglish" | "english"
 */
function detectLanguage(text) {
    if (!text || text.trim().length === 0) return "english";

    const hasDevanagari = DEVANAGARI_REGEX.test(text);

    if (hasDevanagari) {
        let marathiScore = 0;
        for (const marker of MARATHI_MARKERS) {
            if (text.includes(marker)) marathiScore++;
        }
        let hindiScore = 0;
        for (const marker of HINDI_MARKERS) {
            if (text.includes(marker)) hindiScore++;
        }
        if (marathiScore > hindiScore && marathiScore >= 1) return "marathi";
        return "hindi";
    }

    const words = text.toLowerCase().split(/\s+/);
    let hinglishCount = 0;
    for (const word of words) {
        const clean = word.replace(/[^a-z]/g, "");
        if (HINGLISH_MARKERS.includes(clean)) hinglishCount++;
    }
    if (words.length > 0 && hinglishCount / words.length >= 0.15) return "hinglish";
    if (hinglishCount >= 2) return "hinglish";

    return "english";
}

export { detectLanguage };
