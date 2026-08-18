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
  getInitiative,
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  apiGet: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio: getPortfolio,
    getPendingDecisions: vi.fn(async () => []),
    getInitiativeSnapshot: vi.fn(async () => null),
    getInitiative,
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
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
  InitiativeWizardModal: ({ isOpen, onCreated }: { isOpen: boolean; onCreated: Function }) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'initiative-wizard-modal' },
          React.createElement(
            'button',
            {
              onClick: () => onCreated([{ id: 'fresh-1', name: 'Fresh draft', status: 'DRAFT' }]),
            },
            'Complete wizard'
          )
        )
      : null,
}));

vi.mock('../InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => React.createElement('div', { 'data-testid': 'legacy-initiative' }),
}));

vi.mock('../CanonicalInitiativeCardWorkspace', () => ({
  CanonicalInitiativeCardWorkspace: () =>
    React.createElement('div', { 'data-testid': 'canonical-initiative' }),
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

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <InitiativesHub />
    </MemoryRouter>
  );

beforeEach(() => {
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
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

  it('opens a wizard-created draft in the persisted initiative document, not unregistered runtime', async () => {
    renderHub();
    const [primaryWizardButton] = await screen.findAllByRole('button', { name: 'New Initiative' });
    fireEvent.click(primaryWizardButton);
    fireEvent.click(await screen.findByRole('button', { name: 'Complete wizard' }));

    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-initiative')).not.toBeInTheDocument();
  });

  it('opens a legacy deep link in the persisted document and a registered V8 deep link in the canonical card', async () => {
    apiGet.mockResolvedValueOnce({ id: 'legacy-1', name: 'Legacy persisted', status: 'DRAFT' });
    const legacy = renderHubAt('/initiatives?open=legacy-1&mode=doc');
    expect(await screen.findByTestId('legacy-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('canonical-initiative')).not.toBeInTheDocument();
    legacy.unmount();

    getInitiative.mockResolvedValueOnce({
      initiative: { id: 'runtime-1', name: 'Registered runtime', status: 'DRAFT' },
    });
    renderHubAt('/initiatives?open=runtime-1&mode=doc');
    expect(await screen.findByTestId('canonical-initiative')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-initiative')).not.toBeInTheDocument();
  });
});
