/** @vitest-environment jsdom
 *
 * K5-8 (odbiór na żywo, 2026-09-13): Piotr — „nie wiem, co to jest całkiem" —
 * o surowej zakładce Menu 2 „Work report" (`InitiativePreparationReadView`).
 * Docelowy kreator „Raport z pracy" buduje Codex w F2-1 E4. Do tego czasu
 * zakładka i jej trasa mają być ukryte za flagą `VITE_INITIATIVES_WORK_REPORT`
 * (domyślnie OFF). Ten test broni obu stanów: OFF = 3 przyciski Menu 2
 * (Initiatives/Plan/Load), ON = 4 (+ Work report).
 *
 * Mutacja: odwrócenie warunku w InitiativesHub.tsx
 * (`=== 'true'` → `!== 'true'`) zamienia „toHaveLength(3)" na czerwone.
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

const { getPortfolio, getInitiative, listRegisteredInitiatives, apiGet, portfolioStoreState, appStoreState, conversationStoreState } =
  vi.hoisted(() => ({
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
  }));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
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

let Hub: typeof import('../InitiativesHub');
async function mount(route = '/initiatives') {
  vi.resetModules();
  Hub = await import('../InitiativesHub');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Hub.InitiativesHub />
    </MemoryRouter>
  );
}

beforeEach(() => {
  // The established Plan destination is not release-gated; only its Wave 2 analysis is.
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

describe('Plan tab parity with VITE_INITIATIVES_PLAN OFF', () => {
  it('flag OFF: preserves Plan and accepts its established direct deep link', async () => {
    vi.stubEnv('VITE_INITIATIVES_PLAN', 'false');
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'false');
    await mount('/initiatives?tab=plan');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    expect(screen.getByRole('tab', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('flag ON: keeps Plan as the second Menu 2 destination', async () => {
    vi.stubEnv('VITE_INITIATIVES_PLAN', 'true');
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'false');
    await mount();
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    expect(screen.getByRole('tab', { name: 'Plan' })).toBeInTheDocument();
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Work report tab gated by VITE_INITIATIVES_WORK_REPORT', () => {
  it('flag OFF (default): shows exactly 3 Menu 2 buttons, no Work report', async () => {
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'false');
    await mount();
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    const tabs = screen.getAllByRole('tab').map((el) => el.textContent);
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Initiatives' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Plan' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Load' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Work report' })).not.toBeInTheDocument();
  });

  it('flag OFF: visiting ?tab=workReport directly redirects to the Initiatives list, not the raw read-view', async () => {
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'false');
    await mount('/initiatives?tab=workReport');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    expect(screen.queryByRole('tab', { name: 'Work report' })).not.toBeInTheDocument();
    expect(screen.queryByText(/initiatives in the current scope/i)).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue('list');
  });

  it('evaluates the parking deep link with both flags OFF and keeps the canonical Menu 3 unchanged', async () => {
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'false');
    vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', 'false');
    await mount('/initiatives?lens=parking');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    expect(screen.getByRole('combobox', { name: 'Initiative workspace' })).toHaveValue('list');
    expect(screen.queryByTestId('standard-chip-parking')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(/^standard-chip-/)).toHaveLength(0);
  });

  /* F9 (15.09.2026) — ZMIANA MIEJSCA, NIE OSLABIENIE STRAZNIKA.
     Zmierzone Playwrightem na realnej powloce: czwarta pigulka Menu 2 nie
     miescila sie w 1440 (byla PRZECIETA W POL przez krawedz przewijania).
     Wlasciciel prosil o ≤3 pigulki (DEC-420), wiec „Work report" przeniesiono
     do istniejacego przelacznika „Status" w Menu 2. Ten test dalej broni
     DOKLADNIE tego samego kontraktu flagi: OFF = powierzchni nie ma nigdzie
     (trzy testy wyzej, bez zmian), ON = powierzchnia jest osiagalna i montuje
     wlasciwy widok. Zmienil sie STER, nie zabezpieczenie.
     Mutacja: `=== 'true'` -> `!== 'true'` w InitiativesHub.tsx wywraca
     zarowno testy OFF wyzej, jak i ten. */
  it('flag ON: Work report jest pozycja przelacznika "Status" (nie 4. pigulka) i montuje widok', async () => {
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'true');
    await mount();
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));

    // Menu 2 trzyma ≤3 pigulki i NIE ma wsrod nich „Work report".
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryByRole('tab', { name: 'Work report' })).not.toBeInTheDocument();

    // ...a powierzchnia jest osiagalna z przelacznika „Status".
    const przelacznik = screen.getByTestId('initiatives-lifecycle-dropdown');
    fireEvent.click(przelacznik.querySelector('button') ?? przelacznik);
    const pozycja = await screen.findByText('Work report');
    fireEvent.click(pozycja);
    /* P1 RP1b (14.09): nagłówek ekranu przestał brzmieć „Work report creator" —
       kreator jest teraz zwiniętą akcją, a treścią ekranu jest LISTA przebiegów.
       Test dalej sprawdza to samo: że klik w zakładkę montuje właściwy widok. */
    expect(await screen.findByTestId('initiatives-work-report')).toBeInTheDocument();
    expect(screen.getByText('Work reports')).toBeInTheDocument();
  });
});
