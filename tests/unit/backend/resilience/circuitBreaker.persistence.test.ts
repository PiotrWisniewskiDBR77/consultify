import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const dbAll = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: (...args: any[]) => dbRun(...args),
}));

describe('CircuitBreaker: persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([{ name: 'service' }]);
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('persists OPEN state when persistenceEnabled and service column exists', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 1,
      persistenceEnabled: true,
    });

    await breaker.recordFailure(new Error('network timeout'));
    expect(breaker.state).toBe(mod.STATES.OPEN);
    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('information_schema.columns'),
      ['circuit_breaker_state'],
      {
      fallback: true,
      }
    );
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO circuit_breaker_state'),
      expect.arrayContaining(['svc', 'svc', mod.STATES.OPEN, 1, expect.any(String)]),
      { fallback: true }
    );
  });
});
