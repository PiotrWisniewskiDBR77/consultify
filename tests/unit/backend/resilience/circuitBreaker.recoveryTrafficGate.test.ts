import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('EnhancedCircuitBreaker: recovery traffic gating', () => {
  it('blocks some traffic during recovery based on recoveryPercent', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc');

    breaker.state = mod.STATES.HALF_OPEN;
    breaker.isRecovering = true;
    breaker.recoveryPercent = 20;

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.99); // 99% -> block at 20%
    const res = breaker.canExecute();
    rand.mockRestore();

    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/recovery/i);
  });

  it('allows traffic during recovery when random is below threshold', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc');

    breaker.state = mod.STATES.HALF_OPEN;
    breaker.isRecovering = true;
    breaker.recoveryPercent = 20;

    const rand = vi.spyOn(Math, 'random').mockReturnValue(0.0); // 0% -> allow
    const res = breaker.canExecute();
    rand.mockRestore();

    expect(res.allowed).toBe(true);
  });
});
