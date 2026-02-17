import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: executeWithRotation', () => {
  it('uses fallback provider when primary is OPEN', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');

    const primary = mod.CircuitBreakerService.getBreaker('openai', { resetTimeout: 60000 });
    primary.state = mod.STATES.OPEN;
    primary.nextAttemptTime = Date.now() + 60000;

    const out = await mod.CircuitBreakerService.executeWithRotation(
      'openai',
      (provider) => async () => `ok:${provider}`,
      { resetTimeout: 60000 }
    );

    expect(out.provider).not.toBe('openai');
    expect(out.result).toMatch(/^ok:/);
  });

  it('throws when all providers unavailable', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');

    const providers = ['openai', 'anthropic', 'google'];
    for (const p of providers) {
      const b = mod.CircuitBreakerService.getBreaker(p, { resetTimeout: 60000 });
      b.state = mod.STATES.OPEN;
      b.nextAttemptTime = Date.now() + 60000;
    }

    await expect(
      mod.CircuitBreakerService.executeWithRotation('openai', () => async () => 'x', {
        resetTimeout: 60000,
      })
    ).rejects.toBeInstanceOf(Error);
  });
});
