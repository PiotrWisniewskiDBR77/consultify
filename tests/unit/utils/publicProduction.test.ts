import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  lockMainMenuForPublicProduction,
  isPublicProductionHost,
  shouldLockNonCoreModulesInPublicProduction,
} from '../../../src/utils/publicProduction';

describe('publicProduction utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects the public production hosts', () => {
    expect(isPublicProductionHost('consultify.ai')).toBe(true);
    expect(isPublicProductionHost('www.consultify.ai')).toBe(true);
    expect(isPublicProductionHost('staging.consultify.ai')).toBe(false);
    expect(isPublicProductionHost('localhost')).toBe(false);
  });

  it('locks non-core modules only on public production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldLockNonCoreModulesInPublicProduction('consultify.ai')).toBe(true);
    expect(shouldLockNonCoreModulesInPublicProduction('www.consultify.ai')).toBe(true);
    expect(shouldLockNonCoreModulesInPublicProduction('localhost')).toBe(false);

    vi.stubEnv('NODE_ENV', 'development');
    expect(shouldLockNonCoreModulesInPublicProduction('consultify.ai')).toBe(false);
  });

  it('keeps all modules visible but locks non-core entries', () => {
    const locked = lockMainMenuForPublicProduction(
      [{ id: 'AI_CHAT' }, { id: 'INTERVIEW' }, { id: 'MY_WORK' }, { id: 'TOOLS' }],
      true,
      'Locked on public production.',
      '/interview'
    );

    expect(locked).toEqual([
      { id: 'AI_CHAT', subItems: undefined },
      { id: 'INTERVIEW', subItems: undefined },
      {
        id: 'MY_WORK',
        subItems: undefined,
      },
      {
        id: 'TOOLS',
        subItems: undefined,
        isLocked: true,
        lockedMessage: 'Locked on public production.',
        lockedCtaHref: '/interview',
      },
    ]);
  });
});
