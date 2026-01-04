/**
 * Redis Rate Limit Store
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * A simple Redis store for express-rate-limit
 * Uses the existing Redis client connection
 */

import type { IncrementResponse, Store } from 'express-rate-limit';

import { getRedisClient, isRedisConnected } from '../../services/ai/redisClient.js';
import logger from './Logger.ts';

// ==========================================
// TYPES
// ==========================================

interface RedisStoreOptions {
    windowMs?: number;
    prefix?: string;
    prefix?: string;
}

// ==========================================
// REDIS STORE IMPLEMENTATION
// ==========================================

/**
 * Redis store for express-rate-limit
 */
export class RedisRateLimitStore implements Store {
    public windowMs: number;
    public prefix: string;

    constructor(options: RedisStoreOptions) {
        this.windowMs = options.windowMs;
        this.prefix = options.prefix || 'rl:';
    }

    init(options: RedisStoreOptions): void {
        this.windowMs = options.windowMs;
        if (options.prefix) {
            this.prefix = options.prefix;
        }
    }

    async increment(key: string): Promise<IncrementResponse> {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();

            // Check connectivity
            if (!isRedisConnected() || !client) {
                // Fallback to memory-like behavior (fail open)
                // Return a safe object to allow traffic
                return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
            }

            const hits = await client.incr(rKey);

            // CRITICAL FIX: express-rate-limit v8 requires positive integer
            // Redis incr returns 0 on fresh keys or null on errors
            const safeHits = typeof hits === 'number' && hits > 0 ? hits : 1;

            if (safeHits === 1) {
                await client.expire(rKey, Math.ceil(this.windowMs / 1000));
            }

            const resetTime = new Date(Date.now() + this.windowMs); // Approximate
            return {
                totalHits: safeHits,
                resetTime,
            };
        } catch (error: unknown) {
            logger.error('[RateLimit] Redis error:', error);
            // Fail open - must return a positive integer for totalHits (v8 requirement)
            return {
                totalHits: 1,
                resetTime: new Date(Date.now() + (this.windowMs || 60000)),
            };
        }
    }

    async decrement(key: string): Promise<void> {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                await client.decr(rKey);
            }
        } catch (error: unknown) {
            // Ignore
        }
    }

    async resetKey(key: string): Promise<void> {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                await client.del(rKey);
            }
        } catch (error: unknown) {
            // Ignore
        }
    }

    /**
     * Get current hit count for a key (required by express-rate-limit v8)
     */
    async get(key: string): Promise<IncrementResponse | undefined> {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();

            if (!isRedisConnected() || !client) {
                // Fail open - return undefined to indicate no stored state
                return undefined;
            }

            const hits = await client.get(rKey);

            // If key doesn't exist, return undefined (express-rate-limit handles this)
            if (hits === null || hits === undefined) {
                return undefined;
            }

            const parsedHits = parseInt(String(hits), 10);
            // CRITICAL: Must return positive integer or undefined
            const safeHits = parsedHits > 0 ? parsedHits : 1;

            return {
                totalHits: safeHits,
                resetTime: new Date(Date.now() + this.windowMs),
            };
        } catch (error: unknown) {
            logger.error('[RateLimit] Redis get error:', error);
            // Fail open - return undefined to let express-rate-limit use defaults
            return undefined;
        }
    }
}

export default RedisRateLimitStore;
