import { describe, expect, it } from 'vitest';

import { CircuitBreaker, STATES } from '../../server/src/services/circuitBreakerService.ts';

describe('API resilience (circuit states) - REAL_CODE', () => {
  it('getStatus exposes cooldownRemaining when OPEN', () => {
    const breaker = new CircuitBreaker('svc', { persistenceEnabled: false });
    breaker.state = STATES.OPEN;
    breaker.nextAttemptTime = Date.now() + 5000;
    const status = breaker.getStatus();
    expect(status.cooldownRemaining).toBeGreaterThan(0);
    expect(status.isFailing).toBe(true);
  });

  it('HALF_OPEN state is considered failing', () => {
    const breaker = new CircuitBreaker('svc', { persistenceEnabled: false });
    breaker.state = STATES.HALF_OPEN;
    expect(breaker.getStatus().isFailing).toBe(true);
  });

  it('CLOSED state is not failing', () => {
    const breaker = new CircuitBreaker('svc', { persistenceEnabled: false });
    breaker.state = STATES.CLOSED;
    expect(breaker.getStatus().isFailing).toBe(false);
  });
});
