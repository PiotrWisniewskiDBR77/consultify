/**
 * Invitation Rate Limiter Middleware
 * 
 * Protects public invitation endpoints from abuse:
 * - Token validation: 20 requests per 10 minutes per IP
 * - Acceptance: 5 failed attempts per 15 minutes per IP → temporary block
 * 
 * Uses Redis-backed storage with in-memory fallback
 * Suitable for production clusters with horizontal scaling
 */

import RedisStore from '../src/utils/RedisStore.js';

// Redis-backed rate limit stores with in-memory fallback
const validateRateLimitsStore = new RedisStore('inv:validate:');
const acceptFailuresStore = new RedisStore('inv:accept:');

// Configuration
const VALIDATE_LIMIT = 20; // requests
const VALIDATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const VALIDATE_WINDOW_SECONDS = Math.ceil(VALIDATE_WINDOW_MS / 1000);

const ACCEPT_FAIL_LIMIT = 5; // failed attempts
const ACCEPT_FAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const ACCEPT_FAIL_WINDOW_SECONDS = Math.ceil(ACCEPT_FAIL_WINDOW_MS / 1000);
const ACCEPT_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block
const ACCEPT_BLOCK_DURATION_SECONDS = Math.ceil(ACCEPT_BLOCK_DURATION_MS / 1000);

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
async function validateRateLimiter(req, res, next) {
    const ip = getClientIP(req);
    const now = Date.now();

    try {
        // Get current count from Redis/in-memory
        const countStr = await validateRateLimitsStore.get(ip);
        const count = countStr ? parseInt(countStr, 10) : 0;

        if (count === 0) {
            // First request in window - initialize
            await validateRateLimitsStore.set(ip, '1', VALIDATE_WINDOW_SECONDS);
            return next();
        }

        // Increment count
        const newCount = await validateRateLimitsStore.increment(ip, VALIDATE_WINDOW_SECONDS);

        if (newCount > VALIDATE_LIMIT) {
            // Calculate retry after (approximate, based on TTL)
            const retryAfter = VALIDATE_WINDOW_SECONDS;
            res.set('Retry-After', retryAfter.toString());
            return res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfterSeconds: retryAfter
            });
        }

        next();
    } catch (error) {
        // On error, fail open (allow request)
        console.error('[InvitationRateLimiter] Error in validateRateLimiter:', error);
        next();
    }
}

/**
 * Rate limiter for acceptance endpoint
 * Blocks IP after ACCEPT_FAIL_LIMIT failed attempts
 */
async function acceptRateLimiter(req, res, next) {
    const ip = getClientIP(req);

    try {
        // Check if IP is blocked
        const blockedUntilStr = await acceptFailuresStore.get(`${ip}:blockedUntil`);
        if (blockedUntilStr) {
            const blockedUntil = parseInt(blockedUntilStr, 10);
            const now = Date.now();

            if (blockedUntil > now) {
                const retryAfter = Math.ceil((blockedUntil - now) / 1000);
                res.set('Retry-After', retryAfter.toString());
                return res.status(429).json({
                    error: 'Too many failed attempts. Please try again later.',
                    retryAfterSeconds: retryAfter
                });
            }
        }

        next();
    } catch (error) {
        // On error, fail open (allow request)
        console.error('[InvitationRateLimiter] Error in acceptRateLimiter:', error);
        next();
    }
}

/**
 * Record a failed acceptance attempt
 * Call this when acceptance fails due to invalid token/email
 */
async function recordAcceptFailure(req) {
    const ip = getClientIP(req);
    const now = Date.now();

    try {
        // Get current failure count
        const countStr = await acceptFailuresStore.get(`${ip}:count`);
        const count = countStr ? parseInt(countStr, 10) : 0;

        if (count === 0) {
            // First failure in window
            await acceptFailuresStore.set(`${ip}:count`, '1', ACCEPT_FAIL_WINDOW_SECONDS);
        } else {
            // Increment failure count
            const newCount = await acceptFailuresStore.increment(`${ip}:count`, ACCEPT_FAIL_WINDOW_SECONDS);

            if (newCount >= ACCEPT_FAIL_LIMIT) {
                // Block IP
                const blockedUntil = now + ACCEPT_BLOCK_DURATION_MS;
                await acceptFailuresStore.set(`${ip}:blockedUntil`, String(blockedUntil), ACCEPT_BLOCK_DURATION_SECONDS);
            }
        }
    } catch (error) {
        console.error('[InvitationRateLimiter] Error recording accept failure:', error);
        // Fail silently - don't block user if we can't record failure
    }
}

/**
 * Clear failure record on successful acceptance
 */
async function clearAcceptFailure(req) {
    const ip = getClientIP(req);

    try {
        await acceptFailuresStore.delete(`${ip}:count`);
        await acceptFailuresStore.delete(`${ip}:blockedUntil`);
    } catch (error) {
        console.error('[InvitationRateLimiter] Error clearing accept failure:', error);
        // Fail silently
    }
}

export {
    validateRateLimiter,
    acceptRateLimiter,
    recordAcceptFailure,
    clearAcceptFailure
};

const rateLimiterModule = {
    validateRateLimiter,
    acceptRateLimiter,
    recordAcceptFailure,
    clearAcceptFailure
};

export default rateLimiterModule;
