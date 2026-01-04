/**
 * PII Encryption Middleware
 * Enterprise SaaS Architecture - Data Protection
 *
 * Automatically encrypts/decrypts PII fields in API requests/responses.
 *
 * Usage:
 * - Encryption: Request body PII fields are encrypted before reaching handlers
 * - Decryption: Response PII fields are decrypted before sending to client
 *
 * Note: This middleware is opt-in and should be applied to routes handling PII.
 */

import { NextFunction, Request, Response } from 'express';

import { decryptPII, encryptPII, isEncrypted, PII_FIELDS } from '../services/encryption/EncryptionService.js';
import logger from '../utils/Logger.ts';

// ==========================================
// CONFIGURATION
// ==========================================

/**
 * Routes that should have PII encryption applied
 */
const PII_ENCRYPTION_ROUTES = [
    '/api/users',
    '/api/auth/register',
    '/api/organization-data',
    '/api/gdpr',
    '/api/settings/profile',
];

/**
 * Routes that should skip PII processing
 */
const SKIP_ROUTES = ['/api/health', '/api/ping', '/api/csrf-token'];

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Encrypt PII fields in request body
 * Applied before route handlers
 */
export function encryptRequestPII(req: Request, _res: Response, next: NextFunction): void {
    try {
        // Skip for non-applicable routes
        if (SKIP_ROUTES.some((route) => req.path.startsWith(route))) {
            return next();
        }

        // Only encrypt for write operations
        if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
            return next();
        }

        // Encrypt PII in request body
        if (req.body && typeof req.body === 'object') {
            req.body = encryptPII(req.body);
        }

        next();
    } catch (error) {
        logger.error('[PIIEncryption] Request encryption error:', error);
        next(); // Continue without encryption on error
    }
}

/**
 * Decrypt PII fields in response
 * Uses response interceptor pattern
 */
export function decryptResponsePII(req: Request, res: Response, next: NextFunction): void {
    // Skip for non-applicable routes
    if (SKIP_ROUTES.some((route) => req.path.startsWith(route))) {
        return next();
    }

    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json to decrypt PII before sending
    res.json = function (body: unknown): Response {
        try {
            if (body && typeof body === 'object') {
                if (Array.isArray(body)) {
                    body = body.map((item) =>
                        typeof item === 'object' && item !== null ? decryptPII(item as Record<string, unknown>) : item,
                    );
                } else {
                    body = decryptPII(body as Record<string, unknown>);
                }
            }
        } catch (error) {
            logger.error('[PIIEncryption] Response decryption error:', error);
            // Send original body on error
        }

        return originalJson(body);
    };

    next();
}

/**
 * Combined PII encryption middleware
 * Handles both request encryption and response decryption
 */
export function piiEncryptionMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Check if route should have PII encryption
    const shouldApply = PII_ENCRYPTION_ROUTES.some((route) => req.path.startsWith(route));

    if (!shouldApply) {
        return next();
    }

    // Apply response decryption interceptor
    decryptResponsePII(req, res, () => {
        // Apply request encryption
        encryptRequestPII(req, res, next);
    });
}

/**
 * Middleware for routes that explicitly need PII protection
 * Use: app.post('/api/sensitive', piiProtection, handler)
 */
export function piiProtection(req: Request, res: Response, next: NextFunction): void {
    decryptResponsePII(req, res, () => {
        encryptRequestPII(req, res, next);
    });
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Check if an object contains encrypted PII
 */
export function hasEncryptedPII(obj: Record<string, unknown>): boolean {
    if (!obj || typeof obj !== 'object') return false;

    for (const field of PII_FIELDS) {
        if (field in obj && typeof obj[field] === 'string' && isEncrypted(obj[field] as string)) {
            return true;
        }
    }

    return false;
}

/**
 * Get list of encrypted fields in an object
 */
export function getEncryptedFields(obj: Record<string, unknown>): string[] {
    if (!obj || typeof obj !== 'object') return [];

    const encryptedFields: string[] = [];

    for (const field of PII_FIELDS) {
        if (field in obj && typeof obj[field] === 'string' && isEncrypted(obj[field] as string)) {
            encryptedFields.push(field);
        }
    }

    return encryptedFields;
}

// ==========================================
// EXPORTS
// ==========================================

export default {
    encryptRequestPII,
    decryptResponsePII,
    piiEncryptionMiddleware,
    piiProtection,
    hasEncryptedPII,
    getEncryptedFields,
    PII_ENCRYPTION_ROUTES,
};
