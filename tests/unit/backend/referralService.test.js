import { describe, expect, it, vi } from 'vitest';

import * as DbPromise from '../../../server/src/utils/DbPromise.ts';
import {
  getReferralTools,
  setDependencies,
  validateReferralCode,
} from '../../../server/src/services/partnerReferralService.ts';

function createFakeDb({ getRow, allRows } = {}) {
  return {
    all: vi.fn((sql, params, cb) => cb(null, typeof allRows === 'function' ? allRows(sql, params) : [])),
    get: vi.fn((sql, params, cb) => cb(null, typeof getRow === 'function' ? getRow(sql, params) : null)),
    run: vi.fn((sql, params, cb) => cb.call({ lastID: undefined, changes: 1 }, null)),
    exec: vi.fn((sql, cb) => cb(null)),
  };
}

describe('PartnerReferralService (server/src/services/partnerReferralService.ts)', () => {
  it('returns invalid for empty code', async () => {
    const db = createFakeDb();
    setDependencies({ db });

    const res = await validateReferralCode('');
    expect(res.valid).toBe(false);
    expect(res.message).toMatch(/invalid/i);
  });

  it('validates a referral code and returns discount message', async () => {
    const db = createFakeDb({
      getRow: () => ({
        id: 'po-1',
        name: 'Partner Org',
        referral_code: 'REF123',
        tier: 'GOLD',
        commission_rate_percent: 20,
        license_discount_percent: 15,
        status: 'active',
      }),
    });
    setDependencies({ db });

    const res = await validateReferralCode('  ref123 ');
    expect(res).toEqual({
      valid: true,
      partnerOrgId: 'po-1',
      partnerName: 'Partner Org',
      partnerTier: 'GOLD',
      discountPercent: 15,
      message: 'Partner code valid! 15% discount applied.',
    });
  });

  it('builds referral tools payload for a partner org', async () => {
    const db = createFakeDb({
      getRow: (sql) => {
        if (String(sql).includes('FROM partner_organizations')) {
          return { id: 'po-2', name: 'P2', referral_code: 'P2', referral_link_slug: 'p2slug' };
        }
        return null;
      },
      allRows: () => [
        {
          id: 'c-1',
          partner_org_id: 'po-2',
          name: 'Campaign A',
          description: null,
          slug: 'camp-a',
          destination_url: '/',
          utm_source: 'google',
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          click_count: 1,
          signup_count: 2,
          conversion_count: 0,
          is_active: true,
          expires_at: null,
          created_at: '2026-02-20',
          updated_at: '2026-02-20',
        },
      ],
    });
    setDependencies({ db });

    const tools = await getReferralTools('po-2');
    expect(tools).not.toBeNull();
    expect(tools.referralCode).toBe('P2');
    expect(tools.referralLink).toContain('/r/');
    expect(tools.campaignLinks).toHaveLength(1);
    expect(tools.campaignLinks[0]).toMatchObject({ id: 'c-1', name: 'Campaign A', clickCount: 1 });
  });
});
