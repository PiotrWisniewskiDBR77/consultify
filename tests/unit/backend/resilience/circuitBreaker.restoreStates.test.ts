import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const dbAll = vi.fn();

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  run: vi.fn(),
  get: vi.fn(),
}));

vi.mock('../../../../server/src/config/DatabaseConfig.js', () => ({
  default: { type: 'sqlite' },
}));

describe('CircuitBreakerService: restoreStates', () => {
  it('restores OPEN circuit when table exists and last_failure is recent', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    dbAll
      .mockResolvedValueOnce([{ name: 'id' }]) // PRAGMA table_info -> exists
      .mockResolvedValueOnce([
        {
          id: 'openai',
          service: 'openai',
          state: 'OPEN',
          failures: 3,
          last_failure: new Date(now.getTime() - 1000).toISOString(),
        },
      ]); // SELECT open rows

    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    await mod.CircuitBreakerService.restoreStates();

    const st = mod.CircuitBreakerService.getStatus('openai');
    expect(st?.state).toBe(mod.STATES.OPEN);
    expect(st?.failures).toBe(3);

    vi.useRealTimers();
  });
});
