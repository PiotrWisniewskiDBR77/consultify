/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
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
    requestPayout: vi.fn(),
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
        payoutEligibility: {
          eligible: true,
          eligibleGross: 150,
          eligibleNet: 148.5,
          minimumThreshold: 100,
          currency: 'EUR',
          reason: 'ELIGIBLE',
        },
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
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockResolvedValue({ transactions: [] } as any);
    vi.mocked(V8PartnerApi.getPayouts).mockResolvedValue({ payouts: [] } as any);
  });

  it('renders governed payout settings as historical read-only data', async () => {
    vi.mocked(V8PartnerApi.getPayoutSettings).mockResolvedValue({
      settings: {
        minimumThreshold: 500,
        payoutMethod: 'PAYPAL',
        autoPayoutEnabled: false,
        payoutAccount: {
          accountHolderName: 'Partner Co',
          iban: 'DE89 3704 0044 0532 0130 00',
          bicSwift: 'COBADEFFXXX',
          bankName: 'Commerzbank AG',
        },
      },
    } as any);
    render(<EarningsSection subsection="payout-settings" />);

    expect(await screen.findByText('Partner Co', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('DE89 3704 0044 0532 0130 00')).toBeInTheDocument();
    expect(screen.getByTestId('historical-payout-method')).toHaveTextContent('PAYPAL');
    expect(screen.getByText('Payout operations unavailable')).toBeInTheDocument();
    expect(screen.getByText(/AMD-PRT-ECONOMICS-002/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(V8PartnerApi.updatePayoutSettings).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
  });

  it('does not enable payout from ledger balance when canonical eligibility is below policy minimum', async () => {
    vi.mocked(V8PartnerApi.getEarningsSummary).mockResolvedValue({
      earnings: {
        totalEarned: 1200,
        totalPending: 0,
        totalApproved: 700,
        totalPaid: 0,
        thisMonth: 0,
        thisMonthCount: 0,
        lastMonth: 0,
        readyForPayout: 700,
        currency: 'EUR',
        payoutEligibility: {
          eligible: false,
          eligibleGross: 200,
          eligibleNet: 198,
          minimumThreshold: 500,
          currency: 'EUR',
          reason: 'BELOW_MINIMUM',
        },
      },
    } as any);
    vi.mocked(V8PartnerApi.getPayoutSettings).mockResolvedValue({
      settings: {
        minimumThreshold: 100,
        payoutMethod: 'BANK_TRANSFER',
        autoPayoutEnabled: false,
        payoutAccount: { accountHolderName: 'Partner', iban: 'DE123', bicSwift: '', bankName: '' },
      },
    } as any);

    render(<EarningsSection />);

    expect(await screen.findByTestId('partner-economics-approved-out')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request payout|Zażądaj wypłaty/i })).not.toBeInTheDocument();
    expect(V8PartnerApi.requestPayout).not.toHaveBeenCalled();
  });

  it('keeps legacy reads but fails closed without a legacy payout-settings mutation', async () => {
    vi.mocked(V8PartnerApi.getPayoutSettings).mockRejectedValue({ status: 404 });
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
    render(<EarningsSection subsection="payout-settings" />);

    expect(await screen.findByText('Legacy Partner Co', {}, { timeout: 10000 })).toBeInTheDocument();
    expect(screen.getByText('PL001234')).toBeInTheDocument();

    expect(Api.get).toHaveBeenCalledWith('/api/partners/payout-settings');
    expect(V8PartnerApi.updatePayoutSettings).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
