/**
 * Input Sanitization Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides defense-in-depth against Cross-Site Scripting (XSS) attacks
 * by escaping HTML entities in request bodies.
 *
 * OWASP Compliant - Production Hardened
 */

import { NextFunction, Request, Response } from 'express';

// ==========================================
// XSS PROTECTION UTILITIES
// ==========================================

/**
 * Escape HTML entities to prevent XSS attacks
 * Covers OWASP recommended characters for HTML context
 */
function escapeHtml(str: string): string {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .replace(/`/g, '&#x60;')
        .replace(/=/g, '&#x3D;');
}

/**
 * Recursively sanitize an object, escaping all string values
 * Preserves sensitive fields that should not be modified (passwords, tokens)
 */
function sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        return escapeHtml(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }

    if (typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};

        // Fields that should NOT be sanitized (authentication-related)
        const sensitiveFields = new Set([
            'password',
            'passwordHash',
            'token',
            'refreshToken',
            'apiKey',
            'accessToken',
            'idToken',
            'secret',
            'privateKey',
            'clientSecret',
        ]);

        for (const [key, value] of Object.entries(obj)) {
            if (sensitiveFields.has(key)) {
                // Preserve sensitive fields as-is
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitizeObject(value);
            }
        }
        return sanitized;
    }

    // Numbers, booleans, etc. - return as-is
    return obj;
}

// ==========================================
// MIDDLEWARE EXPORTS
// ==========================================

/**
 * Input sanitization middleware for Express
 * Applies XSS protection to all request body content
 *
 * Should be applied AFTER body parsing middleware
 */
export const inputSanitizationMiddleware = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    // Only process if there's a body to sanitize
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
        req.body = sanitizeObject(req.body);
    }

    next();
};

/**
 * Create a configurable sanitization middleware
 * Allows custom configuration of sensitive fields
 */
export const createInputSanitizer = (options: {
    additionalSensitiveFields?: string[];
    skipPaths?: string[];
}) => {
    const skipPaths = new Set(options.skipPaths || []);
    const sensitiveFields = new Set([
        'password',
        'passwordHash',
        'token',
        'refreshToken',
        'apiKey',
        'accessToken',
        'idToken',
        'secret',
        'privateKey',
        'clientSecret',
        ...(options.additionalSensitiveFields || []),
    ]);

    function sanitize(obj: unknown): unknown {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'string') return escapeHtml(obj);
        if (Array.isArray(obj)) return obj.map(sanitize);

        if (typeof obj === 'object') {
            const sanitized: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sensitiveFields.has(key) ? value : sanitize(value);
            }
            return sanitized;
        }

        return obj;
    }

    return (req: Request, _res: Response, next: NextFunction): void => {
        // Skip specified paths
        if (skipPaths.has(req.path)) {
            return next();
        }

        if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            req.body = sanitize(req.body);
        }

        next();
    };
};

export default inputSanitizationMiddleware;
