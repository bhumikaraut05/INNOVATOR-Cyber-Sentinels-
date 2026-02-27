// ============================================================
// Fraud Controller — Fraud reporting + detection → alerts
// POST /api/fraud/report — Report fraud, create incident, send alerts
// POST /api/fraud/analyze — Analyze text for risk scoring
// ============================================================

const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const twilioService = require("../services/twilioService");
const serviceNowService = require("../services/serviceNowService");
const audit = require("../services/auditService");

// ── Fraud Keywords (multilingual) ────────────────────
const FRAUD_KEYWORDS = /fraud|scam|hack|stolen|unauthorized|suspicious|phishing|malware|hera|chori|चोरी|धोखा|फ्रॉड|ठगी|लूट|हैक|फसवणूक|चोरी|हॅक|बनावट|अनधिकृत/i;

const HIGH_RISK_KEYWORDS = /hack|stolen|unauthorized|password\s*stolen|account\s*breached|money\s*gone|पैसे\s*गायब|पासवर्ड\s*चोरी|हॅक\s*झाले/i;

// ── Analyze Text for Risk ────────────────────────────
function analyzeRisk(text, emotion = "neutral") {
    let score = 0;
    const triggers = [];

    // Keyword analysis
    if (FRAUD_KEYWORDS.test(text)) { score += 30; triggers.push("fraud_keyword"); }
    if (HIGH_RISK_KEYWORDS.test(text)) { score += 25; triggers.push("high_risk_keyword"); }

    // OTP mention
    if (/otp|one\s*time|verification\s*code|सत्यापन/i.test(text)) { score += 20; triggers.push("otp_mention"); }

    // Amount mention (large)
    const amountMatch = text.match(/(?:rs\.?|₹|inr)\s*([\d,]+)/i);
    if (amountMatch) {
        const amount = parseInt(amountMatch[1].replace(/,/g, ""));
        if (amount >= 10000) { score += 15; triggers.push(`large_amount_${amount}`); }
        if (amount >= 50000) { score += 10; triggers.push("very_large_amount"); }
    }

    // Emotional signals
    const riskEmotions = { fear: 15, anger: 10, surprise: 8, disgust: 12, sad: 5 };
    if (riskEmotions[emotion]) { score += riskEmotions[emotion]; triggers.push(`emotion_${emotion}`); }

    // Urgency words
    if (/urgent|immediately|right\s*now|asap|please\s*help|help\s*me|jaldi|turant|तुरंत|मदत/i.test(text)) {
        score += 10; triggers.push("urgency");
    }

    // Cap at 100
    score = Math.min(score, 100);
    const riskLevel = score >= 61 ? "high" : score >= 31 ? "medium" : "low";

    return { score, riskLevel, triggers };
}

// ── POST /api/fraud/report ───────────────────────────
router.post("/report", authMiddleware, async (req, res) => {
    try {
        const {
            message,
            emotion = "neutral",
            phone,
            language = "en",
            callerName,
            callerEmail,
        } = req.body;

        if (!message) return res.status(400).json({ error: "Message is required" });

        // 1. Analyze risk
        const risk = analyzeRisk(message, emotion);

        // 2. Create ServiceNow incident
        const incident = await serviceNowService.createIncident({
            short_description: `Potential fraud reported via AI Chatbot — Risk: ${risk.riskLevel}`,
            description: `Customer message: "${message}"\nEmotion detected: ${emotion}\nRisk Score: ${risk.score}/100\nTriggers: ${risk.triggers.join(", ")}`,
            caller_id: callerEmail || req.user?.email || "",
            urgency: risk.riskLevel === "high" ? "1" : risk.riskLevel === "medium" ? "2" : "3",
            impact: risk.riskLevel === "high" ? "1" : "2",
            priority: risk.riskLevel === "high" ? "1" : "2",
            category: "Financial Fraud",
            u_risk_score: risk.score,
            u_emotion_detected: emotion,
            u_transcript: message,
            u_caller_phone: phone || "",
            u_caller_email: callerEmail || req.user?.email || "",
        });

        // 3. Audit log
        await audit.logFraudDetection({
            riskScore: risk.score,
            riskLevel: risk.riskLevel,
            incidentId: incident.number,
            userId: req.user?.id,
            channel: "AI Chatbot",
            triggers: risk.triggers,
        });

        await audit.logIncidentCreated({
            incidentId: incident.number,
            description: incident.short_description || message.substring(0, 100),
            userId: req.user?.id,
            priority: incident.priority,
            category: "Financial Fraud",
            simulated: incident.simulated,
        });

        // 4. Send alerts to all channels (if phone provided)
        let alertResults = null;
        const alertPhone = phone || req.user?.phone;
        if (alertPhone) {
            alertResults = await twilioService.sendFraudAlerts(alertPhone, {
                riskScore: risk.score,
                incidentId: incident.number,
                customerName: callerName || req.user?.name || "Customer",
                language,
            });

            // Log each alert
            for (const channel of ["sms", "whatsapp", "voice"]) {
                if (alertResults[channel]) {
                    await audit.logAlertSent({
                        channel,
                        to: alertPhone,
                        sid: alertResults[channel].sid,
                        simulated: alertResults[channel].simulated,
                        incidentId: incident.number,
                        userId: req.user?.id,
                    });
                }
            }
        }

        res.json({
            success: true,
            risk,
            incident: {
                number: incident.number,
                priority: incident.priority,
                state: incident.state,
                simulated: incident.simulated,
            },
            alerts: alertResults,
            ticketNumber: incident.number,
        });
    } catch (err) {
        await audit.error("FRAUD_REPORT_FAILED", {
            message: err.message,
            userId: req.user?.id,
            meta: { body: req.body },
        });
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/fraud/analyze ──────────────────────────
router.post("/analyze", authMiddleware, (req, res) => {
    const { message, emotion } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    const risk = analyzeRisk(message, emotion);
    res.json({ risk });
});

module.exports = router;
