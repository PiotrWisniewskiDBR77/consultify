import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: canExecute', () => {
  it('allows execution when CLOSED', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 10 });
    expect(breaker.canExecute()).toEqual({ allowed: true, state: mod.STATES.CLOSED });
  });

  it('opens after reaching failureThreshold', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 2,
      resetTimeout: 1234,
    });

    await breaker.recordFailure(new Error('network timeout'));
    expect(breaker.state).toBe(mod.STATES.CLOSED);
    expect(breaker.failures).toBe(1);

    await breaker.recordFailure(new Error('network timeout'));
    expect(breaker.state).toBe(mod.STATES.OPEN);
    expect(breaker.openedAt).toEqual(expect.any(Number));
    expect(breaker.nextAttemptTime).toBe((breaker.openedAt as number) + 1234);
    expect(breaker.lastError).toMatch(/timeout/i);
  });

  it('blocks execution while OPEN cooldown is active', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 60000 });
    breaker.state = mod.STATES.OPEN;
    breaker.nextAttemptTime = Date.now() + 60000;

    const res = breaker.canExecute();
    expect(res.allowed).toBe(false);
    expect(res.state).toBe(mod.STATES.OPEN);
    expect(res.reason).toMatch(/retry in/i);
  });

  it('transitions OPEN -> HALF_OPEN when cooldown elapsed', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 1 });
    breaker.state = mod.STATES.OPEN;
    breaker.nextAttemptTime = Date.now() - 1;

    const res = breaker.canExecute();
    expect(res.allowed).toBe(true);
    expect(res.state).toBe(mod.STATES.HALF_OPEN);
    expect(breaker.state).toBe(mod.STATES.HALF_OPEN);
  });
});
