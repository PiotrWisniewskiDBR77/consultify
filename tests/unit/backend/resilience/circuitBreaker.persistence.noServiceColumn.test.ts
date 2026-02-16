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

describe('CircuitBreaker: persistence without service column', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([{ name: 'id' }, { name: 'state' }]); // no `service`
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('persists using (id, state, failures, last_failure) signature', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const breaker = mod.CircuitBreakerService.getBreaker('svc', {
      failureThreshold: 1,
      persistenceEnabled: true,
    });
    await breaker.recordFailure(new Error('network timeout'));

    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('(id, state, failures, last_failure, updated_at)'),
      expect.arrayContaining(['svc', mod.STATES.OPEN, 1, expect.any(String)]),
      { fallback: true }
    );
  });
});
