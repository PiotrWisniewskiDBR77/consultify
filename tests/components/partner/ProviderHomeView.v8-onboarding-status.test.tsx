/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const tMock = (key: string, fallbackOrOptions?: string | Record<string, unknown>, maybeOptions?: Record<string, unknown>) => {
  const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined;
  const options =
    typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null
      ? fallbackOrOptions
      : maybeOptions;

  if (options?.returnObjects) {
    return ['Mock item A', 'Mock item B'];
  }

  if (typeof options?.defaultValue === 'string') {
    return options.defaultValue.replace('{{tier}}', String(options.tier ?? ''));
  }

  if (key === 'partner.beta.partnerSince' && options?.date) {
    return `Beta Partner since ${String(options.date)}`;
  }

  return fallback || key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
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
    getOnboardingStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { ProviderHomeView } from '@/views/partner/ProviderHomeView';

describe('ProviderHomeView onboarding status seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('prefers governed onboarding status before legacy fallback', async () => {
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('2/4')).toBeInTheDocument();
      expect(screen.getByText(/Current tier: professional/i)).toBeInTheDocument();
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
          completed: true,
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('4/4')).toBeInTheDocument();
      expect(screen.getByText(/Current tier: enterprise/i)).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/onboarding/status');
  });
});
