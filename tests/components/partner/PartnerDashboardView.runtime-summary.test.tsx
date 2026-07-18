/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
    getProgramStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import {
  loadPartnerRuntimeSummary,
  PartnerRuntimeSummaryStrip,
  type PartnerRuntimeSummary,
} from '@/components/Partner/PartnerRuntimeSummaryStrip';
import { V8PartnerApi } from '@/services/api/v8';

// PartnerDashboardView was consolidated into PartnerPortalView during partner
// production-hardening (commit 8404b892f6). The governed runtime-summary surface
// it used to host now lives in the shared PartnerRuntimeSummaryStrip component
// plus the loadPartnerRuntimeSummary seam, which PartnerPortalView consumes.
// This test pins the surviving canonical contract.
describe('Partner runtime summary seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads governed analytics/earnings/program through the runtime seam', async () => {
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockResolvedValue({
      analytics: {
        totalClicks: 42,
        uniqueClicks: 30,
        signups: 8,
        trials: 5,
        paidCustomers: 3,
        conversionRate: 37.5,
        clicksByDay: [],
        clicksBySource: [],
      },
    } as any);
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

    const summary = await loadPartnerRuntimeSummary();

    expect(V8PartnerApi.getReferralAnalytics).toHaveBeenCalled();
    expect(V8PartnerApi.getEarningsSummary).toHaveBeenCalled();
    expect(summary.analytics.totalClicks).toBe(42);
    expect(summary.earnings.readyForPayout).toBe(150);
  });

  it('renders the governed partner runtime summary strip', async () => {
    const summary: PartnerRuntimeSummary = {
      analytics: {
        totalClicks: 42,
        uniqueClicks: 30,
        signups: 8,
        trials: 5,
        paidCustomers: 3,
        conversionRate: 37.5,
        clicksByDay: [],
        clicksBySource: [],
      },
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
      program: null,
    };

    render(<PartnerRuntimeSummaryStrip summary={summary} />);

    await waitFor(() => {
      expect(screen.getByText('Partner Runtime Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Referral clicks')).toBeInTheDocument();
    expect(screen.getByText('Ready for payout')).toBeInTheDocument();
    expect(screen.getByText('30 unique')).toBeInTheDocument();
    // Trust Progression / Network Effect lived on the deleted dashboard wrapper,
    // not on the surviving runtime-summary strip.
    expect(screen.queryByText('Network Effect')).not.toBeInTheDocument();
  });
});
