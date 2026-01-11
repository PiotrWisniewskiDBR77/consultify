/**
 * Cache Service Tests
 * Tests for in-memory cache with TTL support
 *
 * @module tests/cache/cache-service.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Cache service implementation
const createCacheService = (options = {}) => {
  const { defaultTTL = 300000, maxSize = 1000 } = options;
  const cache = new Map();
  const expirations = new Map();

  const isExpired = (key) => {
    const expiry = expirations.get(key);
    if (!expiry) return false;
    return Date.now() > expiry;
  };

  const cleanup = () => {
    const now = Date.now();
    for (const [key, expiry] of expirations.entries()) {
      if (now > expiry) {
        cache.delete(key);
        expirations.delete(key);
      }
    }
  };

  return {
    get: (key) => {
      if (!cache.has(key)) return undefined;
      if (isExpired(key)) {
        cache.delete(key);
        expirations.delete(key);
        return undefined;
      }
      return cache.get(key);
    },

    set: (key, value, ttl = defaultTTL) => {
      // Enforce max size
      if (cache.size >= maxSize && !cache.has(key)) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
        expirations.delete(firstKey);
      }

      cache.set(key, value);
      if (ttl > 0) {
        expirations.set(key, Date.now() + ttl);
      }
      return true;
    },

    has: (key) => {
      if (!cache.has(key)) return false;
      if (isExpired(key)) {
        cache.delete(key);
        expirations.delete(key);
        return false;
      }
      return true;
    },

    delete: (key) => {
      expirations.delete(key);
      return cache.delete(key);
    },

    clear: () => {
      cache.clear();
      expirations.clear();
    },

    size: () => cache.size,

    keys: () => [...cache.keys()].filter((key) => !isExpired(key)),

    values: () => [...cache.keys()].filter((key) => !isExpired(key)).map((key) => cache.get(key)),

    entries: () =>
      [...cache.keys()].filter((key) => !isExpired(key)).map((key) => [key, cache.get(key)]),

    getOrSet: async (key, factory, ttl) => {
      const existing = cache.get(key);
      if (existing !== undefined && !isExpired(key)) {
        return existing;
      }

      const value = await factory();
      cache.set(key, value);
      if ((ttl || defaultTTL) > 0) {
        expirations.set(key, Date.now() + (ttl || defaultTTL));
      }
      return value;
    },

    mget: (keys) => {
      return keys.map((key) => ({
        key,
        value: cache.has(key) && !isExpired(key) ? cache.get(key) : undefined,
      }));
    },

    mset: (entries, ttl = defaultTTL) => {
      entries.forEach(([key, value]) => {
        cache.set(key, value);
        if (ttl > 0) {
          expirations.set(key, Date.now() + ttl);
        }
      });
    },

    ttl: (key) => {
      const expiry = expirations.get(key);
      if (!expiry) return -1;
      const remaining = expiry - Date.now();
      return remaining > 0 ? remaining : 0;
    },

    touch: (key, ttl = defaultTTL) => {
      if (!cache.has(key) || isExpired(key)) return false;
      expirations.set(key, Date.now() + ttl);
      return true;
    },

    cleanup,

    stats: () => ({
      size: cache.size,
      maxSize,
      defaultTTL,
    }),
  };
};

describe('Cache Service Tests', () => {
  let cache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createCacheService({ defaultTTL: 1000, maxSize: 5 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET / SET
  // ═══════════════════════════════════════════════════════════════════

  describe('get / set', () => {
    it('should set and get value', () => {
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should overwrite existing value', () => {
      cache.set('key', 'value1');
      cache.set('key', 'value2');
      expect(cache.get('key')).toBe('value2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TTL / EXPIRATION
  // ═══════════════════════════════════════════════════════════════════

  describe('TTL / Expiration', () => {
    it('should expire after TTL', () => {
      cache.set('key', 'value', 500);

      vi.advanceTimersByTime(600);

      expect(cache.get('key')).toBeUndefined();
    });

    it('should not expire before TTL', () => {
      cache.set('key', 'value', 1000);

      vi.advanceTimersByTime(500);

      expect(cache.get('key')).toBe('value');
    });

    it('should return remaining TTL', () => {
      cache.set('key', 'value', 1000);

      vi.advanceTimersByTime(300);

      expect(cache.ttl('key')).toBe(700);
    });

    it('should touch to extend TTL', () => {
      cache.set('key', 'value', 1000);

      vi.advanceTimersByTime(800);
      cache.touch('key', 1000);
      vi.advanceTimersByTime(500);

      expect(cache.get('key')).toBe('value');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // HAS
  // ═══════════════════════════════════════════════════════════════════

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key', 'value');
      expect(cache.has('key')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(cache.has('missing')).toBe(false);
    });

    it('should return false for expired key', () => {
      cache.set('key', 'value', 500);
      vi.advanceTimersByTime(600);
      expect(cache.has('key')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════════════════════════════

  describe('delete', () => {
    it('should delete existing key', () => {
      cache.set('key', 'value');
      cache.delete('key');
      expect(cache.get('key')).toBeUndefined();
    });

    it('should return true when deleted', () => {
      cache.set('key', 'value');
      expect(cache.delete('key')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(cache.delete('missing')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.size()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SIZE & MAX SIZE
  // ═══════════════════════════════════════════════════════════════════

  describe('size / maxSize', () => {
    it('should return correct size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });

    it('should evict oldest when max size reached', () => {
      cache.set('key1', 'v1');
      cache.set('key2', 'v2');
      cache.set('key3', 'v3');
      cache.set('key4', 'v4');
      cache.set('key5', 'v5');
      cache.set('key6', 'v6');

      expect(cache.size()).toBe(5);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // KEYS / VALUES / ENTRIES
  // ═══════════════════════════════════════════════════════════════════

  describe('keys / values / entries', () => {
    beforeEach(() => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
    });

    it('should return all keys', () => {
      expect(cache.keys()).toEqual(['key1', 'key2']);
    });

    it('should return all values', () => {
      expect(cache.values()).toEqual(['value1', 'value2']);
    });

    it('should return all entries', () => {
      expect(cache.entries()).toEqual([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);
    });

    it('should exclude expired in keys', () => {
      cache.set('expired', 'val', 100);
      vi.advanceTimersByTime(200);
      expect(cache.keys()).not.toContain('expired');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET OR SET
  // ═══════════════════════════════════════════════════════════════════

  describe('getOrSet', () => {
    it('should return cached value', async () => {
      cache.set('key', 'cached');
      const factory = vi.fn().mockResolvedValue('new');

      const result = await cache.getOrSet('key', factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory for missing key', async () => {
      const factory = vi.fn().mockResolvedValue('new');

      const result = await cache.getOrSet('key', factory);

      expect(result).toBe('new');
      expect(factory).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MGET / MSET
  // ═══════════════════════════════════════════════════════════════════

  describe('mget / mset', () => {
    it('should get multiple values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const results = cache.mget(['key1', 'key2', 'missing']);

      expect(results[0]).toEqual({ key: 'key1', value: 'value1' });
      expect(results[2]).toEqual({ key: 'missing', value: undefined });
    });

    it('should set multiple values', () => {
      cache.mset([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ]);

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════

  describe('stats', () => {
    it('should return cache stats', () => {
      cache.set('key', 'value');
      const stats = cache.stats();

      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(5);
      expect(stats.defaultTTL).toBe(1000);
    });
  });
});
