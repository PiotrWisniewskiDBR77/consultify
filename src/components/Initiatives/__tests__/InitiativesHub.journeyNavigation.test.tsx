/**
 * @vitest-environment jsdom
 *
 * DEC-420 (właściciel, 06.09.2026, 3 zrzuty Inicjatyw): „Trzecie menu ma za
 * dużo przycisków — ogranicz je do dwóch lub trzech." Bezpiecznik: każda z
 * trzech zakładek (Inicjatywy/Plan/Obciążenie) renderuje ≤3 chipy w Menu 3
 * i dokładnie jeden dropdown filtra w Menu 2.
 *
 * Mutacja: przywrócenie pełnej listy 8 chipów cyklu życia (zamiast
 * `menu3LifecyclePresets` filtrowanej do `KEPT_LIFECYCLE_MENU3_IDS`) w
 * `InitiativesHub.tsx` wywraca test „Inicjatywy" na czerwono — zmierzone
 * ręcznie 06.09.2026 przy tym dyżurze (patrz meldunek).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
vi.unmock('react-router-dom');
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
  demoModeState,
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
  demoModeState: { enabled: false },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
  listLegacyInitiatives,
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
  shouldAllowDemoData: () => demoModeState.enabled,
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

import { InitiativesHub } from '../InitiativesHub';

const renderHubAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <InitiativesHub />
    </MemoryRouter>
  );

beforeEach(() => {
  window.localStorage.clear();
  demoModeState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({
    initiatives: [
      {
        version: 1,
        updatedAt: '2026-09-13T00:00:00.000Z',
        initiative: {
          initiativeId: 'ie01-row-1',
          lifecycleState: 'SCHEDULED',
          title: 'ie01-register-row',
          priority: 'MEDIUM',
          projectId: 'proj-1',
          readiness: 'NOT_EVALUATED',
        },
      },
    ],
  });
  listLegacyInitiatives.mockReset();
  listLegacyInitiatives.mockResolvedValue([]);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('IE01 preparation navigation', () => {
  it('renders exactly three stable module destinations by default (Work report gated behind VITE_INITIATIVES_FOUR_BUTTONS, K5-8), with the workspace lens inside Initiatives and no dead "Analysis" entry (D-76)', async () => {
    renderHubAt('/initiatives');
    await screen.findByRole('combobox', { name: 'Initiative workspace' });
    expect(screen.queryByRole('tab', { name: 'Work report' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue('list');
    fireEvent.change(screen.getByRole('combobox', { name: 'Initiative workspace' }), {
      target: { value: 'analysis' },
    });
    // RP3 (DEC-543): atrapa `InitiativePreparationReadView` usunięta — soczewka
    // „Analysis" przy fladze OFF pokazuje kanoniczny rejestr, nie „Preparation overview".
    expect(await screen.findByText('ie01-register-row')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Preparation overview' })).toBeNull();
    // D-76 (W1): „Analysis" nie jest już wartością do wybrania — próba nie może
    // zostawić pustego pola, selektor wraca na istniejącą opcję.
    expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue('list');
  });
});

it('restores the preparation lens in both directions through router history', async () => {
  function HistoryControls() {
    const navigate = useNavigate();
    const location = useLocation();
    return (
      <>
        <button onClick={() => navigate(1)}>→</button>
        <button onClick={() => navigate(-1)}>←</button>
        <span data-testid="loc">{location.search}</span>
      </>
    );
  }
  render(<MemoryRouter initialEntries={['/initiatives?lens=list','/initiatives?lens=analysis']} initialIndex={0}><HistoryControls/><InitiativesHub/></MemoryRouter>);
  expect(await screen.findByRole('combobox', {name:'Initiative workspace'})).toHaveValue('list');
  fireEvent.click(screen.getByRole('button',{name:'→'}));
  // D-76 (W1): pozycji „Analysis" w selektorze już nie ma, ale alias w URL żyje —
  // adres stoi na `?lens=analysis`, a pole pokazuje „List".
  await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('?lens=analysis'));
  expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue('list');
  expect(await screen.findByText('ie01-register-row')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Preparation overview' })).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'←'}));
  await waitFor(() => expect(screen.getByRole('combobox', {name:'Initiative workspace'})).toHaveValue('list'));
});
