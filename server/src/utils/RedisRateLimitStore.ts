/**
 * Redis Rate Limit Store
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides a simple wrapper around Redis for rate limiting management.
 */

import redisClient from './RedisClient.js';

export class RedisRateLimitStore {
  constructor(private options: { windowMs: number }) {}

  /**
   * express-rate-limit store interface
   * Returns current hit count + a reset timestamp.
   *
   * Implementation notes:
   * - Uses Redis INCR + EXPIRE for a simple (sliding) window.
   * - If Redis is not configured or the client is mocked, this still behaves deterministically
   *   but will not enforce distributed limits (acceptable for dev/test; production should use Redis).
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const windowMs = this.options.windowMs || 60000;
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    try {
      const hits = await (redisClient as any).incr(key);
      let ttlSeconds = await (redisClient as any).ttl?.(key);
      if (typeof ttlSeconds !== 'number' || ttlSeconds < 0) {
        await (redisClient as any).expire(key, windowSeconds);
        ttlSeconds = windowSeconds;
      }
      const numHits = typeof hits === 'number' ? hits : Number(hits || 0);
      return {
        totalHits: Math.max(1, numHits),
        resetTime: new Date(Date.now() + Math.max(1, ttlSeconds) * 1000),
      };
    } catch {
      // Conservative fallback: count as 1 hit and set a reset time.
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + windowMs),
      };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await (redisClient as any).decr(key);
    } catch {
      // ignore
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await (redisClient as any).del(key);
    } catch {
      // ignore
    }
  }

  init(options: any) {
    this.options = options || this.options;
  }
}

export default RedisRateLimitStore;
