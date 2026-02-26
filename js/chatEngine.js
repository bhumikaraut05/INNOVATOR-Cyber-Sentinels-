// ============================================================
// Banking Chat Engine — Fraud-aware multilingual assistant
// Enhanced with emotion intelligence, new intents, WhatsApp sim
// ============================================================

import { detectLanguage } from "./langDetect.js";
import { analyzeMessage, getAuraColor, getFraudState } from "./fraudEngine.js";
import { createIncident, formatIncidentAlert } from "./serviceNow.js";

// ── Context ──────────────────────────────────────────────
const context = {
    history: [],
    language: "english",
    faceEmotion: "neutral",
    messageCount: 0,
    customerId: "CUST-10042",
    customerName: "Customer",
    verified: false,
    awaitingVerification: false,
    lastRiskLevel: "low",
    incidentCreated: false,
    isElderly: false,
};

// ── Simulated Banking Data ───────────────────────────────
const BANK_DATA = {
    accounts: {
        savings: { number: "XXXX-XXXX-4523", balance: 185420, type: "Savings" },
        current: { number: "XXXX-XXXX-7891", balance: 52300, type: "Current" },
    },
    recentTransactions: [
        { date: "2026-02-25", desc: "Amazon India", amount: -2499, type: "Debit" },
        { date: "2026-02-24", desc: "Salary Credit", amount: 65000, type: "Credit" },
        { date: "2026-02-23", desc: "Electricity Bill", amount: -1850, type: "Debit" },
        { date: "2026-02-22", desc: "UPI - Swiggy", amount: -450, type: "Debit" },
        { date: "2026-02-21", desc: "ATM Withdrawal", amount: -5000, type: "Debit" },
    ],
    cards: [
        { type: "Debit Card", number: "XXXX-XXXX-XXXX-7823", status: "Active" },
        { type: "Credit Card", number: "XXXX-XXXX-XXXX-3456", status: "Active", limit: 200000, used: 34500 },
    ],
    loans: [
        { type: "Home Loan", amount: 3500000, emi: 28500, remaining: 2100000, status: "Active" },
        { type: "Agriculture Loan", amount: 500000, emi: 8500, remaining: 320000, status: "Active" },
        { type: "Personal Loan", amount: 200000, emi: 6800, remaining: 85000, status: "Active" },
    ],
};

