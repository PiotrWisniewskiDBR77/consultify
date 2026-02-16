import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: cleanup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops health checks and cancels recovery steps', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');

    const breaker = mod.CircuitBreakerService.getBreaker('svc', { healthCheckFn: async () => {} });
    breaker.state = mod.STATES.HALF_OPEN;

    // start health checks (side-effect of canExecute in HALF_OPEN)
    breaker.canExecute();
    expect(breaker.getStatus().healthCheckActive).toBe(true);

    breaker.beginGradualRecovery();
    expect(breaker.isRecovering).toBe(true);
    expect(breaker.recoveryPercent).toBe(20);

    mod.CircuitBreakerService.cleanup();
    expect(breaker.getStatus().healthCheckActive).toBe(false);

    // steps were cleared - percent should not change after time passes
    await vi.advanceTimersByTimeAsync(60_000);
    expect(breaker.recoveryPercent).toBe(20);
  });
});
