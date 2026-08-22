/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderHomeView from '@/views/partner/ProviderHomeView';
import {
  COOPERATION_MODELS,
  FIRST_DEAL_STAGES,
  PARTNER_AUDIENCES,
  PROHIBITED_PARTNER_MARKETING_STRINGS,
} from '@/views/partner/partnerProgramContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({ Api: { get: vi.fn() } }));
vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: { getOnboardingStatus: vi.fn() },
  shouldFallbackToLegacyPartner: () => false,
}));

import { V8PartnerApi } from '@/services/api/v8';

describe('ProviderHomeView PAR-OWN-001 content trust', () => {
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

  it('renders all six partner paths and switches to a role-specific contribution split', async () => {
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(PARTNER_AUDIENCES.length);
    for (const audience of PARTNER_AUDIENCES) {
      expect(screen.getByRole('tab', { name: audience.label })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole('tab', { name: 'Financial Institution' }));
    const detail = screen.getByTestId('partner-audience-detail');
    expect(within(detail).getByText('Financial Institution')).toBeInTheDocument();
    expect(within(detail).getByText(/Validate compliance, client ownership/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/verified steps/i)).toBeInTheDocument());
  });

  it('renders five models and the ordered six-stage first-deal journey', async () => {
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    for (const model of COOPERATION_MODELS) {
      expect(screen.getAllByText(model.label).length).toBeGreaterThan(0);
    }
    for (const stage of FIRST_DEAL_STAGES) {
      expect(screen.getByText(stage.label)).toBeInTheDocument();
      expect(screen.getByText(stage.output)).toBeInTheDocument();
    }
    await waitFor(() => expect(screen.getByText(/verified steps/i)).toBeInTheDocument());
  });

  it('does not publish fictional proof or unapproved commercial strings', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );
    const visibleCopy = container.textContent || '';

    for (const forbidden of PROHIBITED_PARTNER_MARKETING_STRINGS) {
      expect(visibleCopy).not.toContain(forbidden);
    }
    expect(visibleCopy).not.toMatch(/\b(?:10|12|14|20)%\b/);
    expect(screen.getByText('No publishable reference yet')).toBeInTheDocument();
    expect(screen.getByText('Economics unavailable in this workspace')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/verified steps/i)).toBeInTheDocument());
  });
});
