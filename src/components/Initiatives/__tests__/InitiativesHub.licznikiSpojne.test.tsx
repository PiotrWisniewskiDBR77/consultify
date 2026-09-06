/**
 * @vitest-environment jsdom
 *
 * ODMROZENIE 05_INITIATIVES (06.09.2026) — bezpiecznik „jedna liczba, jeden zbiór".
 *
 * Zmierzone PRZED naprawą na jednym kadrze `/initiatives` (org DBR77, zakres
 * „Aktywne"): Menu 2 „Status: Wszystkie 72", pigułka Menu 3 „Wszystkie 63",
 * suma pozycji statusów w rozwiniętym dropdownie 60. Trzy różne liczby tego
 * samego zbioru w jednym kadrze, bo liczyły je trzy niezależne wyrażenia na
 * trzech różnych podstawach.
 *
 * Ten test trzyma niezmiennik: pigułka „Wszystkie" w Menu 3 == wartość przy
 * przycisku „Status" w Menu 2 == suma pozycji statusów w rozwiniętej liście.
 *
 * Mutacja (zmierzona ręcznie przy tym dyżurze): przywrócenie
 * `{ id: 'all', ..., count: allInitiatives.length }` w `lifecycleDropdownOptions`
 * (zamiast `statusCounts.all`) wywraca ten test na czerwono — dropdown pokazuje
 * 6 zamiast 4.
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
const legacyRow = (
  id: string,
  status: string,
  projectId: string
): Record<string, unknown> => ({
  id,
  name: `Inicjatywa ${id}`,
  status,
  projectId,
  priority: 'MEDIUM',
  progress: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const FIXTURE = [
  legacyRow('a1', 'DRAFT', 'proj-1'),
  legacyRow('a2', 'PENDING_APPROVAL', 'proj-1'),
  legacyRow('a3', 'IN_EXECUTION', 'proj-1'),
  legacyRow('a4', 'APPROVED', 'proj-1'),
  legacyRow('z1', 'CLOSED', 'proj-1'),
  legacyRow('z2', 'REJECTED', 'proj-1'),
  legacyRow('x1', 'IN_EXECUTION', 'proj-2'),
];

const WIDOCZNE_AKTYWNE = 4;

beforeEach(() => {
  window.localStorage.clear();
  demoModeState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  listLegacyInitiatives.mockReset();
  listLegacyInitiatives.mockResolvedValue(FIXTURE);
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

const liczbaZChipa = (element: HTMLElement): number => {
  const tekst = element.textContent ?? '';
  const ostatnia = tekst.match(/(\d+)\s*$/);
  expect(ostatnia, `chip bez licznika: "${tekst}"`).not.toBeNull();
  return Number(ostatnia![1]);
};

describe('InitiativesHub — jedna liczba, jeden zbiór (Menu 2 · Menu 3 · lista statusów)', () => {
  it('pigułka „Wszystkie", licznik przy filtrze i suma statusów pokazują ten sam zbiór', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/initiatives']}>
        <InitiativesHub />
      </MemoryRouter>
    );
    await screen.findByTestId('initiatives-hub');

    // 1) Pigułka „Wszystkie" w Menu 3.
    const pigulka = await screen.findByTestId('initiatives-menu3-chip-all');
    const zPigulki = liczbaZChipa(pigulka);

    // 2) Licznik przy przycisku „Status" w Menu 2 (zbiór na domyślnym „Wszystkie").
    const dropdown = screen.getByTestId('initiatives-lifecycle-dropdown');
    const przycisk = within(dropdown).getByRole('button');
    const zFiltra = liczbaZChipa(przycisk);

    // 3) Suma pozycji statusów w rozwiniętej liście.
    await user.click(przycisk);
    const lista = within(dropdown).getByRole('listbox');
    const pozycje = within(lista).getAllByRole('option');
    const wiersze = pozycje.map((pozycja) => ({
      etykieta: pozycja.textContent ?? '',
      liczba: liczbaZChipa(pozycja),
    }));
    const wierszWszystkie = wiersze[0];
    const sumaStatusow = wiersze
      .slice(1)
      .reduce((suma, wiersz) => suma + wiersz.liczba, 0);

    expect(zPigulki).toBe(WIDOCZNE_AKTYWNE);
    expect(zFiltra).toBe(WIDOCZNE_AKTYWNE);
    expect(wierszWszystkie.liczba).toBe(WIDOCZNE_AKTYWNE);
    expect(sumaStatusow).toBe(WIDOCZNE_AKTYWNE);
  });

  it('wybór statusu w Menu 2 nie zeruje liczników pozostałych statusów', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/initiatives']}>
        <InitiativesHub />
      </MemoryRouter>
    );
    await screen.findByTestId('initiatives-hub');

    const chipWRealizacji = await screen.findByTestId('initiatives-menu3-chip-IN_EXECUTION');
    await user.click(chipWRealizacji);

    // Po zawężeniu do „W realizacji" liczniki nadal opisują zbiór DO WYBORU,
    // a nie rozmiar bieżącego wyboru — inaczej użytkownik widzi same zera.
    const dropdown = screen.getByTestId('initiatives-lifecycle-dropdown');
    await user.click(within(dropdown).getByRole('button'));
    const lista = within(dropdown).getByRole('listbox');
    const pozycje = within(lista).getAllByRole('option');
    const suma = pozycje
      .slice(1)
      .reduce((acc, pozycja) => acc + liczbaZChipa(pozycja), 0);

    expect(liczbaZChipa(pozycje[0])).toBe(WIDOCZNE_AKTYWNE);
    expect(suma).toBe(WIDOCZNE_AKTYWNE);
  });
});
