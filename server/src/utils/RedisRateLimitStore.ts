/**
 * Redis Rate Limit Store
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Provides a simple wrapper around Redis for rate limiting management.
 */

import redisClient from './RedisClient.js';

export interface RedisRateLimitStoreOptions {
  windowMs: number;
  /**
   * Propagate Redis failures to the caller instead of swallowing them.
   *
   * DEFAULT `false`, which keeps the historical behaviour byte-for-byte for the
   * `express-rate-limit` gateway limiters constructed in `server/src/index.ts`
   * (`new RedisRateLimitStore({ windowMs: ... })` — no second key, so
   * `throwOnError` is `undefined` -> falsy). Those limiters front authenticated
   * product traffic and deliberately fail OPEN: express-rate-limit has no
   * fail-mode policy of its own, so a thrown error there would surface as a 500
   * on every request during a Redis blip.
   *
   * The swallowing default is nonetheless dangerous for anyone who needs to KNOW:
   * the fallback returns `{ totalHits: 1 }`, so during an outage every request
   * looks like the first hit of a fresh window. The quota silently becomes
   * infinite AND the caller cannot tell that apart from a genuine first hit.
   * Callers that must make a deliberate fail-open/fail-closed decision (the demo
   * signup limiters) opt in with `throwOnError: true` and get the real error.
   */
  throwOnError?: boolean;
}

export class RedisRateLimitStore {
  constructor(private options: RedisRateLimitStoreOptions) {}

  private get throwOnError(): boolean {
    return this.options?.throwOnError === true;
  }

  /**
   * express-rate-limit store interface
   * Returns current hit count + a reset timestamp.
   *
   * Implementation notes:
   * - Uses Redis INCR + EXPIRE for a simple (sliding) window.
   * - If Redis is not configured or the client is mocked, this still behaves deterministically
   *   but will not enforce distributed limits (acceptable for dev/test; production should use Redis).
   * - With `throwOnError`, EVERY failure point propagates: a rejected INCR, a
   *   rejected TTL read, a rejected EXPIRE, a missing command (the in-process
   *   mock client implements `incr` but has no `ttl`), or a hit count Redis could
   *   not express as a number.
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const windowMs = this.options.windowMs || 60000;
    const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

    try {
      const client = redisClient as any;

      if (this.throwOnError) {
        // A store that cannot count is not a store. The in-process mock client
        // implements `incr` (constant 1) but no `ttl`, so this also refuses the
        // mock rather than reporting a window that never advances.
        if (typeof client?.incr !== 'function') {
          throw new Error('rate limit store: redis client does not support INCR');
        }
        if (typeof client?.ttl !== 'function') {
          throw new Error('rate limit store: redis client does not support TTL');
        }
      }

      const hits = await client.incr(key);
      let ttlSeconds = await client.ttl?.(key);
      if (typeof ttlSeconds !== 'number' || ttlSeconds < 0) {
        await client.expire(key, windowSeconds);
        ttlSeconds = windowSeconds;
      }
      const numHits = typeof hits === 'number' ? hits : Number(hits || 0);
      if (this.throwOnError && !Number.isFinite(numHits)) {
        throw new Error('rate limit store: redis returned a non-numeric hit count');
      }
      return {
        totalHits: Math.max(1, numHits),
        resetTime: new Date(Date.now() + Math.max(1, ttlSeconds) * 1000),
      };
    } catch (error) {
      if (this.throwOnError) throw error;
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
    } catch (error) {
      if (this.throwOnError) throw error;
      // ignore
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await (redisClient as any).del(key);
    } catch (error) {
      if (this.throwOnError) throw error;
      // ignore
    }
  }

  init(options: any) {
    this.options = options || this.options;
  }
}

export default RedisRateLimitStore;
