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

import { render, screen } from '@testing-library/react';
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
    i18n: { language: 'pl' },
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
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
  demoModeState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
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
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InitiativesHub — Menu 3 ograniczone do ≤3 chipów + dropdown Menu 2 (DEC-420)', () => {
  it('zakładka Inicjatywy: dokładnie 3 chipy cyklu życia w Menu 3 + jeden dropdown "Cykl życia" w Menu 2', async () => {
    renderHubAt('/initiatives');
    await screen.findByTestId('initiatives-hub');

    const chips = screen.getAllByTestId(/^initiatives-menu3-chip-/);
    expect(chips).toHaveLength(3);
    expect(screen.getByTestId('initiatives-menu3-chip-all')).toBeInTheDocument();
    expect(screen.getByTestId('initiatives-menu3-chip-DECISION')).toBeInTheDocument();
    expect(screen.getByTestId('initiatives-menu3-chip-IN_EXECUTION')).toBeInTheDocument();

    expect(screen.getByTestId('initiatives-lifecycle-dropdown')).toBeInTheDocument();
  });

  it('zakładka Plan: dokładnie 3 chipy w Menu 3 + jeden dropdown "Stan planu" w Menu 2', async () => {
    renderHubAt('/initiatives?tab=plan');
    await screen.findByTestId('initiatives-hub');

    const chips = screen.getAllByTestId(/^standard-chip-/);
    expect(chips).toHaveLength(3);
    expect(screen.getByTestId('standard-chip-unscheduled')).toBeInTheDocument();
    expect(screen.getByTestId('standard-chip-conflicted')).toBeInTheDocument();
    expect(screen.getByTestId('standard-chip-published')).toBeInTheDocument();

    expect(screen.getByTestId('initiatives-plan-state-dropdown')).toBeInTheDocument();
  });

  it('zakładka Obciążenie: dokładnie 3 chipy w Menu 3 + jeden dropdown "Ograniczenie" w Menu 2', async () => {
    renderHubAt('/initiatives?tab=capacity');
    await screen.findByTestId('initiatives-hub');

    const chips = screen.getAllByTestId(/^standard-chip-/);
    expect(chips).toHaveLength(3);
    expect(screen.getByTestId('standard-chip-all')).toBeInTheDocument();
    expect(screen.getByTestId('standard-chip-critical')).toBeInTheDocument();
    expect(screen.getByTestId('standard-chip-unconfirmed')).toBeInTheDocument();

    expect(screen.getByTestId('initiatives-capacity-constraint-dropdown')).toBeInTheDocument();
  });
});
