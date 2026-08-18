/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * TRUTHFUL SCOPE, stated first because an earlier revision of this file was
 * named "*.realdb.test.ts" while mocking the entire persistence layer. That
 * name claimed a real-PostgreSQL proof this file does not provide, and the
 * claim was wrong. Renamed rather than quietly left in place.
 *
 * WHAT THIS FILE ACTUALLY PROVES. The persistence seam (DbPromise, the
 * database handle and the pg client acquirer) is mocked, and each test asserts
 * that a policy-denied writer NEVER ENTERS it. For the deep-service guards
 * that is a genuinely stronger statement than a row count, because it
 * distinguishes "refused before the write" from "wrote and rolled back", and
 * because it can exercise createOrganizationDiscount, cancelOrganizationDiscount
 * and cancelCommission, which have no route and which no HTTP test can reach.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR: anything requiring
 * a real database or a mounted production auth stack. No schema is applied, no
 * migration runs, no advisory lock is taken, no residue is measured, no
 * trigger fires, no ACTIVE/revoked/foreign membership is resolved, and receipt
 * idempotency, collision behaviour and append-only immutability are NOT
 * exercised here. Those belong to the separate opted-in disposable-PostgreSQL
 * suite and are not claimed until it is green.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PARTNER_ECONOMICS_OPERATIONS_ENABLED,
  PARTNER_ECONOMICS_POLICY_CODE,
  PARTNER_ECONOMICS_POLICY_DECISION,
  PARTNER_ECONOMICS_POLICY_STATUS,
  PartnerEconomicsPolicyDisabledError,
  isPartnerEconomicsOperationAvailable,
} from '../../../server/src/services/partnerEconomicsPolicy.js';

/* ==========================================================================
 * Persistence spies. Every partner economic writer reaches the database
 * through exactly one of these two seams. If a guard ever regresses, one of
 * them records a call and the corresponding assertion fails.
 * ========================================================================== */

const dbRun = vi.fn();
const dbGet = vi.fn();
const dbAll = vi.fn();
const dbExec = vi.fn();
const dbTransaction = vi.fn();
const pgQuery = vi.fn();
const acquirePgClient = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  get: (...args: unknown[]) => dbGet(...args),
  all: (...args: unknown[]) => dbAll(...args),
  exec: (...args: unknown[]) => dbExec(...args),
  transaction: (...args: unknown[]) => dbTransaction(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: (...a: unknown[]) => pgQuery(...a) }),
}));

