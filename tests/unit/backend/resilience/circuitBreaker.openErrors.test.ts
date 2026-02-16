import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreaker: open errors', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws CIRCUIT_OPEN with flags when OPEN', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 60000 });
    breaker.state = mod.STATES.OPEN;
    breaker.nextAttemptTime = Date.now() + 60000;

    await expect(breaker.execute(async () => 'ok')).rejects.toMatchObject({
      isCircuitOpen: true,
      breakerName: 'svc',
      code: 'CIRCUIT_OPEN',
    });
  });

  it('throws CIRCUIT_OPENED when circuit opens during retry', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 1,
      resetTimeout: 60000,
      retryAttempts: 2,
      retryBaseDelay: 1,
      retryMaxDelay: 2,
    });

    const fn = vi.fn(async () => {
      throw new Error('network timeout');
    });

    const p = breaker.execute(fn);
    await vi.runAllTimersAsync();

    await expect(p).rejects.toMatchObject({
      isCircuitOpen: true,
      code: 'CIRCUIT_OPENED',
    });
  });
});
