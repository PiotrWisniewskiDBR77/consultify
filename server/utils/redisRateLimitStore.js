const client = require('./redisClient');

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
            // Check connectivity
            if (!client.isOpen) {
                // Fallback to memory-like behavior (return 1 to allow request but warn)
                // Or easier: throw error to let RateLimit handle it (it might not handle store errors gracefully without config)
                // Better: Just return a safe object.
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
            // Fail open
            return { totalHits: 0, resetTime: new Date() };
        }
    }

    async decrement(key) {
        const rKey = this.prefix + key;
        try {
            if (client.isOpen) {
                await client.decr(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }

    async resetKey(key) {
        const rKey = this.prefix + key;
        try {
            if (client.isOpen) {
                await client.del(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }
}

module.exports = RedisStore;
