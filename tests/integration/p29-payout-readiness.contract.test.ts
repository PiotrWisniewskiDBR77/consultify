/**
 * P29-C: degraded posture dla wypłat — gotowość profilu (pure helpers).
 */
import { describe, expect, it } from 'vitest';

import {
  isPartnerPayoutDestinationComplete,
  type PartnerPayoutSettings,
} from '../../server/src/services/partnerPayoutSettingsService.js';

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
