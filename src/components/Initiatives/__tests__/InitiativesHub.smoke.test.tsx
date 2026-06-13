/**
 * @vitest-environment jsdom
 *
 * Smoke tests for InitiativesHub (Module 05 — Inicjatywy).
 * Mocks the V8 planning / economics services so the hub mounts deterministically
 * offline. Asserts: the empty portfolio renders the honest empty state, a
 * populated portfolio renders the initiative, and the "New Initiative" CTA opens
 * the create modal.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio: getPortfolio,
    getPendingDecisions: vi.fn(async () => []),
    getInitiativeSnapshot: vi.fn(async () => null),
    getInitiative: vi.fn(async () => null),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getUsers: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'initiative-wizard-modal' }) : null,
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: () => ({}),
}));

vi.mock('../../../store/portfolioSlice', () => ({
  usePortfolioStore: () => ({ filters: {}, setFilters: vi.fn() }),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
  }),
}));

import { InitiativesHub } from '../InitiativesHub';

const renderHub = () =>
  render(
    <MemoryRouter initialEntries={['/initiatives']}>
      <InitiativesHub />
    </MemoryRouter>
  );

beforeEach(() => {
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InitiativesHub smoke', () => {
  it('mounts and renders the hub shell with an empty portfolio', async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByTestId('initiatives-hub')).toBeInTheDocument();
    });
  });

  it('renders an initiative card when the portfolio has one initiative', async () => {
    getPortfolio.mockResolvedValue({
      initiatives: [
        {
          id: 'init-1',
          name: 'Automate Onboarding',
          status: 'REVIEW', // in the default "active" scope so it isn't filtered out
          priority: 'high',
        },
      ],
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('Automate Onboarding')).toBeInTheDocument();
    });
  });

  it('exposes the "AI Initiative Wizard" CTA and opens the wizard modal on click', async () => {
    renderHub();
    await waitFor(() => expect(screen.getByTestId('initiatives-hub')).toBeInTheDocument());
    const wizardBtn = await screen.findByText('AI Initiative Wizard');
    fireEvent.click(wizardBtn);
    await waitFor(() => {
      expect(screen.getByTestId('initiative-wizard-modal')).toBeInTheDocument();
    });
  });
});
