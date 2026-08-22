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

  it('routes the one state-aware primary CTA to partner onboarding', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start application' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Start application' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(ROUTES.PARTNER.ONBOARDING);
    });
  });

  it('keeps the hero educational and routes documentation to the canonical guide', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Choose your partner path' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /discuss custom terms/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open documentation' }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/docs/consultify-partner-program/partner-program-overview'
      );
    });
  });

  it('does not reintroduce the legacy tier and payout lifecycle narrative', async () => {
    render(
      <MemoryRouter initialEntries={['/partner']}>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Application and onboarding')).toBeInTheDocument();
    });

    expect(screen.queryByText('Partner lifecycle canon')).toBeNull();
    expect(screen.queryByText(/Finish workspace and payouts/i)).toBeNull();
    expect(screen.getByText('Commercial schedule: decision required')).toBeInTheDocument();
  });
});
