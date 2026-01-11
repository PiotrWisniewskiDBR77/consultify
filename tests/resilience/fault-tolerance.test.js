/**
 * Fault Tolerance Patterns Tests
 * Tests for bulkhead, timeout, and fallback patterns
 *
 * @module tests/resilience/fault-tolerance.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Retry with backoff
const createRetryWithBackoff = (options = {}) => {
  const { maxRetries = 3, baseDelay = 100, maxDelay = 10000, backoffFactor = 2, retryOn } = options;

  return {
    execute: async (fn) => {
      let lastError;
      let delay = baseDelay;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;

          if (retryOn && !retryOn(error)) {
            throw error;
          }

          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(delay * backoffFactor, maxDelay);
          }
        }
      }

      throw lastError;
    },
  };
};

// Bulkhead pattern
const createBulkhead = (maxConcurrent, queueSize = 0) => {
  let running = 0;
  const queue = [];

  const runNext = () => {
    if (running >= maxConcurrent || queue.length === 0) return;

    const { fn, resolve, reject } = queue.shift();
    running++;

    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        running--;
        runNext();
      });
  };

  return {
    execute: async (fn) => {
      if (running < maxConcurrent) {
        running++;
        try {
          return await fn();
        } finally {
          running--;
          runNext();
        }
      }

      if (queue.length >= queueSize) {
        throw new Error('Bulkhead queue full');
      }

      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
      });
    },

    getStats: () => ({
      running,
      queued: queue.length,
      available: maxConcurrent - running,
    }),
  };
};

// Timeout wrapper
const createTimeoutWrapper = (defaultTimeout = 5000) => {
  return {
    execute: async (fn, timeout = defaultTimeout) => {
      let timeoutId;

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Operation timed out'));
        }, timeout);
      });

      try {
        return await Promise.race([fn(), timeoutPromise]);
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
};

// Fallback pattern
const createFallback = (primary, fallback) => {
  return {
    execute: async (...args) => {
      try {
        return await primary(...args);
      } catch {
        return await fallback(...args);
      }
    },
  };
};

// Hedged requests
const createHedgedRequest = (timeout = 100) => {
  return {
    execute: async (requests) => {
      const controllers = requests.map(() => new AbortController());

      const racers = requests.map(
        (fn, i) =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              fn(controllers[i].signal).then(resolve).catch(reject);
            }, i * timeout);
          })
      );

      try {
        const result = await Promise.race(racers);
        // Cancel remaining
        controllers.forEach((c) => c.abort());
        return result;
      } catch (error) {
        throw error;
      }
    },
  };
};

describe('Retry with Backoff Tests', () => {
  it('should retry on failure', async () => {
    let attempts = 0;
    const retry = createRetryWithBackoff({ maxRetries: 3, baseDelay: 10 });

    const result = await retry.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max retries', async () => {
    const retry = createRetryWithBackoff({ maxRetries: 2, baseDelay: 10 });

    await expect(
      retry.execute(async () => {
        throw new Error('always fail');
      })
    ).rejects.toThrow('always fail');
  });

  it('should not retry unretryable errors', async () => {
    let attempts = 0;
    const retry = createRetryWithBackoff({
      maxRetries: 3,
      baseDelay: 10,
      retryOn: (err) => err.message !== 'fatal',
    });

    await expect(
      retry.execute(async () => {
        attempts++;
        throw new Error('fatal');
      })
    ).rejects.toThrow('fatal');

    expect(attempts).toBe(1);
  });
});

describe('Bulkhead Tests', () => {
  let bulkhead;

  beforeEach(() => {
    bulkhead = createBulkhead(2, 2);
  });

  it('should limit concurrency', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array(5)
      .fill(null)
      .map(() =>
        bulkhead.execute(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
        })
      );

    await Promise.all(tasks);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should reject when queue is full', async () => {
    const slowFn = () => new Promise((r) => setTimeout(r, 100));

    bulkhead.execute(slowFn);
    bulkhead.execute(slowFn);
    bulkhead.execute(slowFn);
    bulkhead.execute(slowFn);

    await expect(bulkhead.execute(slowFn)).rejects.toThrow('queue full');
  });

  it('should report stats', () => {
    const stats = bulkhead.getStats();

    expect(stats.running).toBe(0);
    expect(stats.queued).toBe(0);
  });
});

describe('Timeout Wrapper Tests', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = createTimeoutWrapper(50);
  });

  it('should complete within timeout', async () => {
    const result = await wrapper.execute(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'done';
    });

    expect(result).toBe('done');
  });

  it('should throw on timeout', async () => {
    await expect(
      wrapper.execute(async () => {
        await new Promise((r) => setTimeout(r, 100));
      })
    ).rejects.toThrow('timed out');
  });
});

describe('Fallback Pattern Tests', () => {
  it('should use primary on success', async () => {
    const primary = vi.fn(async () => 'primary');
    const fallback = vi.fn(async () => 'fallback');

    const pattern = createFallback(primary, fallback);
    const result = await pattern.execute();

    expect(result).toBe('primary');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('should use fallback on failure', async () => {
    const primary = vi.fn(async () => {
      throw new Error();
    });
    const fallback = vi.fn(async () => 'fallback');

    const pattern = createFallback(primary, fallback);
    const result = await pattern.execute();

    expect(result).toBe('fallback');
  });
});
