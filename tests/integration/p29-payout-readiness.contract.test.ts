/**
 * P29-C: degraded posture dla wypłat — gotowość profilu + dual-control (pure helpers).
 */
import { describe, expect, it } from 'vitest';

import {
  isPartnerPayoutDestinationComplete,
  type PartnerPayoutSettings,
} from '../../server/src/services/partnerPayoutSettingsService.js';
import { requiresDualControl } from '../../server/src/services/partnerProgramLedgerService.js';

function baseSettings(over: Partial<PartnerPayoutSettings> = {}): PartnerPayoutSettings {
  return {
    minimumThreshold: 100,
    payoutMethod: 'BANK_TRANSFER',
    autoPayoutEnabled: false,
    payoutAccount: null,
    ...over,
  };
}

describe('P29 Partner payout readiness (FINAL 29 §2.3.6)', () => {
  it('isPartnerPayoutDestinationComplete is false without account', () => {
    expect(isPartnerPayoutDestinationComplete(baseSettings())).toBe(false);
  });

  it('BANK_TRANSFER requires holder and IBAN', () => {
    expect(
      isPartnerPayoutDestinationComplete(
        baseSettings({
          payoutAccount: {
            accountHolderName: 'ACME',
            iban: '',
            bicSwift: '',
            bankName: '',
          },
        })
      )
    ).toBe(false);
    expect(
      isPartnerPayoutDestinationComplete(
        baseSettings({
          payoutAccount: {
            accountHolderName: 'ACME',
            iban: 'PL61109010140000071219812874',
            bicSwift: 'BPKOPLPW',
            bankName: 'Test',
          },
        })
      )
    ).toBe(true);
  });

  it('non-bank methods require at least account holder', () => {
    expect(
      isPartnerPayoutDestinationComplete(
        baseSettings({
          payoutMethod: 'PAYPAL',
          payoutAccount: {
            accountHolderName: '  ',
            iban: '',
            bicSwift: '',
            bankName: '',
          },
        })
      )
    ).toBe(false);
    expect(
      isPartnerPayoutDestinationComplete(
        baseSettings({
          payoutMethod: 'WISE',
          payoutAccount: {
            accountHolderName: 'Partner Org',
            iban: '',
            bicSwift: '',
            bankName: '',
          },
        })
      )
    ).toBe(true);
  });
});

describe('P29 Dual-control payouts (FINAL 29 §2.3.5)', () => {
  it('requiresDualControl is true for payout.approved above threshold', () => {
    expect(requiresDualControl('payout.approved', 1500, false)).toBe(true);
    expect(requiresDualControl('payout.approved', 500, false)).toBe(false);
  });

  it('requiresDualControl is true for first payout regardless of amount', () => {
    expect(requiresDualControl('payout.executed', 10, true)).toBe(true);
  });

  it('requiresDualControl is false for non-payout entry types', () => {
    expect(requiresDualControl('accrual.posted', 5000, true)).toBe(false);
    expect(requiresDualControl('hold.placed', 2000, false)).toBe(false);
  });
});
