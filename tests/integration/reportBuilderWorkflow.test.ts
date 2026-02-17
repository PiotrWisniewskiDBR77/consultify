import { describe, expect, it } from 'vitest';

import { INVOCATION_PROFILES } from '../../server/src/config/reportInvocationProfiles.js';

describe('Report Builder invocation profiles - REAL_CODE', () => {
  it('includes at least assessment_full and assessment_summary profiles', () => {
    expect(INVOCATION_PROFILES.assessment_full).toBeDefined();
    expect(INVOCATION_PROFILES.assessment_summary).toBeDefined();
  });

  it('has consistent profile id == key', () => {
    for (const [key, profile] of Object.entries(INVOCATION_PROFILES)) {
      expect(profile.id).toBe(key);
    }
  });

  it('ensures template section order is unique within each profile', () => {
    for (const profile of Object.values(INVOCATION_PROFILES)) {
      const orders = profile.defaultTemplateSections.map((s) => s.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it('does not overlap allowed vs disallowed block types when allowedBlockTypes is set', () => {
    for (const profile of Object.values(INVOCATION_PROFILES)) {
      if (!profile.allowedBlockTypes) continue;
      const allowed = new Set(profile.allowedBlockTypes);
      for (const dis of profile.disallowedBlockTypes) {
        expect(allowed.has(dis)).toBe(false);
      }
    }
  });

  it('requires language intent in assessment_full (profile contract)', () => {
    const p = INVOCATION_PROFILES.assessment_full;
    expect(p.requiredIntentFields).toEqual(
      expect.arrayContaining(['audience', 'goal', 'language'])
    );
  });
});
