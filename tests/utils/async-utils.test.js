/**
 * Async Utils Tests
 * Tests for async/promise utility functions
 *
 * @module tests/utils/async-utils.test.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Async utilities implementation
const asyncUtils = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  timeout: (promise, ms, errorMessage = 'Operation timed out') => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), ms)),
    ]);
  },

  retry: async (fn, options = {}) => {
    const { retries = 3, delay = 100, onRetry } = options;
    let lastError;

    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < retries) {
          if (onRetry) onRetry(error, i + 1);
          await asyncUtils.sleep(delay);
        }
      }
    }
    throw lastError;
  },

  debounce: (fn, delay) => {
    let timeoutId;
    const debounced = (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
    debounced.cancel = () => clearTimeout(timeoutId);
    return debounced;
  },

  throttle: (fn, limit) => {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  },

  parallel: (tasks, concurrency = Infinity) => {
    return new Promise((resolve, reject) => {
      const results = [];
      let running = 0;
      let index = 0;
      let completed = 0;

      const runNext = () => {
        if (completed === tasks.length) {
          resolve(results);
          return;
        }

        while (running < concurrency && index < tasks.length) {
          const taskIndex = index++;
          running++;

          tasks[taskIndex]()
            .then((result) => {
              results[taskIndex] = result;
            })
            .catch(reject)
            .finally(() => {
              running--;
              completed++;
              runNext();
            });
        }
      };

      runNext();
    });
  },

  series: async (tasks) => {
    const results = [];
    for (const task of tasks) {
      results.push(await task());
    }
    return results;
  },

  map: async (items, fn, options = {}) => {
    const { concurrency = Infinity } = options;
    const tasks = items.map((item, index) => () => fn(item, index));
    return asyncUtils.parallel(tasks, concurrency);
  },

  filter: async (items, predicate) => {
    const results = await Promise.all(
      items.map(async (item, index) => ({
        item,
        keep: await predicate(item, index),
      }))
    );
    return results.filter((r) => r.keep).map((r) => r.item);
  },

  any: (promises) => {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const errors = [];

      promises.forEach((promise, index) => {
        promise
          .then((result) => {
            if (!resolved) {
              resolved = true;
              resolve(result);
            }
          })
          .catch((error) => {
            errors[index] = error;
            if (errors.filter(Boolean).length === promises.length) {
              reject(new Error('All promises rejected'));
            }
          });
      });
    });
  },

  allSettled: (promises) => {
    return Promise.all(
      promises.map((p) =>
        p.then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason })
        )
      )
    );
  },

  defer: () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  },

  queue: (concurrency = 1) => {
    const pending = [];
    let running = 0;

    const runNext = () => {
      if (running >= concurrency || pending.length === 0) return;

      const { task, resolve, reject } = pending.shift();
      running++;

      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          running--;
          runNext();
        });
    };

    return {
      add: (task) =>
        new Promise((resolve, reject) => {
          pending.push({ task, resolve, reject });
          runNext();
        }),
      size: () => pending.length,
      running: () => running,
    };
  },
};

describe('Async Utils Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // SLEEP
  // ═══════════════════════════════════════════════════════════════════

  describe('sleep', () => {
    it('should delay execution', async () => {
      const promise = asyncUtils.sleep(1000);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // TIMEOUT
  // ═══════════════════════════════════════════════════════════════════

  describe('timeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = Promise.resolve('success');
      await expect(asyncUtils.timeout(promise, 1000)).resolves.toBe('success');
    });

    it('should reject if promise times out', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 2000));

      const promise = asyncUtils.timeout(slowPromise, 100);
      vi.advanceTimersByTime(100);

      await expect(promise).rejects.toThrow('Operation timed out');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RETRY
  // ═══════════════════════════════════════════════════════════════════

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await asyncUtils.retry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

      const promise = asyncUtils.retry(fn, { delay: 100 });
      vi.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      const promise = asyncUtils.retry(fn, { retries: 2, delay: 100 });
      vi.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow('always fail');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEBOUNCE
  // ═══════════════════════════════════════════════════════════════════

  describe('debounce', () => {
    it('should debounce calls', () => {
      const fn = vi.fn();
      const debounced = asyncUtils.debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel debounce', () => {
      const fn = vi.fn();
      const debounced = asyncUtils.debounce(fn, 100);

      debounced();
      debounced.cancel();

      vi.advanceTimersByTime(100);

      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // THROTTLE
  // ═══════════════════════════════════════════════════════════════════

  describe('throttle', () => {
    it('should throttle calls', () => {
      const fn = vi.fn();
      const throttled = asyncUtils.throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // PARALLEL & SERIES
  // ═══════════════════════════════════════════════════════════════════

  describe('parallel', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should run tasks in parallel', async () => {
      const tasks = [() => Promise.resolve(1), () => Promise.resolve(2), () => Promise.resolve(3)];

      const results = await asyncUtils.parallel(tasks);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('series', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should run tasks in series', async () => {
      const order = [];
      const tasks = [
        async () => {
          order.push(1);
          return 1;
        },
        async () => {
          order.push(2);
          return 2;
        },
        async () => {
          order.push(3);
          return 3;
        },
      ];

      const results = await asyncUtils.series(tasks);

      expect(results).toEqual([1, 2, 3]);
      expect(order).toEqual([1, 2, 3]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // MAP & FILTER
  // ═══════════════════════════════════════════════════════════════════

  describe('map', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should map items async', async () => {
      const items = [1, 2, 3];
      const results = await asyncUtils.map(items, async (n) => n * 2);

      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('filter', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should filter items async', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await asyncUtils.filter(items, async (n) => n % 2 === 0);

      expect(results).toEqual([2, 4]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // DEFER
  // ═══════════════════════════════════════════════════════════════════

  describe('defer', () => {
    it('should create deferred promise', async () => {
      const deferred = asyncUtils.defer();

      setTimeout(() => deferred.resolve('done'), 10);
      vi.advanceTimersByTime(10);

      await expect(deferred.promise).resolves.toBe('done');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // QUEUE
  // ═══════════════════════════════════════════════════════════════════

  describe('queue', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should queue tasks', async () => {
      const queue = asyncUtils.queue(1);

      const results = await Promise.all([
        queue.add(() => Promise.resolve(1)),
        queue.add(() => Promise.resolve(2)),
      ]);

      expect(results).toEqual([1, 2]);
    });
  });
});
