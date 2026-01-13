/**
 * Error Recovery Unit Tests
 * Tests error handling, retries, and fallback mechanisms
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Error Recovery implementation
const createErrorRecovery = () => {
  const recoveryLog = [];
  let counter = 0;

  return {
    withRetry: async (operation, options = {}) => {
      const maxRetries = options.maxRetries || 3;
      const delay = options.delay || 100;
      const backoff = options.backoff || 2;

      let lastError = null;
      let currentDelay = delay;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await operation();
          recoveryLog.push({
            id: `rec-${Date.now()}-${++counter}`,
            attempt,
            success: true,
            timestamp: new Date(),
          });
          return { success: true, result, attempts: attempt };
        } catch (error) {
          lastError = error;
          recoveryLog.push({
            id: `rec-${Date.now()}-${++counter}`,
            attempt,
            success: false,
            error: error.message,
            timestamp: new Date(),
          });

          if (attempt < maxRetries) {
            await sleep(currentDelay);
            currentDelay *= backoff;
          }
        }
      }

      return {
        success: false,
        error: lastError,
        attempts: maxRetries,
        recovered: false,
      };
    },

    withFallback: async (primary, fallback) => {
      try {
        return { result: await primary(), source: 'primary' };
      } catch (primaryError) {
        try {
          return { result: await fallback(), source: 'fallback' };
        } catch (fallbackError) {
          throw new Error(
            `Both primary and fallback failed: ${primaryError.message}, ${fallbackError.message}`
          );
        }
      }
    },

    withCircuitBreaker: (options = {}) => {
      const threshold = options.threshold || 5;
      const resetTimeout = options.resetTimeout || 30000;
      let failureCount = 0;
      let lastFailure = null;
      let isOpen = false;

      return {
        call: async (operation) => {
          if (isOpen) {
            if (Date.now() - lastFailure > resetTimeout) {
              isOpen = false;
              failureCount = 0;
            } else {
              throw new Error('Circuit breaker is open');
            }
          }

          try {
            const result = await operation();
            failureCount = 0;
            return result;
          } catch (error) {
            failureCount++;
            lastFailure = Date.now();
            if (failureCount >= threshold) {
              isOpen = true;
            }
            throw error;
          }
        },
        getState: () => ({
          isOpen,
          failureCount,
          threshold,
        }),
      };
    },

    getRecoveryLog: () => [...recoveryLog],

    isRecoverableError: (error) => {
      const recoverableCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', '503', '429'];
      return recoverableCodes.some((code) => error.code === code || error.message?.includes(code));
    },
  };
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ErrorRecovery', () => {
  let recovery;

  beforeEach(() => {
    recovery = createErrorRecovery();
  });

  describe('Retry Mechanism', () => {
    it('should succeed on first try', async () => {
      const result = await recovery.withRetry(async () => 'success');

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const result = await recovery.withRetry(
        async () => {
          attempts++;
          if (attempts < 3) throw new Error('Temporary failure');
          return 'success';
        },
        { maxRetries: 3, delay: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should fail after max retries', async () => {
      const result = await recovery.withRetry(
        async () => {
          throw new Error('Permanent failure');
        },
        { maxRetries: 2, delay: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);
    });
  });

  describe('Fallback Mechanism', () => {
    it('should use primary when successful', async () => {
      const result = await recovery.withFallback(
        async () => 'primary result',
        async () => 'fallback result'
      );

      expect(result.result).toBe('primary result');
      expect(result.source).toBe('primary');
    });

    it('should use fallback on primary failure', async () => {
      const result = await recovery.withFallback(
        async () => {
          throw new Error('Primary failed');
        },
        async () => 'fallback result'
      );

      expect(result.result).toBe('fallback result');
      expect(result.source).toBe('fallback');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open after threshold failures', async () => {
      const breaker = recovery.withCircuitBreaker({ threshold: 2 });

      for (let i = 0; i < 2; i++) {
        try {
          await breaker.call(async () => {
            throw new Error('Fail');
          });
        } catch (e) {}
      }

      expect(breaker.getState().isOpen).toBe(true);
    });

    it('should reject when open', async () => {
      const breaker = recovery.withCircuitBreaker({ threshold: 1 });

      try {
        await breaker.call(async () => {
          throw new Error('Fail');
        });
      } catch (e) {}

      await expect(breaker.call(async () => 'success')).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('Error Classification', () => {
    it('should identify recoverable errors', () => {
      expect(recovery.isRecoverableError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(recovery.isRecoverableError({ message: 'Error 503' })).toBe(true);
    });

    it('should identify non-recoverable errors', () => {
      expect(recovery.isRecoverableError({ code: 'INVALID_INPUT' })).toBe(false);
    });
  });
});
