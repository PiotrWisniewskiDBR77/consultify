/**
 * Resource Pool Tests
 * Tests for connection and resource pooling
 *
 * @module tests/pool/resource-pool.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Generic resource pool
const createResourcePool = (options = {}) => {
  const {
    create,
    destroy = () => {},
    validate = () => true,
    min = 0,
    max = 10,
    acquireTimeout = 30000,
    idleTimeout = 60000,
  } = options;

  const available = [];
  const inUse = new Set();
  const waiting = [];
  let created = 0;

  const createResource = async () => {
    const resource = await create();
    created++;
    return {
      resource,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };
  };

  const destroyResource = async (wrapper) => {
    await destroy(wrapper.resource);
    created--;
  };

  return {
    acquire: async () => {
      // Try to get from pool
      while (available.length > 0) {
        const wrapper = available.pop();

        if (validate(wrapper.resource)) {
          wrapper.lastUsed = Date.now();
          inUse.add(wrapper);
          return wrapper.resource;
        }

        await destroyResource(wrapper);
      }

      // Create new if under limit
      if (created < max) {
        const wrapper = await createResource();
        inUse.add(wrapper);
        return wrapper.resource;
      }

      // Wait for available
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const idx = waiting.indexOf(waiter);
          if (idx !== -1) waiting.splice(idx, 1);
          reject(new Error('Acquire timeout'));
        }, acquireTimeout);

        const waiter = { resolve, reject, timeout };
        waiting.push(waiter);
      });
    },

    release: (resource) => {
      for (const wrapper of inUse) {
        if (wrapper.resource === resource) {
          inUse.delete(wrapper);
          wrapper.lastUsed = Date.now();

          // Serve waiting
          if (waiting.length > 0) {
            const { resolve, timeout } = waiting.shift();
            clearTimeout(timeout);
            inUse.add(wrapper);
            resolve(resource);
          } else {
            available.push(wrapper);
          }

          return true;
        }
      }
      return false;
    },

    destroy: async (resource) => {
      for (const wrapper of inUse) {
        if (wrapper.resource === resource) {
          inUse.delete(wrapper);
          await destroyResource(wrapper);
          return true;
        }
      }
      return false;
    },

    drain: async () => {
      // Destroy all available
      while (available.length > 0) {
        await destroyResource(available.pop());
      }
    },

    clear: async () => {
      // Wait for all to be released
      while (inUse.size > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await this.drain();
    },

    getStats: () => ({
      available: available.length,
      inUse: inUse.size,
      waiting: waiting.length,
      created,
      min,
      max,
    }),

    evictIdle: async () => {
      const now = Date.now();
      const toEvict = available.filter((w) => now - w.lastUsed > idleTimeout);

      for (const wrapper of toEvict) {
        const idx = available.indexOf(wrapper);
        if (idx !== -1) {
          available.splice(idx, 1);
          await destroyResource(wrapper);
        }
      }

      return toEvict.length;
    },
  };
};

// Connection wrapper
const createConnectionWrapper = (pool) => {
  return {
    withConnection: async (fn) => {
      const conn = await pool.acquire();
      try {
        return await fn(conn);
      } finally {
        pool.release(conn);
      }
    },

    transaction: async (fn) => {
      const conn = await pool.acquire();
      try {
        await conn.beginTransaction?.();
        const result = await fn(conn);
        await conn.commit?.();
        return result;
      } catch (error) {
        await conn.rollback?.();
        throw error;
      } finally {
        pool.release(conn);
      }
    },
  };
};

// Health checker for pool
const createPoolHealthChecker = (pool, checkFn) => {
  let isHealthy = true;
  let lastCheck = null;
  let checkInterval = null;

  return {
    start: (intervalMs = 30000) => {
      checkInterval = setInterval(async () => {
        try {
          const conn = await pool.acquire();
          try {
            isHealthy = await checkFn(conn);
          } finally {
            pool.release(conn);
          }
        } catch (error) {
          isHealthy = false;
        }
        lastCheck = Date.now();
      }, intervalMs);
    },

    stop: () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    },

    isHealthy: () => isHealthy,

    getLastCheck: () => lastCheck,

    checkNow: async () => {
      try {
        const conn = await pool.acquire();
        try {
          isHealthy = await checkFn(conn);
        } finally {
          pool.release(conn);
        }
      } catch (error) {
        isHealthy = false;
      }
      lastCheck = Date.now();
      return isHealthy;
    },
  };
};

describe('Resource Pool Tests', () => {
  let pool;

  beforeEach(() => {
    let connId = 0;
    pool = createResourcePool({
      create: async () => ({ id: ++connId, connected: true }),
      destroy: async (conn) => {
        conn.connected = false;
      },
      validate: (conn) => conn.connected,
      min: 0,
      max: 3,
    });
  });

  it('should acquire resource', async () => {
    const resource = await pool.acquire();

    expect(resource.id).toBe(1);
    expect(resource.connected).toBe(true);
  });

  it('should release and reuse resource', async () => {
    const r1 = await pool.acquire();
    pool.release(r1);

    const r2 = await pool.acquire();

    expect(r2.id).toBe(r1.id);
  });

  it('should respect max limit', async () => {
    const resources = await Promise.all([pool.acquire(), pool.acquire(), pool.acquire()]);

    expect(resources).toHaveLength(3);

    const stats = pool.getStats();
    expect(stats.inUse).toBe(3);
  });

  it('should track stats', async () => {
    await pool.acquire();

    const stats = pool.getStats();

    expect(stats.inUse).toBe(1);
    expect(stats.created).toBe(1);
  });

  it('should destroy resource', async () => {
    const resource = await pool.acquire();
    await pool.destroy(resource);

    const stats = pool.getStats();
    expect(stats.created).toBe(0);
  });

  it('should drain pool', async () => {
    const r1 = await pool.acquire();
    const r2 = await pool.acquire();

    pool.release(r1);
    pool.release(r2);

    await pool.drain();

    const stats = pool.getStats();
    expect(stats.available).toBe(0);
  });
});

describe('Connection Wrapper Tests', () => {
  let pool;
  let wrapper;

  beforeEach(() => {
    pool = createResourcePool({
      create: async () => ({
        query: vi.fn().mockResolvedValue([]),
        beginTransaction: vi.fn(),
        commit: vi.fn(),
        rollback: vi.fn(),
      }),
    });

    wrapper = createConnectionWrapper(pool);
  });

  it('should run with connection', async () => {
    const result = await wrapper.withConnection(async (conn) => {
      return conn.query('SELECT 1');
    });

    expect(result).toEqual([]);

    const stats = pool.getStats();
    expect(stats.inUse).toBe(0);
  });

  it('should handle transaction', async () => {
    await wrapper.transaction(async (conn) => {
      await conn.query('INSERT ...');
    });

    const conn = await pool.acquire();
    expect(conn.beginTransaction).toHaveBeenCalled();
    expect(conn.commit).toHaveBeenCalled();
  });

  it('should rollback on error', async () => {
    await expect(
      wrapper.transaction(async (conn) => {
        throw new Error('fail');
      })
    ).rejects.toThrow('fail');

    const conn = await pool.acquire();
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('Pool Health Checker Tests', () => {
  let pool;
  let checker;

  beforeEach(() => {
    pool = createResourcePool({
      create: async () => ({ ping: vi.fn().mockResolvedValue(true) }),
    });

    checker = createPoolHealthChecker(pool, async (conn) => {
      return conn.ping();
    });
  });

  afterEach(() => {
    checker.stop();
  });

  it('should check health', async () => {
    const healthy = await checker.checkNow();

    expect(healthy).toBe(true);
    expect(checker.isHealthy()).toBe(true);
  });

  it('should track last check', async () => {
    await checker.checkNow();

    expect(checker.getLastCheck()).not.toBeNull();
  });
});
