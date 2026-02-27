// ============================================================
// Audit Service — Structured logging with MongoDB persistence
// Logs all security events, API calls, and fraud detections
// ============================================================

const mongoose = require("mongoose");

// ── Audit Log Model ──────────────────────────────────
const auditLogSchema = new mongoose.Schema({
    level: { type: String, enum: ["info", "warn", "error", "critical"], default: "info" },
    action: { type: String, required: true, index: true },
    message: { type: String, default: "" },
    userId: { type: String, default: null },
    ip: { type: String, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    statusCode: { type: Number, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
});

// TTL index: auto-delete logs after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

let AuditLog;
try {
    AuditLog = mongoose.model("AuditLog");
} catch {
    AuditLog = mongoose.model("AuditLog", auditLogSchema);
}

// In-memory log buffer (always available)
const logBuffer = [];
const MAX_BUFFER = 1000;

// ── Log Function ─────────────────────────────────────
async function log(level, action, data = {}) {
    const entry = {
        level,
        action,
        message: data.message || "",
        userId: data.userId || null,
        ip: data.ip || null,
        method: data.method || null,
        path: data.path || null,
        statusCode: data.statusCode || null,
        meta: data.meta || {},
        timestamp: new Date(),
    };

    // Console output
    const icon = { info: "ℹ️", warn: "⚠️", error: "❌", critical: "🚨" }[level] || "📋";
    console.log(`${icon} [AUDIT] ${action}: ${entry.message || ""}`, entry.meta.incidentId ? `(${entry.meta.incidentId})` : "");

    // In-memory buffer
    logBuffer.push(entry);
    if (logBuffer.length > MAX_BUFFER) logBuffer.shift();

    // MongoDB persistence (non-blocking)
    try {
        if (mongoose.connection.readyState === 1) {
            await AuditLog.create(entry);
        }
    } catch (err) {
        console.warn("Audit DB write failed:", err.message);
    }

    return entry;
}

// ── Convenience Methods ──────────────────────────────
const info = (action, data) => log("info", action, data);
const warn = (action, data) => log("warn", action, data);
const error = (action, data) => log("error", action, data);
const critical = (action, data) => log("critical", action, data);

// ── Predefined Actions ──────────────────────────────
async function logFraudDetection(data) {
    return critical("FRAUD_DETECTED", {
        message: `Fraud detected — Risk: ${data.riskScore}/100 — ${data.riskLevel}`,
        userId: data.userId,
        meta: {
            riskScore: data.riskScore,
            riskLevel: data.riskLevel,
            incidentId: data.incidentId,
            channel: data.channel,
            triggers: data.triggers,
        },
    });
}

async function logAlertSent(data) {
    return info("ALERT_SENT", {
        message: `${data.channel} alert sent to ${data.to}`,
        userId: data.userId,
        meta: {
            channel: data.channel,
            to: data.to,
            sid: data.sid,
            simulated: data.simulated,
            incidentId: data.incidentId,
        },
    });
}

async function logIncidentCreated(data) {
    return info("INCIDENT_CREATED", {
        message: `Incident ${data.incidentId} created — ${data.description}`,
        userId: data.userId,
        meta: {
            incidentId: data.incidentId,
            priority: data.priority,
            category: data.category,
            simulated: data.simulated,
        },
    });
}

async function logApiCall(req, res, duration) {
    return info("API_CALL", {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        ip: req.ip || req.connection?.remoteAddress,
        userId: req.user?.id || null,
        meta: { duration: `${duration}ms`, userAgent: req.get("User-Agent")?.substring(0, 100) },
    });
}

async function logAuthEvent(action, data) {
    return info(action, {
        message: data.message,
        userId: data.userId,
        ip: data.ip,
        meta: { email: data.email, success: data.success },
    });
}

// ── Get Logs ─────────────────────────────────────────
async function getLogs(filter = {}, limit = 100) {
    try {
        if (mongoose.connection.readyState === 1) {
            const query = {};
            if (filter.level) query.level = filter.level;
            if (filter.action) query.action = { $regex: filter.action, $options: "i" };
            if (filter.userId) query.userId = filter.userId;
            return await AuditLog.find(query).sort({ timestamp: -1 }).limit(limit).lean();
        }
    } catch { /* fallback */ }

    // In-memory fallback
    let logs = [...logBuffer];
    if (filter.level) logs = logs.filter(l => l.level === filter.level);
    if (filter.action) logs = logs.filter(l => l.action.includes(filter.action));
    return logs.slice(-limit).reverse();
}

module.exports = {
    log, info, warn, error, critical,
    logFraudDetection,
    logAlertSent,
    logIncidentCreated,
    logApiCall,
    logAuthEvent,
    getLogs,
    AuditLog,
};
