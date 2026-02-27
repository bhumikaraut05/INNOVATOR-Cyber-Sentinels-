// ============================================================
// Twilio Service — SMS, WhatsApp, Voice Calls with retry
// Centralized Twilio integration for all alert channels
// ============================================================

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_API_KEY = process.env.TWILIO_API_KEY_SID || "";
const TWILIO_API_SECRET = process.env.TWILIO_API_KEY_SECRET || "";
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || "";
const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER || "";

let client = null;

function getClient() {
    if (client) return client;
    try {
        const twilio = require("twilio");
        // Prefer API Key auth if available
        if (TWILIO_API_KEY && TWILIO_API_SECRET && TWILIO_SID) {
            client = twilio(TWILIO_API_KEY, TWILIO_API_SECRET, { accountSid: TWILIO_SID });
            console.log("✅ Twilio client initialized (API Key auth)");
            return client;
        }
        // Fallback to Account SID + Auth Token
        if (TWILIO_SID && TWILIO_TOKEN) {
            client = twilio(TWILIO_SID, TWILIO_TOKEN);
            console.log("✅ Twilio client initialized (Auth Token)");
            return client;
        }
    } catch (err) {
        console.error("❌ Twilio init error:", err.message);
    }
    return null;
}

function isConfigured() {
    return !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_PHONE);
}

// ── Retry Wrapper ────────────────────────────────────
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// ── Send SMS ─────────────────────────────────────────
async function sendSMS(to, body) {
    const c = getClient();
    if (!c) {
        console.log(`📲 [SIM SMS → ${to}]: ${body.substring(0, 80)}...`);
        return { simulated: true, sid: `SIM_SMS_${Date.now()}`, channel: "sms" };
    }

    return withRetry(async () => {
        const msg = await c.messages.create({
            body,
            from: TWILIO_PHONE,
            to,
        });
        console.log(`📲 SMS sent to ${to}: ${msg.sid}`);
        return { simulated: false, sid: msg.sid, channel: "sms", status: msg.status };
    });
}

// ── Send WhatsApp ────────────────────────────────────
async function sendWhatsApp(to, body) {
    const c = getClient();
    const whatsappFrom = TWILIO_WHATSAPP || TWILIO_PHONE;
    if (!c) {
        console.log(`💬 [SIM WA → ${to}]: ${body.substring(0, 80)}...`);
        return { simulated: true, sid: `SIM_WA_${Date.now()}`, channel: "whatsapp" };
    }

    return withRetry(async () => {
        const msg = await c.messages.create({
            body,
            from: `whatsapp:${whatsappFrom}`,
            to: `whatsapp:${to}`,
        });
        console.log(`💬 WhatsApp sent to ${to}: ${msg.sid}`);
        return { simulated: false, sid: msg.sid, channel: "whatsapp", status: msg.status };
    });
}

// ── Make Voice Call ───────────────────────────────────
async function makeVoiceCall(to, message, language = "en") {
    const c = getClient();
    if (!c) {
        console.log(`📞 [SIM CALL → ${to}]: ${message.substring(0, 80)}...`);
        return { simulated: true, sid: `SIM_CALL_${Date.now()}`, channel: "voice" };
    }

    // Map language codes to Twilio voice names
    const voiceMap = {
        en: { voice: "Polly.Aditi", language: "en-IN" },
        hi: { voice: "Polly.Aditi", language: "hi-IN" },
        mr: { voice: "Polly.Aditi", language: "mr-IN" },
    };
    const voiceConfig = voiceMap[language] || voiceMap.en;

    return withRetry(async () => {
        const call = await c.calls.create({
            twiml: `<Response><Say voice="${voiceConfig.voice}" language="${voiceConfig.language}">${escapeXml(message)}</Say><Pause length="1"/><Say voice="${voiceConfig.voice}" language="${voiceConfig.language}">This is an automated message from SecureBank. Please contact us immediately if you did not initiate this activity.</Say></Response>`,
            from: TWILIO_PHONE,
            to,
        });
        console.log(`📞 Voice call to ${to}: ${call.sid}`);
        return { simulated: false, sid: call.sid, channel: "voice", status: call.status };
    });
}

// ── Send All Fraud Alerts (SMS + WhatsApp + Call) ────
async function sendFraudAlerts(to, data = {}) {
    const {
        riskScore = 0,
        incidentId = "N/A",
        customerName = "Customer",
        language = "en",
    } = data;

    const messages = getFraudAlertMessages(language, customerName, riskScore, incidentId);
    const results = { sms: null, whatsapp: null, voice: null, errors: [] };

    // SMS
    try {
        results.sms = await sendSMS(to, messages.sms);
    } catch (err) {
        results.errors.push({ channel: "sms", error: err.message });
        console.error("❌ SMS alert failed:", err.message);
    }

    // WhatsApp
    try {
        results.whatsapp = await sendWhatsApp(to, messages.whatsapp);
    } catch (err) {
        results.errors.push({ channel: "whatsapp", error: err.message });
        console.error("❌ WhatsApp alert failed:", err.message);
    }

    // Voice Call (only for high risk ≥ 61)
    if (riskScore >= 61) {
        try {
            results.voice = await makeVoiceCall(to, messages.voice, language);
        } catch (err) {
            results.errors.push({ channel: "voice", error: err.message });
            console.error("❌ Voice call failed:", err.message);
        }
    }

    return results;
}

