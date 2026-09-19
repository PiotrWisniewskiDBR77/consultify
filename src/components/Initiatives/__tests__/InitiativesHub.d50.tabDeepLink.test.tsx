/** @vitest-environment jsdom
 *
 * D-50 (Wpis 165, dług QA15): adres `/initiatives?tab=workReport` jest
 * ignorowany, gdy przechodzimy na niego KLIENTEM (React Router `navigate`/
 * `Link`), a nie pełnym przeładowaniem strony. Przyczyna zmierzona w
 * InitiativesHub.tsx: `activeTab` czyta `?tab=` TYLKO w inicjalizatorze
 * `useState` przy montowaniu (linia ~363) i w nasłuchu `popstate` (linia
 * ~1796). Klientowa nawigacja do tej samej trasy NIE remountuje komponentu
 * i NIE odpala `popstate`, więc `?tab=` w adresie nie zmienia zakładki.
 *
 * Ten test montuje REALNY `InitiativesHub` w `MemoryRouter` obok przycisku,
 * który robi klientowy `navigate('/initiatives?tab=...')`, i asertuje, że
 * zakładka faktycznie się przełącza (stan UI, nie lustro).
 *
 * Mutacja: usunięcie efektu synchronizacji `?tab=` -> `activeTab`
 * (`lastSyncedTabParamRef` w InitiativesHub.tsx) wraca te testy na czerwone.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
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
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
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

// Przyciski robiące KLIENTOWY `navigate` (bez `popstate`, bez przeładowania) —
// dokładnie ta ścieżka, którą D-50 gubi.
function NavControls() {
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate('/initiatives?tab=plan')}>go-plan</button>
      <button onClick={() => navigate('/initiatives?tab=workReport')}>go-workreport</button>
    </div>
  );
}

async function mountWithNav(route = '/initiatives') {
  vi.resetModules();
  const Hub = await import('../InitiativesHub');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <NavControls />
      <Hub.InitiativesHub />
    </MemoryRouter>
  );
}

beforeEach(() => {
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
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('D-50 — client-side navigation to /initiatives?tab= switches the tab', () => {
  it('plan: klientowy navigate na ?tab=plan przełącza zakładkę (bez popstate)', async () => {
    await mountWithNav('/initiatives');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    // Start: lista (Initiatives), Plan NIE wybrany.
    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'go-plan' }));

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true')
    );
  });

  it('workReport (flag ON): klientowy navigate na ?tab=workReport montuje widok raportu', async () => {
    vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'true');
    await mountWithNav('/initiatives');
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
    expect(screen.queryByTestId('initiatives-work-report')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'go-workreport' }));

    expect(await screen.findByTestId('initiatives-work-report')).toBeInTheDocument();
  });
});
