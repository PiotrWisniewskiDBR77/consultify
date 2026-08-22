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

  if (typeof options?.defaultValue === 'string') {
    return options.defaultValue.replace('{{tier}}', String(options.tier ?? ''));
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
  shouldFallbackToLegacyPartner: () => false,
}));

import { V8PartnerApi } from '@/services/api/v8';
import { ProviderHomeView } from '@/views/partner/ProviderHomeView';

// PartnerLifecycleCanonPanel was removed during partner production-hardening.
// This suite pins the surviving state-aware action without restoring draft
// commercial lifecycle claims.
describe('Partner lifecycle canon surface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers one state-aware onboarding action for a verified zero-step state', async () => {
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
      expect(screen.getByText('Onboarding status')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Start onboarding/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review terms/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Set up payment/i })).not.toBeInTheDocument();
    expect(screen.getByText(/0\/4 verified steps/i)).toBeInTheDocument();
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
      // terms+privacy and the recorded program path complete -> 3 of 4 steps done.
      expect(screen.getByText(/3\/4 verified steps/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Continue onboarding/i })).toBeInTheDocument();
    expect(screen.getByText(/Current tier: professional/i)).toBeInTheDocument();
  });
});
