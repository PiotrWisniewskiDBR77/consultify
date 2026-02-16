import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker, STATES } from '../../server/src/services/circuitBreakerService.ts';

describe('CircuitBreaker - resilience basics (REAL_CODE)', () => {
  it('allows execution when CLOSED', () => {
    const breaker = new CircuitBreaker('x', { persistenceEnabled: false });
    expect(breaker.canExecute()).toEqual({ allowed: true, state: STATES.CLOSED });
  });

  it('denies execution when OPEN and cooldown not elapsed', () => {
    const breaker = new CircuitBreaker('x', { persistenceEnabled: false });
    breaker.state = STATES.OPEN;
    breaker.nextAttemptTime = Date.now() + 60_000;
    const res = breaker.canExecute();
    expect(res.allowed).toBe(false);
    expect(res.state).toBe(STATES.OPEN);
  });

  it('transitions OPEN -> HALF_OPEN when cooldown elapsed', () => {
    const breaker = new CircuitBreaker('x', { persistenceEnabled: false });
    breaker.state = STATES.OPEN;
    breaker.nextAttemptTime = Date.now() - 1;
    const res = breaker.canExecute();
    expect(res.allowed).toBe(true);
    expect(res.state).toBe(STATES.HALF_OPEN);
    expect(breaker.state).toBe(STATES.HALF_OPEN);
  });

  it('execute throws CIRCUIT_OPEN error when OPEN and not ready', async () => {
    const breaker = new CircuitBreaker('x', { persistenceEnabled: false });
    breaker.state = STATES.OPEN;
    breaker.nextAttemptTime = Date.now() + 60_000;
    await expect(breaker.execute(async () => 1)).rejects.toEqual(
      expect.objectContaining({ code: 'CIRCUIT_OPEN', isCircuitOpen: true })
    );
  });

  it('execute retries on retriable failures (timeout) and eventually succeeds', async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker('x', {
      persistenceEnabled: false,
      retryAttempts: 2,
      retryBaseDelay: 10,
      retryMaxDelay: 20,
      failureThreshold: 99,
    });

    let attempts = 0;
    const p = breaker.execute(async () => {
      attempts++;
      if (attempts < 3) throw new Error('timeout');
      return 'ok';
    });

    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(attempts).toBe(3);
    vi.useRealTimers();
  });
});
