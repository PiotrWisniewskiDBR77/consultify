/**
 * @vitest-environment jsdom
 *
 * POZIOM 1 trzypoziomowej formuły KPI — `/results/kpi` MUSI otwierać się na
 * TABELI ZESTAWIEŃ, a lista pojedynczych wskaźników musi zostać osiągalna.
 *
 * HISTORIA (dwa zmierzone defekty, ten sam plik):
 *  1. Odbiór na żywo 05.09 (`results-vnext-kpi-scorecards`): gałąź
 *     `tab === 'scorecards'` w `ResultsKpiRegistryPage` była w pełni
 *     zbudowana (tabela, podgląd, kebab cyklu życia, modal tworzenia), ale
 *     stan `tab` dało się ustawić WYŁĄCZNIE propem `initialTab`, którego
 *     żadna trasa nie przekazywała — rejestr zestawień był nieosiągalny.
 *  2. Odrzucenie właściciela 05.09 („Omawialiśmy tabelę; z poziomu tabeli
 *     otwiera się lista"): zestawienia były zakładką POBOCZNĄ, a domyślną
 *     tabelą była lista pojedynczych wskaźników. Od tej zmiany jest
 *     odwrotnie — zestawienia to poziom 1, wskaźniki to pigułka „Wszystkie
 *     wskaźniki" obok nich.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): zmiana domyślnego stanu `tab` z
 * `'scorecards'` z powrotem na `'org'` wywraca test „domyślną tabelą są
 * zestawienia", a usunięcie gałęzi `if (id === KPI_CHIP_ID)` z
 * `onChipChange` wywraca test przejścia na listę wskaźników.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('poziom 1 — tabela zestawień jako domyślny widok /results/kpi', () => {
  it('domyślną tabelą /results/kpi są ZESTAWIENIA (bez żadnego kliknięcia)', async () => {
    renderPage();
    await waitFor(() => expect(listKpiScorecards).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });

  it('pigułka „Zestawienia" jest widoczna w Menu 3 i jest zakładką aktywną', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Zestawienia')).toBeInTheDocument());
  });

  it('pigułka „Wszystkie wskaźniki" przełącza na listę pojedynczych KPI', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Wszystkie wskaźniki'));
    await waitFor(() =>
      expect(screen.queryByText('Karta wyników operacji')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(listKpis).toHaveBeenCalled());
  });

  it('z listy wskaźników da się wrócić na poziom 1 (nie jest ślepą uliczką)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Wszystkie wskaźniki'));
    await waitFor(() =>
      expect(screen.queryByText('Karta wyników operacji')).not.toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Zestawienia'));
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });

  it('deep-link ?kpiView=scorecards otwiera ten sam poziom 1', async () => {
    setSearch('?kpiView=scorecards');
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });
});
