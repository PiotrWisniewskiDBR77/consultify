/**
 * @vitest-environment jsdom
 *
 * RP3 (wiersz planu 17, DEC-543, 17.09.2026): atrapa `InitiativePreparationReadView`
 * usunięta razem z gałęzią „PARYTET OFF" w `InitiativesHub`. Pomiar decyzyjny:
 * staging ma `VITE_INITIATIVES_FOUR_BUTTONS:"true"` wbite w zbudowany bundle
 * (env obiekt w `index-*.js`, gitSha ba0e600b12), więc stan OFF nie istnieje na
 * stagingu, a bundler wyciął atrapę z dostarczonego chunka `InitiativesHub-*.js`
 * (zero jej literałów). Przy fladze OFF soczewka „Analysis" ma teraz pokazywać
 * kanoniczny rejestr — tę samą powierzchnię, co soczewka „List".
 *
 * Mutacja: przywrócenie gałęzi OFF i pliku atrapy (stan sprzed RP3) wywraca
 * pierwszy test na czerwono — region „Preparation overview" wraca do DOM.
 */
import { render, screen, waitFor } from '@testing-library/react';
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

const {
  getPortfolio,
  getInitiative,
  listRegisteredInitiatives,
  listLegacyInitiatives,
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
  fourButtonsFlagState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
  listLegacyInitiatives: vi.fn(),
  apiGet: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
  fourButtonsFlagState: { enabled: false },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
  listLegacyInitiatives,
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio,
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
    getProjects: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: () => null,
}));

vi.mock('../InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => React.createElement('div', { 'data-testid': 'legacy-initiative' }),
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

vi.mock('@/utils/initiativesFourButtonsFlag', () => ({
  isInitiativesFourButtonsEnabled: () => fourButtonsFlagState.enabled,
}));

import { InitiativesHub } from '../InitiativesHub';

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <InitiativesHub />
    </MemoryRouter>
  );

const registered = (id: string, title: string, lifecycleState: string) => ({
  version: 1,
  updatedAt: '2026-09-13T00:00:00.000Z',
  initiative: {
    initiativeId: id,
    lifecycleState,
    title,
    priority: 'MEDIUM',
    projectId: 'proj-1',
    readiness: 'NOT_EVALUATED',
  },
});

beforeEach(() => {
  window.localStorage.clear();
  fourButtonsFlagState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({
    initiatives: [registered('rp3-row-1', 'rp3-register-row', 'SCHEDULED')],
  });
  listLegacyInitiatives.mockReset();
  listLegacyInitiatives.mockResolvedValue([]);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RP3 — atrapa InitiativePreparationReadView usunięta', () => {
  it('flag OFF: soczewka „Analysis" nie renderuje atrapy, tylko kanoniczny rejestr', async () => {
    renderHubAt('/initiatives?lens=analysis');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    // Soczewka faktycznie stoi na „Analysis" — to dokładnie ten stan, w którym
    // przed RP3 montowała się atrapa.
    expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue(
      'analysis'
    );

    // Atrapy nie ma w DOM: ani jej region, ani jej zdania.
    expect(screen.queryByRole('region', { name: 'Preparation overview' })).toBeNull();
    expect(screen.queryByText(/initiatives in the current scope/i)).toBeNull();

    // Zamiast niej — kanoniczny rejestr z tym samym wierszem, co soczewka „List".
    expect(await screen.findByText('rp3-register-row')).toBeInTheDocument();
  });

  it('flag OFF: soczewki „Analysis" i „List" pokazują tę samą powierzchnię rejestru', async () => {
    const analysis = renderHubAt('/initiatives?lens=analysis');
    expect(await screen.findByText('rp3-register-row')).toBeInTheDocument();
    const analysisHtml = screen.getByText('rp3-register-row').closest('table')?.outerHTML;
    analysis.unmount();

    const list = renderHubAt('/initiatives?lens=list');
    expect(await screen.findByText('rp3-register-row')).toBeInTheDocument();
    const listHtml = screen.getByText('rp3-register-row').closest('table')?.outerHTML;
    list.unmount();

    expect(analysisHtml).toBeTruthy();
    expect(analysisHtml).toBe(listHtml);
  });
});
