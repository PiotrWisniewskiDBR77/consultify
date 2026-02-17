import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreaker: execute retries with backoff', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on retriable error and eventually succeeds', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      retryAttempts: 3,
      retryBaseDelay: 10,
      retryMaxDelay: 50,
    });

    const fn = vi
      .fn<[], Promise<string>>()
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('ok');

    const p = breaker.execute(fn);
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await vi.runAllTicks();

    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(breaker.totalSuccesses).toBe(1);
  });
});
