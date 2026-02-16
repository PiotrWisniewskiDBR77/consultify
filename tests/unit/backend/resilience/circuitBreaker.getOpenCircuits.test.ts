import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: getOpenCircuits', () => {
  it('lists open circuits with metadata', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const b = mod.CircuitBreakerService.getBreaker('svc', { resetTimeout: 10 });
    b.state = mod.STATES.OPEN;
    b.openedAt = Date.now() - 1000;
    b.lastError = 'timeout';

    const list = mod.CircuitBreakerService.getOpenCircuits();
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'svc',
          timeSinceOpen: expect.any(Number),
          lastError: 'timeout',
          hasHealthCheck: false,
        }),
      ])
    );
  });
});
