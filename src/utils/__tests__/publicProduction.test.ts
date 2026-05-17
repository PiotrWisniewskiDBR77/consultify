import { describe, expect, it } from 'vitest';

import {
  isPublicProductionHost,
  lockMainMenuForPublicProduction,
  shouldHideNonCoreModulesInPublicProduction,
  shouldLockNonCoreModulesInPublicProduction,
} from '../publicProduction';

describe('publicProduction navigation guards', () => {
  it('detects only customer-facing production hosts', () => {
    expect(isPublicProductionHost('consultify.ai')).toBe(true);
    expect(isPublicProductionHost('www.consultify.ai')).toBe(true);
    expect(isPublicProductionHost('staging.consultify.ai')).toBe(false);
    expect(isPublicProductionHost('localhost')).toBe(false);
  });

  it('locks and hides non-core modules only in production on public hosts', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      expect(shouldLockNonCoreModulesInPublicProduction('consultify.ai')).toBe(true);
      expect(shouldHideNonCoreModulesInPublicProduction('www.consultify.ai')).toBe(true);
      expect(shouldLockNonCoreModulesInPublicProduction('staging.consultify.ai')).toBe(false);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('keeps Chat and Interview unlocked while decorating all other menu entries', () => {
    const locked = lockMainMenuForPublicProduction(
      [
        { id: 'AI_CHAT', label: 'Chat' },
        { id: 'INTERVIEW', label: 'Interview' },
        {
          id: 'MODULE_TABELE',
          label: 'Table Studio',
          subItems: [{ id: 'MODULE_TABELE_CHILD', label: 'Child lane' }],
        },
      ],
      true,
      'Locked on public production',
      '/interview'
    );

    expect(locked).toHaveLength(3);
    expect(locked[0]).toMatchObject({ id: 'AI_CHAT' });
    expect(locked[0]).not.toHaveProperty('isLocked');
    expect(locked[1]).toMatchObject({ id: 'INTERVIEW' });
    expect(locked[1]).not.toHaveProperty('isLocked');
    expect(locked[2]).toMatchObject({
      id: 'MODULE_TABELE',
      isLocked: true,
      lockedMessage: 'Locked on public production',
      lockedCtaHref: '/interview',
    });
    expect(locked[2].subItems?.[0]).toMatchObject({
      id: 'MODULE_TABELE_CHILD',
      isLocked: true,
    });
  });
});
