// ============================================================
// Audit Logger Middleware — Logs every API request
// ============================================================

const audit = require("../services/auditService");

function auditLogger(req, res, next) {
    const start = Date.now();

    // Capture response finish
    res.on("finish", () => {
        const duration = Date.now() - start;

        // Skip health checks and static files from logging
        if (req.originalUrl === "/api/health" || !req.originalUrl.startsWith("/api/")) return;

        audit.logApiCall(req, res, duration).catch(() => { });
    });

    next();
}

module.exports = auditLogger;
