/**
 * Input Sanitization Middleware
 * Enterprise SaaS Architecture - Security Hardening
 *
 * Applies input sanitization to all incoming requests
 */

import { NextFunction, Request, Response } from 'express';

import logger from '../utils/Logger.ts';
import { sanitizeObject, sanitizeString, stripHtml } from '../utils/security.utils.js';

// ==========================================
// CONFIGURATION
// ==========================================

/**
 * Paths that should skip sanitization (e.g., rich text editors)
 */
const SKIP_SANITIZATION_PATHS = [
    '/api/content/html', // HTML content endpoints
    '/api/documents/upload', // File uploads handled separately
];

/**
 * Fields that should preserve HTML (rich text content)
 */
const PRESERVE_HTML_FIELDS = new Set([
    'htmlContent',
    'richTextContent',
    'content', // AI responses often contain markdown
    'description', // May contain markdown
]);

/**
 * Fields that should be stripped of HTML entirely
 */
const STRIP_HTML_FIELDS = new Set(['name', 'title', 'firstName', 'lastName', 'companyName', 'email', 'phone']);

// ==========================================
// SANITIZATION HELPERS
// ==========================================

/**
 * Deep sanitize an object with field-specific rules
 */
function deepSanitize(obj: unknown, parentKey = '', depth = 0): unknown {
    if (depth > 20) return obj; // Prevent stack overflow

    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        // Apply field-specific sanitization
        if (STRIP_HTML_FIELDS.has(parentKey)) {
            return sanitizeString(stripHtml(obj));
        }
        if (PRESERVE_HTML_FIELDS.has(parentKey)) {
            // Only escape dangerous characters, preserve basic HTML
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
        }
        // Default: full sanitization
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map((item, index) => deepSanitize(item, `${parentKey}[${index}]`, depth + 1));
    }

    if (typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
            sanitized[key] = deepSanitize(value, key, depth + 1);
        }
        return sanitized;
    }

    return obj;
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Input Sanitization Middleware
 * Sanitizes request body, query, and params
 */
export function inputSanitizationMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Skip for exempted paths
    const shouldSkip = SKIP_SANITIZATION_PATHS.some((path) => req.path.startsWith(path));

    if (shouldSkip) {
        return next();
    }

    try {
        // Sanitize request body
        if (req.body && typeof req.body === 'object') {
            req.body = deepSanitize(req.body);
        }

        // Sanitize query parameters
        if (req.query && typeof req.query === 'object') {
            for (const [key, value] of Object.entries(req.query)) {
                if (typeof value === 'string') {
                    (req.query as any)[key] = sanitizeString(value);
                } else if (Array.isArray(value)) {
                    (req.query as any)[key] = value.map((v) => (typeof v === 'string' ? sanitizeString(v) : v));
                }
            }
        }

        // Sanitize URL params
        if (req.params && typeof req.params === 'object') {
            const sanitizedParams: Record<string, string> = {};
            for (const [key, value] of Object.entries(req.params)) {
                sanitizedParams[key] = sanitizeString(value);
            }
            req.params = sanitizedParams;
        }

        next();
    } catch (error) {
        logger.error('[InputSanitization] Error sanitizing request:', error);
        // Continue without sanitization rather than blocking the request
        next();
    }
}

/**
 * Query Parameter Sanitization Middleware
 * Lighter version that only sanitizes query params
 */
export function queryParamSanitizationMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (req.query && typeof req.query === 'object') {
        for (const [key, value] of Object.entries(req.query)) {
            if (typeof value === 'string') {
                (req.query as Record<string, unknown>)[key] = sanitizeString(value);
            }
        }
    }
    next();
}

/**
 * SQL Parameter Sanitization Middleware
 * Validates that ID parameters are proper UUIDs
 */
export function sqlParamValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Check common ID parameters
    const idParams = ['id', 'userId', 'organizationId', 'projectId', 'taskId', 'initiativeId'];

    for (const param of idParams) {
        const value = req.params[param] || req.query[param] || req.body?.[param];
        if (value && typeof value === 'string' && !uuidPattern.test(value)) {
            // Only validate if parameter exists and looks like it should be a UUID
            if (param.endsWith('Id') || param === 'id') {
                // Log suspicious input
                logger.warn(`[SQLParamValidation] Invalid UUID format for ${param}: ${value.substring(0, 50)}`);

                res.status(400).json({
                    error: 'Validation Error',
                    message: `Invalid ${param} format`,
                    code: 'INVALID_UUID_FORMAT',
                });
                return;
            }
        }
    }

    next();
}

// ==========================================
// EXPORTS
// ==========================================

export default {
    inputSanitizationMiddleware,
    queryParamSanitizationMiddleware,
    sqlParamValidationMiddleware,
    deepSanitize,
};





