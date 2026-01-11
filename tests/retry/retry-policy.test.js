/**
 * Retry Policy Tests
 * Tests for various retry strategies
 *
 * @module tests/retry/retry-policy.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Retry policy implementations
const retryPolicies = {
  fixed: (delay) => () => delay,

  linear: (baseDelay, increment) => (attempt) => baseDelay + attempt * increment,

  exponential:
    (baseDelay, factor = 2) =>
    (attempt) =>
      baseDelay * Math.pow(factor, attempt),

  exponentialWithJitter:
    (baseDelay, factor = 2) =>
    (attempt) => {
      const delay = baseDelay * Math.pow(factor, attempt);
      const jitter = Math.random() * delay * 0.1;
      return delay + jitter;
    },

  fibonacci: (baseDelay) => {
    const fib = [1, 1];
    return (attempt) => {
      while (fib.length <= attempt + 1) {
        fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
      }
      return baseDelay * fib[attempt];
    };
  },
};

// Retry executor
const createRetryExecutor = (options = {}) => {
  const {
    maxAttempts = 3,
    delayPolicy = retryPolicies.fixed(1000),
    shouldRetry = () => true,
    onRetry = () => {},
    timeout = 30000,
  } = options;

  return {
    execute: async (fn) => {
      let lastError;
      const startTime = Date.now();

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await fn(attempt);
        } catch (error) {
          lastError = error;

          // Check if we should retry
          if (!shouldRetry(error, attempt)) {
            throw error;
          }

          // Check timeout
          if (Date.now() - startTime >= timeout) {
            throw new Error(`Retry timeout after ${attempt + 1} attempts`);
          }

          // Last attempt, don't wait
          if (attempt === maxAttempts - 1) {
            throw error;
          }

          // Calculate delay
          const delay = delayPolicy(attempt);
          onRetry({ error, attempt, delay });

          // Wait before retry
          await new Promise((r) => setTimeout(r, delay));
        }
      }

      throw lastError;
    },
  };
};

describe('Retry Policy Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIXED DELAY
  // ═══════════════════════════════════════════════════════════════════

  describe('Fixed Delay', () => {
    it('should return constant delay', () => {
      const policy = retryPolicies.fixed(1000);

      expect(policy(0)).toBe(1000);
      expect(policy(1)).toBe(1000);
      expect(policy(5)).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // LINEAR BACKOFF
  // ═══════════════════════════════════════════════════════════════════

  describe('Linear Backoff', () => {
    it('should increase linearly', () => {
      const policy = retryPolicies.linear(1000, 500);

      expect(policy(0)).toBe(1000);
      expect(policy(1)).toBe(1500);
      expect(policy(2)).toBe(2000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPONENTIAL BACKOFF
  // ═══════════════════════════════════════════════════════════════════

  describe('Exponential Backoff', () => {
    it('should increase exponentially', () => {
      const policy = retryPolicies.exponential(1000, 2);

      expect(policy(0)).toBe(1000);
      expect(policy(1)).toBe(2000);
      expect(policy(2)).toBe(4000);
      expect(policy(3)).toBe(8000);
    });

    it('should use custom factor', () => {
      const policy = retryPolicies.exponential(1000, 3);

      expect(policy(0)).toBe(1000);
      expect(policy(1)).toBe(3000);
      expect(policy(2)).toBe(9000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // EXPONENTIAL WITH JITTER
  // ═══════════════════════════════════════════════════════════════════

  describe('Exponential With Jitter', () => {
    it('should add jitter', () => {
      const policy = retryPolicies.exponentialWithJitter(1000);

      const delay1 = policy(1);
      const delay2 = policy(1);

      // Base would be 2000, jitter adds up to 200 (10%)
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FIBONACCI BACKOFF
  // ═══════════════════════════════════════════════════════════════════

  describe('Fibonacci Backoff', () => {
    it('should follow fibonacci sequence', () => {
      const policy = retryPolicies.fibonacci(1000);

      expect(policy(0)).toBe(1000); // fib(0) = 1
      expect(policy(1)).toBe(1000); // fib(1) = 1
      expect(policy(2)).toBe(2000); // fib(2) = 2
      expect(policy(3)).toBe(3000); // fib(3) = 3
      expect(policy(4)).toBe(5000); // fib(4) = 5
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RETRY EXECUTOR - SUCCESS
  // ═══════════════════════════════════════════════════════════════════

  describe('Retry Executor - Success', () => {
    it('should succeed on first try', async () => {
      const executor = createRetryExecutor();
      const fn = vi.fn().mockResolvedValue('success');

      const result = await executor.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should succeed after retries', async () => {
      const executor = createRetryExecutor({
        delayPolicy: retryPolicies.fixed(100),
      });

      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success');

      const promise = executor.execute(fn);
      vi.advanceTimersByTime(100);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // RETRY EXECUTOR - FAILURE
  // ═══════════════════════════════════════════════════════════════════

  describe('Retry Executor - Failure', () => {
    it('should throw after max attempts', async () => {
      const executor = createRetryExecutor({
        maxAttempts: 3,
        delayPolicy: retryPolicies.fixed(100),
      });

      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      const promise = executor.execute(fn);
      vi.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // SHOULD RETRY
  // ═══════════════════════════════════════════════════════════════════

  describe('Should Retry', () => {
    it('should not retry when shouldRetry returns false', async () => {
      const executor = createRetryExecutor({
        shouldRetry: (error) => error.message !== 'fatal',
      });

      const fn = vi.fn().mockRejectedValue(new Error('fatal'));

      await expect(executor.execute(fn)).rejects.toThrow('fatal');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry based on error type', async () => {
      const executor = createRetryExecutor({
        maxAttempts: 3,
        delayPolicy: retryPolicies.fixed(100),
        shouldRetry: (error) => error.message.includes('timeout'),
      });

      const fn = vi.fn().mockRejectedValueOnce(new Error('timeout')).mockResolvedValue('ok');

      const promise = executor.execute(fn);
      vi.advanceTimersByTime(100);

      await expect(promise).resolves.toBe('ok');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ON RETRY CALLBACK
  // ═══════════════════════════════════════════════════════════════════

  describe('On Retry Callback', () => {
    it('should call onRetry with details', async () => {
      const onRetry = vi.fn();
      const executor = createRetryExecutor({
        maxAttempts: 3,
        delayPolicy: retryPolicies.fixed(100),
        onRetry,
      });

      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

      const promise = executor.execute(fn);
      vi.advanceTimersByTime(100);
      await promise;

      expect(onRetry).toHaveBeenCalledWith({
        error: expect.any(Error),
        attempt: 0,
        delay: 100,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ATTEMPT COUNTER
  // ═══════════════════════════════════════════════════════════════════

  describe('Attempt Counter', () => {
    it('should pass attempt number to function', async () => {
      const executor = createRetryExecutor({
        maxAttempts: 3,
        delayPolicy: retryPolicies.fixed(100),
      });

      const attempts = [];
      const fn = vi.fn().mockImplementation((attempt) => {
        attempts.push(attempt);
        if (attempt < 2) throw new Error('retry');
        return 'ok';
      });

      const promise = executor.execute(fn);
      vi.advanceTimersByTime(200);
      await promise;

      expect(attempts).toEqual([0, 1, 2]);
    });
  });
});
