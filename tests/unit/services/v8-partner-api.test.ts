import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/v8/client', () => ({
  v8Get: vi.fn(),
  v8Post: vi.fn(),
  v8Put: vi.fn(),
}));

import { V8PartnerApi } from '@/services/api/v8/partner';
import { v8Get } from '@/services/api/v8/client';

describe('V8PartnerApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests partner referral analytics from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      analytics: {
        totalClicks: 12,
        uniqueClicks: 9,
        signups: 3,
        trials: 2,
        paidCustomers: 1,
        conversionRate: 11.1,
        clicksByDay: [],
        clicksBySource: [],
      },
      days: 30,
    });

    const data = await V8PartnerApi.getReferralAnalytics();

    expect(v8Get).toHaveBeenCalledWith('/partner/referral-analytics', { days: '30' });
    expect(data.analytics.totalClicks).toBe(12);
  });

  it('requests partner earnings summary from the V8 namespace', async () => {
    vi.mocked(v8Get).mockResolvedValue({
      earnings: {
        totalEarned: 1000,
        totalPending: 150,
        totalApproved: 700,
        totalPaid: 300,
        thisMonth: 80,
        thisMonthCount: 2,
        lastMonth: 60,
        readyForPayout: 120,
        currency: 'EUR',
      },
    });

    const data = await V8PartnerApi.getEarningsSummary();

    expect(v8Get).toHaveBeenCalledWith('/partner/earnings-summary');
    expect(data.earnings.readyForPayout).toBe(120);
  });
});
