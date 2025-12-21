const client = require('./redisClient');

/**
 * A simple Redis store for express-rate-limit
 * Uses the existing Redis client connection
 */
class RedisStore {
    constructor(options: { windowMs: number }) {
        this.windowMs = options.windowMs;
        this.prefix = 'rl:';
    }

    init(options: { windowMs: number }): void {
        this.windowMs = options.windowMs;
    }

    async increment(key: string) {
        const rKey = this.prefix + key;
        try {
            // Check connectivity
            const redisClient = client as { isOpen?: boolean; incr?: (key: string) => Promise<number>; expire?: (key: string, seconds: number) => Promise<boolean> };
            
            if (!redisClient.isOpen) {
                // Fallback to memory-like behavior (return 1 to allow request but warn)
                return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
            }

            const hits = await redisClient.incr!(rKey);
            if (hits === 1) {
                await redisClient.expire!(rKey, Math.ceil(this.windowMs / 1000));
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

    async decrement(key: string): Promise<void> {
        const rKey = this.prefix + key;
        try {
            const redisClient = client as { isOpen?: boolean; decr?: (key: string) => Promise<number> };
            if (redisClient.isOpen) {
                await redisClient.decr!(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }

    async resetKey(key: string): Promise<void> {
        const rKey = this.prefix + key;
        try {
            const redisClient = client as { isOpen?: boolean; del?: (key: string) => Promise<number> };
            if (redisClient.isOpen) {
                await redisClient.del!(rKey);
            }
        } catch (error) {
            // Ignore
        }
    }
}

module.exports = RedisStore;

