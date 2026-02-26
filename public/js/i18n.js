// ============================================================
// i18n — Multilingual translations (EN / HI / MR)
// ============================================================

const TRANSLATIONS = {
    en: {
        appName: "SecureBank AI",
        subtitle: "Your intelligent banking assistant",
        signIn: "Sign In",
        signUp: "Sign Up",
        email: "Email Address",
        password: "Password",
        name: "Full Name",
        phone: "Phone Number",
        gender: "Gender",
        male: "Male",
        female: "Female",
        neutral: "Prefer not to say",
        createAccount: "Create Account",
        signInBtn: "Sign In",
        orDivider: "or",
        googleLogin: "Continue with Google",
        otpLogin: "Login with OTP",
        sendOtp: "Send OTP",
        verifyOtp: "Verify OTP",
        enterOtp: "Enter 6-digit OTP",
        language: "Language",
        welcome: "Welcome! I'm your AI banking assistant. How may I help you today?",
        welcomeBack: "Hey {name} 👋 Welcome back. How can I assist you today?",
        typeMessage: "Type a message...",
        send: "Send",
        chat: "Chat",
        face: "Face",
        speak: "Speak",
        profile: "Profile",
        logout: "Logout",
        newSession: "New Session",
        tts: "Voice",
        secure: "Secure",
        detecting: "Detecting...",
        balance: "Balance",
        loan: "Loan",
        schemes: "Schemes",
        help: "Help",
        transfer: "Transfer",
        faceRecognition: "Face Recognition",
    },
    hi: {
        appName: "सिक्योरबैंक AI",
        subtitle: "आपका बुद्धिमान बैंकिंग सहायक",
        signIn: "लॉग इन",
        signUp: "साइन अप",
        email: "ईमेल",
        password: "पासवर्ड",
        name: "पूरा नाम",
        phone: "फ़ोन नंबर",
        gender: "लिंग",
        male: "पुरुष",
        female: "महिला",
        neutral: "नहीं बताना",
        createAccount: "खाता बनाएं",
        signInBtn: "लॉग इन करें",
        orDivider: "या",
        googleLogin: "Google से लॉग इन",
        otpLogin: "OTP से लॉग इन",
        sendOtp: "OTP भेजें",
        verifyOtp: "OTP सत्यापित करें",
        enterOtp: "6 अंकों का OTP दर्ज करें",
        language: "भाषा",
        welcome: "स्वागत है! मैं आपका AI बैंकिंग सहायक हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",
        welcomeBack: "नमस्ते {name} 👋 वापस आने पर स्वागत है। आज मैं आपकी कैसे मदद करूँ?",
        typeMessage: "संदेश लिखें...",
        send: "भेजें",
        chat: "चैट",
        face: "चेहरा",
        speak: "बोलें",
        profile: "प्रोफ़ाइल",
        logout: "लॉगआउट",
        newSession: "नया सत्र",
        tts: "आवाज़",
        secure: "सुरक्षित",
        detecting: "पहचान रहा है...",
        balance: "बैलेंस",
        loan: "लोन",
        schemes: "योजनाएं",
        help: "मदद",
        transfer: "ट्रांसफर",
        faceRecognition: "चेहरा पहचान",
    },
    mr: {
        appName: "सिक्योरबँक AI",
        subtitle: "तुमचा बुद्धिमान बँकिंग सहाय्यक",
        signIn: "लॉग इन",
        signUp: "साइन अप",
        email: "ईमेल",
        password: "पासवर्ड",
        name: "पूर्ण नाव",
        phone: "फोन नंबर",
        gender: "लिंग",
        male: "पुरुष",
        female: "स्त्री",
        neutral: "सांगू इच्छित नाही",
        createAccount: "खाते तयार करा",
        signInBtn: "लॉग इन करा",
        orDivider: "किंवा",
        googleLogin: "Google ने लॉग इन करा",
        otpLogin: "OTP ने लॉग इन करा",
        sendOtp: "OTP पाठवा",
        verifyOtp: "OTP सत्यापित करा",
        enterOtp: "६ अंकी OTP टाका",
        language: "भाषा",
        welcome: "स्वागत! मी तुमचा AI बँकिंग सहाय्यक आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
        welcomeBack: "नमस्कार {name} 👋 परत आल्याबद्दल स्वागत. आज मी तुम्हाला कशी मदत करू?",
        typeMessage: "संदेश लिहा...",
        send: "पाठवा",
        chat: "चॅट",
        face: "चेहरा",
        speak: "बोला",
        profile: "प्रोफाइल",
        logout: "लॉगआउट",
        newSession: "नवीन सत्र",
        tts: "आवाज",
        secure: "सुरक्षित",
        detecting: "शोधत आहे...",
        balance: "शिल्लक",
        loan: "कर्ज",
        schemes: "योजना",
        help: "मदत",
        transfer: "हस्तांतरण",
        faceRecognition: "चेहरा ओळख",
    },
};

let currentLang = "en";

function setLanguage(lang) {
    currentLang = TRANSLATIONS[lang] ? lang : "en";
    document.documentElement.lang = currentLang === "en" ? "en" : currentLang === "hi" ? "hi" : "mr";

    // Update all elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.dataset.i18n;
        if (TRANSLATIONS[currentLang][key]) {
            if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                el.placeholder = TRANSLATIONS[currentLang][key];
            } else {
                el.textContent = TRANSLATIONS[currentLang][key];
            }
        }
    });
}

function t(key, replacements = {}) {
    let text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.en[key] || key;
    for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

function getLang() { return currentLang; }

function getVoiceLang() {
    return { en: "en-IN", hi: "hi-IN", mr: "mr-IN" }[currentLang] || "en-IN";
}

export { setLanguage, t, getLang, getVoiceLang, TRANSLATIONS };
