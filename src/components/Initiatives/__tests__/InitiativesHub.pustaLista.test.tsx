/**
 * @vitest-environment jsdom
 *
 * PUSTA LISTA INICJATYW (07.09.2026) — bezpiecznik „API oddalo wiersze, wiec
 * lista NIE MA prawa byc pusta".
 *
 * Zgloszenie wlasciciela: „w inicjatywach jest pusto. Nie mam jak tam cokolwiek
 * zweryfikowac." Zmierzone: baza stagingu ma 97 wierszy dla jego organizacji,
 * `GET /api/initiatives` i `GET /api/initiatives/runtime-v1/initiatives`
 * odpowiadaja 200 — a tabela renderuje ZERO wierszy.
 *
 * Przyczyna: `toCanonicalInitiativeRegisterItem` czytalo `.status` z wyniku
 * `mapInitiativeStatus({ direction: 'runtime-to-status' })`, ktory dla wartosci
 * spoza 12-elementowego slownika zwraca `undefined`. Organizacja wlasciciela ma
 * w `ie_aggregate_state` agregat z `lifecycleState: 'EXECUTING'` (slownik
 * LEGACY, wyciekl do event store) — JEDEN taki wiersz rzucal TypeError w srodku
 * `.map()` w `InitiativesHub.fetchData`, wyjatek szedl do `catch`, a `catch`
 * ustawial `setInitiatives([])`. Jeden wiersz kasowal 97.
 *
 * Ten test trzyma dwa niezmienniki:
 *   1. wiersz runtime-v1 spoza slownika (`EXECUTING`) nie kasuje listy i sam
 *      tez jest widoczny (tlumaczony przez slownik LEGACY na IN_EXECUTION),
 *   2. wiersz runtime-v1 BEZ `lifecycleState` (NULL w bazie stagingu — realny
 *      ksztalt) rowniez nie kasuje listy.
 *
 * Mutacja potwierdzajaca (zmierzona przy tym dyzurze): przywrocenie w
 * `initiativeRegisterProjection.ts` starego zapisu
 *   `status: mapInitiativeStatus({ direction: 'runtime-to-status', lifecycle: … }).status`
 * wywraca oba testy na czerwono (0 wierszy zamiast 5).
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

/**
 * Fikstura odwzorowuje kształt danych, który wyprodukował rozjazd na żywo:
 * wiersze CLOSED/REJECTED (odcinane przez zakres „Aktywne"), wiersz spoza
 * bieżącego projektu (odcinany przez zakres rejestru) i wiersze aktywne.
 * Widoczny, aktywny zbiór to 4 wiersze — i tylko ta liczba ma prawo pojawić
 * się na ekranie.
 */

/** Wiersz tabeli klasycznej — dokladnie ten ksztalt oddaje `GET /api/initiatives`. */
const legacyRow = (id: string, status: string): Record<string, unknown> => ({
  id,
  name: `Inicjatywa ${id}`,
  status,
  projectId: 'proj-1',
  priority: 'MEDIUM',
  progress: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** Wiersz projekcji runtime-v1 (`ie_aggregate_state.payload_json`). */
const runtimeRow = (initiativeId: string, lifecycleState: unknown) => ({
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  initiative: {
    initiativeId,
    title: `Runtime ${initiativeId}`,
    problem: 'p',
    lifecycleState,
    priority: 'MEDIUM',
    projectId: 'proj-1',
    initiativeOwnerId: 'u1',
  },
});

const LEGACY_FIXTURE = [
  legacyRow('a1', 'DRAFT'),
  legacyRow('a2', 'DRAFT'),
  legacyRow('a3', 'IN_EXECUTION'),
  legacyRow('a4', 'PENDING_APPROVAL'),
];

beforeEach(() => {
  window.localStorage.clear();
  demoModeState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listLegacyInitiatives.mockReset();
  listLegacyInitiatives.mockResolvedValue(LEGACY_FIXTURE);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

const licznikPigulki = async (): Promise<number> => {
  const pigulka = await screen.findByTestId('initiatives-menu3-chip-all');
  const ostatnia = (pigulka.textContent ?? '').match(/(\d+)\s*$/);
  expect(ostatnia, `pigulka bez licznika: "${pigulka.textContent}"`).not.toBeNull();
  return Number(ostatnia![1]);
};

describe('InitiativesHub — niepuste API nie ma prawa dac pustej listy', () => {
  it('wiersz runtime-v1 ze statusem spoza slownika (EXECUTING) nie kasuje rejestru', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [runtimeRow('r-executing', 'EXECUTING')],
    });

    render(
      <MemoryRouter initialEntries={['/initiatives']}>
        <InitiativesHub />
      </MemoryRouter>
    );
    await screen.findByTestId('initiatives-hub');

    // 4 wiersze klasyczne + 1 runtime — zaden nie znika przez nieznany slownik.
    expect(await screen.findByText('Inicjatywa a1')).toBeTruthy();
    expect(screen.getByText('Runtime r-executing')).toBeTruthy();
    expect(await licznikPigulki()).toBe(5);
  });

  it('wiersz runtime-v1 BEZ lifecycleState nie kasuje rejestru', async () => {
    listRegisteredInitiatives.mockResolvedValue({
      initiatives: [runtimeRow('r-null', null)],
    });

    render(
      <MemoryRouter initialEntries={['/initiatives']}>
        <InitiativesHub />
      </MemoryRouter>
    );
    await screen.findByTestId('initiatives-hub');

    expect(await screen.findByText('Inicjatywa a1')).toBeTruthy();
    expect(await licznikPigulki()).toBe(5);
  });
});
