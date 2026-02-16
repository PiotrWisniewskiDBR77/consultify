import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('EnhancedCircuitBreaker: gradual recovery progress', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reaches 100% and completes recovery after scheduled steps', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc');

    breaker.state = mod.STATES.HALF_OPEN;
    breaker.beginGradualRecovery();
    expect(breaker.isRecovering).toBe(true);
    expect(breaker.recoveryPercent).toBe(20);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(breaker.recoveryPercent).toBe(100);
    expect(breaker.isRecovering).toBe(false);
  });
});
