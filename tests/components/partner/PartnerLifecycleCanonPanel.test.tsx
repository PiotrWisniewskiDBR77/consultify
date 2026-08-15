/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const tMock = (
  key: string,
  fallbackOrOptions?: string | Record<string, unknown>,
  maybeOptions?: Record<string, unknown>
) => {
  const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined;
  const options =
    typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null
      ? fallbackOrOptions
      : maybeOptions;

  if (options?.returnObjects) {
    return ['Mock item A', 'Mock item B'];
  }

  if (key === 'partner.onboarding.pricingBonus' && options?.tier) {
    return `Current tier: ${String(options.tier)}`;
  }

  return fallback || (options?.defaultValue as string | undefined) || key;
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
  shouldFallbackToLegacyPartner: () => false,
}));

import { V8PartnerApi } from '@/services/api/v8';
import { ProviderHomeView } from '@/views/partner/ProviderHomeView';

// PartnerLifecycleCanonPanel was removed during partner production-hardening
// (commit 8404b892f6). Its lifecycle progress view was consolidated into the
// ProviderHomeView onboarding checklist, which builds the same
// apply -> activate -> payout -> active lifecycle from the governed onboarding
// status. This test pins that surviving canonical lifecycle surface.
describe('Partner lifecycle canon surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the canonical onboarding lifecycle narrative', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: {
        termsAccepted: false,
        privacyAccepted: false,
        pricingTier: null,
        paymentSetup: false,
        completed: false,
      },
    } as any);

    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Get Started in 10 Minutes')).toBeInTheDocument();
    });

    // The four canonical lifecycle steps surface as their CTAs.
    expect(screen.getByRole('button', { name: 'Review terms' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set up payment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish onboarding' })).toBeInTheDocument();
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });

  it('reflects onboarding progress for partner workspace states', async () => {
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: {
        termsAccepted: true,
        privacyAccepted: true,
        pricingTier: 'professional',
        paymentSetup: true,
        completed: false,
      },
    } as any);

    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      // terms+privacy, tier, and payment complete -> 3 of 4 lifecycle steps done.
      expect(screen.getByText('3/4')).toBeInTheDocument();
    });

    // The active commercial tier is reflected back in the lifecycle.
    expect(screen.getByText(/Current tier: professional/i)).toBeInTheDocument();
  });
});
