/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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

describe('ProviderHomeView CTA authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
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
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Review terms' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Review terms' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.PARTNER.ONBOARDING);
    });
  });

  it('uses honest hero CTAs for onboarding and partner docs', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Open onboarding' })[0]);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.PARTNER.ONBOARDING);
    });

    mockNavigate.mockReset();
    fireEvent.click(screen.getByRole('button', { name: 'Open partner docs' }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/docs/consultify-partner-program/partner-program-overview'
      );
    });
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
