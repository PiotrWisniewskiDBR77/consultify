/**
 * Proxy Pattern Tests
 * Tests for proxy pattern implementations
 *
 * @module tests/patterns/proxy.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Virtual proxy (lazy loading)
const createVirtualProxy = (loader) => {
  let instance = null;
  let loading = null;

  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'isLoaded') return () => instance !== null;
        if (prop === 'load')
          return async () => {
            if (!loading) {
              loading = loader().then((result) => {
                instance = result;
                return result;
              });
            }
            return loading;
          };

        if (!instance) {
          throw new Error('Resource not loaded');
        }

        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
      },
    }
  );
};

// Protection proxy (access control)
const createProtectionProxy = (target, rules = {}) => {
  const { canRead = () => true, canWrite = () => true, canExecute = () => true } = rules;

  return new Proxy(target, {
    get(obj, prop) {
      if (!canRead(prop)) {
        throw new Error(`Access denied: cannot read ${String(prop)}`);
      }

      const value = obj[prop];
      if (typeof value === 'function') {
        return (...args) => {
          if (!canExecute(prop, args)) {
            throw new Error(`Access denied: cannot execute ${String(prop)}`);
          }
          return value.apply(obj, args);
        };
      }
      return value;
    },

    set(obj, prop, value) {
      if (!canWrite(prop, value)) {
        throw new Error(`Access denied: cannot write ${String(prop)}`);
      }
      obj[prop] = value;
      return true;
    },
  });
};

// Caching proxy
const createCachingProxy = (target, options = {}) => {
  const { ttl = Infinity, methods = [] } = options;
  const cache = new Map();

  return new Proxy(target, {
    get(obj, prop) {
      const value = obj[prop];

      if (typeof value !== 'function' || !methods.includes(prop)) {
        return value;
      }

      return (...args) => {
        const key = `${String(prop)}:${JSON.stringify(args)}`;
        const cached = cache.get(key);

        if (cached && Date.now() < cached.expiresAt) {
          return cached.value;
        }

        const result = value.apply(obj, args);
        cache.set(key, {
          value: result,
          expiresAt: Date.now() + ttl,
        });

        return result;
      };
    },
  });
};

// Logging proxy
const createLoggingProxy = (target, logger = console.log) => {
  return new Proxy(target, {
    get(obj, prop) {
      logger(`GET: ${String(prop)}`);
      const value = obj[prop];

      if (typeof value === 'function') {
        return (...args) => {
          logger(`CALL: ${String(prop)}(${JSON.stringify(args)})`);
          const result = value.apply(obj, args);
          logger(`RETURN: ${String(prop)} =>`, result);
          return result;
        };
      }
      return value;
    },

    set(obj, prop, value) {
      logger(`SET: ${String(prop)} =`, value);
      obj[prop] = value;
      return true;
    },
  });
};

// Remote proxy (simulated)
const createRemoteProxy = (endpoint) => {
  let mockFetch = vi.fn();

  const proxy = new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === '_setMockFetch') {
          return (fn) => {
            mockFetch = fn;
          };
        }

        return async (...args) => {
          const response = await mockFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({ method: prop, args }),
          });
          return response.result;
        };
      },
    }
  );

  return proxy;
};

// Validation proxy
const createValidationProxy = (target, schema) => {
  return new Proxy(target, {
    set(obj, prop, value) {
      const validator = schema[prop];

      if (validator) {
        const result = validator(value);
        if (result !== true) {
          throw new Error(result || `Invalid value for ${String(prop)}`);
        }
      }

      obj[prop] = value;
      return true;
    },
  });
};

// Immutable proxy
const createImmutableProxy = (target) => {
  return new Proxy(target, {
    set() {
      throw new Error('Object is immutable');
    },

    deleteProperty() {
      throw new Error('Object is immutable');
    },

    get(obj, prop) {
      const value = obj[prop];

      if (value !== null && typeof value === 'object') {
        return createImmutableProxy(value);
      }

      return value;
    },
  });
};

describe('Proxy Pattern Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // VIRTUAL PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Virtual Proxy', () => {
    it('should lazy load resource', async () => {
      const proxy = createVirtualProxy(async () => ({
        data: 'loaded',
        getData() {
          return this.data;
        },
      }));

      expect(proxy.isLoaded()).toBe(false);

      await proxy.load();

      expect(proxy.isLoaded()).toBe(true);
      expect(proxy.data).toBe('loaded');
    });

    it('should throw when accessing before load', () => {
      const proxy = createVirtualProxy(async () => ({ data: 'test' }));

      expect(() => proxy.data).toThrow('not loaded');
    });

    it('should only load once', async () => {
      let loadCount = 0;
      const proxy = createVirtualProxy(async () => {
        loadCount++;
        return { data: 'test' };
      });

      await Promise.all([proxy.load(), proxy.load(), proxy.load()]);

      expect(loadCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PROTECTION PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Protection Proxy', () => {
    it('should restrict read access', () => {
      const obj = { public: 1, secret: 2 };
      const proxy = createProtectionProxy(obj, {
        canRead: (prop) => prop !== 'secret',
      });

      expect(proxy.public).toBe(1);
      expect(() => proxy.secret).toThrow('Access denied');
    });

    it('should restrict write access', () => {
      const obj = { value: 1 };
      const proxy = createProtectionProxy(obj, {
        canWrite: (prop, value) => value >= 0,
      });

      proxy.value = 10;
      expect(obj.value).toBe(10);

      expect(() => {
        proxy.value = -5;
      }).toThrow('Access denied');
    });

    it('should restrict method execution', () => {
      const obj = {
        publicMethod() {
          return 'public';
        },
        privateMethod() {
          return 'private';
        },
      };
      const proxy = createProtectionProxy(obj, {
        canExecute: (prop) => prop !== 'privateMethod',
      });

      expect(proxy.publicMethod()).toBe('public');
      expect(() => proxy.privateMethod()).toThrow('Access denied');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CACHING PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Caching Proxy', () => {
    it('should cache method results', () => {
      let callCount = 0;
      const obj = {
        expensive(x) {
          callCount++;
          return x * 2;
        },
      };
      const proxy = createCachingProxy(obj, { methods: ['expensive'] });

      proxy.expensive(5);
      proxy.expensive(5);
      proxy.expensive(5);

      expect(callCount).toBe(1);
    });

    it('should cache different arguments separately', () => {
      let callCount = 0;
      const obj = {
        compute(x) {
          callCount++;
          return x * 2;
        },
      };
      const proxy = createCachingProxy(obj, { methods: ['compute'] });

      proxy.compute(5);
      proxy.compute(10);
      proxy.compute(5);

      expect(callCount).toBe(2);
    });

    it('should expire cache', async () => {
      let callCount = 0;
      const obj = {
        getData() {
          callCount++;
          return 'data';
        },
      };
      const proxy = createCachingProxy(obj, { methods: ['getData'], ttl: 50 });

      proxy.getData();
      await new Promise((r) => setTimeout(r, 100));
      proxy.getData();

      expect(callCount).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGGING PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Logging Proxy', () => {
    it('should log property access', () => {
      const logs = [];
      const obj = { value: 42 };
      const proxy = createLoggingProxy(obj, (...args) => logs.push(args));

      const _ = proxy.value;

      expect(logs.some((log) => log[0].includes('GET'))).toBe(true);
    });

    it('should log method calls', () => {
      const logs = [];
      const obj = {
        add(a, b) {
          return a + b;
        },
      };
      const proxy = createLoggingProxy(obj, (...args) => logs.push(args));

      proxy.add(2, 3);

      expect(logs.some((log) => log[0].includes('CALL'))).toBe(true);
      expect(logs.some((log) => log[0].includes('RETURN'))).toBe(true);
    });

    it('should log property sets', () => {
      const logs = [];
      const obj = { value: 0 };
      const proxy = createLoggingProxy(obj, (...args) => logs.push(args));

      proxy.value = 10;

      expect(logs.some((log) => log[0].includes('SET'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // REMOTE PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Remote Proxy', () => {
    it('should call remote methods', async () => {
      const proxy = createRemoteProxy('https://api.example.com/rpc');

      proxy._setMockFetch(
        vi.fn().mockResolvedValue({
          result: { sum: 15 },
        })
      );

      const result = await proxy.add(5, 10);

      expect(result.sum).toBe(15);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // VALIDATION PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Validation Proxy', () => {
    it('should validate on set', () => {
      const obj = { age: 0, email: '' };
      const proxy = createValidationProxy(obj, {
        age: (v) => v >= 0 || 'Age must be positive',
        email: (v) => v.includes('@') || 'Invalid email',
      });

      proxy.age = 25;
      expect(obj.age).toBe(25);

      expect(() => {
        proxy.age = -5;
      }).toThrow('must be positive');
      expect(() => {
        proxy.email = 'invalid';
      }).toThrow('Invalid email');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // IMMUTABLE PROXY
  // ═══════════════════════════════════════════════════════════════════

  describe('Immutable Proxy', () => {
    it('should prevent modifications', () => {
      const obj = { value: 1 };
      const proxy = createImmutableProxy(obj);

      expect(() => {
        proxy.value = 2;
      }).toThrow('immutable');
    });

    it('should prevent nested modifications', () => {
      const obj = { nested: { value: 1 } };
      const proxy = createImmutableProxy(obj);

      expect(() => {
        proxy.nested.value = 2;
      }).toThrow('immutable');
    });

    it('should allow reading', () => {
      const obj = { value: 42, nested: { data: 'test' } };
      const proxy = createImmutableProxy(obj);

      expect(proxy.value).toBe(42);
      expect(proxy.nested.data).toBe('test');
    });
  });
});
