import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getConnection: vi.fn(),
    getOnboardingStatus: vi.fn(),
    getClients: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

vi.mock('@/components/Partner/PartnerRuntimeSummaryStrip', () => ({
  loadPartnerRuntimeSummary: vi.fn(),
}));

import {
  derivePartnerTrustSnapshot,
  loadPartnerTrustSnapshot,
} from '@/components/Partner/partnerTrustRuntime';
import { loadPartnerRuntimeSummary } from '@/components/Partner/PartnerRuntimeSummaryStrip';
import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';

describe('partner trust runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps trust progression in onboarding until real activation signals appear', () => {
    const snapshot = derivePartnerTrustSnapshot({
      connected: true,
      partnerSince: '2026-01-01T00:00:00.000Z',
      onboardingStatus: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: false,
        completed: false,
      },
      clientCount: 0,
      totalClicks: 0,
      signups: 0,
      paidCustomers: 0,
      totalEarned: 0,
      readyForPayout: 0,
    });

    expect(snapshot.currentTrustPhase).toBe('G3_ONBOARDING');
    expect(snapshot.trustProgression[0].completed).toBe(true);
    expect(snapshot.trustProgression[1].completed).toBe(true);
    expect(snapshot.trustProgression[2].completed).toBe(false);
  });

  it('promotes trust progression to ecosystem only when referral activity is real', () => {
    const snapshot = derivePartnerTrustSnapshot({
      connected: true,
      partnerSince: '2026-01-01T00:00:00.000Z',
      onboardingStatus: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'enterprise',
        paymentSetup: true,
        completed: true,
      },
      clientCount: 4,
      totalClicks: 12,
      signups: 3,
      paidCustomers: 1,
      totalEarned: 2400,
      readyForPayout: 300,
    });

    expect(snapshot.currentTrustPhase).toBe('G5_ECOSYSTEM');
    expect(snapshot.trustProgression[3].completed).toBe(true);
    expect(snapshot.trustProgression[4].completed).toBe(false);
  });

  it('loads trust snapshot from the canonical v8 seam', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/onboarding/status') {
        return {
          terms_accepted: true,
          privacy_accepted: true,
          pricing_tier: 'professional',
          payment_setup: true,
          completed: true,
        } as any;
      }

      if (url === '/api/partners/clients') {
        return {
          success: true,
          data: [{ id: 'client-1' }, { id: 'client-2' }],
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    vi.mocked(V8PartnerApi.getConnection).mockResolvedValue({
      connected: true,
      selfConnectEnabled: false,
      organization: { id: 'partner-1', name: 'Partner', partnerSince: '2026-01-01T00:00:00.000Z' },
    });
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: { termsAccepted: true, privacyAccepted: true, pricingTier: 'professional', paymentSetup: true, completed: true },
    });
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({ clients: [{ id: 'client-1' }, { id: 'client-2' }] } as any);
    vi.mocked(loadPartnerRuntimeSummary).mockResolvedValue({
      analytics: {
        totalClicks: 8,
        uniqueClicks: 5,
        signups: 2,
        trials: 1,
        paidCustomers: 1,
        conversionRate: 12.5,
        clicksByDay: [],
        clicksBySource: [],
      },
      earnings: {
        totalEarned: 1100,
        totalPending: 80,
        totalApproved: 400,
        totalPaid: 620,
        thisMonth: 75,
        thisMonthCount: 1,
        lastMonth: 90,
        readyForPayout: 120,
        currency: 'EUR',
      },
    } as any);

    const snapshot = await loadPartnerTrustSnapshot();

    expect(Api.get).not.toHaveBeenCalled();
    expect(snapshot.currentTrustPhase).toBe('G5_ECOSYSTEM');
  });
});
