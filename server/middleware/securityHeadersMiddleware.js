/**
 * Security Headers Middleware
 * Step 14: Governance, Security & Enterprise Controls
 * 
 * Adds security headers for SOC2/ISO compliance.
 */

/**
 * Apply security headers to responses
 */
const securityHeaders = (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy (disable unnecessary features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');

    // HSTS (only in production with HTTPS)
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content Security Policy (customize as needed)
    // Allow images from transparenttextures.com for background patterns
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https://www.transparenttextures.com; " +
        "connect-src 'self'; " +
        "font-src 'self' data:; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "frame-src 'none'"
    );

    next();
};

/**
 * Rate limiter factory for sensitive endpoints
 * Uses Redis-backed store with in-memory fallback (suitable for production clustering)
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Max requests per window
 * @param {string} [options.message] - Error message
 */
import RedisStore from '../src/utils/RedisStore.js';

const rateLimitStore = new RedisStore('rl:security:');

const createRateLimiter = ({ windowMs = 60000, max = 100, message = 'Too many requests' }) => {
    const windowSeconds = Math.ceil(windowMs / 1000);

    return async (req, res, next) => {
        const key = `${req.ip}-${req.path}`;

        try {
            // Get current count
            const countStr = await rateLimitStore.get(key);
            const count = countStr ? parseInt(countStr, 10) : 0;

            if (count >= max) {
                // Rate limit exceeded
                const retryAfter = windowSeconds;
                res.setHeader('Retry-After', retryAfter);
                res.setHeader('X-RateLimit-Limit', max);
                res.setHeader('X-RateLimit-Remaining', 0);
                res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

                return res.status(429).json({
                    error: message,
                    retryAfter,
                    code: 'RATE_LIMITED'
                });
            }

            // Increment count
            const newCount = await rateLimitStore.increment(key, windowSeconds);

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, max - newCount));
            res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

            next();
        } catch (error) {
            // On error, fail open (allow request)
            console.error('[SecurityHeadersRateLimiter] Error:', error);
            next();
        }
    };
};

/**
 * Rate limiter presets for common scenarios
 */
const rateLimitPresets = {
    // Sensitive admin operations
    admin: createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 30,
        message: 'Too many admin requests, please slow down'
    }),

    // Authentication endpoints
    auth: createRateLimiter({
        windowMs: 900000, // 15 minutes
        max: 10,
        message: 'Too many authentication attempts, please try again later'
    }),

    // Break-glass operations (very restrictive)
    breakGlass: createRateLimiter({
        windowMs: 3600000, // 1 hour
        max: 5,
        message: 'Break-glass operations are rate limited for security'
    }),

    // Export operations
    export: createRateLimiter({
        windowMs: 300000, // 5 minutes
        max: 10,
        message: 'Export operations are rate limited'
    }),

    // General API
    api: createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 200,
        message: 'Too many requests'
    })
};

/**
 * Request validation middleware factory
 * Validates request body against a simple schema
 * @param {Object} schema - Validation schema
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];

            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push({ field, message: `${field} is required` });
                continue;
            }

            if (value !== undefined && value !== null) {
                if (rules.type === 'string' && typeof value !== 'string') {
                    errors.push({ field, message: `${field} must be a string` });
                }
                if (rules.type === 'number' && typeof value !== 'number') {
                    errors.push({ field, message: `${field} must be a number` });
                }
                if (rules.type === 'boolean' && typeof value !== 'boolean') {
                    errors.push({ field, message: `${field} must be a boolean` });
                }
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push({ field, message: `${field} must be one of: ${rules.enum.join(', ')}` });
                }
                if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
                    errors.push({ field, message: `${field} must be at least ${rules.minLength} characters` });
                }
                if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
                    errors.push({ field, message: `${field} must be at most ${rules.maxLength} characters` });
                }
                if (rules.min && typeof value === 'number' && value < rules.min) {
                    errors.push({ field, message: `${field} must be at least ${rules.min}` });
                }
                if (rules.max && typeof value === 'number' && value > rules.max) {
                    errors.push({ field, message: `${field} must be at most ${rules.max}` });
                }
                if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
                    errors.push({ field, message: `${field} format is invalid` });
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors
            });
        }

        next();
    };
};

// Cleanup is handled by Redis TTL or RedisStore's internal cleanup interval
// No manual cleanup needed

export {
securityHeaders,
    createRateLimiter,
    rateLimitPresets,
    validateRequest
};

export default {
    securityHeaders,
    createRateLimiter,
    rateLimitPresets,
    validateRequest
};
