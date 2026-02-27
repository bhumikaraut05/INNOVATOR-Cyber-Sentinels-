// ============================================================
// Twilio Webhook Signature Validator Middleware
// Validates incoming Twilio webhook requests
// ============================================================

const { validateTwilioSignature } = require("../services/twilioService");

function twilioValidator(req, res, next) {
    // Skip validation in development
    if (process.env.NODE_ENV === "development" || !process.env.TWILIO_AUTH_TOKEN) {
        return next();
    }

    const signature = req.headers["x-twilio-signature"];
    const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const params = req.body || {};

    if (!signature) {
        console.warn("⚠️ Missing Twilio signature on webhook");
        return res.status(403).json({ error: "Missing Twilio signature" });
    }

    const valid = validateTwilioSignature(url, params, signature);
    if (!valid) {
        console.warn("⚠️ Invalid Twilio signature on webhook");
        return res.status(403).json({ error: "Invalid Twilio signature" });
    }

    next();
}

module.exports = twilioValidator;
