/**
 * Cache Strategies Tests
 * Tests for advanced caching patterns
 *
 * @module tests/cache/cache-strategies.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// LRU Cache
const createLRUCache = (capacity = 100) => {
  const cache = new Map();

  return {
    get: (key) => {
      if (!cache.has(key)) return undefined;

      // Move to end (most recently used)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    },

    set: (key, value) => {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= capacity) {
        // Remove least recently used (first item)
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },

    has: (key) => cache.has(key),

    delete: (key) => cache.delete(key),

    clear: () => cache.clear(),

    size: () => cache.size,

    keys: () => [...cache.keys()],
  };
};

// TTL Cache
const createTTLCache = (defaultTTL = 60000) => {
  const cache = new Map();

  const isExpired = (item) => Date.now() > item.expiresAt;

  const cleanup = () => {
    for (const [key, item] of cache) {
      if (isExpired(item)) {
        cache.delete(key);
      }
    }
  };

  return {
    get: (key) => {
      const item = cache.get(key);
      if (!item) return undefined;

      if (isExpired(item)) {
        cache.delete(key);
        return undefined;
      }

      return item.value;
    },

    set: (key, value, ttl = defaultTTL) => {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttl,
      });
    },

    has: (key) => {
      const item = cache.get(key);
      if (!item) return false;
      if (isExpired(item)) {
        cache.delete(key);
        return false;
      }
      return true;
    },

    delete: (key) => cache.delete(key),

    clear: () => cache.clear(),

    cleanup,

    size: () => cache.size,

    getTTL: (key) => {
      const item = cache.get(key);
      if (!item || isExpired(item)) return 0;
      return Math.max(0, item.expiresAt - Date.now());
    },
  };
};

// Write-through cache
const createWriteThroughCache = (storage) => {
  const cache = new Map();

  return {
    get: async (key) => {
      if (cache.has(key)) {
        return cache.get(key);
      }

      const value = await storage.get(key);
      if (value !== undefined) {
        cache.set(key, value);
      }
      return value;
    },

    set: async (key, value) => {
      cache.set(key, value);
      await storage.set(key, value);
    },

    delete: async (key) => {
      cache.delete(key);
      await storage.delete(key);
    },

    invalidate: (key) => {
      cache.delete(key);
    },

    clear: () => {
      cache.clear();
    },
  };
};

// Cache-aside pattern
const createCacheAside = (cache, loader) => {
  return {
    get: async (key) => {
      // Check cache first
      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Load from source
      const value = await loader(key);
      if (value !== undefined) {
        cache.set(key, value);
      }
      return value;
    },

    invalidate: (key) => {
      cache.delete(key);
    },

    refresh: async (key) => {
      cache.delete(key);
      return this.get(key);
    },
  };
};

// Multi-level cache
const createMultiLevelCache = (l1, l2) => {
  return {
    get: async (key) => {
      // Check L1 (fast)
      let value = l1.get(key);
      if (value !== undefined) {
        return value;
      }

      // Check L2 (slower)
      value = await l2.get(key);
      if (value !== undefined) {
        l1.set(key, value); // Promote to L1
      }

      return value;
    },

    set: async (key, value) => {
      l1.set(key, value);
      await l2.set(key, value);
    },

    delete: async (key) => {
      l1.delete(key);
      await l2.delete(key);
    },

    invalidateL1: (key) => {
      l1.delete(key);
    },
  };
};

// Cache with stale-while-revalidate
const createSWRCache = (loader, options = {}) => {
  const { ttl = 60000, staleTime = 300000 } = options;
  const cache = new Map();
  const refreshing = new Set();

  return {
    get: async (key) => {
      const item = cache.get(key);
      const now = Date.now();

      if (item) {
        // Fresh
        if (now < item.expiresAt) {
          return item.value;
        }

        // Stale but usable
        if (now < item.staleAt) {
          // Revalidate in background
          if (!refreshing.has(key)) {
            refreshing.add(key);
            loader(key).then((value) => {
              cache.set(key, {
                value,
                expiresAt: Date.now() + ttl,
                staleAt: Date.now() + staleTime,
              });
              refreshing.delete(key);
            });
          }
          return item.value;
        }
      }

      // Load fresh
      const value = await loader(key);
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttl,
        staleAt: Date.now() + staleTime,
      });
      return value;
    },

    invalidate: (key) => {
      cache.delete(key);
    },
  };
};

describe('LRU Cache Tests', () => {
  let cache;

  beforeEach(() => {
    cache = createLRUCache(3);
  });

  it('should set and get', () => {
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
  });

  it('should evict LRU item', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // Should evict 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
  });

  it('should update LRU on access', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a'); // Access 'a', making it most recent
    cache.set('d', 4); // Should evict 'b' now

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });
});

describe('TTL Cache Tests', () => {
  let cache;

  beforeEach(() => {
    cache = createTTLCache(1000);
  });

  it('should get before expiry', () => {
    cache.set('key', 'value', 5000);
    expect(cache.get('key')).toBe('value');
  });

  it('should return undefined after expiry', async () => {
    cache.set('key', 'value', 10);
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get('key')).toBeUndefined();
  });

  it('should report remaining TTL', () => {
    cache.set('key', 'value', 10000);
    const ttl = cache.getTTL('key');
    expect(ttl).toBeGreaterThan(9000);
  });
});

describe('Write-Through Cache Tests', () => {
  let cache;
  let storage;

  beforeEach(() => {
    storage = {
      data: new Map(),
      get: vi.fn(async (key) => storage.data.get(key)),
      set: vi.fn(async (key, value) => storage.data.set(key, value)),
      delete: vi.fn(async (key) => storage.data.delete(key)),
    };
    cache = createWriteThroughCache(storage);
  });

  it('should write through to storage', async () => {
    await cache.set('key', 'value');

    expect(storage.set).toHaveBeenCalledWith('key', 'value');
  });

  it('should read from cache on hit', async () => {
    await cache.set('key', 'value');
    await cache.get('key');
    await cache.get('key');

    // Storage get called only once (initial load not needed after set)
    expect(storage.get).toHaveBeenCalledTimes(0);
  });

  it('should delete from both', async () => {
    await cache.set('key', 'value');
    await cache.delete('key');

    expect(storage.delete).toHaveBeenCalledWith('key');
  });
});

describe('Cache-Aside Tests', () => {
  let cache;
  let loader;
  let cacheAside;

  beforeEach(() => {
    cache = createLRUCache(10);
    loader = vi.fn(async (key) => `loaded:${key}`);
    cacheAside = createCacheAside(cache, loader);
  });

  it('should load on miss', async () => {
    const value = await cacheAside.get('key');

    expect(value).toBe('loaded:key');
    expect(loader).toHaveBeenCalledWith('key');
  });

  it('should use cache on hit', async () => {
    await cacheAside.get('key');
    await cacheAside.get('key');

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should refresh', async () => {
    await cacheAside.get('key');
    await cacheAside.refresh('key');

    expect(loader).toHaveBeenCalledTimes(2);
  });
});

describe('Multi-Level Cache Tests', () => {
  let l1;
  let l2;
  let multiLevel;

  beforeEach(() => {
    l1 = createLRUCache(5);
    l2 = {
      data: new Map(),
      get: async (key) => l2.data.get(key),
      set: async (key, value) => l2.data.set(key, value),
      delete: async (key) => l2.data.delete(key),
    };
    multiLevel = createMultiLevelCache(l1, l2);
  });

  it('should check L1 first', async () => {
    l1.set('key', 'l1-value');
    l2.data.set('key', 'l2-value');

    const value = await multiLevel.get('key');

    expect(value).toBe('l1-value');
  });

  it('should promote from L2 to L1', async () => {
    l2.data.set('key', 'l2-value');

    await multiLevel.get('key');

    expect(l1.get('key')).toBe('l2-value');
  });

  it('should write to both levels', async () => {
    await multiLevel.set('key', 'value');

    expect(l1.get('key')).toBe('value');
    expect(l2.data.get('key')).toBe('value');
  });
});
