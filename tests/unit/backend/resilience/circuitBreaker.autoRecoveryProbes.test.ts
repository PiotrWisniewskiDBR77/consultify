import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: auto recovery probes', () => {
  it('transitions OPEN -> HALF_OPEN when opened long enough (no healthCheckFn)', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 10 });
    breaker.state = mod.STATES.OPEN;
    breaker.openedAt = now.getTime() - 1000;

    const result = await mod.CircuitBreakerService.runAutoRecoveryProbes();
    expect(result.recovered).toBe(1);
    expect(breaker.state).toBe(mod.STATES.HALF_OPEN);

    vi.useRealTimers();
  });
});
