import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('EnhancedCircuitBreaker: health checks trigger gradual recovery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('begins gradual recovery after 3 consecutive health checks in HALF_OPEN', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { healthCheckFn: async () => {} });
    breaker.state = mod.STATES.HALF_OPEN;

    // canExecute will start health checks
    breaker.canExecute();

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(breaker.consecutiveHealthChecks).toBeGreaterThanOrEqual(3);
    expect(breaker.isRecovering).toBe(true);
    expect(breaker.recoveryPercent).toBe(20);
  });
});
