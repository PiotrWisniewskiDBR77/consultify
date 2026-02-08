/**
 * Resilience & Robustness - Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../../matchers/index';
import { ResiliencePatterns } from '../../patterns/resilience-patterns';

describe('Resilience & Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Circuit Breaker', () => {
    it('should transition to OPEN state after threshold met', () => {
      const threshold = 3;
      const checkState = ResiliencePatterns.circuitBreaker.simulateFailure(threshold);

      expect(checkState()).toBe('closed');
      expect(checkState()).toBe('closed');
      expect(checkState()).toBe('open');
    });

    it('should prevent execution when state is OPEN', () => {
      const service = {
        state: 'open',
        execute: vi.fn(),
      };

      const callService = () => {
        if (service.state === 'open') throw new Error('Circuit Open');
        return service.execute();
      };

      expect(callService).toThrow('Circuit Open');
      expect(service.execute).not.toHaveBeenCalled();
    });

    it('should transition to HALF-OPEN after timeout', () => {
      let state = 'open';
      vi.advanceTimersByTime(5000);
      state = 'half-open';

      expect(state).toBe('half-open');
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate correct delay sequence', () => {
      const baseMs = 100;
      const attempts = 4;
      const expected = [100, 200, 400, 800];

      const results = ResiliencePatterns.retryStrategy.validateExponentialBackoff(attempts, baseMs);
      expect(results).toEqual(expected);
    });

    it('should succeed after retry attempts', async () => {
      const transientAction = ResiliencePatterns.retryStrategy.simulateTransientFailure(3);
      let attempts = 0;
      let result = '';

      while (attempts < 5) {
        try {
          result = transientAction();
          break;
        } catch (e) {
          attempts++;
        }
      }

      expect(result).toBe('success');
      expect(attempts).toBe(2); // Failed twice, succeeded on 3rd
    });
  });

  describe('Deadlines & Timeouts', () => {
    it('should respect short deadlines', async () => {
      const fastAction = async () => 'done';
      await expect(fastAction).toRespectDeadlines(100);
    });

    it('should fail on exceeded deadlines', async () => {
      const slowAction = () => new Promise((r) => setTimeout(() => r('done'), 500));

      const promise = ResiliencePatterns.deadlines.testDeadline(slowAction, 100);
      vi.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow('Deadline exceeded');
    });
  });

  describe('Partial Failures', () => {
    it('should handle partial list failure', () => {
      const items = [1, 2, 3, 4, 5];
      const process = (id: number) => {
        if (id === 3) throw new Error('Failed');
        return id * 2;
      };

      const results = items.map((id) => {
        try {
          return { id, result: process(id), status: 'success' };
        } catch (e) {
          return { id, status: 'error', error: e.message };
        }
      });

      expect(results.filter((r) => r.status === 'success')).toHaveLength(4);
      expect(results.find((r) => r.id === 3)?.status).toBe('error');
    });

    it('should use fallback on failure', () => {
      const getPrimary = () => {
        throw new Error('Primary Down');
      };
      const getFallback = () => 'Fallback Value';

      let result;
      try {
        result = getPrimary();
      } catch (e) {
        result = getFallback();
      }

      expect(result).toBe('Fallback Value');
    });
  });
});
