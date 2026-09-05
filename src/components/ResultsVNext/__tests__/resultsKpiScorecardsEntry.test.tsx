/**
 * @vitest-environment jsdom
 *
 * Rejestr „Kart wyników" MUSI mieć wejście — klikiem i adresem.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 05.09, `results-vnext-kpi-scorecards`):
 * gałąź `tab === 'scorecards'` w `ResultsKpiRegistryPage` była w pełni
 * zbudowana (własna tabela, podgląd, kebab cyklu życia, modal tworzenia),
 * ale stan `tab` dało się ustawić WYŁĄCZNIE propem `initialTab`, którego
 * żadna trasa nigdy nie przekazywała — i w całym pliku nie było ani jednego
 * `onClick`, który by go zmienił. Wraz z rejestrem nieosiągalna była CAŁA
 * trasa `/results/kpi/scorecards/:scorecardId` (jedyne wejście do niej to
 * klik w wiersz tego rejestru) — a to ONA jest zatwierdzonym obrazem
 * `results-vnext-kpi-scorecards__PO__light.png`.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): usunięcie pigułki
 * `SCORECARDS_CHIP_ID` z tablicy `chips` → pada test „pigułka jest widoczna",
 * a usunięcie gałęzi `if (id === SCORECARDS_CHIP_ID)` z `onChipChange` →
 * pada test przełączenia klikiem (ekran zostaje na rejestrze KPI).
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

describe('wejście do rejestru Kart wyników', () => {
  it('pigułka „Karty wyników" jest widoczna w Menu 3 rejestru KPI', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Karty wyników')).toBeInTheDocument());
  });

  it('klik w pigułkę przełącza na rejestr Kart wyników', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Karty wyników'));
    await waitFor(() => expect(listKpiScorecards).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });

  it('deep-link ?kpiView=scorecards otwiera ten sam rejestr', async () => {
    setSearch('?kpiView=scorecards');
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
  });

  it('z rejestru Kart wyników da się wrócić do KPI (nie jest ślepą uliczką)', async () => {
    setSearch('?kpiView=scorecards');
    renderPage();
    await waitFor(() => expect(screen.getByText('Karta wyników operacji')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Rejestr KPI'));
    await waitFor(() =>
      expect(screen.queryByText('Karta wyników operacji')).not.toBeInTheDocument()
    );
  });
});
