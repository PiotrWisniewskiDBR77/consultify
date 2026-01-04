/**
 * Rate Limiting Middleware
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides configurable rate limiting for different types of endpoints
 * Uses Redis for distributed rate limiting across multiple instances
 */

import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import RedisRateLimitStore from '../utils/RedisRateLimitStore.ts';

// ==========================================
// RATE LIMIT CONFIGURATIONS
// ==========================================

/**
 * Auth endpoints rate limiter
 * 5 requests per minute per IP
 */
export const authRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // 5 requests per window
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ windowMs: 1 * 60 * 1000 }),
    validate: false,
    // Default keyGenerator uses req.ip, which is what we want.
});

/**
 * AI endpoints rate limiter
 * 100 requests per minute per user
 */
export const aiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: 'Too many AI requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ windowMs: 1 * 60 * 1000 }),
    validate: false, // Disable all validation to prevent IPv6 errors
    keyGenerator: (req: Request) => {
        // Use user ID if available, otherwise IP
        const userId = (req as any).user?.id;
        if (userId) {
            return `ai:user:${userId}`;
        }
        return `ai:ip:${req.ip || 'unknown'}`;
    },
});

/**
 * File upload rate limiter
 * 10 requests per minute per user
 */
export const fileUploadRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per window
    message: 'Too many file uploads, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ windowMs: 1 * 60 * 1000 }),
    validate: false,
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id;
        if (userId) {
            return `upload:user:${userId}`;
        }
        return `upload:ip:${req.ip || 'unknown'}`;
    },
});

/**
 * Admin endpoints rate limiter
 * 100 requests per minute per user
 */
export const adminRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
    message: 'Too many admin requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ windowMs: 1 * 60 * 1000 }),
    validate: false,
    keyGenerator: (req: Request) => {
        const userId = (req as any).user?.id;
        if (userId) {
            return `admin:user:${userId}`;
        }
        return `admin:ip:${req.ip || 'unknown'}`;
    },
});

/**
 * Default API rate limiter
 * 60 requests per minute per IP
 */
export const defaultRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per window
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisRateLimitStore({ windowMs: 1 * 60 * 1000 }),
    validate: false,
    // Default keyGenerator uses req.ip
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get appropriate rate limiter based on route path
 */
export function getRateLimiterForRoute(path: string): ReturnType<typeof rateLimit> {
    // Auth routes
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
        return authRateLimiter;
    }

    // AI routes
    if (path.includes('/ai') || path.includes('/chat') || path.includes('/llm')) {
        return aiRateLimiter;
    }

    // File upload routes
    if (path.includes('/upload') || path.includes('/file') || path.includes('/media')) {
        return fileUploadRateLimiter;
    }

    // Admin routes
    if (path.includes('/admin') || path.includes('/superadmin')) {
        return adminRateLimiter;
    }

    // Default
    return defaultRateLimiter;
}
