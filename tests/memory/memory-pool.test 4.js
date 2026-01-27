/**
 * Memory Management Tests
 * Tests for memory pools and object caching
 *
 * @module tests/memory/memory-pool.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Object pool
const createObjectPool = (factory, options = {}) => {
  const { maxSize = 100, resetFn } = options;
  const pool = [];
  let created = 0;

  return {
    acquire: () => {
      if (pool.length > 0) {
        return pool.pop();
      }

      if (created < maxSize) {
        created++;
        return factory();
      }

      throw new Error('Pool exhausted');
    },

    release: (obj) => {
      if (pool.length < maxSize) {
        if (resetFn) {
          resetFn(obj);
        }
        pool.push(obj);
      }
    },

    getPoolSize: () => pool.length,

    getCreatedCount: () => created,

    drain: () => {
      pool.length = 0;
    },

    prewarm: (count) => {
      const toCreate = Math.min(count, maxSize - created);
      for (let i = 0; i < toCreate; i++) {
        pool.push(factory());
        created++;
      }
    },
  };
};

// LRU Cache with size limit
const createMemoryCache = (options = {}) => {
  const { maxSize = 1000, maxMemory = Infinity } = options;
  const cache = new Map();
  let currentMemory = 0;

  const estimateSize = (value) => {
    if (typeof value === 'string') return value.length * 2;
    if (typeof value === 'number') return 8;
    if (typeof value === 'boolean') return 4;
    if (Array.isArray(value)) return value.length * 8;
    if (typeof value === 'object') return JSON.stringify(value).length * 2;
    return 8;
  };

  const evict = () => {
    if (cache.size === 0) return;
    const firstKey = cache.keys().next().value;
    const item = cache.get(firstKey);
    currentMemory -= item.size;
    cache.delete(firstKey);
  };

  return {
    get: (key) => {
      const item = cache.get(key);
      if (!item) return undefined;

      // Move to end (LRU)
      cache.delete(key);
      cache.set(key, item);

      return item.value;
    },

    set: (key, value) => {
      const size = estimateSize(value);

      // Remove existing
      if (cache.has(key)) {
        currentMemory -= cache.get(key).size;
        cache.delete(key);
      }

      // Evict until we have space
      while (currentMemory + size > maxMemory || cache.size >= maxSize) {
        if (cache.size === 0) break;
        evict();
      }

      cache.set(key, { value, size });
      currentMemory += size;
    },

    delete: (key) => {
      const item = cache.get(key);
      if (item) {
        currentMemory -= item.size;
        cache.delete(key);
        return true;
      }
      return false;
    },

    clear: () => {
      cache.clear();
      currentMemory = 0;
    },

    getSize: () => cache.size,

    getMemoryUsage: () => currentMemory,

    getStats: () => ({
      size: cache.size,
      maxSize,
      memoryUsage: currentMemory,
      maxMemory,
    }),
  };
};

// Weak reference cache
const createWeakCache = () => {
  const cache = new Map();
  const registry = new FinalizationRegistry((key) => {
    cache.delete(key);
  });

  return {
    set: (key, value) => {
      const ref = new WeakRef(value);
      cache.set(key, ref);
      registry.register(value, key);
    },

    get: (key) => {
      const ref = cache.get(key);
      if (!ref) return undefined;

      const value = ref.deref();
      if (value === undefined) {
        cache.delete(key);
      }
      return value;
    },

    has: (key) => {
      const ref = cache.get(key);
      if (!ref) return false;
      return ref.deref() !== undefined;
    },

    delete: (key) => cache.delete(key),

    getSize: () => cache.size,
  };
};

// Buffer pool
const createBufferPool = (bufferSize, poolSize = 10) => {
  const available = [];
  const inUse = new Set();

  // Pre-allocate
  for (let i = 0; i < poolSize; i++) {
    available.push(new ArrayBuffer(bufferSize));
  }

  return {
    acquire: () => {
      let buffer;
      if (available.length > 0) {
        buffer = available.pop();
      } else {
        buffer = new ArrayBuffer(bufferSize);
      }
      inUse.add(buffer);
      return buffer;
    },

    release: (buffer) => {
      if (inUse.delete(buffer)) {
        // Clear buffer
        new Uint8Array(buffer).fill(0);
        available.push(buffer);
        return true;
      }
      return false;
    },

    getAvailable: () => available.length,

    getInUse: () => inUse.size,

    getBufferSize: () => bufferSize,
  };
};

describe('Object Pool Tests', () => {
  let pool;

  beforeEach(() => {
    pool = createObjectPool(() => ({ data: null }), {
      maxSize: 5,
      resetFn: (obj) => {
        obj.data = null;
      },
    });
  });

  it('should acquire object', () => {
    const obj = pool.acquire();

    expect(obj).toBeDefined();
    expect(obj.data).toBeNull();
  });

  it('should reuse released objects', () => {
    const obj1 = pool.acquire();
    obj1.data = 'test';

    pool.release(obj1);
    const obj2 = pool.acquire();

    expect(obj2).toBe(obj1);
    expect(obj2.data).toBeNull(); // Reset
  });

  it('should throw when exhausted', () => {
    for (let i = 0; i < 5; i++) {
      pool.acquire();
    }

    expect(() => pool.acquire()).toThrow('Pool exhausted');
  });

  it('should prewarm pool', () => {
    pool.prewarm(3);

    expect(pool.getPoolSize()).toBe(3);
  });
});

describe('Memory Cache Tests', () => {
  let cache;

  beforeEach(() => {
    cache = createMemoryCache({ maxSize: 3 });
  });

  it('should set and get', () => {
    cache.set('key', 'value');

    expect(cache.get('key')).toBe('value');
  });

  it('should evict LRU on max size', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
  });

  it('should update LRU on access', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    cache.get('a'); // Access 'a'

    cache.set('d', 4); // Should evict 'b'

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('should track memory', () => {
    cache.set('str', 'hello');

    expect(cache.getMemoryUsage()).toBeGreaterThan(0);
  });
});

describe('Buffer Pool Tests', () => {
  let pool;

  beforeEach(() => {
    pool = createBufferPool(1024, 3);
  });

  it('should acquire buffer', () => {
    const buffer = pool.acquire();

    expect(buffer.byteLength).toBe(1024);
  });

  it('should track available and in use', () => {
    expect(pool.getAvailable()).toBe(3);

    const buf1 = pool.acquire();
    const buf2 = pool.acquire();

    expect(pool.getAvailable()).toBe(1);
    expect(pool.getInUse()).toBe(2);
  });

  it('should release and reuse', () => {
    const buf = pool.acquire();
    pool.release(buf);

    expect(pool.getAvailable()).toBe(3);
  });

  it('should clear buffer on release', () => {
    const buf = pool.acquire();
    new Uint8Array(buf)[0] = 42;

    pool.release(buf);

    const buf2 = pool.acquire();
    expect(new Uint8Array(buf2)[0]).toBe(0);
  });
});
