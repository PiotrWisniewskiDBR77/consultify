import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: executeWithRotation uses primary when healthy', () => {
  it('returns primary provider when CLOSED', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');
    mod.CircuitBreakerService.getBreaker('openai').state = mod.STATES.CLOSED;

    const out = await mod.CircuitBreakerService.executeWithRotation(
      'openai',
      (provider) => async () => `ok:${provider}`
    );
    expect(out).toEqual({ provider: 'openai', result: 'ok:openai' });
  });
});
