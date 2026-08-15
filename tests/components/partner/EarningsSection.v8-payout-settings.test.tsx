/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const translate = (_key: string, fallback?: any) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getCommissionTransactions: vi.fn(),
    getEarningsSummary: vi.fn(),
    getProgramStatus: vi.fn(),
    getPayouts: vi.fn(),
    getPayoutSettings: vi.fn(),
    updatePayoutSettings: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status ?? error?.response?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { EarningsSection } from '@/views/partner/sections/EarningsSection';

describe('EarningsSection V8 payout settings seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/earnings') {
        return {
          success: true,
          data: {
            totalEarned: 1200,
            totalPending: 200,
            totalApproved: 700,
            totalPaid: 500,
            thisMonth: 120,
            thisMonthCount: 2,
            lastMonth: 90,
            readyForPayout: 150,
            currency: 'EUR',
            bankInfoComplete: true,
          },
        } as any;
      }
      if (url === '/api/partners/commission-transactions' || url === '/api/partners/payouts') {
        return { success: true, data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(V8PartnerApi.getEarningsSummary).mockResolvedValue({
      earnings: {
        totalEarned: 1200,
        totalPending: 200,
        totalApproved: 700,
        totalPaid: 500,
        thisMonth: 120,
        thisMonthCount: 2,
        lastMonth: 90,
        readyForPayout: 150,
        currency: 'EUR',
      },
    } as any);
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue({
      lifecyclePhase: 'payout',
      payoutSettingsComplete: true,
      balances: {
        grossEarned: 1200,
        paidOut: 500,
        heldAmount: 0,
        availableToPayout: 150,
        currency: 'EUR',
      },
      whatNext: [],
      hold: null,
    } as any);
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockResolvedValue({
      transactions: [],
    } as any);
    vi.mocked(V8PartnerApi.getPayouts).mockResolvedValue({ payouts: [] } as any);
  });

  it('prefers governed payout-settings read and update before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getPayoutSettings).mockResolvedValue({
      settings: {
        minimumThreshold: 500,
        payoutMethod: 'PAYPAL',
        autoPayoutEnabled: true,
        payoutAccount: {
          accountHolderName: 'Partner Co',
          iban: 'DE89 3704 0044 0532 0130 00',
          bicSwift: 'COBADEFFXXX',
          bankName: 'Commerzbank AG',
        },
      },
    } as any);
    vi.mocked(V8PartnerApi.updatePayoutSettings).mockResolvedValue({
      success: true,
      settings: {
        minimumThreshold: 500,
        payoutMethod: 'PAYPAL',
        autoPayoutEnabled: true,
        payoutAccount: {
          accountHolderName: 'Updated Partner Co',
          iban: 'DE00 0000 0000 0000 0000 00',
          bicSwift: 'REVODEFF',
          bankName: 'Revolut Bank',
        },
      },
    } as any);

    render(<EarningsSection subsection="payout-settings" />);

    const holderInput = await screen.findByDisplayValue('Partner Co', {}, { timeout: 10000 });
    fireEvent.change(holderInput, { target: { value: 'Updated Partner Co' } });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save Changes' }, { timeout: 10000 })
    );

    await waitFor(
      () => {
        expect(V8PartnerApi.updatePayoutSettings).toHaveBeenCalledWith({
          minimumThreshold: 500,
          payoutMethod: 'PAYPAL',
          autoPayoutEnabled: true,
          payoutAccount: {
            accountHolderName: 'Updated Partner Co',
            iban: 'DE89 3704 0044 0532 0130 00',
            bicSwift: 'COBADEFFXXX',
            bankName: 'Commerzbank AG',
          },
        });
      },
      { timeout: 10000 }
    );

    expect(Api.put).not.toHaveBeenCalledWith('/api/partners/payout-settings', expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith('Payout settings updated');
  });

  it('falls back to legacy payout-settings route on bounded compatibility errors', async () => {
    vi.mocked(V8PartnerApi.getPayoutSettings).mockRejectedValue({ status: 404 });
    vi.mocked(V8PartnerApi.updatePayoutSettings).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/earnings') {
        return {
          success: true,
          data: {
            totalEarned: 1200,
            totalPending: 200,
            totalApproved: 700,
            totalPaid: 500,
            thisMonth: 120,
            thisMonthCount: 2,
            lastMonth: 90,
            readyForPayout: 150,
            currency: 'EUR',
            bankInfoComplete: true,
          },
        } as any;
      }
      if (url === '/api/partners/commission-transactions' || url === '/api/partners/payouts') {
        return { success: true, data: [] } as any;
      }
      if (url === '/api/partners/payout-settings') {
        return {
          success: true,
          data: {
            minimumThreshold: 250,
            payoutMethod: 'BANK_TRANSFER',
            autoPayoutEnabled: false,
            payoutAccount: {
              accountHolderName: 'Legacy Partner Co',
              iban: 'PL001234',
              bicSwift: 'WBKPPLPP',
              bankName: 'Legacy Bank',
            },
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(Api.put).mockResolvedValue({
      success: true,
      data: {
        minimumThreshold: 250,
        payoutMethod: 'BANK_TRANSFER',
        autoPayoutEnabled: false,
        payoutAccount: {
          accountHolderName: 'Legacy Updated',
          iban: 'PL009999',
          bicSwift: 'WBKPPLPP',
          bankName: 'Legacy Bank',
        },
      },
    } as any);

    render(<EarningsSection subsection="payout-settings" />);

    const holderInput = await screen.findByDisplayValue(
      'Legacy Partner Co',
      {},
      { timeout: 10000 }
    );
    fireEvent.change(holderInput, { target: { value: 'Legacy Updated' } });
    fireEvent.click(
      await screen.findByRole('button', { name: 'Save Changes' }, { timeout: 10000 })
    );

    await waitFor(
      () => {
        expect(Api.put).toHaveBeenCalledWith('/api/partners/payout-settings', {
          minimumThreshold: 250,
          payoutMethod: 'BANK_TRANSFER',
          autoPayoutEnabled: false,
          payoutAccount: {
            accountHolderName: 'Legacy Updated',
            iban: 'PL001234',
            bicSwift: 'WBKPPLPP',
            bankName: 'Legacy Bank',
          },
        });
      },
      { timeout: 10000 }
    );

    expect(Api.get).toHaveBeenCalledWith('/api/partners/payout-settings');
    expect(toastSuccess).toHaveBeenCalledWith('Payout settings updated');
    expect(toastError).not.toHaveBeenCalled();
  });
});
