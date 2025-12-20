/**
 * Invitation Rate Limiter Middleware
 * 
 * Protects public invitation endpoints from abuse:
 * - Token validation: 20 requests per 10 minutes per IP
 * - Acceptance: 5 failed attempts per 15 minutes per IP → temporary block
 * 
 * Uses in-memory storage (suitable for single-instance deployments)
 * For production clusters, consider Redis-backed rate limiting
 */

// In-memory rate limit stores
const validateRateLimits = new Map(); // IP -> { count, resetAt }
const acceptFailures = new Map(); // IP -> { count, blockedUntil }

// Configuration
const VALIDATE_LIMIT = 20; // requests
const VALIDATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

const ACCEPT_FAIL_LIMIT = 5; // failed attempts
const ACCEPT_FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCEPT_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

// Cleanup stale entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();

    for (const [ip, data] of validateRateLimits.entries()) {
        if (data.resetAt < now) {
            validateRateLimits.delete(ip);
        }
    }

    for (const [ip, data] of acceptFailures.entries()) {
        if (data.blockedUntil && data.blockedUntil < now) {
            acceptFailures.delete(ip);
        }
    }
}, 5 * 60 * 1000);

/**
 * Get client IP from request
 */
function getClientIP(req) {
    return req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        'unknown';
}

/**
 * Rate limiter for token validation endpoint
 * Allows VALIDATE_LIMIT requests per VALIDATE_WINDOW_MS per IP
 */
function validateRateLimiter(req, res, next) {
    const ip = getClientIP(req);
    const now = Date.now();

    let rateData = validateRateLimits.get(ip);

    if (!rateData || rateData.resetAt < now) {
        // Reset or initialize
        rateData = { count: 1, resetAt: now + VALIDATE_WINDOW_MS };
        validateRateLimits.set(ip, rateData);
        return next();
    }

    rateData.count++;

    if (rateData.count > VALIDATE_LIMIT) {
        const retryAfter = Math.ceil((rateData.resetAt - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        return res.status(429).json({
            error: 'Too many requests. Please try again later.',
            retryAfterSeconds: retryAfter
        });
    }

    next();
}

/**
 * Rate limiter for acceptance endpoint
 * Blocks IP after ACCEPT_FAIL_LIMIT failed attempts
 */
function acceptRateLimiter(req, res, next) {
    const ip = getClientIP(req);
    const now = Date.now();

    const failData = acceptFailures.get(ip);

    if (failData?.blockedUntil && failData.blockedUntil > now) {
        const retryAfter = Math.ceil((failData.blockedUntil - now) / 1000);
        res.set('Retry-After', retryAfter.toString());
        return res.status(429).json({
            error: 'Too many failed attempts. Please try again later.',
            retryAfterSeconds: retryAfter
        });
    }

    next();
}

/**
 * Record a failed acceptance attempt
 * Call this when acceptance fails due to invalid token/email
 */
function recordAcceptFailure(req) {
    const ip = getClientIP(req);
    const now = Date.now();

    let failData = acceptFailures.get(ip);

    if (!failData || (failData.resetAt && failData.resetAt < now)) {
        failData = { count: 1, resetAt: now + ACCEPT_FAIL_WINDOW_MS };
    } else {
        failData.count++;
    }

    if (failData.count >= ACCEPT_FAIL_LIMIT) {
        failData.blockedUntil = now + ACCEPT_BLOCK_DURATION_MS;
    }

    acceptFailures.set(ip, failData);
}

/**
 * Clear failure record on successful acceptance
 */
function clearAcceptFailure(req) {
    const ip = getClientIP(req);
    acceptFailures.delete(ip);
}

module.exports = {
    validateRateLimiter,
    acceptRateLimiter,
    recordAcceptFailure,
    clearAcceptFailure,
    // Expose for testing
    _validateRateLimits: validateRateLimits,
    _acceptFailures: acceptFailures
};
