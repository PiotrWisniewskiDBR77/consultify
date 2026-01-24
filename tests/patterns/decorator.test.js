/**
 * Decorator Pattern Tests
 * Tests for decorator pattern implementations
 *
 * @module tests/patterns/decorator.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Base component
const createComponent = (value) => ({
  getValue: () => value,
  describe: () => `Base(${value})`,
});

// Decorator factory
const createDecorator = (component, options = {}) => {
  const { prefix = '', suffix = '', multiplier = 1, transformer } = options;

  return {
    getValue: () => {
      let value = component.getValue() * multiplier;
      if (transformer) {
        value = transformer(value);
      }
      return value;
    },

    describe: () => {
      const base = component.describe();
      if (prefix || suffix) {
        return `${prefix}${base}${suffix}`;
      }
      return base;
    },

    getComponent: () => component,
  };
};

// Function decorator
const createFunctionDecorator = (fn, decorators = {}) => {
  const { before, after, around, onError, memoize, throttle, debounce, retry } = decorators;
  let lastResult;
  let throttleTimer;
  let debounceTimer;
  const memoCache = new Map();

  return async (...args) => {
    try {
      // Memoization
      if (memoize) {
        const key = JSON.stringify(args);
        if (memoCache.has(key)) {
          return memoCache.get(key);
        }
      }

      // Throttle
      if (throttle && throttleTimer) {
        return lastResult;
      }

      // Debounce
      if (debounce) {
        return new Promise((resolve) => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            const result = await fn(...args);
            resolve(result);
          }, debounce);
        });
      }

      // Before
      if (before) {
        await before(...args);
      }

      // Around
      let result;
      if (around) {
        result = await around(fn, ...args);
      } else {
        result = await fn(...args);
      }

      // After
      if (after) {
        result = await after(result, ...args);
      }

      // Cache for memoization
      if (memoize) {
        const key = JSON.stringify(args);
        memoCache.set(key, result);
      }

      // Throttle timer
      if (throttle) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
        }, throttle);
      }

      lastResult = result;
      return result;
    } catch (error) {
      // Retry
      if (retry && retry.attempts > 0) {
        const newDecorators = { ...decorators, retry: { ...retry, attempts: retry.attempts - 1 } };
        const retryFn = createFunctionDecorator(fn, newDecorators);
        await new Promise((r) => setTimeout(r, retry.delay || 0));
        return retryFn(...args);
      }

      // Error handler
      if (onError) {
        return onError(error, ...args);
      }
      throw error;
    }
  };
};

// Class method decorator (simulated)
const decorateMethod = (target, methodName, decorator) => {
  const original = target[methodName].bind(target);
  target[methodName] = (...args) => decorator(original, ...args);
  return target;
};

// Logging decorator
const withLogging = (fn, logger = console.log) => {
  return async (...args) => {
    logger(`Calling with args:`, args);
    const start = Date.now();
    const result = await fn(...args);
    const elapsed = Date.now() - start;
    logger(`Returned:`, result, `(${elapsed}ms)`);
    return result;
  };
};

// Validation decorator
const withValidation = (fn, validator) => {
  return async (...args) => {
    const validationResult = validator(...args);
    if (validationResult !== true) {
      throw new Error(validationResult || 'Validation failed');
    }
    return fn(...args);
  };
};

// Caching decorator
const withCaching = (fn, options = {}) => {
  const { ttl = Infinity, keyFn = JSON.stringify } = options;
  const cache = new Map();

  return async (...args) => {
    const key = keyFn(args);
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const result = await fn(...args);
    cache.set(key, {
      value: result,
      expiresAt: Date.now() + ttl,
    });

    return result;
  };
};

describe('Decorator Pattern Tests', () => {
  // ═══════════════════════════════════════════════════════════════════
  // COMPONENT DECORATOR
  // ═══════════════════════════════════════════════════════════════════

  describe('Component Decorator', () => {
    it('should wrap component', () => {
      const base = createComponent(10);
      const decorated = createDecorator(base, { multiplier: 2 });

      expect(decorated.getValue()).toBe(20);
    });

    it('should chain decorators', () => {
      const base = createComponent(5);
      const doubled = createDecorator(base, { multiplier: 2 });
      const tripled = createDecorator(doubled, { multiplier: 3 });

      expect(tripled.getValue()).toBe(30);
    });

    it('should apply transformer', () => {
      const base = createComponent(10);
      const decorated = createDecorator(base, {
        transformer: (v) => v + 5,
      });

      expect(decorated.getValue()).toBe(15);
    });

    it('should modify description', () => {
      const base = createComponent(10);
      const decorated = createDecorator(base, {
        prefix: '[Decorated] ',
      });

      expect(decorated.describe()).toBe('[Decorated] Base(10)');
    });

    it('should access underlying component', () => {
      const base = createComponent(10);
      const decorated = createDecorator(base);

      expect(decorated.getComponent()).toBe(base);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FUNCTION DECORATOR
  // ═══════════════════════════════════════════════════════════════════

  describe('Function Decorator', () => {
    it('should apply before hook', async () => {
      const order = [];
      const fn = () => {
        order.push('main');
        return 'result';
      };

      const decorated = createFunctionDecorator(fn, {
        before: () => {
          order.push('before');
        },
      });

      await decorated();

      expect(order).toEqual(['before', 'main']);
    });

    it('should apply after hook', async () => {
      const fn = (x) => x * 2;

      const decorated = createFunctionDecorator(fn, {
        after: (result) => result + 10,
      });

      const result = await decorated(5);

      expect(result).toBe(20); // 5 * 2 + 10
    });

    it('should apply around hook', async () => {
      const fn = (x) => x * 2;

      const decorated = createFunctionDecorator(fn, {
        around: (original, x) => original(x) * 3,
      });

      const result = await decorated(5);

      expect(result).toBe(30); // (5 * 2) * 3
    });

    it('should handle errors', async () => {
      const fn = () => {
        throw new Error('Oops');
      };

      const decorated = createFunctionDecorator(fn, {
        onError: (error) => `Handled: ${error.message}`,
      });

      const result = await decorated();

      expect(result).toBe('Handled: Oops');
    });

    it('should memoize results', async () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const decorated = createFunctionDecorator(fn, { memoize: true });

      await decorated(5);
      await decorated(5);
      await decorated(5);

      expect(callCount).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = () => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      };

      const decorated = createFunctionDecorator(fn, {
        retry: { attempts: 3, delay: 10 },
      });

      const result = await decorated();

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SPECIALIZED DECORATORS
  // ═══════════════════════════════════════════════════════════════════

  describe('Specialized Decorators', () => {
    describe('withLogging', () => {
      it('should log calls', async () => {
        const logs = [];
        const logger = (...args) => logs.push(args);

        const fn = (a, b) => a + b;
        const logged = withLogging(fn, logger);

        await logged(2, 3);

        expect(logs.length).toBe(2);
        expect(logs[0][0]).toBe('Calling with args:');
      });
    });

    describe('withValidation', () => {
      it('should validate arguments', async () => {
        const fn = (x) => x * 2;
        const validated = withValidation(fn, (x) => typeof x === 'number' || 'Must be a number');

        expect(await validated(5)).toBe(10);
        await expect(validated('abc')).rejects.toThrow('Must be a number');
      });
    });

    describe('withCaching', () => {
      it('should cache results', async () => {
        let callCount = 0;
        const fn = (x) => {
          callCount++;
          return x * 2;
        };
        const cached = withCaching(fn);

        await cached(5);
        await cached(5);

        expect(callCount).toBe(1);
      });

      it('should expire cache', async () => {
        let callCount = 0;
        const fn = (x) => {
          callCount++;
          return x * 2;
        };
        const cached = withCaching(fn, { ttl: 50 });

        await cached(5);
        await new Promise((r) => setTimeout(r, 100));
        await cached(5);

        expect(callCount).toBe(2);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // METHOD DECORATOR
  // ═══════════════════════════════════════════════════════════════════

  describe('Method Decorator', () => {
    it('should decorate class method', () => {
      const obj = {
        value: 10,
        getValue() {
          return this.value;
        },
      };

      decorateMethod(obj, 'getValue', (original) => {
        return original() * 2;
      });

      expect(obj.getValue()).toBe(20);
    });
  });
});
