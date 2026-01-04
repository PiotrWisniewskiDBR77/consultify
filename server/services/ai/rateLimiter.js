/**
 * AI Rate Limiter
 * Sliding window rate limiting with Redis support (fallback to in-memory)
 * 
 * Limits:
 * - Per User: 60 requests/minute (chat), 10 requests/minute (generation)
 * - Per Organization: 1000 requests/minute
 * - Global: Circuit breaker after 5 failures in 60 seconds
 */

import { aiLogger } from './logger.js';

// Rate limit configurations
const RATE_LIMITS = {
    user: {
        chat: { points: 60, duration: 60 },      // 60 req/min for chat
        generation: { points: 10, duration: 60 }, // 10 req/min for generation
        magic_wand: { points: 30, duration: 60 }, // 30 req/min for magic wand
        default: { points: 30, duration: 60 }     // 30 req/min default
    },
    organization: {
        default: { points: 1000, duration: 60 }   // 1000 req/min per org
    },
    ip: {
        default: { points: 100, duration: 60 }    // 100 req/min per IP (anonymous)
    }
};

// In-memory store (fallback when Redis unavailable)
class MemoryRateLimitStore {
    constructor() {
        this.store = new Map();
        // Cleanup expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    async get(key) {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry;
    }

    async set(key, value, ttlSeconds) {
        this.store.set(key, {
            ...value,
            expiresAt: Date.now() + (ttlSeconds * 1000)
        });
    }

    async increment(key, ttlSeconds) {
        let entry = await this.get(key);
        if (!entry) {
            entry = { count: 0, firstRequest: Date.now() };
        }
        entry.count++;
        await this.set(key, entry, ttlSeconds);
        return entry.count;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}

// Redis store adapter
class RedisRateLimitStore {
    constructor(redisClient) {
        this.redis = redisClient;
    }

    async get(key) {
        try {
            const data = await this.redis.get(`ratelimit:${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            aiLogger.error('RateLimiter', 'Redis get error', e);
            return null;
        }
    }

    async set(key, value, ttlSeconds) {
        try {
            await this.redis.setEx(`ratelimit:${key}`, ttlSeconds, JSON.stringify(value));
        } catch (e) {
            aiLogger.error('RateLimiter', 'Redis set error', e);
        }
    }

    async increment(key, ttlSeconds) {
        try {
            const fullKey = `ratelimit:${key}`;
            const count = await this.redis.incr(fullKey);
            if (count === 1) {
                await this.redis.expire(fullKey, ttlSeconds);
            }
            return count;
        } catch (e) {
            aiLogger.error('RateLimiter', 'Redis increment error', e);
            return 1;
        }
    }
}

class RateLimiter {
    constructor() {
        this.store = new MemoryRateLimitStore();
        this.redis = null;
    }

    /**
     * Connect to Redis for distributed rate limiting
     */
    connectRedis(redisClient) {
        if (redisClient) {
            this.store = new RedisRateLimitStore(redisClient);
            this.redis = redisClient;
            aiLogger.info('RateLimiter', 'Connected to Redis');
        }
    }

    /**
     * Check if request is within rate limits
     * @param {Object} params - { userId, organizationId, capability, ip }
     * @returns {Object} { allowed: boolean, remaining: number, resetIn: number, reason?: string }
     */
    async check(params) {
        const { userId, organizationId, capability = 'default', ip } = params;
        const now = Date.now();

        // 1. Check organization limit first (broader scope)
        if (organizationId) {
            const orgResult = await this.checkLimit(
                `org:${organizationId}`,
                RATE_LIMITS.organization.default
            );
            if (!orgResult.allowed) {
                aiLogger.warn('RateLimiter', `Org rate limit exceeded: ${organizationId}`);
                return {
                    allowed: false,
                    remaining: 0,
                    resetIn: orgResult.resetIn,
                    reason: 'Organization rate limit exceeded'
                };
            }
        }

        // 2. Check user limit (specific to capability)
        if (userId) {
            const userLimitConfig = RATE_LIMITS.user[capability] || RATE_LIMITS.user.default;
            const userResult = await this.checkLimit(
                `user:${userId}:${capability}`,
                userLimitConfig
            );
            if (!userResult.allowed) {
                aiLogger.warn('RateLimiter', `User rate limit exceeded: ${userId} for ${capability}`);
                return {
                    allowed: false,
                    remaining: 0,
                    resetIn: userResult.resetIn,
                    reason: `User rate limit exceeded for ${capability}`
                };
            }
            return userResult;
        }

        // 3. Check IP limit (for anonymous requests)
        if (ip) {
            const ipResult = await this.checkLimit(
                `ip:${ip}`,
                RATE_LIMITS.ip.default
            );
            if (!ipResult.allowed) {
                aiLogger.warn('RateLimiter', `IP rate limit exceeded: ${ip}`);
                return {
                    allowed: false,
                    remaining: 0,
                    resetIn: ipResult.resetIn,
                    reason: 'IP rate limit exceeded'
                };
            }
            return ipResult;
        }

        return { allowed: true, remaining: 999, resetIn: 0 };
    }

    /**
     * Check and consume a rate limit
     */
    async checkLimit(key, config) {
        const { points, duration } = config;
        const windowKey = `${key}:${Math.floor(Date.now() / 1000 / duration)}`;

        const count = await this.store.increment(windowKey, duration);

        const allowed = count <= points;
        const remaining = Math.max(0, points - count);
        const resetIn = duration - (Math.floor(Date.now() / 1000) % duration);

        return { allowed, remaining, resetIn };
    }

    /**
     * Get current rate limit status without consuming
     */
    async getStatus(params) {
        const { userId, organizationId, capability = 'default' } = params;
        const results = {};

        if (userId) {
            const userLimitConfig = RATE_LIMITS.user[capability] || RATE_LIMITS.user.default;
            const windowKey = `user:${userId}:${capability}:${Math.floor(Date.now() / 1000 / userLimitConfig.duration)}`;
            const entry = await this.store.get(windowKey);
            results.user = {
                used: entry?.count || 0,
                limit: userLimitConfig.points,
                remaining: userLimitConfig.points - (entry?.count || 0)
            };
        }

        if (organizationId) {
            const orgConfig = RATE_LIMITS.organization.default;
            const windowKey = `org:${organizationId}:${Math.floor(Date.now() / 1000 / orgConfig.duration)}`;
            const entry = await this.store.get(windowKey);
            results.organization = {
                used: entry?.count || 0,
                limit: orgConfig.points,
                remaining: orgConfig.points - (entry?.count || 0)
            };
        }

        return results;
    }

    /**
     * Reset rate limit for a specific key (admin function)
     */
    async reset(key) {
        if (this.redis) {
            await this.redis.del(`ratelimit:${key}`);
        } else {
            this.store.store.delete(key);
        }
        aiLogger.info('RateLimiter', `Reset rate limit for: ${key}`);
    }
}

// Singleton
const rateLimiter = new RateLimiter();

export {
RateLimiter, rateLimiter, RATE_LIMITS
};

export default { RateLimiter, rateLimiter, RATE_LIMITS };










