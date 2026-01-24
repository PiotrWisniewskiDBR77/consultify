/**
 * Rate Limiting Pattern Tests
 * Tests for various rate limiting strategies
 *
 * @module tests/ratelimit/rate-limiting.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Fixed window rate limiter
const createFixedWindowLimiter = (options = {}) => {
  const { windowMs = 60000, max = 100 } = options;
  const windows = new Map();

  return {
    check: (key) => {
      const now = Date.now();
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const windowKey = `${key}:${windowStart}`;

      const current = windows.get(windowKey) || 0;

      // Clean old windows
      for (const [k] of windows) {
        if (!k.endsWith(`:${windowStart}`)) {
          windows.delete(k);
        }
      }

      if (current >= max) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: windowStart + windowMs,
        };
      }

      windows.set(windowKey, current + 1);
      return {
        allowed: true,
        remaining: max - current - 1,
        resetAt: windowStart + windowMs,
      };
    },

    reset: (key) => {
      for (const [k] of windows) {
        if (k.startsWith(`${key}:`)) {
          windows.delete(k);
        }
      }
    },
  };
};

// Sliding window rate limiter
const createSlidingWindowLimiter = (options = {}) => {
  const { windowMs = 60000, max = 100 } = options;
  const requests = new Map(); // key -> timestamp[]

  return {
    check: (key) => {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create request log
      let log = requests.get(key) || [];

      // Remove old requests
      log = log.filter((ts) => ts > windowStart);

      if (log.length >= max) {
        requests.set(key, log);
        return {
          allowed: false,
          remaining: 0,
          retryAfter: log[0] + windowMs - now,
        };
      }

      log.push(now);
      requests.set(key, log);

      return {
        allowed: true,
        remaining: max - log.length,
      };
    },

    reset: (key) => {
      requests.delete(key);
    },

    getCount: (key) => {
      const now = Date.now();
      const windowStart = now - windowMs;
      const log = requests.get(key) || [];
      return log.filter((ts) => ts > windowStart).length;
    },
  };
};

// Token bucket rate limiter
const createTokenBucketLimiter = (options = {}) => {
  const {
    bucketSize = 10,
    refillRate = 1, // tokens per second
    refillInterval = 1000,
  } = options;

  const buckets = new Map(); // key -> { tokens, lastRefill }

  return {
    check: (key, cost = 1) => {
      const now = Date.now();
      let bucket = buckets.get(key);

      if (!bucket) {
        bucket = { tokens: bucketSize, lastRefill: now };
        buckets.set(key, bucket);
      }

      // Refill tokens
      const elapsed = now - bucket.lastRefill;
      const refillCount = Math.floor(elapsed / refillInterval) * refillRate;

      if (refillCount > 0) {
        bucket.tokens = Math.min(bucketSize, bucket.tokens + refillCount);
        bucket.lastRefill = now;
      }

      if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        return {
          allowed: true,
          remaining: bucket.tokens,
        };
      }

      return {
        allowed: false,
        remaining: bucket.tokens,
        retryAfter: Math.ceil(((cost - bucket.tokens) / refillRate) * refillInterval),
      };
    },

    reset: (key) => {
      buckets.delete(key);
    },

    getTokens: (key) => {
      return buckets.get(key)?.tokens ?? bucketSize;
    },
  };
};

// Leaky bucket rate limiter
const createLeakyBucketLimiter = (options = {}) => {
  const { capacity = 10, leakRate = 1 } = options; // leak per second
  const buckets = new Map();

  return {
    check: (key) => {
      const now = Date.now();
      let bucket = buckets.get(key);

      if (!bucket) {
        bucket = { level: 0, lastLeak: now };
        buckets.set(key, bucket);
      }

      // Leak
      const elapsed = (now - bucket.lastLeak) / 1000;
      bucket.level = Math.max(0, bucket.level - elapsed * leakRate);
      bucket.lastLeak = now;

      if (bucket.level >= capacity) {
        return {
          allowed: false,
          level: bucket.level,
        };
      }

      bucket.level += 1;
      return {
        allowed: true,
        level: bucket.level,
      };
    },

    reset: (key) => {
      buckets.delete(key);
    },
  };
};

// Concurrent request limiter
const createConcurrencyLimiter = (maxConcurrent) => {
  const active = new Map(); // key -> count

  return {
    acquire: (key) => {
      const current = active.get(key) || 0;

      if (current >= maxConcurrent) {
        return { allowed: false, active: current };
      }

      active.set(key, current + 1);
      return { allowed: true, active: current + 1 };
    },

    release: (key) => {
      const current = active.get(key) || 0;
      if (current > 0) {
        active.set(key, current - 1);
      }
    },

    getActive: (key) => active.get(key) || 0,
  };
};

describe('Fixed Window Limiter Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = createFixedWindowLimiter({ windowMs: 1000, max: 3 });
  });

  it('should allow requests within limit', () => {
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
  });

  it('should deny requests over limit', () => {
    limiter.check('user1');
    limiter.check('user1');
    limiter.check('user1');

    expect(limiter.check('user1').allowed).toBe(false);
  });

  it('should track remaining', () => {
    const result = limiter.check('user1');
    expect(result.remaining).toBe(2);
  });

  it('should reset', () => {
    limiter.check('user1');
    limiter.check('user1');
    limiter.reset('user1');

    expect(limiter.check('user1').remaining).toBe(2);
  });
});

describe('Sliding Window Limiter Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = createSlidingWindowLimiter({ windowMs: 1000, max: 3 });
  });

  it('should allow requests within limit', () => {
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(false);
  });

  it('should track count', () => {
    limiter.check('user1');
    limiter.check('user1');

    expect(limiter.getCount('user1')).toBe(2);
  });
});

describe('Token Bucket Limiter Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = createTokenBucketLimiter({ bucketSize: 5, refillRate: 1, refillInterval: 100 });
  });

  it('should allow requests with tokens', () => {
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.getTokens('user1')).toBe(4);
  });

  it('should support different costs', () => {
    limiter.check('user1', 3);

    expect(limiter.getTokens('user1')).toBe(2);
  });

  it('should refill tokens', async () => {
    limiter.check('user1', 5);
    expect(limiter.getTokens('user1')).toBe(0);

    await new Promise((r) => setTimeout(r, 200));

    expect(limiter.check('user1').allowed).toBe(true);
  });
});

describe('Leaky Bucket Limiter Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = createLeakyBucketLimiter({ capacity: 3, leakRate: 1 });
  });

  it('should allow within capacity', () => {
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
    expect(limiter.check('user1').allowed).toBe(true);
  });

  it('should deny at capacity', () => {
    limiter.check('user1');
    limiter.check('user1');
    limiter.check('user1');

    expect(limiter.check('user1').allowed).toBe(false);
  });
});

describe('Concurrency Limiter Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = createConcurrencyLimiter(2);
  });

  it('should limit concurrent', () => {
    expect(limiter.acquire('user1').allowed).toBe(true);
    expect(limiter.acquire('user1').allowed).toBe(true);
    expect(limiter.acquire('user1').allowed).toBe(false);
  });

  it('should release', () => {
    limiter.acquire('user1');
    limiter.acquire('user1');
    limiter.release('user1');

    expect(limiter.acquire('user1').allowed).toBe(true);
  });

  it('should track active', () => {
    limiter.acquire('user1');

    expect(limiter.getActive('user1')).toBe(1);
  });
});
