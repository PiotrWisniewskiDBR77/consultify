/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
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
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getCommissionTransactions: vi.fn(),
    getEarningsSummary: vi.fn(),
    getProgramStatus: vi.fn(),
    getPayouts: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { EarningsSection } from '@/views/partner/sections/EarningsSection';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

// The standalone CommissionView was consolidated into the EarningsSection
// statements surface during partner production-hardening (commit 8404b892f6).
// The commission-statement continuity seam — prefer governed V8 reads, fall back
// to legacy partner reads on bounded compatibility statuses — now lives in
// EarningsSection. This test pins that surviving statement-continuity contract.
describe('Commission statement continuity seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue(null as any);
    vi.mocked(V8PartnerApi.getPayouts).mockResolvedValue({ payouts: [] } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/earnings') {
        return { success: true, data: { currency: 'EUR' } } as any;
      }
      if (url === '/api/partners/payouts') {
        return { success: true, data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('prefers the governed commission statement seam for statement history', async () => {
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockResolvedValue({
      transactions: [
        {
          id: 'tx-v8-1',
          organizationName: 'ACME GmbH',
          transactionType: 'RECURRING',
          transactionDate: '2026-01-31',
          grossAmount: 1000,
          commissionRate: 15,
          commissionAmount: 150,
          currency: 'EUR',
          status: 'PAID',
        },
      ],
    } as any);

    render(<EarningsSection subsection="statements" />);

    await waitFor(() => {
      expect(screen.getByText('ACME GmbH')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getCommissionTransactions).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/commission-transactions');
  });

  it('falls back to legacy commission statement reads on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/earnings') {
        return { success: true, data: { currency: 'EUR' } } as any;
      }
      if (url === '/api/partners/payouts') {
        return { success: true, data: [] } as any;
      }
      if (url === '/api/partners/commission-transactions') {
        return {
          success: true,
          data: [
            {
              id: 'tx-legacy-1',
              organizationName: 'Legacy Org Sp. z o.o.',
              transactionType: 'NEW',
              transactionDate: '2026-02-28',
              grossAmount: 800,
              commissionRate: 12,
              commissionAmount: 96,
              currency: 'EUR',
              status: 'APPROVED',
            },
          ],
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EarningsSection subsection="statements" />);

    await waitFor(() => {
      expect(screen.getByText('Legacy Org Sp. z o.o.')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/commission-transactions');
  });
});