// ── Multilingual Fraud Alert Messages ────────────────
function getFraudAlertMessages(lang, name, score, incidentId) {
    const templates = {
        en: {
            sms: `🚨 SecureBank FRAUD ALERT\n\nDear ${name},\n\nSuspicious activity detected on your account.\nRisk Score: ${score}/100\nIncident: ${incidentId}\n\n✅ Account temporarily secured\n✅ Fraud Investigation Team alerted\n\n⚠️ DO NOT share OTP, PIN or password with anyone.\n\nCall us: 1800-XXX-XXXX\n— SecureBank Security Team`,
            whatsapp: `🚨 *SecureBank FRAUD ALERT*\n\nDear *${name}*,\n\nSuspicious activity has been detected on your account.\n\n📊 *Risk Score:* ${score}/100\n🎫 *Incident:* ${incidentId}\n\n✅ Your account has been temporarily secured\n✅ Our Fraud Investigation Team has been alerted\n✅ SLA monitoring activated (2-hour target)\n\n⚠️ *DO NOT share OTP, PIN, or password with anyone.*\n\nIf you did not initiate this activity, reply *HELP* or call *1800-XXX-XXXX* immediately.\n\n— SecureBank Security Team`,
            voice: `Alert from SecureBank. Dear ${name}, suspicious activity has been detected on your account. Your risk score is ${score} out of 100. Incident number ${incidentId} has been created. Your account has been temporarily secured. Please do not share your OTP, PIN, or password with anyone. If you did not initiate this activity, please contact us immediately at 1800 XXX XXXX.`,
        },
        hi: {
            sms: `🚨 SecureBank फ्रॉड अलर्ट\n\nप्रिय ${name},\n\nआपके खाते पर संदिग्ध गतिविधि पाई गई।\nरिस्क स्कोर: ${score}/100\nइंसीडेंट: ${incidentId}\n\n✅ खाता अस्थायी रूप से सुरक्षित\n✅ फ्रॉड जांच टीम को सूचित किया\n\n⚠️ OTP, PIN या पासवर्ड किसी से शेयर न करें।\n\nकॉल करें: 1800-XXX-XXXX\n— SecureBank सुरक्षा टीम`,
            whatsapp: `🚨 *SecureBank फ्रॉड अलर्ट*\n\nप्रिय *${name}*,\n\nआपके खाते पर संदिग्ध गतिविधि पाई गई है।\n\n📊 *रिस्क स्कोर:* ${score}/100\n🎫 *इंसीडेंट:* ${incidentId}\n\n✅ खाता अस्थायी रूप से सुरक्षित किया गया\n✅ फ्रॉड जांच टीम को सूचित किया गया\n\n⚠️ *OTP, PIN या पासवर्ड किसी से शेयर न करें।*\n\n— SecureBank सुरक्षा टीम`,
            voice: `सिक्योरबैंक से अलर्ट। प्रिय ${name}, आपके खाते पर संदिग्ध गतिविधि पाई गई है। आपका रिस्क स्कोर ${score} में से 100 है। इंसीडेंट नंबर ${incidentId} बनाया गया है। कृपया अपना OTP, PIN या पासवर्ड किसी से शेयर न करें।`,
        },
        mr: {
            sms: `🚨 SecureBank फसवणूक अलर्ट\n\nप्रिय ${name},\n\nतुमच्या खात्यावर संशयास्पद हालचाल आढळली.\nरिस्क स्कोर: ${score}/100\nइन्सिडंट: ${incidentId}\n\n✅ खाते तात्पुरते सुरक्षित\n✅ फसवणूक तपास टीमला सूचित केले\n\n⚠️ OTP, PIN किंवा पासवर्ड कोणालाही सांगू नका.\n\nकॉल करा: 1800-XXX-XXXX\n— SecureBank सुरक्षा टीम`,
            whatsapp: `🚨 *SecureBank फसवणूक अलर्ट*\n\nप्रिय *${name}*,\n\nतुमच्या खात्यावर संशयास्पद हालचाल आढळली आहे.\n\n📊 *रिस्क स्कोर:* ${score}/100\n🎫 *इन्सिडंट:* ${incidentId}\n\n✅ खाते तात्पुरते सुरक्षित केले\n✅ फसवणूक तपास टीमला सूचित केले\n\n⚠️ *OTP, PIN किंवा पासवर्ड कोणालाही सांगू नका.*\n\n— SecureBank सुरक्षा टीम`,
            voice: `सिक्योरबँकचा अलर्ट. प्रिय ${name}, तुमच्या खात्यावर संशयास्पद हालचाल आढळली आहे. तुमचा रिस्क स्कोर ${score} पैकी 100 आहे. इन्सिडंट नंबर ${incidentId} तयार केला आहे. कृपया तुमचा OTP, PIN किंवा पासवर्ड कोणालाही सांगू नका.`,
        },
    };

    return templates[lang] || templates.en;
}

// ── Validate Twilio Signature ────────────────────────
function validateTwilioSignature(url, params, signature) {
    if (!TWILIO_TOKEN) return true; // skip in dev
    try {
        const twilio = require("twilio");
        return twilio.validateRequest(TWILIO_TOKEN, signature, url, params);
    } catch {
        return false;
    }
}

function escapeXml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

module.exports = {
    sendSMS,
    sendWhatsApp,
    makeVoiceCall,
    sendFraudAlerts,
    getFraudAlertMessages,
    validateTwilioSignature,
    withRetry,
    isConfigured,
    getClient,
};
