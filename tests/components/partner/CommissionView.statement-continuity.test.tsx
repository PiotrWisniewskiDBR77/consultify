/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getPayouts: vi.fn(),
    getCommissionTransactions: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/hooks/usePartnerEcosystem', () => ({
  usePartnerEcosystem: () => ({
    deals: [],
    loading: false,
    submitCommissionInquiry: vi.fn(),
  }),
}));

const setCurrentView = vi.fn();

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView,
  }),
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { CommissionView } from '@/views/partner/CommissionView';

describe('CommissionView statement continuity seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('prefers governed payout and commission seams for statement history', async () => {
    vi.mocked(V8PartnerApi.getPayouts).mockResolvedValue({
      payouts: [
        {
          id: 'payout-1',
          status: 'COMPLETED',
          netAmount: 1200,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          completedAt: '2026-02-15T00:00:00.000Z',
        },
      ],
    } as any);
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockResolvedValue({
      transactions: [],
    } as any);

    render(<CommissionView />);

    await waitFor(() => {
      expect(screen.getByText('2026-01-01 - 2026-01-31')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getPayouts).toHaveBeenCalled();
    expect(V8PartnerApi.getCommissionTransactions).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/payouts');
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/commission-transactions');
    expect(screen.getByText(/\$1,?200/)).toBeInTheDocument();
  });

  it('falls back to legacy partner statement reads on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getPayouts).mockRejectedValue({ status: 404 });
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/payouts') {
        return {
          success: true,
          data: [
            {
              id: 'payout-legacy-1',
              status: 'COMPLETED',
              netAmount: 980,
              periodStart: '2026-02-01',
              periodEnd: '2026-02-28',
              completedAt: '2026-03-15T00:00:00.000Z',
            },
          ],
        } as any;
      }

      if (url === '/api/partners/commission-transactions') {
        return {
          success: true,
          data: [],
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<CommissionView />);

    await waitFor(() => {
      expect(screen.getByText('2026-02-01 - 2026-02-28')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/payouts');
    expect(Api.get).toHaveBeenCalledWith('/api/partners/commission-transactions');
  });
});
