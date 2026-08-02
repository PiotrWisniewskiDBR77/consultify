import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL = process.env.ENABLE_TERESA_IDEA_ACTIONS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ENABLE_TERESA_IDEA_ACTIONS;
  else process.env.ENABLE_TERESA_IDEA_ACTIONS = ORIGINAL;
  vi.resetModules();
});

describe('ENABLE_TERESA_IDEA_ACTIONS rollout posture', () => {
  it('uses the governed registry transport by default', async () => {
    delete process.env.ENABLE_TERESA_IDEA_ACTIONS;
    vi.resetModules();
    const { loadFeatureFlags } = await import('../../../server/src/config/FeatureFlags.js');

    expect(loadFeatureFlags().ENABLE_TERESA_IDEA_ACTIONS).toBe(true);
  });

  it('keeps an explicit false kill-switch for the legacy fallback', async () => {
    process.env.ENABLE_TERESA_IDEA_ACTIONS = 'false';
    vi.resetModules();
    const { loadFeatureFlags } = await import('../../../server/src/config/FeatureFlags.js');

    expect(loadFeatureFlags().ENABLE_TERESA_IDEA_ACTIONS).toBe(false);
  });
});
