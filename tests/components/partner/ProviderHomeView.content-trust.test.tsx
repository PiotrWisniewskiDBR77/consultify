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

const locale = vi.hoisted(() => ({ language: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { get language() { return locale.language; } },
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
    locale.language = 'en';
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

  it('implements roving keyboard navigation and a stable tabpanel relationship', () => {
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    const first = screen.getByRole('tab', { name: 'Consulting Owner' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    const second = screen.getByRole('tab', { name: 'Individual Consultant' });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(second).toHaveAttribute('aria-controls', 'partner-path-panel');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', second.id);

    fireEvent.keyDown(second, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Financial Institution' })).toHaveFocus();
  });

  it('renders the governed core narrative in Polish when Polish is active', async () => {
    locale.language = 'pl';
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /Zbuduj pierwszą wspólną szansę/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Instytucja finansowa' })).toBeInTheDocument();
    expect(screen.getByText('Pięć modeli współpracy')).toBeInTheDocument();
    expect(screen.getByText('Pierwsza wspólna transakcja')).toBeInTheDocument();
    expect(screen.getByText('Zabezpieczenia i FAQ')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/potwierdzonych kroków/i)).toBeInTheDocument());
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
