// ============================================================
// Fraud Intelligence Engine — Real-time risk scoring
// ============================================================

const fraudState = {
    riskScore: 0,        // 0-100
    riskLevel: "low",    // low | medium | high
    otpAttempts: 0,
    namesProvided: [],
    phonesProvided: [],
    emailsProvided: [],
    suspiciousKeywordHits: 0,
    emotionFlags: 0,     // panic/fear/stress from face
    sessionTransactions: 0,
    totalAmountRequested: 0,
    flagged: false,
    history: [],         // log of risk events
};

// ── High risk keywords ──────────────────────────────────
const HIGH_RISK_KEYWORDS = [
    // English
    "transfer all", "send all money", "share otp", "give otp", "tell otp",
    "share password", "give password", "urgent transfer", "emergency transfer",
    "immediately transfer", "full amount", "entire balance", "wire everything",
    "all savings", "empty account", "withdraw all",
    // Hindi
    "सारे पैसे भेजो", "otp बताओ", "otp दो", "पासवर्ड बताओ", "तुरंत ट्रांसफर",
    "पूरा पैसा", "सब पैसे", "जल्दी भेजो", "खाता खाली",
    // Hinglish
    "saare paise bhejo", "otp batao", "otp do", "password batao", "turant transfer",
    "poora paisa", "sab paise", "jaldi bhejo", "khata khaali",
    // Marathi
    "सगळे पैसे पाठवा", "otp सांगा", "पासवर्ड सांगा", "तातडीने ट्रान्सफर",
];

const MEDIUM_RISK_KEYWORDS = [
    "otp", "transfer", "send money", "bhejo", "पैसे भेजो", "पाठवा",
    "change password", "change number", "change email", "update phone",
    "password change", "forgot password", "reset password",
    "नंबर बदलो", "पासवर्ड बदलो",
];

const PANIC_EMOTIONS = ["fearful", "angry", "surprised", "disgusted"];

/**
 * Analyze a user message for fraud risk factors.
 * Returns updated risk assessment.
 */
function analyzeMessage(text, faceEmotion = "neutral") {
    const lower = text.toLowerCase();
    let riskDelta = 0;
    const events = [];

    // ── Check high-risk keywords ──────────────────────────
    for (const kw of HIGH_RISK_KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) {
            riskDelta += 25;
            fraudState.suspiciousKeywordHits++;
            events.push({ type: "high_risk_keyword", detail: kw, score: 25 });
            break; // one hit is enough
        }
    }

    // ── Check medium-risk keywords ────────────────────────
    if (riskDelta === 0) {
        for (const kw of MEDIUM_RISK_KEYWORDS) {
            if (lower.includes(kw.toLowerCase())) {
                riskDelta += 8;
                events.push({ type: "medium_risk_keyword", detail: kw, score: 8 });
                break;
            }
        }
    }

    // ── OTP detection ─────────────────────────────────────
    if (/otp/i.test(lower) || /ओटीपी/.test(text)) {
        fraudState.otpAttempts++;
        if (fraudState.otpAttempts > 3) {
            riskDelta += 20;
            events.push({ type: "excessive_otp", detail: `${fraudState.otpAttempts} OTP attempts`, score: 20 });
        } else if (fraudState.otpAttempts > 1) {
            riskDelta += 5;
            events.push({ type: "otp_attempt", detail: `${fraudState.otpAttempts} attempts`, score: 5 });
        }
    }

    // ── Large transaction amounts ─────────────────────────
    const amountMatch = lower.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i) || lower.match(/([\d,]+)\s*(?:rupees|rs|₹)/i);
    if (amountMatch) {
        const amount = parseInt(amountMatch[1].replace(/,/g, ""));
        if (amount > 0) {
            fraudState.totalAmountRequested += amount;
            fraudState.sessionTransactions++;
            if (amount >= 100000) {
                riskDelta += 15;
                events.push({ type: "large_amount", detail: `₹${amount.toLocaleString("en-IN")}`, score: 15 });
            } else if (amount >= 50000) {
                riskDelta += 8;
                events.push({ type: "moderate_amount", detail: `₹${amount.toLocaleString("en-IN")}`, score: 8 });
            }
        }
    }

    // ── Rapid transaction requests ────────────────────────
    if (fraudState.sessionTransactions > 3) {
        riskDelta += 10;
        events.push({ type: "rapid_transactions", detail: `${fraudState.sessionTransactions} requests`, score: 10 });
    }

    // ── Emotion signals from face detection ───────────────
    if (PANIC_EMOTIONS.includes(faceEmotion)) {
        fraudState.emotionFlags++;
        if (fraudState.emotionFlags >= 2) {
            riskDelta += 10;
            events.push({ type: "stress_emotion", detail: faceEmotion, score: 10 });
        }
    }

    // ── Identity inconsistency ───────────────────────────
    const nameMatch = lower.match(/(?:my name is|i am|i'm|mera naam|माझे नाव|मेरा नाम)\s+(\w+)/i);
    if (nameMatch) {
        const name = nameMatch[1].toLowerCase();
        if (fraudState.namesProvided.length > 0 && !fraudState.namesProvided.includes(name)) {
            riskDelta += 20;
            events.push({ type: "identity_mismatch", detail: `New name: ${name}`, score: 20 });
        }
        if (!fraudState.namesProvided.includes(name)) fraudState.namesProvided.push(name);
    }

    // ── Update total risk score ───────────────────────────
    fraudState.riskScore = Math.min(100, fraudState.riskScore + riskDelta);

    // Determine risk level
    if (fraudState.riskScore >= 61) {
        fraudState.riskLevel = "high";
    } else if (fraudState.riskScore >= 31) {
        fraudState.riskLevel = "medium";
    } else {
        fraudState.riskLevel = "low";
    }

    // Log events
    if (events.length > 0) {
        fraudState.history.push(...events);
    }

    return {
        riskScore: fraudState.riskScore,
        riskLevel: fraudState.riskLevel,
        events: events,
        otpAttempts: fraudState.otpAttempts,
    };
}

/**
 * Get aura color based on risk level.
 */
function getAuraColor() {
    switch (fraudState.riskLevel) {
        case "high": return { color: "#ef4444", label: "High Risk", glow: "rgba(239,68,68,0.5)" };
        case "medium": return { color: "#f59e0b", label: "Suspicious", glow: "rgba(245,158,11,0.4)" };
        default: return { color: "#22c55e", label: "Secure", glow: "rgba(34,197,94,0.4)" };
    }
}

/**
 * Reset fraud state for new session.
 */
function resetFraudState() {
    fraudState.riskScore = 0;
    fraudState.riskLevel = "low";
    fraudState.otpAttempts = 0;
    fraudState.namesProvided = [];
    fraudState.phonesProvided = [];
    fraudState.emailsProvided = [];
    fraudState.suspiciousKeywordHits = 0;
    fraudState.emotionFlags = 0;
    fraudState.sessionTransactions = 0;
    fraudState.totalAmountRequested = 0;
    fraudState.flagged = false;
    fraudState.history = [];
}

function getFraudState() {
    return { ...fraudState };
}

export {
    fraudState,
    analyzeMessage,
    getAuraColor,
    resetFraudState,
    getFraudState,
};
