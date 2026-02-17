import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('EnhancedCircuitBreaker: beginGradualRecovery is idempotent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not reset recoveryPercent when called twice', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc');
    breaker.state = mod.STATES.HALF_OPEN;

    breaker.beginGradualRecovery();
    expect(breaker.recoveryPercent).toBe(20);
    breaker.recoveryPercent = 40;
    breaker.beginGradualRecovery();
    expect(breaker.recoveryPercent).toBe(40);
  });
});
