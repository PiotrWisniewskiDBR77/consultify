import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('EnhancedCircuitBreaker: health check failure reopens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('records failure when health check fails in HALF_OPEN', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 1,
      healthCheckFn: async () => {
        throw new Error('timeout');
      },
    });
    breaker.state = mod.STATES.HALF_OPEN;

    breaker.canExecute(); // starts interval
    await vi.advanceTimersByTimeAsync(30_000);

    expect(breaker.state).toBe(mod.STATES.OPEN);
    expect(breaker.lastError).toMatch(/timeout/i);
  });
});
