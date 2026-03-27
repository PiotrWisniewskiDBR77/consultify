/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
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
    getEarningsSummary: vi.fn(),
    requestPayout: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { EarningsSection } from '@/views/partner/sections/EarningsSection';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

describe('EarningsSection V8 payout request seam', () => {
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
      if (url === '/api/partners/commission-transactions') {
        return { success: true, data: [] } as any;
      }
      if (url === '/api/partners/payouts') {
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
  });

  it('prefers governed payout request before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.requestPayout).mockResolvedValue({
      payout: { id: 'payout-1', status: 'requested' },
    } as any);

    render(<EarningsSection subsection="earnings" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Request Payout' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Request Payout' }));

    await waitFor(() => {
      expect(V8PartnerApi.requestPayout).toHaveBeenCalledWith({ amount: 150 });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/api/partners/payouts/request', expect.anything());
  });

  it('falls back to legacy payout request on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.requestPayout).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({
      success: true,
      data: { id: 'payout-legacy-1' },
    } as any);

    render(<EarningsSection subsection="earnings" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Request Payout' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Request Payout' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/partners/payouts/request', { amount: 150 });
    });
  });
});