// ── Intent Detection ─────────────────────────────────────
const INTENTS = {
    greeting: [/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)\b/i, /^(नमस्ते|नमस्कार|हैलो)/, /^(namaste|namaskar)/i],
    farewell: [/\b(bye|goodbye|take care|good night)\b/i, /\b(अलविदा|बाय)\b/, /\b(alvida|bye)\b/i],
    balance: [/\b(balance|account\s*balance|how much|kitna|balance\s*check)\b/i, /\b(बैलेंस|खाता|कितना पैसा|शिल्लक)\b/, /\b(balance|kitna paisa|khata)\b/i],
    transfer: [/\b(transfer|send\s*money|bhej|payment|pay\s+to)\b/i, /\b(ट्रांसफर|पैसे भेजो|भेजना|पाठवा)\b/, /\b(transfer|paise bhejo|bhejdo)\b/i],
    transactions: [/\b(transaction|statement|history|recent|passbook)\b/i, /\b(लेनदेन|स्टेटमेंट|हिस्ट्री)\b/, /\b(transaction|statement|history)\b/i],
    card_block: [/\b(block\s*card|card\s*block|lost\s*card|stolen\s*card|freeze\s*card)\b/i, /\b(कार्ड\s*ब्लॉक|कार्ड\s*खो गया|कार्ड\s*चोरी)\b/],
    loan: [/\b(loan|emi|home\s*loan|personal\s*loan|agriculture\s*loan|loan\s*status|karz)\b/i, /\b(लोन|ईएमआई|कर्ज|कर्जा)\b/],
    otp: [/\b(otp|one\s*time|verification\s*code)\b/i, /\b(ओटीपी)\b/],
    help: [/\b(help|what\s*can\s*you|features|kya kar sakte)\b/i, /\b(मदद|सहायता|मदत)\b/],
    thanks: [/\b(thanks|thank\s*you|shukriya|dhanyavaad)\b/i, /\b(धन्यवाद|शुक्रिया)\b/],
    name_intro: [/\b(?:my name is|i(?:'m| am)|call me)\s+(\w+)/i, /\b(?:मेरा नाम)\s+(\S+)/, /\b(?:mera naam)\s+(\w+)/i],
    // ── New intents ──────────────────────────────────────
    government_schemes: [/\b(scheme|government|sarkari|yojana|pm kisan|mudra|subsid)\b/i, /\b(योजना|सरकारी|सब्सिडी)\b/, /\b(yojana|sarkari|subsidy)\b/i],
    kyc: [/\b(kyc|know your customer|aadhar|aadhaar|pan card|identity|id proof)\b/i, /\b(केवाईसी|आधार|पैन कार्ड)\b/, /\b(kyc|aadhaar|pan)\b/i],
    complaint: [/\b(complaint|complain|problem|issue|shikayat|grievance)\b/i, /\b(शिकायत|समस्या|तक्रार)\b/, /\b(shikayat|samasya)\b/i],
    fraud_reporting: [/\b(fraud|scam|cheat|dhokha|thagi|unauthori[sz]ed)\b/i, /\b(धोखा|ठगी|फ्रॉड)\b/, /\b(dhokha|thagi|fraud)\b/i],
    whatsapp_doc: [/\b(whatsapp|send\s*document|send.*whatsapp|document\s*bhejo)\b/i, /\b(व्हाट्सएप|डॉक्यूमेंट भेजो)\b/],
};

function detectIntent(text) {
    for (const [intent, patterns] of Object.entries(INTENTS)) {
        for (const p of patterns) {
            if (p.test(text)) return intent;
        }
    }
    return "general";
}

function extractName(text) {
    const patterns = [/(?:my name is|i(?:'m| am)|call me)\s+(\w+)/i, /(?:मेरा नाम)\s+(\S+)/, /(?:mera naam)\s+(\w+)/i];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return m[1];
    }
    return null;
}

// ── Response Templates ───────────────────────────────────
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const R = {
    greeting: {
        english: ["Hello! 👋 Welcome to SecureBank. I'm your banking assistant. How can I help you today?", "Hi there! 🏦 I'm here to assist you with your banking needs. What can I do for you?"],
        hindi: ["नमस्ते! 👋 SecureBank में आपका स्वागत है। मैं आपका बैंकिंग असिस्टेंट हूँ। कैसे मदद करूँ?"],
        marathi: ["नमस्कार! 👋 SecureBank मध्ये तुमचे स्वागत आहे. मी तुमचा बँकिंग असिस्टंट आहे. कशी मदत करू?"],
        hinglish: ["Hello! 👋 SecureBank mein aapka swagat hai. Main aapka banking assistant hoon. Kaise help karun?"],
    },
    farewell: {
        english: ["Thank you for banking with us! Stay safe. 🏦 Is there anything else I can assist you with today?", "Happy to help! Have a secure day. Bye! 👋"],
        hindi: ["बैंकिंग के लिए धन्यवाद! सुरक्षित रहें। 🏦 और कुछ मदद चाहिए?"],
        marathi: ["बँकिंगसाठी धन्यवाद! सुरक्षित रहा. 🏦 अजून काही मदत हवी का?"],
        hinglish: ["Banking ke liye dhanyavaad! Safe rahein. 🏦 Aur kuch help chahiye?"],
    },
    thanks: {
        english: ["You're welcome! 😊 Is there anything else I can assist you with today?"],
        hindi: ["कोई बात नहीं! 😊 और कुछ मदद चाहिए?"],
        marathi: ["काही हरकत नाही! 😊 अजून काही मदत हवी का?"],
        hinglish: ["Koi baat nahi! 😊 Aur kuch help chahiye?"],
    },
    help: {
        english: ["I can help you with:\n\n🏦 Account balance\n💸 Fund transfers\n📋 Transaction history\n💳 Card management\n📊 Loan & EMI info\n🌾 Agriculture & Government schemes\n📝 KYC update\n📞 Complaint registration\n🚨 Fraud reporting\n🔐 Security & fraud detection\n🎤 Voice commands\n📸 Face emotion detection\n\nJust ask me anything!"],
        hindi: ["मैं इनमें मदद कर सकता हूँ:\n\n🏦 अकाउंट बैलेंस\n💸 फंड ट्रांसफर\n📋 ट्रांज़ैक्शन हिस्ट्री\n💳 कार्ड मैनेजमेंट\n📊 लोन और EMI जानकारी\n🌾 सरकारी योजनाएं\n📝 KYC अपडेट\n📞 शिकायत दर्ज\n🚨 फ्रॉड रिपोर्ट\n\nकुछ भी पूछिए!"],
        marathi: ["मी यात मदत करू शकतो:\n\n🏦 अकाउंट बॅलन्स\n💸 फंड ट्रान्सफर\n📋 ट्रॅन्झॅक्शन हिस्ट्री\n💳 कार्ड व्यवस्थापन\n📊 कर्ज आणि EMI माहिती\n🌾 सरकारी योजना\n📝 KYC अपडेट\n📞 तक्रार नोंदणी\n🚨 फसवणूक तक्रार\n\nकाहीही विचारा!"],
        hinglish: ["Main in sab mein help kar sakta hoon:\n\n🏦 Account balance\n💸 Fund transfer\n📋 Transaction history\n💳 Card management\n📊 Loan & EMI info\n🌾 Government schemes\n📝 KYC update\n📞 Complaint\n🚨 Fraud reporting\n\nKuch bhi pucho!"],
    },
    balance: {
        english: () => `Here's your account summary:\n\n💰 Savings Account (${BANK_DATA.accounts.savings.number})\n   Balance: ₹${BANK_DATA.accounts.savings.balance.toLocaleString("en-IN")}\n\n💼 Current Account (${BANK_DATA.accounts.current.number})\n   Balance: ₹${BANK_DATA.accounts.current.balance.toLocaleString("en-IN")}\n\nIs there anything else I can assist you with today?`,
        hindi: () => `आपका अकाउंट समरी:\n\n💰 सेविंग्स अकाउंट (${BANK_DATA.accounts.savings.number})\n   बैलेंस: ₹${BANK_DATA.accounts.savings.balance.toLocaleString("en-IN")}\n\n💼 करंट अकाउंट (${BANK_DATA.accounts.current.number})\n   बैलेंस: ₹${BANK_DATA.accounts.current.balance.toLocaleString("en-IN")}\n\nऔर कुछ मदद चाहिए?`,
        marathi: () => `तुमचा अकाउंट सारांश:\n\n💰 सेव्हिंग्स अकाउंट (${BANK_DATA.accounts.savings.number})\n   बॅलन्स: ₹${BANK_DATA.accounts.savings.balance.toLocaleString("en-IN")}\n\n💼 करंट अकाउंट (${BANK_DATA.accounts.current.number})\n   बॅलन्स: ₹${BANK_DATA.accounts.current.balance.toLocaleString("en-IN")}\n\nअजून काही हवे का?`,
        hinglish: () => `Aapka account summary:\n\n💰 Savings (${BANK_DATA.accounts.savings.number})\n   Balance: ₹${BANK_DATA.accounts.savings.balance.toLocaleString("en-IN")}\n\n💼 Current (${BANK_DATA.accounts.current.number})\n   Balance: ₹${BANK_DATA.accounts.current.balance.toLocaleString("en-IN")}\n\nAur kuch chahiye?`,
    },
    transactions: {
        english: () => {
            let msg = "Here are your recent transactions:\n\n";
            BANK_DATA.recentTransactions.forEach(t => {
                const sign = t.type === "Credit" ? "+" : "";
                msg += `📌 ${t.date} — ${t.desc}\n   ${sign}₹${Math.abs(t.amount).toLocaleString("en-IN")} (${t.type})\n\n`;
            });
            msg += "Is there anything else I can assist you with today?";
            return msg;
        },
        hindi: () => {
            let msg = "आपके हालिया लेनदेन:\n\n";
            BANK_DATA.recentTransactions.forEach(t => {
                const sign = t.type === "Credit" ? "+" : "";
                msg += `📌 ${t.date} — ${t.desc}\n   ${sign}₹${Math.abs(t.amount).toLocaleString("en-IN")} (${t.type === "Credit" ? "क्रेडिट" : "डेबिट"})\n\n`;
            });
            msg += "और कुछ जानकारी चाहिए?";
            return msg;
        },
        marathi: () => {
            let msg = "तुमचे अलीकडील व्यवहार:\n\n";
            BANK_DATA.recentTransactions.forEach(t => {
                const sign = t.type === "Credit" ? "+" : "";
                msg += `📌 ${t.date} — ${t.desc}\n   ${sign}₹${Math.abs(t.amount).toLocaleString("en-IN")} (${t.type === "Credit" ? "क्रेडिट" : "डेबिट"})\n\n`;
            });
            msg += "अजून माहिती हवी का?";
            return msg;
        },
        hinglish: () => {
            let msg = "Aapke recent transactions:\n\n";
            BANK_DATA.recentTransactions.forEach(t => {
                const sign = t.type === "Credit" ? "+" : "";
                msg += `📌 ${t.date} — ${t.desc}\n   ${sign}₹${Math.abs(t.amount).toLocaleString("en-IN")} (${t.type})\n\n`;
            });
            msg += "Aur details chahiye?";
            return msg;
        },
    },
    card_block: {
        english: "I've blocked your card immediately for safety. 🔒\n\nBlocked: Debit Card (XXXX-7823)\nStatus: Blocked ✅\nTime: Just now\n\nA new card will be issued within 5-7 business days. Is there anything else I can assist you with today?",
        hindi: "सुरक्षा के लिए आपका कार्ड तुरंत ब्लॉक कर दिया गया है। 🔒\n\nब्लॉक किया: डेबिट कार्ड (XXXX-7823)\nस्टेटस: ब्लॉक ✅\n\nनया कार्ड 5-7 दिनों में जारी होगा। और कुछ मदद चाहिए?",
        marathi: "सुरक्षिततेसाठी तुमचे कार्ड तातडीने ब्लॉक केले आहे. 🔒\n\nब्लॉक केले: डेबिट कार्ड (XXXX-7823)\nस्टेटस: ब्लॉक ✅\n\nनवीन कार्ड 5-7 दिवसांत जारी होईल. अजून काही हवे का?",
        hinglish: "Safety ke liye aapka card turant block kar diya gaya hai. 🔒\n\nBlocked: Debit Card (XXXX-7823)\nStatus: Blocked ✅\n\nNaya card 5-7 din mein aa jayega. Aur kuch help chahiye?",
    },
    loan: {
        english: () => {
            let msg = "Your loan details:\n\n";
            BANK_DATA.loans.forEach(l => {
                msg += `🏠 ${l.type}\n   Total: ₹${l.amount.toLocaleString("en-IN")}\n   EMI: ₹${l.emi.toLocaleString("en-IN")}/month\n   Remaining: ₹${l.remaining.toLocaleString("en-IN")}\n   Status: ${l.status}\n\n`;
            });
            msg += "Is there anything else I can assist you with today?";
            return msg;
        },
        hindi: () => {
            let msg = "आपका लोन विवरण:\n\n";
            BANK_DATA.loans.forEach(l => {
                msg += `🏠 ${l.type}\n   कुल: ₹${l.amount.toLocaleString("en-IN")}\n   EMI: ₹${l.emi.toLocaleString("en-IN")}/महीना\n   बाकी: ₹${l.remaining.toLocaleString("en-IN")}\n   स्टेटस: ${l.status === "Active" ? "सक्रिय" : l.status}\n\n`;
            });
            msg += "और कुछ जानना है?";
            return msg;
        },
        marathi: () => {
            let msg = "तुमचा कर्ज तपशील:\n\n";
            BANK_DATA.loans.forEach(l => {
                msg += `🏠 ${l.type}\n   एकूण: ₹${l.amount.toLocaleString("en-IN")}\n   EMI: ₹${l.emi.toLocaleString("en-IN")}/महिना\n   शिल्लक: ₹${l.remaining.toLocaleString("en-IN")}\n   स्टेटस: ${l.status === "Active" ? "सक्रिय" : l.status}\n\n`;
            });
            msg += "अजून काही हवे का?";
            return msg;
        },
        hinglish: () => {
            let msg = "Aapka loan detail:\n\n";
            BANK_DATA.loans.forEach(l => {
                msg += `🏠 ${l.type}\n   Total: ₹${l.amount.toLocaleString("en-IN")}\n   EMI: ₹${l.emi.toLocaleString("en-IN")}/month\n   Remaining: ₹${l.remaining.toLocaleString("en-IN")}\n   Status: ${l.status}\n\n`;
            });
            msg += "Aur kuch info chahiye?";
            return msg;
        },
    },
    // ── New intent responses ──────────────────────────────
    government_schemes: {
        english: ["Here are some government schemes you may be eligible for:\n\n🌾 PM-KISAN — ₹6,000/year for farmers\n🏦 Mudra Loan — Up to ₹10 lakh for businesses\n🏠 PM Awas Yojana — Affordable housing subsidy\n👩 Sukanya Samriddhi — Savings for girl child\n💊 Ayushman Bharat — ₹5 lakh health cover\n\nWould you like me to send detailed documents via WhatsApp? Is there anything else I can assist you with today?"],
        hindi: ["यहाँ कुछ सरकारी योजनाएं हैं जिनके लिए आप पात्र हो सकते हैं:\n\n🌾 PM-KISAN — किसानों के लिए ₹6,000/साल\n🏦 मुद्रा लोन — व्यापार के लिए ₹10 लाख तक\n🏠 PM आवास योजना — किफायती आवास सब्सिडी\n👩 सुकन्या समृद्धि — बेटियों के लिए बचत\n💊 आयुष्मान भारत — ₹5 लाख स्वास्थ्य कवर\n\nक्या मैं WhatsApp पर विस्तृत जानकारी भेजूं?"],
        marathi: ["तुम्हाला पात्र असलेल्या काही सरकारी योजना:\n\n🌾 PM-KISAN — शेतकऱ्यांसाठी ₹6,000/वर्ष\n🏦 मुद्रा कर्ज — व्यवसायासाठी ₹10 लाख पर्यंत\n🏠 PM आवास योजना — परवडणारे घर\n👩 सुकन्या समृद्धी — मुलींसाठी बचत\n💊 आयुष्मान भारत — ₹5 लाख आरोग्य कवर\n\nWhatsApp वर तपशीलवार माहिती पाठवू का?"],
        hinglish: ["Yeh kuch sarkari yojnayein hain jinke liye aap eligible ho sakte hain:\n\n🌾 PM-KISAN — ₹6,000/saal kisanon ke liye\n🏦 Mudra Loan — Business ke liye ₹10 lakh tak\n🏠 PM Awas Yojana — Sasti housing subsidy\n👩 Sukanya Samriddhi — Betiyon ke liye savings\n💊 Ayushman Bharat — ₹5 lakh health cover\n\nKya WhatsApp par details bhejun?"],
    },
    kyc: {
        english: ["To update your KYC:\n\n📋 Documents needed:\n   • Aadhaar Card\n   • PAN Card\n   • Address Proof\n\n📍 You can visit your nearest branch or upload documents through our secure portal.\n\n✅ Your current KYC status: Active (last updated: 2025-08-15)\n\nWould you like me to send the KYC form via WhatsApp? Is there anything else I can assist you with today?"],
        hindi: ["KYC अपडेट के लिए:\n\n📋 ज़रूरी दस्तावेज:\n   • आधार कार्ड\n   • पैन कार्ड\n   • पता प्रमाण\n\n📍 आप नजदीकी शाखा में जा सकते हैं या सुरक्षित पोर्टल से अपलोड कर सकते हैं।\n\n✅ आपकी KYC स्टेटस: सक्रिय (अंतिम अपडेट: 2025-08-15)\n\nक्या WhatsApp पर KYC फॉर्म भेजूं?"],
        marathi: ["KYC अपडेटसाठी:\n\n📋 आवश्यक कागदपत्रे:\n   • आधार कार्ड\n   • पॅन कार्ड\n   • पत्ता पुरावा\n\n📍 जवळच्या शाखेत जा किंवा सुरक्षित पोर्टलवरून अपलोड करा.\n\n✅ तुमची KYC स्टेटस: सक्रिय (शेवटचे अपडेट: 2025-08-15)\n\nWhatsApp वर KYC फॉर्म पाठवू का?"],
        hinglish: ["KYC update ke liye:\n\n📋 Zaruri documents:\n   • Aadhaar Card\n   • PAN Card\n   • Address Proof\n\n📍 Nearest branch jao ya secure portal se upload karo.\n\n✅ KYC status: Active (last updated: 2025-08-15)\n\nWhatsApp par KYC form bhejun kya?"],
    },
    complaint: {
        english: ["I'm sorry to hear you're facing an issue. Let me help you register a complaint.\n\n📝 Complaint registered successfully!\nTicket: CMP-2026-00847\nStatus: Under Review\nExpected resolution: 48 hours\n\nOur team will contact you shortly. Is there anything else I can assist you with today?"],
        hindi: ["आपकी समस्या सुनकर दुख हुआ। मैं शिकायत दर्ज करता हूँ।\n\n📝 शिकायत सफलतापूर्वक दर्ज हो गई!\nटिकट: CMP-2026-00847\nस्टेटस: समीक्षा में\nअपेक्षित समाधान: 48 घंटे\n\nहमारी टीम जल्द संपर्क करेगी। और कुछ मदद चाहिए?"],
        marathi: ["तुम्हाला समस्या आहे ऐकून वाईट वाटले. मी तक्रार नोंदवतो.\n\n📝 तक्रार यशस्वीरित्या नोंदवली!\nतिकीट: CMP-2026-00847\nस्टेटस: पुनरावलोकनात\nअपेक्षित निराकरण: 48 तास\n\nआमची टीम लवकरच संपर्क करेल. अजून काही हवे का?"],
        hinglish: ["Aapki problem sunkar dukh hua. Main complaint register karta hoon.\n\n📝 Complaint registered!\nTicket: CMP-2026-00847\nStatus: Under Review\nExpected resolution: 48 hours\n\nHamari team jald contact karegi. Aur kuch help chahiye?"],
    },
    fraud_reporting: {
        english: ["🚨 I understand your concern. Fraud reporting is our top priority.\n\nI have initiated the following actions:\n✅ Account temporarily secured\n✅ Alert sent to Fraud Investigation Team\n✅ Incident logged in our system\n✅ WhatsApp confirmation sent\n\nOur fraud team will contact you within 30 minutes. Please do not share OTPs or passwords with anyone. Is there anything else I can assist you with today?"],
        hindi: ["🚨 मैं आपकी चिंता समझता हूँ। फ्रॉड रिपोर्टिंग हमारी प्राथमिकता है।\n\nमैंने ये कदम उठाए हैं:\n✅ अकाउंट अस्थायी रूप से सुरक्षित\n✅ फ्रॉड जांच टीम को अलर्ट भेजा\n✅ सिस्टम में इंसीडेंट लॉग किया\n✅ WhatsApp पर पुष्टि भेजी\n\nहमारी फ्रॉड टीम 30 मिनट में संपर्क करेगी। कृपया OTP या पासवर्ड किसी से शेयर न करें।"],
        marathi: ["🚨 मला तुमची चिंता समजते. फसवणूक तक्रार ही आमची प्राथमिकता आहे.\n\nमी हे पाऊले उचलले:\n✅ अकाउंट तात्पुरते सुरक्षित\n✅ फसवणूक तपास टीमला अलर्ट पाठवला\n✅ सिस्टममध्ये इन्सिडंट नोंदवला\n✅ WhatsApp वर पुष्टी पाठवली\n\nआमची टीम 30 मिनिटांत संपर्क करेल. कृपया OTP किंवा पासवर्ड कोणालाही सांगू नका."],
        hinglish: ["🚨 Main aapki chinta samajhta hoon. Fraud reporting hamari top priority hai.\n\nMaine ye actions liye:\n✅ Account temporarily secure kiya\n✅ Fraud Investigation Team ko alert bheja\n✅ System mein incident log kiya\n✅ WhatsApp confirmation bheja\n\nHamari fraud team 30 min mein contact karegi. Please OTP ya password kisi se share mat karo."],
    },
    whatsapp_doc: {
        english: ["📲 I have sent the requested documents to your registered WhatsApp number via WhatsApp Cloud API.\n\nPlease check your WhatsApp messages. The documents are encrypted for your security. Is there anything else I can assist you with today?"],
        hindi: ["📲 मैंने आपके रजिस्टर्ड WhatsApp नंबर पर WhatsApp Cloud API के ज़रिए दस्तावेज़ भेज दिए हैं।\n\nकृपया अपने WhatsApp मैसेज चेक करें। दस्तावेज़ आपकी सुरक्षा के लिए एन्क्रिप्टेड हैं। और कुछ मदद चाहिए?"],
        marathi: ["📲 मी तुमच्या नोंदणीकृत WhatsApp नंबरवर WhatsApp Cloud API द्वारे कागदपत्रे पाठवली आहेत.\n\nकृपया तुमचे WhatsApp मेसेज तपासा. कागदपत्रे तुमच्या सुरक्षिततेसाठी एन्क्रिप्टेड आहेत. अजून काही हवे का?"],
        hinglish: ["📲 Maine aapke registered WhatsApp number par WhatsApp Cloud API se documents bhej diye hain.\n\nApne WhatsApp messages check karein. Documents aapki security ke liye encrypted hain. Aur kuch help chahiye?"],
    },
    // ── Fraud-aware responses ─────────────────────────────
    transfer_ask_verify: {
        english: "For your security, I need to verify some details before proceeding with the transfer. Could you confirm your registered phone number?",
        hindi: "आपकी सुरक्षा के लिए ट्रांसफर से पहले कुछ डिटेल्स वेरिफाई करने होंगे। क्या आप अपना रजिस्टर्ड फोन नंबर बता सकते हैं?",
        marathi: "तुमच्या सुरक्षिततेसाठी ट्रान्सफर करण्यापूर्वी काही तपशील पडताळणे आवश्यक आहे. तुमचा नोंदणीकृत फोन नंबर सांगू शकता का?",
        hinglish: "Aapki security ke liye transfer se pehle kuch details verify karni hongi. Apna registered phone number bata sakte hain?",
    },
    medium_risk_verify: {
        english: "For your security, additional verification is required. Could you please confirm your registered phone number and date of birth?",
        hindi: "आपकी सुरक्षा के लिए अतिरिक्त सत्यापन आवश्यक है। कृपया अपना रजिस्टर्ड फोन नंबर और जन्म तिथि बताएं।",
        marathi: "तुमच्या सुरक्षिततेसाठी अतिरिक्त पडताळणी आवश्यक आहे. कृपया तुमचा नोंदणीकृत फोन नंबर आणि जन्मतारीख सांगा.",
        hinglish: "Aapki security ke liye additional verification zaruri hai. Apna registered phone number aur date of birth bataiye.",
    },
    high_risk_block: {
        english: "For your security, additional verification is required. 🔐 I have alerted our Fraud Investigation Team. They will contact you shortly. For your protection, this transaction has been paused.",
        hindi: "आपकी सुरक्षा के लिए अतिरिक्त सत्यापन आवश्यक है। 🔐 मैंने हमारी फ्रॉड जांच टीम को सूचित कर दिया है। वे जल्द ही आपसे संपर्क करेंगे। आपकी सुरक्षा के लिए यह ट्रांज़ैक्शन रोक दिया गया है।",
        marathi: "तुमच्या सुरक्षिततेसाठी अतिरिक्त पडताळणी आवश्यक आहे. 🔐 मी आमच्या फसवणूक तपास टीमला सूचित केले आहे. ते लवकरच तुमच्याशी संपर्क करतील. तुमच्या संरक्षणासाठी हा व्यवहार थांबवला आहे.",
        hinglish: "Aapki security ke liye additional verification zaruri hai. 🔐 Maine hamari Fraud Investigation Team ko alert kar diya hai. Woh jald hi aapse contact karenge. Aapki safety ke liye yeh transaction rok diya gaya hai.",
    },
    otp_warning: {
        english: "For security reasons, I cannot share or process OTP requests. Please enter your OTP directly on the secure banking portal. Never share your OTP with anyone.",
        hindi: "सुरक्षा कारणों से मैं OTP शेयर या प्रोसेस नहीं कर सकता। कृपया OTP सीधे सुरक्षित बैंकिंग पोर्टल पर दर्ज करें। अपना OTP किसी से शेयर न करें।",
        marathi: "सुरक्षिततेच्या कारणांसाठी मी OTP शेअर किंवा प्रक्रिया करू शकत नाही. कृपया OTP थेट सुरक्षित बँकिंग पोर्टलवर टाका. तुमचा OTP कोणाशीही शेअर करू नका.",
        hinglish: "Security reasons se main OTP share ya process nahi kar sakta. OTP seedha secure banking portal par enter karein. Apna OTP kisi se share na karein.",
    },
    general: {
        english: ["I'm here to help with your banking needs! You can ask about balance, transfers, transactions, cards, loans, government schemes, KYC, or any complaint. What would you like to know?"],
        hindi: ["मैं आपकी बैंकिंग ज़रूरतों में मदद के लिए हूँ! बैलेंस, ट्रांसफर, ट्रांज़ैक्शन, कार्ड, लोन, सरकारी योजनाएं या शिकायत के बारे में पूछिए।"],
        marathi: ["मी तुमच्या बँकिंग गरजांसाठी इथे आहे! बॅलन्स, ट्रान्सफर, व्यवहार, कार्ड, कर्ज, सरकारी योजना किंवा तक्रारीबद्दल विचारा."],
        hinglish: ["Main aapki banking needs mein help ke liye hoon! Balance, transfer, transaction, card, loan, sarkari yojana ya complaint ke baare mein pucho."],
    },
};

function getResp(key, lang) {
    const data = R[key];
    if (!data) return "";
    const langData = data[lang] || data.english;
    if (typeof langData === "function") return langData();
    return Array.isArray(langData) ? pick(langData) : langData;
}

// ── Emotion Intelligence Prefixes ────────────────────────
function getEmotionPrefix(emotion, lang) {
    const prefixes = {
        angry: {
            english: "I completely understand your frustration, and I want to help resolve this right away. ",
            hindi: "मैं आपकी परेशानी पूरी तरह समझता हूँ, और मैं इसे तुरंत हल करना चाहता हूँ। ",
            marathi: "मला तुमची निराशा पूर्णपणे समजते, आणि मला हे लगेच सोडवायचे आहे. ",
            hinglish: "Main aapki pareshani poori tarah samajhta hoon, aur main ise turant solve karna chahta hoon. ",
        },
        sad: {
            english: "I can see something is troubling you. I'm here to help and make this easier. ",
            hindi: "मैं देख सकता हूँ कि कुछ आपको परेशान कर रहा है। मैं यहाँ मदद के लिए हूँ। ",
            marathi: "मला दिसतंय काहीतरी तुम्हाला त्रास देत आहे. मी मदतीसाठी इथे आहे. ",
            hinglish: "Main dekh sakta hoon kuch aapko pareshaan kar raha hai. Main yahan madad ke liye hoon. ",
        },
        fearful: {
            english: "Please don't worry, your account and money are completely safe with us. Let me assist you calmly. ",
            hindi: "कृपया चिंता न करें, आपका अकाउंट और पैसा हमारे पास पूरी तरह सुरक्षित है। मैं शांति से आपकी मदद करता हूँ। ",
            marathi: "कृपया काळजी करू नका, तुमचे अकाउंट आणि पैसे आमच्याकडे पूर्णपणे सुरक्षित आहेत. मी शांतपणे मदत करतो. ",
            hinglish: "Please chinta mat karo, aapka account aur paisa hamare paas poori tarah safe hai. Main shanti se madad karta hoon. ",
        },
        surprised: {
            english: "I understand this may be unexpected. Let me walk you through this step by step. ",
            hindi: "मैं समझता हूँ यह अचानक हो सकता है। मैं आपको कदम-दर-कदम समझाता हूँ। ",
            marathi: "मला समजते हे अनपेक्षित असू शकते. मी तुम्हाला टप्प्याटप्प्याने समजावतो. ",
            hinglish: "Main samajhta hoon ye unexpected ho sakta hai. Main aapko step by step samjhata hoon. ",
        },
        disgusted: {
            english: "I understand your concern. Let me address this issue properly for you. ",
            hindi: "मैं आपकी चिंता समझता हूँ। मैं इस मुद्दे को ठीक से संभालता हूँ। ",
            marathi: "मला तुमची चिंता समजते. मी हा मुद्दा व्यवस्थित हाताळतो. ",
            hinglish: "Main aapki chinta samajhta hoon. Main is issue ko theek se handle karta hoon. ",
        },
    };

    if (prefixes[emotion]) {
        return (prefixes[emotion][lang] || prefixes[emotion].english);
    }
    return "";
}

// ── Main Process Function ────────────────────────────────
function processMessage(userText, faceEmotion = "neutral") {
    const lang = detectLanguage(userText);
    context.language = lang;
    context.faceEmotion = faceEmotion;
    context.messageCount++;
    context.history.push({ role: "user", text: userText, timestamp: new Date().toISOString() });

    // ── Fraud analysis ────────────────────────────────────
    const fraudResult = analyzeMessage(userText, faceEmotion);
    context.lastRiskLevel = fraudResult.riskLevel;

    // ── HIGH RISK → Block + ServiceNow incident ───────────
    if (fraudResult.riskLevel === "high" && !context.incidentCreated) {
        context.incidentCreated = true;
        const incident = createIncident({
            shortDescription: `High fraud risk detected — Risk Score: ${fraudResult.riskScore}/100`,
            description: `Automated fraud detection triggered during banking session.\nRisk factors: ${fraudResult.events.map(e => e.type).join(", ")}`,
            customerId: context.customerId,
            customerName: context.customerName,
            riskScore: fraudResult.riskScore,
            riskLevel: fraudResult.riskLevel,
            sentimentScore: faceEmotion,
            faceEmotion: faceEmotion,
            transcript: context.history,
        });

        const blockMsg = getResp("high_risk_block", lang);
        context.history.push({ role: "bot", text: blockMsg, timestamp: new Date().toISOString() });

        return {
            text: blockMsg,
            riskLevel: "high",
            incident: formatIncidentAlert(incident),
            aura: getAuraColor(),
            speakSlow: context.isElderly,
        };
    }

    // ── MEDIUM RISK → Additional verification ─────────────
    if (fraudResult.riskLevel === "medium") {
        const intent = detectIntent(userText);
        if (["transfer", "otp", "card_block"].includes(intent)) {
            const verifyMsg = getResp("medium_risk_verify", lang);
            context.history.push({ role: "bot", text: verifyMsg, timestamp: new Date().toISOString() });
            return { text: verifyMsg, riskLevel: "medium", incident: null, aura: getAuraColor(), speakSlow: context.isElderly };
        }
    }

    // ── Name extraction ───────────────────────────────────
    const nameFromText = extractName(userText);
    if (nameFromText) {
        context.customerName = nameFromText;
        const respMap = {
            english: `Nice to meet you, ${nameFromText}! 😊 How can I assist you with your banking today?`,
            hindi: `आपसे मिलकर अच्छा लगा, ${nameFromText}! 😊 बैंकिंग में कैसे मदद करूँ?`,
            marathi: `भेटून आनंद झाला, ${nameFromText}! 😊 बँकिंगमध्ये कशी मदत करू?`,
            hinglish: `Nice to meet you, ${nameFromText}! 😊 Banking mein kaise help karun?`,
        };
        const msg = respMap[lang] || respMap.english;
        context.history.push({ role: "bot", text: msg, timestamp: new Date().toISOString() });
        return { text: msg, riskLevel: fraudResult.riskLevel, incident: null, aura: getAuraColor(), speakSlow: context.isElderly };
    }

    // ── Detect Intent ─────────────────────────────────────
    const intent = detectIntent(userText);

    let response;
    switch (intent) {
        case "greeting":
            response = getResp("greeting", lang);
            break;
        case "farewell":
            response = getResp("farewell", lang);
            break;
        case "thanks":
            response = getResp("thanks", lang);
            break;
        case "help":
            response = getResp("help", lang);
            break;
        case "balance":
            response = getResp("balance", lang);
            break;
        case "transactions":
            response = getResp("transactions", lang);
            break;
        case "transfer":
            response = getResp("transfer_ask_verify", lang);
            break;
        case "card_block":
            response = getResp("card_block", lang);
            break;
        case "loan":
            response = getResp("loan", lang);
            break;
        case "otp":
            response = getResp("otp_warning", lang);
            break;
        case "government_schemes":
            response = getResp("government_schemes", lang);
            break;
        case "kyc":
            response = getResp("kyc", lang);
            break;
        case "complaint":
            response = getResp("complaint", lang);
            break;
        case "fraud_reporting":
            response = getResp("fraud_reporting", lang);
            break;
        case "whatsapp_doc":
            response = getResp("whatsapp_doc", lang);
            break;
        default:
            response = getResp("general", lang);
    }

    // ── Add emotion prefix if detected ────────────────────
    const emotionPrefix = getEmotionPrefix(faceEmotion, lang);
    if (emotionPrefix && intent !== "greeting" && intent !== "farewell") {
        response = emotionPrefix + response;
    }

    context.history.push({ role: "bot", text: response, timestamp: new Date().toISOString() });
    return { text: response, riskLevel: fraudResult.riskLevel, incident: null, aura: getAuraColor(), speakSlow: context.isElderly };
}

function getWelcomeMessage() {
    return "Hello! 👋 Welcome to SecureBank. I'm your AI banking assistant with fraud protection. You can chat with me in English, Hindi, or Marathi.\n\nUse 🎤 for voice, 📸 for face emotion detection, or just type away!\n\nHow can I help you today?";
}

function setElderly(val) { context.isElderly = !!val; }
function getContext() { return context; }

function resetContext() {
    context.history = [];
    context.language = "english";
    context.faceEmotion = "neutral";
    context.messageCount = 0;
    context.customerName = "Customer";
    context.verified = false;
    context.awaitingVerification = false;
    context.lastRiskLevel = "low";
    context.incidentCreated = false;
    context.isElderly = false;
}

export { processMessage, getWelcomeMessage, getContext, resetContext, setElderly };
