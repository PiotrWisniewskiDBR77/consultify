/**
 * CSRF Protection Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Implements CSRF token generation and validation for stateful applications.
 * Uses Double Submit Cookie pattern adapted for JWT-based SPAs.
 *
 * OWASP Compliant - Production Hardened
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

// ==========================================
// CONFIGURATION
// ==========================================

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Token validity period in milliseconds (1 hour)
const TOKEN_VALIDITY_MS = 60 * 60 * 1000;

// ==========================================
// TOKEN STORE (In-memory - use Redis for production clustering)
// ==========================================

interface TokenInfo {
    token: string;
    createdAt: number;
}

const tokenStore = new Map<string, TokenInfo>();

// Cleanup expired tokens every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, info] of tokenStore.entries()) {
        if (now - info.createdAt > TOKEN_VALIDITY_MS) {
            tokenStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Generate a cryptographically secure random token
 */
function generateToken(): string {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Get session identifier from request
 * Uses IP + User-Agent as fallback if no JWT user
 */
function getSessionId(req: Request): string {
    // Try to get user ID from JWT (if available after auth middleware)
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (userId) {
        return `user:${userId}`;
    }

    // Fallback to IP + User-Agent hash for anonymous users
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const hash = crypto.createHash('sha256').update(`${ip}:${userAgent}`).digest('hex').slice(0, 16);
    return `session:${hash}`;
}

// ==========================================
// MIDDLEWARE EXPORTS
// ==========================================

/**
 * CSRF Token Generation Middleware
 * Sets a CSRF token in cookie and response header
 */
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const sessionId = getSessionId(req);

    // Check if we have a valid existing token
    const existing = tokenStore.get(sessionId);
    const now = Date.now();

    let token: string;

    if (existing && now - existing.createdAt < TOKEN_VALIDITY_MS) {
        // Reuse existing token
        token = existing.token;
    } else {
        // Generate new token
        token = generateToken();
        tokenStore.set(sessionId, { token, createdAt: now });
    }

    // Set token in cookie (HttpOnly: false so JavaScript can read it)
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: TOKEN_VALIDITY_MS,
    });

    // Also set in response header for convenience
    res.setHeader(CSRF_HEADER_NAME, token);

    next();
};

/**
 * CSRF Validation Middleware
 * Validates the CSRF token from header/body against the stored token
 */
export const csrfValidationMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Skip validation for safe HTTP methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const sessionId = getSessionId(req);
    const storedInfo = tokenStore.get(sessionId);

    if (!storedInfo) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_MISSING',
            message: 'No CSRF token found for this session. Please refresh and try again.',
        });
        return;
    }

    // Get token from request (header first, then body, then cookie)
    const submittedToken =
        (req.headers[CSRF_HEADER_NAME] as string) ||
        (req.body?._csrf as string) ||
        req.cookies?.[CSRF_COOKIE_NAME];

    if (!submittedToken) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_NOT_PROVIDED',
            message: 'CSRF token was not provided in the request.',
        });
        return;
    }

    // Constant-time comparison to prevent timing attacks
    const storedBuffer = Buffer.from(storedInfo.token);
    const submittedBuffer = Buffer.from(submittedToken);

    if (storedBuffer.length !== submittedBuffer.length) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_INVALID',
            message: 'The provided CSRF token is invalid.',
        });
        return;
    }

    if (!crypto.timingSafeEqual(storedBuffer, submittedBuffer)) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_MISMATCH',
            message: 'CSRF token mismatch. Please refresh and try again.',
        });
        return;
    }

    // Check token expiry
    if (Date.now() - storedInfo.createdAt > TOKEN_VALIDITY_MS) {
        tokenStore.delete(sessionId);
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_EXPIRED',
            message: 'CSRF token has expired. Please refresh and try again.',
        });
        return;
    }

    next();
};

/**
 * Handler to get a fresh CSRF token (for SPAs)
 */
export const getCsrfTokenHandler = (req: Request, res: Response): void => {
    const sessionId = getSessionId(req);
    const token = generateToken();

    tokenStore.set(sessionId, { token, createdAt: Date.now() });

    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: TOKEN_VALIDITY_MS,
    });

    res.json({ token });
};

export default csrfTokenMiddleware;
