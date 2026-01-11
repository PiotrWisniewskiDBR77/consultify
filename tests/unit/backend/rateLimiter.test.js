/**
 * Rate Limiter Unit Tests
 * Tests rate limiting algorithms and request throttling
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple in-memory rate limiter for testing
const createRateLimiter = (options = {}) => {
  const {
    maxRequests = 100,
    windowMs = 60000,
    keyGenerator = (req) => req.ip || 'default',
  } = options;

  const requestCounts = new Map();

  const cleanupExpired = () => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.startTime > windowMs) {
        requestCounts.delete(key);
      }
    }
  };

  return {
    check: (req) => {
      cleanupExpired();
      const key = keyGenerator(req);
      const now = Date.now();

      const current = requestCounts.get(key);
      if (!current || now - current.startTime > windowMs) {
        requestCounts.set(key, { count: 1, startTime: now });
        return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
      }

      if (current.count >= maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: current.startTime + windowMs,
          retryAfter: Math.ceil((current.startTime + windowMs - now) / 1000),
        };
      }

      current.count++;
      return {
        allowed: true,
        remaining: maxRequests - current.count,
        resetAt: current.startTime + windowMs,
      };
    },

    getStats: (key) => requestCounts.get(key) || null,

    reset: (key) => requestCounts.delete(key),

    resetAll: () => requestCounts.clear(),
  };
};

describe('RateLimiter', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 1000 });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const result = rateLimiter.check({ ip: '192.168.1.1' });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should track request count', () => {
      for (let i = 0; i < 3; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }

      const result = rateLimiter.check({ ip: '192.168.1.1' });
      expect(result.remaining).toBe(1);
    });

    it('should block when limit exceeded', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }

      const result = rateLimiter.check({ ip: '192.168.1.1' });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should separate limits by key', () => {
      // Exhaust limit for one IP
      for (let i = 0; i < 5; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }

      // Different IP should still work
      const result = rateLimiter.check({ ip: '192.168.1.2' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('Window Reset', () => {
    it('should reset after window expires', async () => {
      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }
      expect(rateLimiter.check({ ip: '192.168.1.1' }).allowed).toBe(false);

      // Wait for window to expire (using shorter window for test)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const result = rateLimiter.check({ ip: '192.168.1.1' });
      expect(result.allowed).toBe(true);
    });
  });

  describe('Custom Key Generator', () => {
    it('should use custom key generator', () => {
      const customLimiter = createRateLimiter({
        maxRequests: 3,
        keyGenerator: (req) => req.userId,
      });

      for (let i = 0; i < 3; i++) {
        customLimiter.check({ userId: 'user-1' });
      }

      expect(customLimiter.check({ userId: 'user-1' }).allowed).toBe(false);
      expect(customLimiter.check({ userId: 'user-2' }).allowed).toBe(true);
    });
  });

  describe('Stats and Management', () => {
    it('should return stats for key', () => {
      rateLimiter.check({ ip: '192.168.1.1' });
      rateLimiter.check({ ip: '192.168.1.1' });

      const stats = rateLimiter.getStats('192.168.1.1');

      expect(stats).not.toBeNull();
      expect(stats.count).toBe(2);
    });

    it('should reset specific key', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }
      expect(rateLimiter.check({ ip: '192.168.1.1' }).allowed).toBe(false);

      rateLimiter.reset('192.168.1.1');

      expect(rateLimiter.check({ ip: '192.168.1.1' }).allowed).toBe(true);
    });

    it('should reset all keys', () => {
      rateLimiter.check({ ip: '192.168.1.1' });
      rateLimiter.check({ ip: '192.168.1.2' });

      rateLimiter.resetAll();

      expect(rateLimiter.getStats('192.168.1.1')).toBeNull();
      expect(rateLimiter.getStats('192.168.1.2')).toBeNull();
    });
  });

  describe('Headers Response', () => {
    it('should provide rate limit headers', () => {
      const result = rateLimiter.check({ ip: '192.168.1.1' });

      expect(result.remaining).toBeDefined();
      expect(result.resetAt).toBeDefined();
    });

    it('should provide retry-after when blocked', () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check({ ip: '192.168.1.1' });
      }

      const result = rateLimiter.check({ ip: '192.168.1.1' });

      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
