import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('CircuitBreaker: persistence errors are ignored', () => {
  it('recordFailure does not throw when DbPromise.run fails', async () => {
    dbAll.mockResolvedValue([{ name: 'service' }]);
    dbRun.mockRejectedValue(new Error('db down'));

    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 1,
      persistenceEnabled: true,
    });

    await expect(breaker.recordFailure(new Error('network timeout'))).resolves.toBeUndefined();
    expect(breaker.state).toBe(mod.STATES.OPEN);
  });
});
