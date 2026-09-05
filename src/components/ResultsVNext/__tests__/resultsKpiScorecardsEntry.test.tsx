/**
 * @vitest-environment jsdom
 *
 * POZIOM 1 Wyników → KPI — `/results/kpi` MUSI otwierać się na TABELI
 * RAPORTÓW, a płaska lista pojedynczych wskaźników NIE jest punktem wejścia.
 *
 * HISTORIA (trzy zmierzone defekty, ten sam plik):
 *  1. Odbiór na żywo 05.09 (`results-vnext-kpi-scorecards`): gałąź
 *     `tab === 'scorecards'` w `ResultsKpiRegistryPage` była w pełni
 *     zbudowana, ale stan `tab` dało się ustawić WYŁĄCZNIE propem
 *     `initialTab`, którego żadna trasa nie przekazywała — rejestr był
 *     nieosiągalny („biblioteka bez wywołania").
 *  2. Odrzucenie właściciela 05.09: zestawienia były zakładką POBOCZNĄ, a
 *     domyślną tabelą lista pojedynczych wskaźników. Odwrócone.
 *  3. Korekta P7K (SSOT §1, decyzja właściciela nr 2 z 30.08): „płaska lista
 *     wszystkich wskaźników nie jest punktem wejścia" — pigułka „Wszystkie
 *     wskaźniki" ZNIKA z Menu 3, a rejestr wskaźników (jedyne miejsce cyklu
 *     definicji miernika) zostaje osiągalny adresem `?kpiView=wskazniki`.
 *
 * DOWÓD MUTACYJNY: przywrócenie pigułki „Wszystkie wskaźniki" do Menu 3
 * wywraca test „pigułka znika"; zmiana domyślnego stanu `tab` z `'scorecards'`
 * na `'org'` wywraca test „domyślną tabelą są raporty"; usunięcie gałęzi
 * `view === 'wskazniki'` z efektu deep-linku wywraca test rejestru wskaźników.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === 'string'
        ? fallback
        : ((fallback as { defaultValue?: string })?.defaultValue ?? key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { currentUser: unknown }) => unknown) =>
    selector({ currentUser: { id: 'user-piotr', firstName: 'Piotr', role: 'ADMIN' } }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({ kpis: [] })), post: vi.fn(), put: vi.fn() },
}));

const { listKpiScorecards, listKpis } = vi.hoisted(() => ({
  listKpiScorecards: vi.fn(async () => [
    {
      scorecardId: 'sc-1',
      organizationId: 'org-1',
      name: 'Karta wyników operacji',
      description: null,
      scopeType: 'organization',
      scopeId: null,
      ownerUserId: 'user-piotr',
      ownerName: 'Piotr Wiśniewski',
      reviewFrequency: 'monthly',
      lifecycleStatus: 'active',
      rowVersion: 1,
      createdBy: 'user-piotr',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
  ]),
  listKpis: vi.fn(async () => []),
}));

vi.mock('../kpiScorecards/kpiScorecardApi', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listKpiScorecards };
});

vi.mock('../kpiApi', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, listKpis };
});

import { ResultsKpiRegistryPage } from '../ResultsKpiRegistryPage';

function setSearch(search: string) {
  (window.location as unknown as { search: string }).search = search;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/results/kpi']}>
      <ResultsKpiRegistryPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  setSearch('');
});

afterEach(() => {
  window.localStorage.clear();
  setSearch('');
});

describe('poziom 1 — tabela RAPORTÓW jako jedyny widok /results/kpi', () => {
  it('domyślną tabelą /results/kpi są RAPORTY (bez żadnego kliknięcia)', async () => {
    renderPage();
    await waitFor(() => expect(listKpiScorecards).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });

  it('Menu 3 ma DOKŁADNIE jedną akcję („Nowy raport") i ZERO pigułek nawigacyjnych', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
    expect(screen.getByText('Nowy raport')).toBeInTheDocument();
    // MUTACJA: przywrócenie którejkolwiek z dwóch pigułek wywraca ten test.
    expect(screen.queryByText('Wszystkie wskaźniki')).not.toBeInTheDocument();
    expect(screen.queryByText('Zestawienia')).not.toBeInTheDocument();
  });

  it('rejestr pojedynczych wskaźników nie został skasowany — otwiera go ?kpiView=wskazniki', async () => {
    setSearch('?kpiView=wskazniki');
    renderPage();
    // Rejestr wskaźników to jedyne miejsce cyklu definicji miernika (szkic →
    // zgłoszenie → zatwierdzenie → rewizja), więc musi zostać osiągalny mimo
    // zniknięcia pigułki.
    await waitFor(() => expect(listKpis).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText('Karta wyników operacji')).not.toBeInTheDocument()
    );
  });

  it('deep-link ?kpiView=scorecards otwiera ten sam poziom 1', async () => {
    setSearch('?kpiView=scorecards');
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });
});
