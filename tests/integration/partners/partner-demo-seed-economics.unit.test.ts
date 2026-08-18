/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * GAP A (independent-audit finding): `server/src/services/partnerDemoSeedService.ts`
 * writes REAL economics rows (ACTIVE `partner_attributions` with a
 * `commission_rate_percent`, COMPLETED/PENDING `partner_payouts`,
 * PAID/APPROVED `partner_commission_transactions`) with NO policy guard at
 * all. The function runs as router-level middleware
 * (`requirePartnerOrgId` in `routes/partners.routes.ts`, and the demo-dataset
 * middleware in `routes/v8/partner.routes.ts`) on effectively every partner
 * request, including plain GETs, BEFORE any read gate is reached, and its
 * only prior guard (`isPartnerDemoSeedAllowed()`) is a no-op outside
 * production.
 *
 * WHAT THIS FILE ACTUALLY PROVES. The persistence seam (`DbPromise`,
 * `Database.getDatabase`, `Logger`) and the sibling `partnerReferralService`
 * module are mocked. The REAL `ensurePartnerDemoDataset` (the file under
 * test) and the REAL `partnerEconomicsPolicy.ts` predicate are NOT mocked.
 * From this it proves:
 *   1. Zero writes reach `partner_attributions`, `partner_commission_transactions`
 *      or `partner_payouts` — no `DbPromise.transaction` call's SQL mentions
 *      any of those three tables — under the current (always-excluded)
 *      AMD-PRT-ECONOMICS-002 policy.
 *   2. Non-economic seeding (referral identity self-heal, campaign links,
 *      referral clicks) still runs — proving the guard SKIPS only the two
 *      economic blocks rather than aborting the whole function.
 *   3. `ensurePartnerDemoDataset` resolves without throwing, so mounting it
 *      as middleware on an ordinary request is not broken by the guard.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR: anything
 * requiring a real database — no schema is applied, no real Postgres table
 * exists, and `partnerReferralService`'s own persistence behaviour (schema
 * self-heal, race handling) is mocked wholesale and therefore not exercised.
 * This file also does not exercise the `isPartnerDemoSeedAllowed()` production
 * gate (a separate, pre-existing concern); it verifies only the NEW economics
 * guard inside the function body.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ==========================================================================
 * Persistence + shared-utility seams. `partnerDemoSeedService.ts` reaches
 * the database through exactly `DbPromise.tableExists` / `.get` /
 * `.transaction`, and reaches partner-identity self-heal through
 * `partnerReferralService.ensurePartnerReferralIdentity`.
 * ========================================================================== */

const {
  dbTableExists,
  dbGet,
  dbTransaction,
  loggerInfo,
  loggerWarn,
  loggerError,
  ensurePartnerReferralIdentity,
} = vi.hoisted(() => ({
  dbTableExists: vi.fn(),
  dbGet: vi.fn(),
  dbTransaction: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
  ensurePartnerReferralIdentity: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  tableExists: (...args: unknown[]) => dbTableExists(...args),
  get: (...args: unknown[]) => dbGet(...args),
  transaction: (...args: unknown[]) => dbTransaction(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: loggerInfo, warn: loggerWarn, error: loggerError, debug: vi.fn() },
}));

vi.mock('../../../server/src/services/partnerReferralService.js', () => ({
  ensurePartnerReferralIdentity: (...args: unknown[]) => ensurePartnerReferralIdentity(...args),
}));

/* ==========================================================================
 * Real module under test — deliberately NOT mocked:
 *   - server/src/services/partnerDemoSeedService.ts (the file under test)
 *   - server/src/services/partnerEconomicsPolicy.ts (the predicate it now consumes)
 * ========================================================================== */

import { ensurePartnerDemoDataset } from '../../../server/src/services/partnerDemoSeedService.js';

const PARTNER_ORG_ID = 'partner-org-demo-seed-1';

/** Flattens every SQL string across every `DbPromise.transaction` call. */
function allTransactionSql(): string[] {
  return dbTransaction.mock.calls.flatMap((call) => {
    const statements = call[0] as Array<{ sql: string }>;
    return (statements || []).map((s) => s.sql);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ensurePartnerReferralIdentity.mockResolvedValue({
    referralCode: 'DEMO-CODE',
    referralLinkSlug: 'demo-slug',
  });
  // All five demo tables exist, and every "already seeded?" count query
  // resolves to zero, so every seed block below is ELIGIBLE to run — the
  // only thing that should stop the two economic blocks is the new guard.
  dbTableExists.mockResolvedValue(true);
  dbGet.mockResolvedValue({ count: 0 });
  dbTransaction.mockResolvedValue(undefined);
});

describe('AMD-PRT-ECONOMICS-002 — partner demo seed service (GAP A)', () => {
  it('performs ZERO writes to partner_attributions, partner_payouts or partner_commission_transactions', async () => {
    await ensurePartnerDemoDataset(PARTNER_ORG_ID);

    const sql = allTransactionSql();
    expect(sql.some((s) => s.includes('partner_attributions'))).toBe(false);
    expect(sql.some((s) => s.includes('partner_commission_transactions'))).toBe(false);
    expect(sql.some((s) => s.includes('partner_payouts'))).toBe(false);
  });

  it('logs a skip line naming the owner decision instead of silently dropping the write', async () => {
    await ensurePartnerDemoDataset(PARTNER_ORG_ID);

    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('AMD-PRT-ECONOMICS-002'),
      expect.objectContaining({ partnerOrgId: PARTNER_ORG_ID })
    );
  });

  it('still performs non-economic seeding: referral identity self-heal runs', async () => {
    await ensurePartnerDemoDataset(PARTNER_ORG_ID);

    expect(ensurePartnerReferralIdentity).toHaveBeenCalledWith(PARTNER_ORG_ID);
  });

  it('still performs non-economic seeding: campaign links and referral clicks are still written', async () => {
    await ensurePartnerDemoDataset(PARTNER_ORG_ID);

    const sql = allTransactionSql();
    expect(sql.some((s) => s.includes('partner_campaign_links'))).toBe(true);
    expect(sql.some((s) => s.includes('partner_referral_clicks'))).toBe(true);
  });

  it('resolves without throwing, so mounting it as middleware does not break an ordinary request', async () => {
    await expect(ensurePartnerDemoDataset(PARTNER_ORG_ID)).resolves.toBeUndefined();
    // The function's own top-level catch must never have been forced to fire
    // by the new guard — a thrown policy error would have been swallowed
    // there as a generic warning, aborting the non-economic blocks below it.
    expect(loggerWarn).not.toHaveBeenCalledWith(
      '[PartnerDemoSeedService] Could not seed demo dataset',
      expect.anything()
    );
  });

  it('is a no-op for an empty partnerOrgId, independent of the economics guard', async () => {
    await ensurePartnerDemoDataset('');
    expect(dbTableExists).not.toHaveBeenCalled();
    expect(dbTransaction).not.toHaveBeenCalled();
  });
});
