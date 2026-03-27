/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    getSubscriptionPlans: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getOnboardingStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { EnterpriseOnboardingWizard } from '@/components/Onboarding/EnterpriseOnboardingWizard';

describe('EnterpriseOnboardingWizard onboarding status seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    vi.mocked(Api.getSubscriptionPlans).mockResolvedValue([]);
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: false,
        completed: false,
      },
    } as any);
  });

  it('prefers governed partner onboarding status before legacy fallback', async () => {
    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
      expect(screen.getByText('Payment Setup')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getOnboardingStatus).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/onboarding/status');
  });

  it('falls back to legacy onboarding status on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/onboarding/status') {
        return {
          terms_accepted: true,
          privacy_accepted: true,
          pricing_tier: 'enterprise',
          payment_setup: true,
          completed: false,
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome Aboard!')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/onboarding/status');
  });
});