vi.mock('../../../server/src/database/PostgresDatabase.js', () => ({
  acquirePgClient: (...args: unknown[]) => acquirePgClient(...args),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const persistenceCalls = () =>
  dbRun.mock.calls.length +
  dbExec.mock.calls.length +
  dbTransaction.mock.calls.length +
  pgQuery.mock.calls.length +
  acquirePgClient.mock.calls.length;

describe('AMD-PRT-ECONOMICS-002 — policy predicate', () => {
  it('is a compile-time exclusion, not a runtime toggle', () => {
    expect(PARTNER_ECONOMICS_OPERATIONS_ENABLED).toBe(false);
    expect(isPartnerEconomicsOperationAvailable()).toBe(false);
  });

  it('refuses with 410, never 403, so no client can convert it into a legacy fallback', () => {
    // Load-bearing. src/services/api/v8/partner.ts shouldFallbackToLegacyPartner()
    // retries against legacy /api/partners/* on [400,404,405,501] and on
    // 403 + PARTNER_ORG_REQUIRED. 410 is on neither list.
    expect(PARTNER_ECONOMICS_POLICY_STATUS).toBe(410);
    expect([400, 403, 404, 405, 501]).not.toContain(PARTNER_ECONOMICS_POLICY_STATUS);
  });

  it('carries a stable code distinct from the legacy cutover code', () => {
    expect(PARTNER_ECONOMICS_POLICY_CODE).toBe('PARTNER_ECONOMICS_POLICY_DISABLED');
    expect(PARTNER_ECONOMICS_POLICY_CODE).not.toBe('PARTNER_LEGACY_WRITER_DISABLED');
    expect(PARTNER_ECONOMICS_POLICY_DECISION).toBe('AMD-PRT-ECONOMICS-002');
  });

  it('cannot be re-enabled by any environment variable', () => {
    const before = isPartnerEconomicsOperationAvailable();
    process.env.PARTNER_ECONOMICS_ENABLED = 'true';
    process.env.PARTNER_ECONOMICS_OPERATIONS_ENABLED = 'true';
    process.env.PARTNER_LEGACY_ROLLBACK_ENABLED = 'true';
    try {
      expect(isPartnerEconomicsOperationAvailable()).toBe(before);
      expect(isPartnerEconomicsOperationAvailable()).toBe(false);
    } finally {
      delete process.env.PARTNER_ECONOMICS_ENABLED;
      delete process.env.PARTNER_ECONOMICS_OPERATIONS_ENABLED;
      delete process.env.PARTNER_LEGACY_ROLLBACK_ENABLED;
    }
  });
});

describe('AMD-PRT-ECONOMICS-002 — direct-service zero-write negatives', () => {
  beforeEach(() => {
    dbRun.mockReset();
    dbGet.mockReset();
    dbAll.mockReset();
    dbExec.mockReset();
    dbTransaction.mockReset();
    pgQuery.mockReset();
    acquirePgClient.mockReset();
  });

  const expectPolicyRefusal = async (invoke: () => Promise<unknown>, operation: string) => {
    await expect(invoke()).rejects.toBeInstanceOf(PartnerEconomicsPolicyDisabledError);
    await expect(invoke()).rejects.toMatchObject({
      code: PARTNER_ECONOMICS_POLICY_CODE,
      status: PARTNER_ECONOMICS_POLICY_STATUS,
      decision: PARTNER_ECONOMICS_POLICY_DECISION,
      operation,
    });
    expect(persistenceCalls()).toBe(0);
  };

  describe('partnerConfigService — the discount writers, including the two with no caller', () => {
    it('createOrganizationDiscount refuses before acquiring a connection', async () => {
      const svc = await import('../../../server/src/services/partnerConfigService.js');
      await expectPolicyRefusal(
        () => svc.createOrganizationDiscount('org-1', 'partner-1', 'PERCENTAGE', 10, 12),
        'discount'
      );
    });

    it('cancelOrganizationDiscount refuses before acquiring a connection', async () => {
      const svc = await import('../../../server/src/services/partnerConfigService.js');
      await expectPolicyRefusal(
        () => svc.cancelOrganizationDiscount('org-1', 'partner-1'),
        'discount'
      );
    });

    it('updateDiscountConfig refuses before acquiring a connection', async () => {
      const svc = await import('../../../server/src/services/partnerConfigService.js');
      await expectPolicyRefusal(() => svc.updateDiscountConfig({ discountValue: 25 }), 'discount');
    });

    it('updateCommissionRate refuses before acquiring a connection', async () => {
      const svc = await import('../../../server/src/services/partnerConfigService.js');
      await expectPolicyRefusal(() => svc.updateCommissionRate('GOLD', 20), 'commission');
    });

    it('updatePayoutSettings refuses before acquiring a connection', async () => {
      const svc = await import('../../../server/src/services/partnerConfigService.js');
      await expectPolicyRefusal(
        () => svc.updatePayoutSettings({ minimumThreshold: 1 }),
        'payout_settings'
      );
    });
  });

  describe('partnerCommissionService — every economic writer', () => {
    const cases: Array<[string, (svc: any) => Promise<unknown>, string]> = [
      [
        'createCommission (the Stripe-webhook-triggered automatic writer)',
        (svc) =>
          svc.createCommission({
            partnerOrgId: 'partner-1',
            attributionId: 'attr-1',
            organizationId: 'org-1',
            transactionType: 'INITIAL',
            grossAmount: 100,
            commissionRate: 15,
            currency: 'EUR',
          }),
        'commission',
      ],
      ['approveCommissions', (svc) => svc.approveCommissions(['c-1'], 'user-1'), 'commission'],
      [
        'cancelCommission (exported, currently no caller)',
        (svc) => svc.cancelCommission('c-1', 'reason', 'user-1'),
        'commission',
      ],
      [
        'requestPayout',
        (svc) =>
          svc.requestPayout({
            partnerOrgId: 'partner-1',
            payoutAccountId: 'acct-1',
            requestedBy: 'user-1',
          }),
        'payout',
      ],
      ['processPayout', (svc) => svc.processPayout('p-1', 'user-1'), 'payout'],
      ['completePayout', (svc) => svc.completePayout('p-1'), 'payout'],
      ['failPayout', (svc) => svc.failPayout('p-1', 'reason'), 'payout'],
    ];

    for (const [name, invoke, operation] of cases) {
      it(`${name} refuses before touching the database`, async () => {
        const svc = await import('../../../server/src/services/partnerCommissionService.js');
        await expectPolicyRefusal(() => invoke(svc), operation);
      });
    }
  });

  describe('partnerPayoutSettingsService', () => {
    it('updatePartnerPayoutSettings refuses before the schema-ensure DDL runs', async () => {
      const svc = await import('../../../server/src/services/partnerPayoutSettingsService.js');
      await expectPolicyRefusal(
        () => svc.updatePartnerPayoutSettings('partner-1', { minimumThreshold: 100 }),
        'payout_settings'
      );
    });
  });

  describe('partnerProgramLedgerService — scoped, not blanket', () => {
    it('refuses a money-bearing accrual entry', async () => {
      const mod = await import('../../../server/src/services/partnerProgramLedgerService.js');
      await expectPolicyRefusal(
        () =>
          mod.default.appendEntry({
            partnerOrgId: 'partner-1',
            entryType: 'accrual.posted',
            amount: 100,
            actor: 'operator',
          }),
        'accrual'
      );
    });

    it('refuses a payout ledger entry and reports it as a payout, not an accrual', async () => {
      const mod = await import('../../../server/src/services/partnerProgramLedgerService.js');
      await expectPolicyRefusal(
        () =>
          mod.default.appendEntry({
            partnerOrgId: 'partner-1',
            entryType: 'payout.executed',
            amount: 100,
            actor: 'operator',
          }),
        'payout'
      );
    });

    it('refuses the earn->payout lifecycle transition', async () => {
      const mod = await import('../../../server/src/services/partnerProgramLedgerService.js');
      await expectPolicyRefusal(
        () =>
          mod.default.transitionLifecycle({
            partnerOrgId: 'partner-1',
            toPhase: 'payout',
            actor: 'partner',
          }),
        'lifecycle_payout'
      );
    });

    it('does NOT refuse the non-economic onboarding transitions the decision preserves', async () => {
      // Regression guard against over-blocking. onboard->activate and
      // activate->earn are onboarding edges, and payout->earn lets an operator
      // unwind an already-historical payout. If any of these started throwing a
      // policy error, a preserved non-economic journey would be broken.
      const mod = await import('../../../server/src/services/partnerProgramLedgerService.js');
      for (const toPhase of ['activate', 'earn'] as const) {
        const error = await mod.default
          .transitionLifecycle({ partnerOrgId: 'partner-1', toPhase, actor: 'operator' })
          .then(() => null)
          .catch((e: unknown) => e);
        expect(error).not.toBeInstanceOf(PartnerEconomicsPolicyDisabledError);
      }
    });

    it('does NOT refuse a lifecycle.transition ledger entry', async () => {
      const mod = await import('../../../server/src/services/partnerProgramLedgerService.js');
      const error = await mod.default
        .appendEntry({
          partnerOrgId: 'partner-1',
          entryType: 'lifecycle.transition',
          amount: 0,
          actor: 'operator',
        })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(error).not.toBeInstanceOf(PartnerEconomicsPolicyDisabledError);
    });
  });
});
