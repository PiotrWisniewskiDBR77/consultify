import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  filterMainMenuForPublicProduction,
  isPublicProductionHost,
  shouldHideNonCoreModulesInPublicProduction,
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

  it('hides non-core modules only on public production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldHideNonCoreModulesInPublicProduction('consultify.ai')).toBe(true);
    expect(shouldHideNonCoreModulesInPublicProduction('www.consultify.ai')).toBe(true);
    expect(shouldHideNonCoreModulesInPublicProduction('localhost')).toBe(false);

    vi.stubEnv('NODE_ENV', 'development');
    expect(shouldHideNonCoreModulesInPublicProduction('consultify.ai')).toBe(false);
  });

  it('keeps only chat and interview in the main menu', () => {
    const filtered = filterMainMenuForPublicProduction(
      [{ id: 'AI_CHAT' }, { id: 'INTERVIEW' }, { id: 'MY_WORK' }, { id: 'TOOLS' }],
      true
    );

    expect(filtered).toEqual([{ id: 'AI_CHAT' }, { id: 'INTERVIEW' }]);
  });
});
