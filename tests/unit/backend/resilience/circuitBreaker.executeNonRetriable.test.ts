import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreaker: non-retriable / non-system errors', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not retry on 400/validation and does not count as system failure', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      retryAttempts: 5,
      retryBaseDelay: 10,
      retryMaxDelay: 20,
    });

    const fn = vi.fn(async () => {
      throw new Error('400 validation error');
    });

    await expect(breaker.execute(fn)).rejects.toThrow(/validation/i);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.failures).toBe(0);
    expect(breaker.totalFailures).toBe(0);
    expect(breaker.state).toBe(mod.STATES.CLOSED);
  });
});
