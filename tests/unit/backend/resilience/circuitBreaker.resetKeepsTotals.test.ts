import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreaker: reset does not wipe totals', () => {
  it('clears state counters but keeps total stats', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { failureThreshold: 1 });

    await breaker.recordFailure(new Error('network timeout'));
    expect(breaker.totalFailures).toBe(1);
    expect(breaker.state).toBe(mod.STATES.OPEN);

    await breaker.reset();
    expect(breaker.state).toBe(mod.STATES.CLOSED);
    expect(breaker.failures).toBe(0);
    expect(breaker.successes).toBe(0);
    expect(breaker.totalFailures).toBe(1);
  });
});
