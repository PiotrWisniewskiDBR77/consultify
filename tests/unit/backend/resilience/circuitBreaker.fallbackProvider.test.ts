import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/services/ai/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('CircuitBreakerService: getFallbackProvider', () => {
  it('returns a healthy fallback when available', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');

    // Ensure at least one fallback breaker exists and is CLOSED
    mod.CircuitBreakerService.getBreaker('anthropic');

    const fb = mod.CircuitBreakerService.getFallbackProvider('openai');
    expect(fb).toBeTruthy();
    expect(['anthropic', 'google']).toContain(fb);
  });

  it('returns null when fallbacks are OPEN', async () => {
    vi.resetModules();
    const mod = await import('../../../../server/src/services/circuitBreakerService.ts');

    for (const name of ['anthropic', 'google']) {
      const b = mod.CircuitBreakerService.getBreaker(name, { resetTimeout: 60000 });
      b.state = mod.STATES.OPEN;
      b.nextAttemptTime = Date.now() + 60000;
    }

    expect(mod.CircuitBreakerService.getFallbackProvider('openai')).toBeNull();
  });
});
