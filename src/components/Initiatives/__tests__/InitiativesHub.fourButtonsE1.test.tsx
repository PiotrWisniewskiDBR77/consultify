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

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => {
  const t = (k: string, opts?: any) => {
    if (typeof opts === 'string') return opts;
    if (opts?.defaultValue) return opts.defaultValue;
    return k;
  };
  return {
    useTranslation: () => ({
      t,
      i18n: { language: 'pl' },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  };
});

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const {
  getPortfolio,
  getInitiative,
  listRegisteredInitiatives,
  listLegacyInitiatives,
  createPortfolioAnalysis,
  readPortfolioAnalysis,
  listPortfolioScenarioRegister,
  listGovernedOrganizationContextVersions,
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
  demoModeState,
  fourButtonsFlagState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
  listLegacyInitiatives: vi.fn(),
  createPortfolioAnalysis: vi.fn(),
  readPortfolioAnalysis: vi.fn(),
  listPortfolioScenarioRegister: vi.fn(),
  listGovernedOrganizationContextVersions: vi.fn(),
  apiGet: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
  demoModeState: { enabled: false },
  fourButtonsFlagState: { enabled: true },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
  listLegacyInitiatives,
  createPortfolioAnalysis,
  readPortfolioAnalysis,
  listPortfolioScenarioRegister,
  listGovernedOrganizationContextVersions,
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
    /* F9 (15.09.2026): filtr projektow dociaga KATALOG NAZW, zeby nie drukowac
       surowych UUID. Atrapa musi go miec, inaczej test mierzy atrape (brak
       metody), a nie produkt. */
    getProjects: vi.fn(async () => []),
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

beforeEach(() => {
  window.localStorage.clear();
  appStoreState.currentOrganization = { id: 'org-1' };
  demoModeState.enabled = false;
  fourButtonsFlagState.enabled = true;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  listLegacyInitiatives.mockReset();
  listLegacyInitiatives.mockResolvedValue([]);
  createPortfolioAnalysis.mockReset();
  readPortfolioAnalysis.mockReset();
  listPortfolioScenarioRegister.mockReset();
  listPortfolioScenarioRegister.mockResolvedValue({ scenarios: [] });
  listGovernedOrganizationContextVersions.mockReset();
  listGovernedOrganizationContextVersions.mockResolvedValue([]);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('F2-1 E1 four-button Initiatives navigation', () => {
  const registered = (id: string, title: string, lifecycleState: string, projectId: string) => ({
    version: 1,
    updatedAt: '2026-09-13T00:00:00.000Z',
    initiative: {
      initiativeId: id,
      lifecycleState,
      title,
      priority: 'MEDIUM',
      projectId,
      readiness: 'NOT_EVALUATED',
    },
  });

  // A2 (DEC-498 §1) dolozylo TRZECIA soczewke Menu 3 — „Parking". Kanon TRIADY
  // dopuszcza najwyzej 3 pigulki, wiec to jest gorna granica: kolejna pozycja
  // musi isc do dropdownu Menu 2, nie do rzedu Menu 3.
  it('renders exactly three Menu 3 lenses as buttons and keeps project/current/archive in filters', async () => {
    renderHubAt('/initiatives?lens=list');
    await screen.findByTestId('initiatives-hub');

    const menu2 = screen.getByRole('tablist', { name: 'Module sections' });
    expect(
      within(menu2)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Initiatives', 'Plan', 'Load']);
    const chips = screen.getAllByTestId(/^standard-chip-/);
    expect(chips).toHaveLength(3);
    expect(screen.getByTestId('standard-chip-list')).toHaveTextContent('Initiative list');
    expect(screen.getByTestId('standard-chip-analysis')).toHaveTextContent('Initiative analysis');
    expect(screen.getByTestId('standard-chip-parking')).toHaveTextContent('Parking');
    expect(screen.queryByRole('combobox', { name: 'Initiative workspace' })).toBeNull();
    expect(screen.getByTestId('initiatives-project-filter')).toBeInTheDocument();
    expect(screen.getByTestId('initiatives-archive-scope')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kanban' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gantt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('filters the mounted register by project and keeps the status denominator aligned', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [
        registered('project-a-row', 'Project A initiative', 'SCHEDULED', 'project-a'),
        registered('project-b-row', 'Project B initiative', 'SCHEDULED', 'project-b'),
      ],
    });
    renderHubAt('/initiatives?lens=list');

    expect(await screen.findByText('Project A initiative')).toBeInTheDocument();
    expect(screen.getByText('Project B initiative')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('initiatives-project-filter'), {
      target: { value: 'project-a' },
    });
    await waitFor(() => expect(screen.queryByText('Project B initiative')).toBeNull());
    expect(screen.getByText('Project A initiative')).toBeInTheDocument();

    const statusDropdown = screen.getByTestId('initiatives-lifecycle-dropdown');
    fireEvent.click(within(statusDropdown).getByRole('button'));
    const options = within(statusDropdown).getAllByRole('option');
    expect(options[0]).toHaveTextContent('1');
    expect(
      options.slice(1).reduce((sum, option) => {
        const count = Number(option.textContent?.match(/\d+$/)?.[0] ?? 0);
        return sum + count;
      }, 0)
    ).toBe(1);
  });

  it('preserves the legacy workspace copy and controls when the flag is off', async () => {
    fourButtonsFlagState.enabled = false;
    renderHubAt('/initiatives?lens=list');
    await screen.findByTestId('initiatives-hub');

    const workspace = screen.getByRole('combobox', { name: 'Initiative workspace' });
    expect(workspace).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Analysis' })).toBeInTheDocument();
    expect(screen.queryByTestId('initiatives-project-filter')).toBeNull();
    expect(screen.queryByTestId('initiatives-archive-scope')).toBeNull();
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gantt' })).toBeNull();
  });

  it('preserves the legacy lens alias while switching the mounted workspace from Menu 3', async () => {
    renderHubAt('/initiatives?lens=portfolio');
    await screen.findByTestId('initiatives-hub');
    expect(screen.getByTestId('standard-chip-analysis')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Initiative analysis' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('standard-chip-list'));
    expect(await screen.findByTestId('standard-chip-list')).toHaveAttribute('aria-pressed', 'true');
  });

  it('routes the enabled analysis lens to the governed Table and Preview workspace', async () => {
    renderHubAt('/initiatives?lens=analysis');
    await screen.findByTestId('initiatives-analysis-table');

    expect(screen.queryByRole('region', { name: 'Preparation overview' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Run portfolio analysis' })).toBeInTheDocument();
  });

  it('shows current and archived canonical rows in mutually exclusive register scopes', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [
        registered('current-1', 'Current initiative', 'SCHEDULED', 'project-a'),
        registered('archive-1', 'Archived initiative', 'ARCHIVED', 'project-b'),
      ],
    });
    listLegacyInitiatives.mockResolvedValue([
      {
        id: 'legacy-current-1',
        name: 'Current legacy initiative',
        status: 'APPROVED',
        archived: false,
        projectId: 'project-a',
      },
      {
        id: 'legacy-archive-1',
        name: 'Archived legacy initiative',
        status: 'CLOSED',
        archived: true,
        projectId: 'project-b',
      },
    ]);
    renderHubAt('/initiatives?lens=list');

    expect(await screen.findByText('Current initiative')).toBeInTheDocument();
    expect(screen.getByText('Current legacy initiative')).toBeInTheDocument();
    expect(screen.queryByText('Archived initiative')).toBeNull();
    expect(screen.queryByText('Archived legacy initiative')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Archive' }));
    expect(await screen.findByText('Archived initiative')).toBeInTheDocument();
    expect(screen.getByText('Archived legacy initiative')).toBeInTheDocument();
    expect(screen.queryByText('Current initiative')).toBeNull();
    expect(screen.queryByText('Current legacy initiative')).toBeNull();
  });

  it('ignores a delayed register response after the organization identity changes', async () => {
    const delayedOrgAResolvers: Array<(value: unknown) => void> = [];
    listRegisteredInitiatives.mockImplementation(() => {
      if (appStoreState.currentOrganization.id === 'org-2') {
        return Promise.resolve({
          initiatives: [registered('org-b', 'Organization B initiative', 'SCHEDULED', 'project-b')],
        });
      }
      return new Promise((resolve) => delayedOrgAResolvers.push(resolve));
    });
    const view = renderHubAt('/initiatives?lens=list');
    await waitFor(() => expect(delayedOrgAResolvers.length).toBeGreaterThan(0));

    appStoreState.currentOrganization = { id: 'org-2' };
    view.rerender(
      <MemoryRouter initialEntries={['/initiatives?lens=list']}>
        <InitiativesHub />
      </MemoryRouter>
    );
    expect(await screen.findByText('Organization B initiative')).toBeInTheDocument();
    delayedOrgAResolvers.forEach((resolve) =>
      resolve({
        initiatives: [registered('org-a', 'Organization A initiative', 'SCHEDULED', 'project-a')],
      })
    );
    await Promise.resolve();
    expect(screen.queryByText('Organization A initiative')).toBeNull();
  });
});
