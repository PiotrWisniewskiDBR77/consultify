/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — partnerReferralService guard.
 * MOCK-ONLY UNIT SUITE.
 *
 * WHAT THIS FILE ACTUALLY PROVES. `server/src/services/partnerReferralService.ts`
 * writes commission_rate_percent / commission_duration_months into
 * partner_attributions (createAttribution) and flips an attribution to ACTIVE
 * at first payment (updateAttributionStatus, called from the Stripe webhook on
 * every invoice.paid). This suite mocks the persistence seam the service goes
 * through — '../../../server/src/utils/DbPromise.js' (run/get/all/exec) and
 * '../../../server/src/database/Database.js' (getDatabase) — and Logger, then
 * asserts that both guarded functions (a) reject with
 * PartnerEconomicsPolicyDisabledError carrying code
 * PARTNER_ECONOMICS_POLICY_DISABLED and status 410, and (b) never call into
 * the mocked persistence layer: the refusal happens before any SQL. It also
 * runs positive controls for the non-economic referral journeys the owner
 * decision explicitly preserves — referral code validation, click tracking,
 * click-to-signup conversion, campaign link create/delete, and referral
 * identity (code/slug/QR) provisioning — asserting they are NOT guarded (they
 * complete, or fail for reasons unrelated to the policy, and they DO reach the
 * mocked persistence layer, proving the guard did not silently swallow them).
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR: anything requiring
 * a real database, a mounted Express app or the actual Stripe webhook route.
 * No schema is applied, no migration runs, no transaction/advisory-lock
 * behaviour is exercised, and the shape of `partner_attributions` rows is
 * taken on faith from the source, not verified against a live schema. This
 * suite proves the guard placement and the non-economic/economic split inside
 * partnerReferralService.ts only.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PARTNER_ECONOMICS_POLICY_CODE,
  PARTNER_ECONOMICS_POLICY_DECISION,
  PARTNER_ECONOMICS_POLICY_STATUS,
  PartnerEconomicsPolicyDisabledError,
} from '../../../server/src/services/partnerEconomicsPolicy.js';

/* ==========================================================================
 * Persistence spies. partnerReferralService.ts reaches the database only
 * through DbPromise.{run,get,all,exec} and the `db` handle obtained once from
 * getDatabase() at module load. If a guard ever regresses, one of these
 * records a call and the corresponding negative assertion fails.
 * ========================================================================== */

const dbRun = vi.fn();
const dbGet = vi.fn();
const dbAll = vi.fn();
const dbExec = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  get: (...args: unknown[]) => dbGet(...args),
  all: (...args: unknown[]) => dbAll(...args),
  exec: (...args: unknown[]) => dbExec(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn() }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const persistenceCallCount = () =>
  dbRun.mock.calls.length + dbGet.mock.calls.length + dbAll.mock.calls.length + dbExec.mock.calls.length;

const resetPersistenceMocks = () => {
  dbRun.mockReset();
  dbGet.mockReset();
  dbAll.mockReset();
  dbExec.mockReset();
};

// Deliberately NO vi.resetModules() anywhere in this file. The guard classes
// (PartnerEconomicsPolicyDisabledError etc.) are imported statically above;
// resetting the module registry would make a dynamically re-imported
// partnerReferralService.ts pull a SEPARATE instance of
// partnerEconomicsPolicy.js, and an error thrown by that separate instance
// would fail `toBeInstanceOf`/`not.toBeInstanceOf` against the
// statically-imported class — silently breaking both the positive and the
// negative assertions. The one piece of state this costs us,
// `referralSchemaEnsured` inside partnerReferralService.ts, is handled
// instead by test ORDER: see the comment on the ensurePartnerReferralIdentity
// test below.
describe('AMD-PRT-ECONOMICS-002 — partnerReferralService — guarded commission writers', () => {
  beforeEach(() => {
    resetPersistenceMocks();
  });

  const expectPolicyRefusal = async (invoke: () => Promise<unknown>) => {
    await expect(invoke()).rejects.toBeInstanceOf(PartnerEconomicsPolicyDisabledError);
    await expect(invoke()).rejects.toMatchObject({
      code: PARTNER_ECONOMICS_POLICY_CODE,
      status: PARTNER_ECONOMICS_POLICY_STATUS,
      decision: PARTNER_ECONOMICS_POLICY_DECISION,
      operation: 'commission',
    });
    // The refusal happens before any SQL: zero calls into the mocked
    // persistence seam, for either of the two invocations above.
    expect(persistenceCallCount()).toBe(0);
  };

  it('createAttribution refuses before touching the database — it writes commission_rate_percent/commission_duration_months into partner_attributions', async () => {
    const svc = await import('../../../server/src/services/partnerReferralService.js');
    await expectPolicyRefusal(() =>
      svc.createAttribution({
        partnerOrgId: 'partner-1',
        organizationId: 'org-1',
        attributionType: 'REFERRAL_LINK',
        commissionRatePercent: 15,
        commissionDurationMonths: 12,
      })
    );
  });

  it('updateAttributionStatus refuses before touching the database — this is the Stripe invoice.paid webhook writer that starts the commission-earning window', async () => {
    const svc = await import('../../../server/src/services/partnerReferralService.js');
    await expectPolicyRefusal(() =>
      svc.updateAttributionStatus('attr-1', 'ACTIVE', {
        firstPaymentAt: new Date().toISOString(),
      })
    );
  });
});

