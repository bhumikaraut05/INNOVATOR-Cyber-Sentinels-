// Chat Routes — OpenAI GPT integration with session memory
const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const Session = require("../models/Session");

const SYSTEM_PROMPT = `You are a professional, warm, and multilingual Indian banking assistant AI.
You help customers with: account balance, EMI, loans, government schemes, KYC, complaints, fraud reporting.
Rules:
- If the user writes in Hindi, respond in Hindi. If Marathi, respond in Marathi. Otherwise English.
- Never say "Press 1" or use menu-based responses.
- Speak like a professional Indian banking officer.
- Keep replies short and helpful.
- End politely.
- If fraud is suspected, respond carefully and reassuringly.
- Never expose backend systems or technical details.`;

// ── REST endpoint (non-streaming) ────────────────────
router.post("/message", authMiddleware, async (req, res) => {
    try {
        const { message, sessionId, language, emotion } = req.body;
        if (!message) return res.status(400).json({ error: "Message required." });

        // Get or create session
        let session;
        if (sessionId) {
            session = await Session.findById(sessionId).catch(() => null);
        }
        if (!session) {
            session = await Session.create({
                userId: req.user.id,
                messages: [{ role: "system", content: SYSTEM_PROMPT }],
                metadata: { language: language || "en" },
            });
        }

        // Add user message
        session.messages.push({ role: "user", content: message, language, emotion });

        // Get AI response
        const reply = await callOpenAI(session.messages.map(m => ({ role: m.role, content: m.content })));

        // Save assistant reply
        session.messages.push({ role: "assistant", content: reply });
        await session.save();

        res.json({ reply, sessionId: session._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── OpenAI Call ──────────────────────────────────────
async function callOpenAI(messages) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-your")) {
        // Fallback: simulated response when no API key
        return simulateResponse(messages[messages.length - 1]?.content || "");
    }

    try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            max_tokens: 500,
            temperature: 0.7,
        });
        return completion.choices[0]?.message?.content || "I'm sorry, I couldn't process that.";
    } catch (err) {
        console.error("OpenAI error:", err.message);
        return simulateResponse(messages[messages.length - 1]?.content || "");
    }
}

