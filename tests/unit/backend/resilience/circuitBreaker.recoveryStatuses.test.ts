import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: getRecoveryStatuses', () => {
  it('returns only recovering breakers', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    const a = mod.CircuitBreakerService.getBreaker('a');
    a.isRecovering = true;
    a.recoveryPercent = 40;

    const b = mod.CircuitBreakerService.getBreaker('b');
    b.isRecovering = false;

    const list = mod.CircuitBreakerService.getRecoveryStatuses();
    expect(list).toEqual([expect.objectContaining({ name: 'a', recoveryPercent: 40 })]);
  });
});