describe('AMD-PRT-ECONOMICS-002 — partnerReferralService — preserved non-economic journeys (positive controls, no over-blocking)', () => {
  beforeEach(() => {
    resetPersistenceMocks();
    dbExec.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ changes: 1 });
    dbAll.mockResolvedValue([]);
  });

  it('ensurePartnerReferralIdentity (referral link/QR generation) is not guarded and reaches the database, even on the first-time identity-provisioning write path', async () => {
    // ORDER-SENSITIVE, deliberately: partnerReferralService.ts is a Node ESM
    // singleton across this whole file (no vi.resetModules(), see the note
    // above), and it memoizes `referralSchemaEnsured` at module scope after
    // the first call that provisions the schema. This must therefore be the
    // FIRST test in the file that exercises ensurePartnerReferralIdentity's
    // write path, so the DDL branch (`dbExec`) is still observable. It runs
    // before createCampaignLink below, which also calls
    // ensurePartnerReferralIdentity and would otherwise consume the
    // first-time DDL call itself.
    //
    // First read: no identity yet on either column.
    dbGet.mockResolvedValueOnce({ referral_code: null, referral_link_slug: null });
    // Re-read after the self-heal UPDATE: identity now committed.
    dbGet.mockResolvedValueOnce({
      referral_code: 'PARTNER-AB12',
      referral_link_slug: 'partner-1-abcd',
    });
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const identity = await svc.ensurePartnerReferralIdentity('partner-1', 'Acme Partner');

    expect(identity.referralCode).toBe('PARTNER-AB12');
    expect(identity.referralLinkSlug).toBe('partner-1-abcd');
    // Schema-ensure DDL, then the COALESCE self-heal UPDATE that provisions
    // the referral code/slug — a write, but an identity write, not a
    // commission/discount/accrual/payout write, so it must NOT be guarded.
    expect(dbExec).toHaveBeenCalledTimes(1);
    expect(dbRun).toHaveBeenCalledTimes(1);
  });

  it('validateReferralCode (referral code validation) is not guarded and reaches the database', async () => {
    dbGet.mockResolvedValueOnce({
      id: 'partner-1',
      name: 'Acme Partner',
      referral_code: 'ACME01',
      tier: 'GOLD',
      commission_rate_percent: 15,
      license_discount_percent: 10,
      status: 'active',
    });
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const result = await svc.validateReferralCode('ACME01');

    expect(result.valid).toBe(true);
    expect(dbGet).toHaveBeenCalledTimes(1);
  });

  it('trackClick (click tracking) is not guarded and reaches the database', async () => {
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const result = await svc.trackClick({
      partnerOrgId: 'partner-1',
      referralCode: 'ACME01',
    });

    expect(result.success).toBe(true);
    expect(dbRun).toHaveBeenCalledTimes(1);
  });

  it('markClickConverted (click-to-signup conversion) is not guarded and reaches the database', async () => {
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const result = await svc.markClickConverted('click-1', null, 'org-1', 'SIGNUP');

    expect(result).toBe(true);
    // One UPDATE for the click row, one UPDATE for the campaign signup_count.
    expect(dbRun).toHaveBeenCalledTimes(2);
  });

  it('createCampaignLink (campaign link generation) is not guarded and reaches the database', async () => {
    // ensurePartnerReferralIdentity resolves immediately: identity already set.
    dbGet.mockResolvedValueOnce({
      referral_code: 'ACME01',
      referral_link_slug: 'acme-partner',
    });
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const link = await svc.createCampaignLink({
      partnerOrgId: 'partner-1',
      name: 'Spring Campaign',
    });

    expect(link.name).toBe('Spring Campaign');
    // NOT asserting dbExec here: by this point in the file the
    // ensurePartnerReferralIdentity test above has already flipped
    // partnerReferralService.ts's module-scoped `referralSchemaEnsured` to
    // true (see the ordering note on that test), so this call's own
    // ensurePartnerReferralIdentity() call skips the DDL. What this test
    // proves is the campaign link INSERT itself.
    expect(dbRun).toHaveBeenCalledTimes(1);
  });

  it('deleteCampaignLink (campaign link generation) is not guarded and reaches the database', async () => {
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const result = await svc.deleteCampaignLink('partner-1', 'campaign-1');

    expect(result).toBe(true);
    expect(dbRun).toHaveBeenCalledTimes(1);
  });

  it('none of the preserved-journey calls above ever throw PartnerEconomicsPolicyDisabledError', async () => {
    resetPersistenceMocks();
    dbExec.mockResolvedValue(undefined);
    dbRun.mockResolvedValue({ changes: 1 });
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue({
      id: 'partner-1',
      name: 'Acme Partner',
      referral_code: 'ACME01',
      referral_link_slug: 'acme-partner',
      tier: 'GOLD',
      commission_rate_percent: 15,
      license_discount_percent: 10,
      status: 'active',
    });
    const svc = await import('../../../server/src/services/partnerReferralService.js');

    const outcomes = await Promise.allSettled([
      svc.validateReferralCode('ACME01'),
      svc.trackClick({ partnerOrgId: 'partner-1', referralCode: 'ACME01' }),
      svc.markClickConverted('click-1', null, 'org-1', 'SIGNUP'),
      svc.deleteCampaignLink('partner-1', 'campaign-1'),
    ]);

    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        expect(outcome.reason).not.toBeInstanceOf(PartnerEconomicsPolicyDisabledError);
      }
    }
  });
});