// ── Simulated Response (when no API key) ─────────────
function simulateResponse(input) {
    const lang = detectLang(input);
    const lower = input.toLowerCase();

    const R = {
        en: {
            balance: "Your account balance is ₹1,85,420 in Savings and ₹52,300 in Current account. Would you like to see recent transactions?",
            loan: "Your Home Loan EMI of ₹18,500 is due on March 5th. Your Agriculture Loan balance is ₹3,20,000. Would you like details on repayment options?",
            transfer: "I can help you transfer funds. For security, please verify your identity. Which account would you like to transfer from?",
            fraud: "I take fraud very seriously. I have alerted our security team to protect your account. Please do not share your OTP, password, or PIN with anyone. Your account is being monitored.",
            scheme: "We support PM Kisan Samman, Mudra Yojana, Jan Dhan, and Atal Pension. Which scheme would you like to know about?",
            kyc: "For KYC update, you need Aadhaar and PAN. You can submit them at the nearest branch or upload through our app.",
            complaint: "I'm sorry to hear that. Let me register a complaint for you. Can you describe the issue so I can route it to the right team?",
            hello: "Hello! 🏦 Welcome to SecureBank. I'm here to help with your banking needs — balance, loans, transfers, KYC, complaints, and more. What can I assist you with?",
            help: "I can help with: account balance, fund transfers, loans/EMI, government schemes, KYC updates, complaints, and fraud reporting. Just ask!",
            fallback: "Thank you for reaching out. I'm here to help with any banking query. Could you please tell me more about what you need?",
        },
        hi: {
            balance: "आपका खाता शेष ₹1,85,420 बचत खाते में और ₹52,300 चालू खाते में है। क्या आप हाल के लेनदेन देखना चाहेंगे?",
            loan: "आपकी होम लोन EMI ₹18,500 5 मार्च को देय है। कृषि ऋण शेष ₹3,20,000 है। क्या आप पुनर्भुगतान विकल्प जानना चाहेंगे?",
            transfer: "मैं आपकी फंड ट्रांसफर में मदद कर सकता हूँ। सुरक्षा के लिए, कृपया अपनी पहचान सत्यापित करें। किस खाते से ट्रांसफर करना है?",
            fraud: "मैं आपकी सुरक्षा को बहुत गंभीरता से लेता हूँ। मैंने आपके खाते की सुरक्षा के लिए हमारी सुरक्षा टीम को सूचित कर दिया है। कृपया अपना OTP, पासवर्ड या PIN किसी के साथ साझा न करें।",
            scheme: "हम PM किसान सम्मान, मुद्रा योजना, जन धन और अटल पेंशन का समर्थन करते हैं। आप किस योजना के बारे में जानना चाहेंगे?",
            kyc: "KYC अपडेट के लिए आपको आधार और PAN कार्ड चाहिए। आप निकटतम शाखा में जमा कर सकते हैं या हमारे ऐप से अपलोड कर सकते हैं।",
            complaint: "मुझे यह सुनकर दुख हुआ। मैं आपकी शिकायत दर्ज करता हूँ। कृपया समस्या का विवरण दें ताकि मैं सही टीम को भेज सकूँ।",
            hello: "नमस्ते! 🏦 सिक्योरबैंक में स्वागत है। मैं आपकी बैंकिंग जरूरतों में मदद के लिए यहाँ हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?",
            help: "मैं इनमें मदद कर सकता हूँ: खाता शेष, फंड ट्रांसफर, लोन/EMI, सरकारी योजनाएं, KYC, शिकायत और धोखाधड़ी रिपोर्टिंग। बस पूछें!",
            fallback: "संपर्क करने के लिए धन्यवाद। मैं किसी भी बैंकिंग प्रश्न में मदद के लिए यहाँ हूँ। कृपया बताएं कि आपको क्या जानकारी चाहिए?",
        },
        mr: {
            balance: "तुमच्या खात्यात बचत खात्यात ₹1,85,420 आणि चालू खात्यात ₹52,300 शिल्लक आहे. अलीकडील व्यवहार पहायचे आहेत का?",
            loan: "तुमच्या होम लोनची EMI ₹18,500 ही 5 मार्चला देय आहे. कृषी कर्ज शिल्लक ₹3,20,000 आहे. परतफेड पर्याय जाणून घ्यायचे का?",
            transfer: "मी तुम्हाला फंड ट्रान्सफरमध्ये मदत करू शकतो. सुरक्षिततेसाठी, कृपया तुमची ओळख सत्यापित करा. कोणत्या खात्यातून ट्रान्सफर करायचा?",
            fraud: "मी तुमच्या सुरक्षिततेबाबत अत्यंत गंभीर आहे. मी तुमच्या खात्याच्या संरक्षणासाठी आमच्या सुरक्षा टीमला सूचित केले आहे. कृपया तुमचा OTP, पासवर्ड किंवा PIN कोणालाही देऊ नका. तुमचे खाते सुरक्षित आहे.",
            scheme: "आम्ही PM किसान सन्मान, मुद्रा योजना, जन धन आणि अटल पेंशनला समर्थन देतो. तुम्हाला कोणत्या योजनेबद्दल माहिती हवी?",
            kyc: "KYC अपडेटसाठी तुम्हाला आधार आणि PAN लागेल. तुम्ही जवळच्या शाखेत जमा करू शकता किंवा आमच्या ऐपवरून अपलोड करू शकता.",
            complaint: "हे ऐकून वाईट वाटले. मी तुमची तक्रार नोंदवतो. कृपया समस्या सांगा म्हणजे मी योग्य टीमकडे पाठवू शकेन.",
            hello: "नमस्कार! 🏦 सिक्योरबँकमध्ये स्वागत. मी तुमच्या बँकिंग गरजांसाठी येथे आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
            help: "मी यात मदत करू शकतो: खाते शिल्लक, फंड ट्रान्सफर, कर्ज/EMI, सरकारी योजना, KYC, तक्रार आणि फसवणूक रिपोर्टिंग. विचारा!",
            fallback: "संपर्क केल्याबद्दल धन्यवाद. मी कोणत्याही बँकिंग प्रश्नात मदतीसाठी येथे आहे. कृपया तुम्हाला काय हवे ते सांगा.",
        },
    };

    const r = R[lang] || R.en;

    if (/balance|balanc|शेष|शिल्लक|बैलेंस|बॅलन्स|khata|khate/.test(lower)) return r.balance;
    if (/loan|emi|कर्ज|कर्ज|ऋण|लोन|karj/.test(lower)) return r.loan;
    if (/transfer|send|भेज|पाठव|ट्रांसफर|ट्रान्सफर|paisa|paise/.test(lower)) return r.transfer;
    if (/fraud|scam|hack|धोखा|फ्रॉड|फसवणूक|hera|chori|चोरी|hack/.test(lower)) return r.fraud;
    if (/scheme|government|sarkari|योजना|सरकार|सरकारी|yojana/.test(lower)) return r.scheme;
    if (/kyc|document|आधार|aadhaar|pan|दस्तावेज|कागदपत्र/.test(lower)) return r.kyc;
    if (/complaint|problem|issue|समस्या|शिकायत|तक्रार|problem|takrar/.test(lower)) return r.complaint;
    if (/hello|hi|hey|namaste|नमस्ते|नमस्कार|namaskar/.test(lower)) return r.hello;
    if (/help|मदद|मदत|sahayata|madad/.test(lower)) return r.help;
    return r.fallback;
}

function detectLang(text) {
    const DEVANAGARI = /[\u0900-\u097F]/;
    if (!DEVANAGARI.test(text)) {
        // Check Hinglish
        const hinglish = /\b(mera|meri|kaha|kaise|kya|hai|nahi|chahiye|batao|aap|karo|haan|ji|yaar|bhai|paisa|khata)\b/i;
        if (hinglish.test(text)) return "hi";
        return "en";
    }
    // Marathi markers
    const MR = ["आहे", "काय", "माझ", "तुमच", "कसे", "हवे", "सांगा", "केव्हा", "करा", "आम्ही", "तुम्ही", "पाहिजे", "नको", "झाले", "आले"];
    let mrScore = 0;
    for (const m of MR) { if (text.includes(m)) mrScore++; }
    if (mrScore >= 1) return "mr";
    return "hi";
}

// ── Export for WebSocket ─────────────────────────────
module.exports = router;
module.exports.callOpenAI = callOpenAI;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
