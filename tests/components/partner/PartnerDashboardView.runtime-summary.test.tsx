/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setCurrentView = vi.fn();

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView,
  }),
}));

vi.mock('@/components/Partner/PartnerRuntimeSummaryStrip', async () => {
  const actual = await vi.importActual<typeof import('@/components/Partner/PartnerRuntimeSummaryStrip')>(
    '@/components/Partner/PartnerRuntimeSummaryStrip'
  );

  return {
    ...actual,
    loadPartnerRuntimeSummary: vi.fn(),
  };
});

vi.mock('@/components/Partner/partnerTrustRuntime', () => ({
  loadPartnerTrustSnapshot: vi.fn(),
}));

import {
  loadPartnerRuntimeSummary,
  PartnerRuntimeSummaryStrip,
} from '@/components/Partner/PartnerRuntimeSummaryStrip';
import { loadPartnerTrustSnapshot } from '@/components/Partner/partnerTrustRuntime';
import { PartnerDashboardView } from '@/views/partner/PartnerDashboardView';

describe('PartnerDashboardView runtime summary seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the governed partner runtime summary above quick navigation', async () => {
    vi.mocked(loadPartnerRuntimeSummary).mockResolvedValue({
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
    });
    vi.mocked(loadPartnerTrustSnapshot).mockResolvedValue({
      currentTrustPhase: 'G4_ACTIVATION',
      trustProgression: [
        {
          phase: 'G1_DISCOVERY',
          label: 'Discovery',
          description: '',
          requirements: [],
          completed: true,
        },
        {
          phase: 'G2_QUALIFICATION',
          label: 'Qualification',
          description: '',
          requirements: [],
          completed: true,
        },
        { phase: 'G3_ONBOARDING', label: 'Onboarding', description: '', requirements: [] },
        { phase: 'G4_ACTIVATION', label: 'Activation', description: '', requirements: [] },
        { phase: 'G5_ECOSYSTEM', label: 'Ecosystem', description: '', requirements: [] },
      ],
    });

    render(<PartnerDashboardView />);

    await waitFor(() => {
      expect(loadPartnerRuntimeSummary).toHaveBeenCalled();
      expect(loadPartnerTrustSnapshot).toHaveBeenCalled();
    });

    expect(PartnerRuntimeSummaryStrip).toBeTypeOf('function');
    expect(screen.getByText('Partner Runtime Summary')).toBeInTheDocument();
    expect(screen.getByText('Referral clicks')).toBeInTheDocument();
    expect(screen.getByText('Ready for payout')).toBeInTheDocument();
    expect(screen.getByText('30 unique')).toBeInTheDocument();
    expect(screen.getByText('Trust Progression')).toBeInTheDocument();
    expect(screen.queryByText('Network Effect')).not.toBeInTheDocument();
  });
});
