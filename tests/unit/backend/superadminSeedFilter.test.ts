import { describe, it, expect } from 'vitest';

import {
  SEED_EMAIL_DOMAINS,
  EPHEMERAL_ORG_ID_PATTERNS,
  isSeedRequested,
  buildSeedExclusion,
} from '../../../server/src/utils/superadminSeedFilter';

describe('superadminSeedFilter', () => {
  describe('isSeedRequested', () => {
    it('defaults to false (seed hidden) when param absent', () => {
      expect(isSeedRequested(undefined)).toBe(false);
      expect(isSeedRequested({})).toBe(false);
      expect(isSeedRequested({ role: 'ADMIN' })).toBe(false);
    });

    it('is true only for explicit truthy opt-in', () => {
      expect(isSeedRequested({ includeSeed: 'true' })).toBe(true);
      expect(isSeedRequested({ includeSeed: '1' })).toBe(true);
      expect(isSeedRequested({ includeSeed: 'yes' })).toBe(true);
      expect(isSeedRequested({ includeSeed: 'on' })).toBe(true);
      expect(isSeedRequested({ include_seed: 'TRUE' })).toBe(true);
      expect(isSeedRequested({ showSeed: 'true' })).toBe(true);
    });

    it('is false for falsy / unrelated values', () => {
      expect(isSeedRequested({ includeSeed: 'false' })).toBe(false);
      expect(isSeedRequested({ includeSeed: '0' })).toBe(false);
      expect(isSeedRequested({ includeSeed: '' })).toBe(false);
    });
  });

  describe('buildSeedExclusion', () => {
    it('returns empty when no columns given', () => {
      const { clause, params } = buildSeedExclusion({});
      expect(clause).toBe('');
      expect(params).toEqual([]);
    });

    it('builds an email-only exclusion with one param per seed domain', () => {
      const { clause, params } = buildSeedExclusion({ emailCol: 'u.email' });
      expect(clause.startsWith('NOT (')).toBe(true);
      expect(clause).toContain("LOWER(COALESCE(u.email, '')) LIKE ?");
      expect(params).toHaveLength(SEED_EMAIL_DOMAINS.length);
      expect(params).toContain('%@demo.ateliertoys.com');
      expect(params).toContain('%@local.test');
    });

    it('adds ephemeral org-id patterns when orgIdCol given', () => {
      const { clause, params } = buildSeedExclusion({
        emailCol: 'u.email',
        orgIdCol: 'u.organization_id',
      });
      expect(clause).toContain("COALESCE(u.organization_id, '') LIKE ?");
      expect(params).toHaveLength(SEED_EMAIL_DOMAINS.length + EPHEMERAL_ORG_ID_PATTERNS.length);
      expect(params).toContain('demo-org-session-%');
    });

    it('placeholder count matches params count (no bind mismatch)', () => {
      const { clause, params } = buildSeedExclusion({
        emailCol: 'o.email',
        orgIdCol: 'o.id',
      });
      const placeholders = (clause.match(/\?/g) || []).length;
      expect(placeholders).toBe(params.length);
    });

    it('org-only exclusion targets just the ephemeral pattern', () => {
      const { clause, params } = buildSeedExclusion({ orgIdCol: 'o.id' });
      expect(clause).toBe("NOT (COALESCE(o.id, '') LIKE ?)");
      expect(params).toEqual(['demo-org-session-%']);
    });
  });

  it('every seed domain is lowercased (LIKE pattern is case-normalised via LOWER())', () => {
    for (const d of SEED_EMAIL_DOMAINS) {
      expect(d).toBe(d.toLowerCase());
    }
  });
});
