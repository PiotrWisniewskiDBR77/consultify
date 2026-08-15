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
      if (k === 'initiatives.form.newInitiative') return 'New Initiative';
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

const {
  getPortfolio,
  listRegisteredInitiatives,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listRegisteredInitiatives,
}));

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
  useConversationStore: (selector: (state: typeof conversationStoreState) => unknown) =>
    selector(conversationStoreState),
}));

vi.mock('../../../store/portfolioSlice', () => ({
  usePortfolioStore: (selector: (state: typeof portfolioStoreState) => unknown) =>
    selector(portfolioStoreState),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => appStoreState,
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
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
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
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [
        {
          version: 1,
          updatedAt: '2026-08-15T10:00:00.000Z',
          initiative: {
            initiativeId: 'init-1',
            lifecycleState: 'DEFINED',
            title: 'Automate Onboarding',
            problem: 'Reduce onboarding lead time',
            projectId: 'proj-1',
            readiness: 'NOT_EVALUATED',
            source: {
              proposalId: 'proposal-1',
              proposalVersion: 1,
              sourceType: 'tool_output',
              sourceId: 'source-1',
              sourceVersion: 1,
            },
          },
        },
      ],
    });
    renderHub();
    await waitFor(() => {
      expect(screen.getByText('Automate Onboarding')).toBeInTheDocument();
    });
  });

  it('exposes the canonical "New Initiative" CTA and opens the wizard in default table view', async () => {
    renderHub();
    await waitFor(() => expect(screen.getByTestId('initiatives-hub')).toBeInTheDocument());
    const [primaryWizardButton] = await screen.findAllByRole('button', {
      name: 'New Initiative',
    });
    fireEvent.click(primaryWizardButton);
    await waitFor(() => {
      expect(screen.getByTestId('initiative-wizard-modal')).toBeInTheDocument();
    });
  });
});
