/**
 * API Key Authentication Middleware
 * Enterprise SaaS Architecture - API Security
 *
 * Authenticates requests using API keys for programmatic access.
 *
 * Usage:
 * - Authorization: Bearer ck_<key>
 * - X-API-Key: ck_<key>
 *
 * Features:
 * - Rate limiting per key
 * - Permission validation
 * - IP whitelist check
 * - Usage tracking
 */

import { NextFunction, Request, Response } from 'express';

import { API_KEY_PERMISSIONS, ApiKey, ApiKeyService } from '../services/ApiKeyService.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface ApiKeyRequest extends Request {
    apiKey?: ApiKey;
    organizationId?: string;
}

// ==========================================
// RATE LIMITING (In-memory, per-key)
// ==========================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(keyId: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window

    let entry = rateLimitStore.get(keyId);

    if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        rateLimitStore.set(keyId, entry);
    }

    entry.count++;
    const remaining = Math.max(0, limit - entry.count);

    return {
        allowed: entry.count <= limit,
        remaining,
        resetAt: entry.resetAt,
    };
}

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [keyId, entry] of rateLimitStore.entries()) {
        if (entry.resetAt < now) {
            rateLimitStore.delete(keyId);
        }
    }
}, 60 * 1000); // Every minute

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Authenticate request using API key
 * Extracts key from Authorization header or X-API-Key header
 */
export async function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    try {
        const apiKey = extractApiKey(req);

        if (!apiKey) {
            res.status(401).json({
                error: 'API key required',
                message: 'Provide API key via Authorization: Bearer ck_<key> or X-API-Key header.',
            });
            return;
        }

        // Get client IP
        const ip = getClientIp(req);

        // Validate key
        const validatedKey = await ApiKeyService.validateKey(apiKey, ip);

        if (!validatedKey) {
            logger.warn('[APIKeyAuth] Invalid API key attempt', { ip, keyPrefix: apiKey.substring(0, 11) });
            res.status(401).json({
                error: 'Invalid API key',
                message: 'The provided API key is invalid, expired, or not authorized for this IP.',
            });
            return;
        }

        // Check rate limit
        const rateLimit = checkRateLimit(validatedKey.id, validatedKey.rateLimit);

        res.setHeader('X-RateLimit-Limit', validatedKey.rateLimit.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000).toString());

        if (!rateLimit.allowed) {
            res.status(429).json({
                error: 'Rate limit exceeded',
                message: `API key rate limit of ${validatedKey.rateLimit} requests/minute exceeded.`,
                retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
            });
            return;
        }

        // Attach to request
        req.apiKey = validatedKey;
        req.organizationId = validatedKey.organizationId;

        next();
    } catch (error) {
        logger.error('[APIKeyAuth] Authentication error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
}

/**
 * Require specific API key permission
 */
export function requireApiKeyPermission(permission: string) {
    return (req: ApiKeyRequest, res: Response, next: NextFunction): void => {
        if (!req.apiKey) {
            res.status(401).json({ error: 'API key authentication required' });
            return;
        }

        if (!ApiKeyService.hasPermission(req.apiKey, permission)) {
            res.status(403).json({
                error: 'Permission denied',
                message: `This action requires the '${permission}' permission.`,
                yourPermissions: req.apiKey.permissions,
            });
            return;
        }

        next();
    };
}

/**
 * Optional API key auth - continues if no key provided
 */
export async function optionalApiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
        // No key provided, continue without
        next();
        return;
    }

    // If key provided, validate it
    await apiKeyAuth(req, res, next);
}

/**
 * Combined auth - accepts either JWT or API key
 */
export function hybridAuth(jwtMiddleware: (req: Request, res: Response, next: NextFunction) => void) {
    return async (req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> => {
        const apiKey = extractApiKey(req);

        if (apiKey) {
            // Use API key auth
            await apiKeyAuth(req, res, next);
        } else {
            // Fall back to JWT auth
            jwtMiddleware(req, res, next);
        }
    };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Extract API key from request
 */
function extractApiKey(req: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ck_')) {
        return authHeader.slice(7); // Remove 'Bearer '
    }

    // Check X-API-Key header
    const xApiKey = req.headers['x-api-key'];
    if (typeof xApiKey === 'string' && xApiKey.startsWith('ck_')) {
        return xApiKey;
    }

    // Check query parameter (not recommended, but supported)
    const queryKey = req.query.api_key;
    if (typeof queryKey === 'string' && queryKey.startsWith('ck_')) {
        return queryKey;
    }

    return null;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}

// ==========================================
// EXPORTS
// ==========================================

export { API_KEY_PERMISSIONS, ApiKeyRequest };

export default {
    apiKeyAuth,
    requireApiKeyPermission,
    optionalApiKeyAuth,
    hybridAuth,
};
