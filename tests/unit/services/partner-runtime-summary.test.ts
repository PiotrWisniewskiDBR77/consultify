import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { PartnerRuntimeSummaryStrip, loadPartnerRuntimeSummary } from '@/components/Partner/PartnerRuntimeSummaryStrip';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

describe('loadPartnerRuntimeSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers V8 partner runtime summary seams', async () => {
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockResolvedValue({
      analytics: {
        totalClicks: 21,
        uniqueClicks: 13,
        signups: 5,
        trials: 3,
        paidCustomers: 2,
        conversionRate: 9.52,
        clicksByDay: [],
        clicksBySource: [],
      },
    } as any);
    vi.mocked(V8PartnerApi.getEarningsSummary).mockResolvedValue({
      earnings: {
        totalEarned: 1200,
        totalPending: 150,
        totalApproved: 400,
        totalPaid: 650,
        thisMonth: 120,
        thisMonthCount: 2,
        lastMonth: 90,
        readyForPayout: 300,
        currency: 'EUR',
      },
    } as any);

    const summary = await loadPartnerRuntimeSummary();

    expect(V8PartnerApi.getReferralAnalytics).toHaveBeenCalled();
    expect(V8PartnerApi.getEarningsSummary).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalled();
    expect(summary.analytics.totalClicks).toBe(21);
    expect(summary.earnings.readyForPayout).toBe(300);
  });

  it('falls back to legacy partner runtime seams on bounded compatibility errors', async () => {
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockRejectedValue({ status: 404 });
    vi.mocked(V8PartnerApi.getEarningsSummary).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/referral-analytics') {
        return {
          success: true,
          data: {
            totalClicks: 9,
            uniqueClicks: 7,
            signups: 2,
            conversions: 1,
            clicksByDay: [],
            topCampaigns: [],
          },
        } as any;
      }

      if (url === '/api/partners/earnings') {
        return {
          success: true,
          data: {
            totalEarnedYTD: 900,
            pendingApproval: 100,
            totalPaidOut: 800,
            readyForPayout: 50,
            thisMonth: 75,
            thisMonthCount: 1,
            lastMonth: 60,
            currency: 'EUR',
          },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    const summary = await loadPartnerRuntimeSummary();

    expect(Api.get).toHaveBeenCalledWith('/api/partners/referral-analytics');
    expect(Api.get).toHaveBeenCalledWith('/api/partners/earnings');
    expect(summary.analytics.paidCustomers).toBe(1);
    expect(summary.earnings.totalEarned).toBe(900);
    expect(summary.earnings.totalPending).toBe(100);
  });

  it('exports the shared runtime summary strip component', () => {
    expect(PartnerRuntimeSummaryStrip).toBeTypeOf('function');
  });
});
