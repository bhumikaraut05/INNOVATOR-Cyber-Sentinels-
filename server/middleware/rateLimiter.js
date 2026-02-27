// ============================================================
// Rate Limiter Middleware — In-memory IP-based rate limiting
// ============================================================

const rateLimitStore = new Map();

function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 100, message = "Too many requests" } = {}) {
    return (req, res, next) => {
        const key = req.ip || req.connection?.remoteAddress || "unknown";
        const now = Date.now();

        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        const entry = rateLimitStore.get(key);

        // Reset window expired
        if (now > entry.resetAt) {
            entry.count = 1;
            entry.resetAt = now + windowMs;
            return next();
        }

        entry.count++;

        if (entry.count > maxRequests) {
            res.set("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({
                error: message,
                retryAfter: Math.ceil((entry.resetAt - now) / 1000),
            });
        }

        // Set rate limit headers
        res.set("X-RateLimit-Limit", maxRequests);
        res.set("X-RateLimit-Remaining", maxRequests - entry.count);
        res.set("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

        next();
    };
}

// Pre-configured limiters
const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 100, message: "Too many API requests, please try again later." });
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 30, message: "Too many auth attempts, please try again later." });
const alertLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, maxRequests: 20, message: "Too many alert requests, please try again later." });

// Cleanup stale entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.resetAt) rateLimitStore.delete(key);
    }
}, 10 * 60 * 1000);

module.exports = { createRateLimiter, apiLimiter, authLimiter, alertLimiter };
