import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: forceRecovery', () => {
  it('returns false when breaker is not OPEN', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    mod.CircuitBreakerService.getBreaker('svc').state = mod.STATES.CLOSED;
    expect(mod.CircuitBreakerService.forceRecovery('svc')).toBe(false);
  });

  it('moves OPEN -> HALF_OPEN and starts health checks', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { healthCheckFn: async () => {} });
    breaker.state = mod.STATES.OPEN;
    breaker.openedAt = Date.now() - 1000;
    breaker.nextAttemptTime = Date.now() + 60_000;

    expect(mod.CircuitBreakerService.forceRecovery('svc')).toBe(true);
    expect(breaker.state).toBe(mod.STATES.HALF_OPEN);
    expect(breaker.getStatus().healthCheckActive).toBe(true);
  });
});
