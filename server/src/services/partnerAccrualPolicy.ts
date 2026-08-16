export interface ApprovedPartnerAccrualPolicy {
  status: 'APPROVED';
  version: string;
  baseCurrency: string;
  commissionRateBps: number;
  payoutFeeBps: number;
  minimumPayoutMinor: number;
}

export class PartnerAccrualPolicyBlockedError extends Error {
  readonly code = 'PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER';
}

const VERSION = /^[a-zA-Z0-9._-]{3,64}$/;
const CURRENCY = /^[A-Z]{3}$/;

export function readApprovedPartnerAccrualPolicy(
  raw = process.env.PARTNER_ACCRUAL_POLICY_JSON
): ApprovedPartnerAccrualPolicy {
  let value: any;
  try {
    value = JSON.parse(String(raw || ''));
  } catch {
    throw new PartnerAccrualPolicyBlockedError('Approved Partner accrual policy is not configured');
  }
  const validInteger = (number: unknown, max: number) =>
    Number.isInteger(number) && Number(number) >= 0 && Number(number) <= max;
  if (
    value?.status !== 'APPROVED' ||
    !VERSION.test(String(value.version || '')) ||
    !CURRENCY.test(String(value.baseCurrency || '')) ||
    !validInteger(value.commissionRateBps, 10_000) ||
    !validInteger(value.payoutFeeBps, 10_000) ||
    !validInteger(value.minimumPayoutMinor, Number.MAX_SAFE_INTEGER)
  ) {
    throw new PartnerAccrualPolicyBlockedError('Partner accrual policy is absent, unapproved or invalid');
  }
  return {
    status: 'APPROVED',
    version: value.version,
    baseCurrency: value.baseCurrency,
    commissionRateBps: value.commissionRateBps,
    payoutFeeBps: value.payoutFeeBps,
    minimumPayoutMinor: value.minimumPayoutMinor,
  };
}

export function assertPolicyCurrency(policy: ApprovedPartnerAccrualPolicy, currency: string): void {
  if (currency !== policy.baseCurrency) {
    throw new PartnerAccrualPolicyBlockedError(
      `Currency ${currency} is outside approved Partner policy ${policy.version}`
    );
  }
}
