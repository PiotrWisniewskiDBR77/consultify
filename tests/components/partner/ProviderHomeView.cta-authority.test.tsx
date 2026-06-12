/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';

const tMock = (key: string, fallbackOrOptions?: string | Record<string, unknown>, maybeOptions?: Record<string, unknown>) => {
  const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined;
  const options =
    typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null
      ? fallbackOrOptions
      : maybeOptions;

  if (options?.returnObjects) {
    return ['Mock item A', 'Mock item B'];
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
  shouldFallbackToLegacyPartner: () => false,
}));

import { V8PartnerApi } from '@/services/api/v8';
import { ROUTES } from '@/routes/routeConfig';
import { ProviderHomeView } from '@/views/partner/ProviderHomeView';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

describe('ProviderHomeView CTA authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('routes incomplete onboarding CTAs to the partner-specific onboarding entry', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
        <LocationProbe />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Review terms' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review terms' }));

    expect(screen.getByTestId('location-probe')).toHaveTextContent(ROUTES.PARTNER.ONBOARDING);
  });

  it('uses honest hero CTAs for onboarding and partner docs', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Open onboarding' })[0]);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(ROUTES.PARTNER.ONBOARDING);

    fireEvent.click(screen.getByRole('button', { name: 'Open partner docs' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/docs/consultify-partner-program/partner-program-overview'
    );
  });

  it('shows the shared partner lifecycle canon inside onboarding surfaces', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Get Started in 10 Minutes')).toBeInTheDocument();
    });

    expect(screen.getByText('Otwórz przewodnik aplikacji')).toBeInTheDocument();
    expect(screen.getByText('Zobacz case potwierdzający')).toBeInTheDocument();
    expect(screen.getByText('Your Path to Partnership Success')).toBeInTheDocument();
  });
});
