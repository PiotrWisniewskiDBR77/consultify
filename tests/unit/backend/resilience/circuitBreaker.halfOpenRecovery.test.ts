import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: HALF_OPEN recovery', () => {
  it('closes after reaching successThreshold in HALF_OPEN', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { successThreshold: 2 });

    breaker.state = mod.STATES.OPEN;
    breaker.nextAttemptTime = Date.now() - 1;
    expect(breaker.canExecute().state).toBe(mod.STATES.HALF_OPEN);
    expect(breaker.state).toBe(mod.STATES.HALF_OPEN);

    await breaker.recordSuccess();
    expect(breaker.state).toBe(mod.STATES.HALF_OPEN);

    await breaker.recordSuccess();
    expect(breaker.state).toBe(mod.STATES.CLOSED);
    expect(breaker.openedAt).toBeNull();
    expect(breaker.nextAttemptTime).toBeNull();
  });
});
