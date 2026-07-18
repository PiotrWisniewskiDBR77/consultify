/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
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
    acceptOnboardingTerms: vi.fn(),
    selectOnboardingTier: vi.fn(),
    completeOnboarding: vi.fn(),
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
    vi.mocked(V8PartnerApi.acceptOnboardingTerms).mockResolvedValue({
      success: true,
      message: 'Terms accepted',
    } as any);
    vi.mocked(V8PartnerApi.selectOnboardingTier).mockResolvedValue({
      success: true,
      tier: 'professional',
      message: 'Pricing tier selected',
    } as any);
    vi.mocked(V8PartnerApi.completeOnboarding).mockResolvedValue({
      success: true,
      message: 'Onboarding completed!',
    } as any);
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: {
        termsAccepted: false,
        privacyAccepted: false,
        pricingTier: null,
        paymentSetup: false,
        completed: false,
      },
    } as any);
  });

  it('prefers governed partner onboarding status before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValueOnce({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: false,
        completed: false,
      },
    } as any);

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
      expect(screen.getByText('Payout and billing readiness')).toBeInTheDocument();
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
      expect(screen.getByText('Partner application completed')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/onboarding/status');
  });

  it('prefers governed partner legal acceptance before legacy fallback', async () => {
    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Akceptuje warunki programu partnerskiego'));
    fireEvent.click(screen.getByLabelText('Akceptuje polityke prywatnosci'));
    fireEvent.click(screen.getByRole('button', { name: /Potwierdz i przejdz dalej/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    expect(V8PartnerApi.acceptOnboardingTerms).toHaveBeenCalledWith({
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });
    expect(Api.post).not.toHaveBeenCalledWith('/onboarding/accept-terms', expect.anything());
  });

  it('falls back to legacy legal acceptance on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.acceptOnboardingTerms).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      if (url === '/onboarding/accept-terms') {
        return { success: true, message: 'Terms accepted' } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Akceptuje warunki programu partnerskiego'));
    fireEvent.click(screen.getByLabelText('Akceptuje polityke prywatnosci'));
    fireEvent.click(screen.getByRole('button', { name: /Potwierdz i przejdz dalej/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    expect(Api.post).toHaveBeenCalledWith('/onboarding/accept-terms', {
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
    });
  });

  it('prefers governed partner pricing-tier selection before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValueOnce({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: null,
        paymentSetup: false,
        completed: false,
      },
    } as any);

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Professional'));
    fireEvent.click(screen.getByRole('button', { name: /Continue with Professional/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    });

    expect(V8PartnerApi.selectOnboardingTier).toHaveBeenCalledWith({
      tier: 'professional',
    });
    expect(Api.post).not.toHaveBeenCalledWith('/onboarding/select-tier', expect.anything());
  });

  it('falls back to legacy pricing-tier selection on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValueOnce({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: null,
        paymentSetup: false,
        completed: false,
      },
    } as any);
    vi.mocked(V8PartnerApi.selectOnboardingTier).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string, body?: any) => {
      if (url === '/onboarding/select-tier') {
        return { success: true, tier: body?.tier, message: 'Pricing tier selected' } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Enterprise'));
    fireEvent.click(screen.getByRole('button', { name: /Continue with Enterprise/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    });

    expect(Api.post).toHaveBeenCalledWith('/onboarding/select-tier', {
      tier: 'enterprise',
    });
  });

  it('prefers governed partner completion before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValueOnce({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: false,
        completed: false,
      },
    } as any);

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue and finish later' }));

    await waitFor(() => {
      expect(V8PartnerApi.completeOnboarding).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/onboarding/complete', expect.anything());
  });

  it('falls back to legacy completion on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValueOnce({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'enterprise',
        paymentSetup: false,
        completed: false,
      },
    } as any);
    vi.mocked(V8PartnerApi.completeOnboarding).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockImplementation(async (url: string) => {
      if (url === '/onboarding/complete') {
        return { success: true, message: 'Onboarding completed!' } as any;
      }
      throw new Error(`Unexpected POST ${url}`);
    });

    render(
      <MemoryRouter>
        <EnterpriseOnboardingWizard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue and finish later' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/onboarding/complete', {});
      expect(navigateMock).toHaveBeenCalledWith('/app');
    });
  });
});
