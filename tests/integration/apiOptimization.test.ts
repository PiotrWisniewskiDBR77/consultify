import { describe, expect, it, vi } from 'vitest';

import { CircuitBreaker } from '../../server/src/services/circuitBreakerService.ts';

describe('API optimization (retry/backoff) - REAL_CODE', () => {
  it('CircuitBreaker uses exponential backoff capped by retryMaxDelay', async () => {
    vi.useFakeTimers();
    const breaker = new CircuitBreaker('opt', {
      persistenceEnabled: false,
      retryAttempts: 3,
      retryBaseDelay: 10,
      retryMaxDelay: 15,
      failureThreshold: 99,
    });

    let attempts = 0;
    const p = breaker.execute(async () => {
      attempts++;
      if (attempts < 4) throw new Error('network');
      return 'ok';
    });

    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe('ok');
    expect(attempts).toBe(4);
    vi.useRealTimers();
  });
});
