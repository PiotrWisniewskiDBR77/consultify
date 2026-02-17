import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: getAllStatuses', () => {
  it('returns statuses for created breakers', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    mod.CircuitBreakerService.getBreaker('a');
    mod.CircuitBreakerService.getBreaker('b');

    const list = mod.CircuitBreakerService.getAllStatuses();
    expect(Array.isArray(list)).toBe(true);
    expect(list.map((s) => s.name)).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
