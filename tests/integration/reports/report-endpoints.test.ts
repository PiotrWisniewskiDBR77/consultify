import { describe, expect, it } from 'vitest';

import { INVOCATION_PROFILES } from '../../../server/src/config/reportInvocationProfiles.js';

describe('Reports config invariants (invocation profiles) - REAL_CODE', () => {
  it('assessment_full includes a cover section at order 0', () => {
    const cover = INVOCATION_PROFILES.assessment_full.defaultTemplateSections.find(
      (s) => s.key === 'cover'
    );
    expect(cover).toBeDefined();
    expect(cover?.order).toBe(0);
  });

  it('all profiles have non-empty descriptions', () => {
    for (const p of Object.values(INVOCATION_PROFILES)) {
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.descriptionPl.length).toBeGreaterThan(0);
    }
  });
});
