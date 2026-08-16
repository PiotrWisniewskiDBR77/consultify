import { afterEach, describe, expect, it } from 'vitest';

import {
  assertPolicyCurrency,
  PartnerAccrualPolicyBlockedError,
  readApprovedPartnerAccrualPolicy,
} from '../../../server/src/services/partnerAccrualPolicy.js';

afterEach(() => delete process.env.PARTNER_ACCRUAL_POLICY_JSON);

describe('PRT-MVP-ACCRUAL-001 owner policy gate', () => {
  it('fails closed when the commercial policy is absent or not approved', () => {
    expect(() => readApprovedPartnerAccrualPolicy()).toThrow(PartnerAccrualPolicyBlockedError);
    expect(() => readApprovedPartnerAccrualPolicy(JSON.stringify({ status: 'DRAFT' }))).toThrow(
      'absent, unapproved or invalid'
    );
  });

  it('accepts only a complete approved versioned rule without inventing values', () => {
    const policy = readApprovedPartnerAccrualPolicy(JSON.stringify({
      status: 'APPROVED', version: 'owner-rule-v1', baseCurrency: 'EUR',
      commissionRateBps: 1500, payoutFeeBps: 100, minimumPayoutMinor: 10000,
    }));
    expect(policy).toMatchObject({ version: 'owner-rule-v1', baseCurrency: 'EUR' });
    expect(() => assertPolicyCurrency(policy, 'USD')).toThrow('outside approved Partner policy');
    expect(() => assertPolicyCurrency(policy, 'EUR')).not.toThrow();
  });

  it('rejects malformed currency, rates, versions and thresholds', () => {
    const base = { status: 'APPROVED', version: 'owner-rule-v1', baseCurrency: 'EUR', commissionRateBps: 1500, payoutFeeBps: 100, minimumPayoutMinor: 10000 };
    for (const patch of [
      { baseCurrency: 'EURO' }, { version: '../secret' }, { commissionRateBps: 10001 },
      { payoutFeeBps: -1 }, { minimumPayoutMinor: 1.5 },
    ]) {
      expect(() => readApprovedPartnerAccrualPolicy(JSON.stringify({ ...base, ...patch }))).toThrow(PartnerAccrualPolicyBlockedError);
    }
  });
});
