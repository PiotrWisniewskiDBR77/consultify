/**
 * CSRF Protection Middleware
 * Enterprise SaaS Architecture - Security Hardening
 *
 * Implements Double Submit Cookie pattern for CSRF protection
 */

import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

// ==========================================
// CONFIGURATION
// ==========================================

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 1000 * 60 * 60, // 1 hour
    path: '/',
};

// Paths that don't require CSRF protection
const CSRF_EXEMPT_PATHS = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/health',
    '/api/ping',
    '/ping',
    '/api/webhooks', // Webhooks have their own signature verification
];

// Methods that don't require CSRF protection
const CSRF_EXEMPT_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// ==========================================
// CSRF TOKEN MANAGEMENT
// ==========================================

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Validate CSRF token using timing-safe comparison
 */
function validateToken(tokenA: string, tokenB: string): boolean {
    if (!tokenA || !tokenB || tokenA.length !== tokenB.length) {
        return false;
    }

    try {
        return crypto.timingSafeEqual(Buffer.from(tokenA), Buffer.from(tokenB));
    } catch {
        return false;
    }
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * CSRF Token Generation Middleware
 * Sets a CSRF token cookie and exposes it via response header
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Check if token already exists in cookie
    let token = req.cookies?.[CSRF_COOKIE_NAME];

    if (!token) {
        token = generateCsrfToken();
        res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    }

    // Expose token in response header for SPA consumption
    res.setHeader('X-CSRF-Token', token);

    // Make token available in request for templates
    (req as Request & { csrfToken?: string }).csrfToken = token;

    next();
}

/**
 * CSRF Validation Middleware
 * Validates the CSRF token on state-changing requests
 */
export function csrfValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip validation for exempt methods
    if (CSRF_EXEMPT_METHODS.includes(req.method)) {
        return next();
    }

    // Skip validation for exempt paths
    const isExempt = CSRF_EXEMPT_PATHS.some((path) => req.path === path || req.path.startsWith(path + '/'));

    if (isExempt) {
        return next();
    }

    // Get token from cookie
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    // Get token from header or body
    const submittedToken = (req.headers[CSRF_HEADER_NAME] as string) || req.body?._csrf || (req.query?._csrf as string);

    if (!cookieToken || !submittedToken) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_MISSING',
            message: 'CSRF token is missing. Please refresh the page and try again.',
        });
        return;
    }

    if (!validateToken(cookieToken, submittedToken)) {
        res.status(403).json({
            error: 'CSRF validation failed',
            code: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token is invalid. Please refresh the page and try again.',
        });
        return;
    }

    next();
}

/**
 * Combined CSRF middleware (token generation + validation)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
    csrfTokenMiddleware(req, res, () => {
        csrfValidationMiddleware(req, res, next);
    });
}

/**
 * CSRF Token API endpoint handler
 * GET /api/csrf-token - Returns a fresh CSRF token
 */
export function getCsrfTokenHandler(req: Request, res: Response): void {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
    res.json({ csrfToken: token });
}

// ==========================================
// EXPORTS
// ==========================================

export default {
    csrfTokenMiddleware,
    csrfValidationMiddleware,
    csrfProtection,
    getCsrfTokenHandler,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
};





