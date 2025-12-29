const { getRedisClient, isRedisConnected } = require('../services/ai/redisClient');

/**
 * A simple Redis store for express-rate-limit
 * Uses the existing Redis client connection
 */
class RedisStore {
    constructor(options) {
        this.windowMs = options.windowMs;
        this.prefix = 'rl:';
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
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
            if (hits === 1) {
                await client.expire(rKey, Math.ceil(this.windowMs / 1000));
            }

            const resetTime = new Date(Date.now() + this.windowMs); // Approximate
            return {
                totalHits: hits,
                resetTime
            };
        } catch (error) {
            console.error('[RateLimit] Redis error:', error);
            // Fail open - must return a positive integer for totalHits (v8 requirement)
            return {
                totalHits: 1,
                resetTime: new Date(Date.now() + (this.windowMs || 60000))
            };
        }
    }

    async decrement(key) {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                await client.decr(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }

    async resetKey(key) {
        const rKey = this.prefix + key;
        try {
            const client = getRedisClient();
            if (isRedisConnected() && client) {
                await client.del(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }
}

module.exports = RedisStore;
