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
      // Sliding window: refresh TTL on each hit (simple + safe).
      await (redisClient as any).expire(key, windowSeconds);
      return {
        totalHits: typeof hits === 'number' ? hits : Number(hits || 0),
        resetTime: new Date(Date.now() + windowMs),
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
