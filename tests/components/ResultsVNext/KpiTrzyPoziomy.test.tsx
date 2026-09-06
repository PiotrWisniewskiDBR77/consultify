/**
 * @vitest-environment jsdom
 *
 * TRZY POZIOMY WYNIKÓW → KPI (SSOT `docs/modules/07_rezultaty/
 * SSOT_WYNIKI_KPI_OKR_ROI.md` §1 i §6, korekta P7K §4):
 *
 *   poziom 1  `/results/kpi`                       — TABELA RAPORTÓW
 *             (nazwa · zakres · OKRES · mierniki · STAN · otwarte działania ·
 *             przygotował · aktualizacja). Płaska lista wszystkich wskaźników
 *             NIE jest punktem wejścia — pigułki „Wszystkie wskaźniki" nie ma.
 *   poziom 2  `/results/kpi/scorecards/:scorecardId` — RAPORT: tabela mierników
 *             grupowana po OBSZARZE, z parą CEL/Rezultat na okres, YTD i STANEM.
 *   poziom 3  `/results/kpi/:kpiId?zbior=<raport>`   — KARTA N miernika,
 *             ścieżka „Rejestr KPI › <raport> › <miernik>".
 *
 * BADANIE MUTACYJNE — test pilnuje KOLEJNOŚCI poziomów, nie wyglądu:
 *   (a) cel nawigacji z poziomu 1 porównywany jako PEŁNY adres, więc
 *       przywrócenie usuniętej trasy `/results/kpi/zestawienie/:id` albo
 *       odwrócenie poziomów („karta → zbiór kart") natychmiast go wywraca;
 *   (b) `ROUTES.RESULTS_KPI` nie może znowu mieć klucza `CARD_SET` —
 *       dopisanie go z powrotem wywraca test;
 *   (c) ścieżka poziomu 3 porównywana jako UPORZĄDKOWANA tablica etykiet,
 *       więc raport MUSI stać między rejestrem a miernikiem.
 *
 * Konwencja mockowania 1:1 z `KpiToolPage.test.tsx` (mock `Api` na granicy
 * modułu + `useNavigate` jako szpieg — żywa podmiana trasy po `navigate()`
 * jest w tym repo niestabilna w jsdom/React 19/RRDv7; `useParams`/
 * `useSearchParams` zostają PRAWDZIWE).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { currentUser: unknown; currentOrganization: unknown }) => unknown) =>
    selector({
      currentUser: { id: 'user-owner', firstName: 'Piotr', role: 'ADMIN' },
      currentOrganization: { id: 'org-1', name: 'DBR77' },
    }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: 'http://test',
  getHeaders: () => ({}),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { Api } from '@/services/api';
import { KpiToolPage } from '../../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { ResultsKpiScorecardDetailPage } from '../../../src/components/ResultsVNext/kpiScorecards/ResultsKpiScorecardDetailPage';
import { ResultsKpiRegistryPage } from '../../../src/components/ResultsVNext/ResultsKpiRegistryPage';
import { ROUTES } from '../../../src/routes/routeConfig';

const KPI_ID = '11111111-1111-1111-1111-111111111111';
const CHILD_KPI_ID = '33333333-3333-3333-3333-333333333333';
const SCORECARD_ID = '44444444-4444-4444-4444-444444444444';

const KPI_ROW = {
  kpiId: KPI_ID,
  organizationId: 'org-1',
  kpiCode: 'KPI-OEE-001',
  name: 'OEE linii pakowania',
  status: 'active',
  currentDefinitionVersionId: 'dv-1',
  primaryProcessId: null,
  responsePolicyId: null,
  ownerUserId: 'user-owner',
  rowVersion: 3,
  createdBy: 'user-owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const CHILD_KPI_ROW = {
  ...KPI_ROW,
  kpiId: CHILD_KPI_ID,
  kpiCode: 'KPI-SMED-002',
  name: 'Czas przezbrojenia',
};

const SCORECARD_ROW = {
  scorecardId: SCORECARD_ID,
  organizationId: 'org-1',
  name: 'Przegląd operacyjny Q3',
  description: 'Raport wskaźników linii pakowania',
  scopeType: 'business_unit',
  scopeId: null,
  ownerUserId: 'user-owner',
  ownerName: 'Anna Kowalczyk',
  reviewFrequency: 'monthly',
  lifecycleStatus: 'active',
  editionLabel: null,
  revisionDate: null,
  preparedByUserId: 'user-owner',
  preparedByName: 'Anna Kowalczyk',
  rowVersion: 1,
  createdBy: 'user-owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const SCORECARD_ITEMS = [
  {
    itemId: 'item-1',
    scorecardId: SCORECARD_ID,
    kpiId: CHILD_KPI_ID,
    kpiName: 'Czas przezbrojenia',
    organizationId: 'org-1',
    role: 'primary',
    sortOrder: 1,
    displayConfig: null,
    areaName: 'PRODUKCJA',
    superiorOwnerName: 'Dyrektor Operacyjny',
    indicatorType: 'settlement',
    benchmarkValue: 28,
    limitPercent: 5,
    unit: 'min',
    targetGeometry: 'threshold_max',
    measurementFrequencyDays: 30,
    ownerUserId: 'user-owner',
    ownerName: 'Marek Zieliński',
    description: null,
    formulaText: null,
    addedBy: 'user-owner',
    addedByName: 'Anna Kowalczyk',
    addedAt: '2026-02-01T00:00:00.000Z',
  },
];

const STATUS_DISTRIBUTION = {
  safe: 3,
  warning: 2,
  critical: 1,
  missing: 4,
  totalVisible: 10,
  openDeviationCases: 7,
  byArea: [
    { areaName: 'PRODUKCJA', safe: 3, warning: 2, critical: 1, missing: 4, totalVisible: 10 },
  ],
};

const PERIOD_MATRIX = {
  scorecardId: SCORECARD_ID,
  year: 2026,
  granularity: 'month' as const,
  periods: [
    {
      key: '2026-07',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-07-31T23:59:59.999Z',
      isCurrent: false,
    },
    {
      key: '2026-08',
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-31T23:59:59.999Z',
      isCurrent: true,
    },
  ],
  items: [
    {
      kpiId: CHILD_KPI_ID,
      itemId: 'item-1',
      cells: [
        {
          periodKey: '2026-07',
          measurementId: 'm-07',
          targetValue: 30,
          actualValue: 31,
          performanceStatus: 'warning',
          dataQualityStatus: 'verified',
        },
        {
          periodKey: '2026-08',
          measurementId: null,
          targetValue: null,
          actualValue: null,
          performanceStatus: null,
          dataQualityStatus: null,
        },
      ],
      ytdTargetValue: 30,
      ytdActualValue: 31,
      ytdPerformanceStatus: 'warning',
      ytdAggregation: 'sum' as const,
      latestPerformanceStatus: 'warning',
      openDeviationCaseCount: 1,
    },
  ],
};

function mockApi(overrides: Record<string, unknown> = {}) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/vnext/results/kpi/scorecards?')) {
      return overrides.scorecards ?? { scorecards: [SCORECARD_ROW] };
    }
    if (url.startsWith('/vnext/results/kpi/scorecards/for-kpi/')) {
      return { scorecards: [SCORECARD_ROW] };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}`) {
      return overrides.scorecard ?? { scorecard: SCORECARD_ROW };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`) {
      return overrides.items ?? { items: SCORECARD_ITEMS };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}/status`) {
      return { distribution: STATUS_DISTRIBUTION };
    }
    if (url.startsWith(`/vnext/results/kpi/scorecards/${SCORECARD_ID}/periods`)) {
      return { matrix: overrides.matrix ?? PERIOD_MATRIX };
    }
    if (url.includes('/review-snapshots/published')) {
      return overrides.published ?? { snapshot: null };
    }
    if (url.includes('/review-snapshots')) return { snapshots: [] };
    if (url.startsWith('/vnext/results/kpi?')) {
      return { kpis: [KPI_ROW, CHILD_KPI_ROW] };
    }
    if (url === `/vnext/results/kpi/${KPI_ID}` || url.startsWith(`/vnext/results/kpi/${KPI_ID}?`)) {
      return { kpi: KPI_ROW };
    }
    if (
      url === `/vnext/results/kpi/${CHILD_KPI_ID}` ||
      url.startsWith(`/vnext/results/kpi/${CHILD_KPI_ID}?`)
    ) {
      return { kpi: CHILD_KPI_ROW };
    }
    if (url.includes('/measurements')) return { measurements: [] };
    if (url.includes('/version')) return { definitionVersion: null };
    if (url.includes('/history')) return { entries: [] };
    if (url.startsWith('/vnext/results/kpi/deviation-cases')) return { cases: [] };
    if (url.includes('/initiative-impacts')) return { impacts: [] };
    return {};
  });
}

function renderRegistry() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.RESULTS_KPI.ROOT]}>
      <ResultsKpiRegistryPage />
    </MemoryRouter>
  );
}

function renderReport(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.SCORECARD} element={<ResultsKpiScorecardDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderTool(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Etykiety ścieżki poziomów W KOLEJNOŚCI — tablica, nie zbiór. */
async function breadcrumbLabels(): Promise<string[]> {
  const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' });
  return Array.from(nav.querySelectorAll('button, span'))
    .map((el) => (el.textContent ?? '').trim())
    .filter(Boolean);
}

describe('KPI — trzy poziomy: tabela raportów → raport → karta N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  });

  it('POZIOM 1: /results/kpi to TABELA RAPORTÓW z okresem, stanem i otwartymi działaniami', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    // Kolumny SSOT §6 — nagłówki, nie wygląd.
    expect(screen.getByText('NAZWA RAPORTU')).toBeInTheDocument();
    expect(screen.getByText('OKRES')).toBeInTheDocument();
    expect(screen.getByText('MIERNIKI')).toBeInTheDocument();
    expect(screen.getByText('OTWARTE DZIAŁANIA')).toBeInTheDocument();

    await waitFor(() => {
      const row = screen.getByText('Przegląd operacyjny Q3').closest('tr') as HTMLElement;
      // MIERNIKI = `totalVisible` z rozkładu stanu, OTWARTE DZIAŁANIA = 7.
      expect(within(row).getByText('10')).toBeInTheDocument();
      expect(within(row).getByText('7')).toBeInTheDocument();
    });
  });

  it('POZIOM 1: pigułka „Wszystkie wskaźniki" ZNIKA — płaska lista nie jest punktem wejścia', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    expect(screen.queryByText('Wszystkie wskaźniki')).not.toBeInTheDocument();
    // Menu 3 ma DOKŁADNIE jedną akcję.
    expect(screen.getByText('Nowy raport')).toBeInTheDocument();
  });

  it('POZIOM 1 → 2: dwuklik otwiera RAPORT pod /scorecards/:id (nie pod usuniętym adresem)', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    fireEvent.doubleClick(screen.getByText('Przegląd operacyjny Q3'));

    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/scorecards/${SCORECARD_ID}`);
    // Mutacja (a): przywrócenie starej trasy poziomu 2 albo odwrócenie
    // poziomów natychmiast wywraca oba twierdzenia poniżej.
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining('zestawienie'));
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining(KPI_ID));
  });

  it('MUTACJA (b): trasa siatki kafelków poziomu 2 nie istnieje w konfiguracji', () => {
    expect(ROUTES.RESULTS_KPI).not.toHaveProperty('CARD_SET');
    expect(ROUTES.RESULTS_KPI.SCORECARD).toBe('/results/kpi/scorecards/:scorecardId');
    // Stary adres zostaje WYŁĄCZNIE jako przekierowanie, z jawnie „starym"
    // parametrem — żeby nie dało się go pomylić z żywą trasą poziomu 2.
    expect(ROUTES.RESULTS_KPI.CARD_SET_REDIRECT).toBe(
      '/results/kpi/zestawienie/:legacyScorecardId'
    );
  });

  it('POZIOM 2: raport to TABELA mierników — grupa obszaru, para CEL/Rezultat, YTD i STAN', async () => {
    mockApi();
    renderReport(`/results/kpi/scorecards/${SCORECARD_ID}`);

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-kpi-scorecard-detail-page')).toBeInTheDocument()
    );
    // Nagłówek raportu — nazwa jest i w okruszku Menu 1, i w nagłówku nad
    // tabelą (dwa różne miejsca kanonu), więc liczymy WYSTĄPIENIA, nie jedno.
    await waitFor(() =>
      expect(screen.getAllByText('Przegląd operacyjny Q3').length).toBeGreaterThanOrEqual(2)
    );
    expect(
      screen.getByTestId('results-vnext-kpi-registry-header')
    ).toHaveTextContent('Przegląd operacyjny Q3');
    // Wiersz grupy obszaru — JEDNA komórka na całą szerokość (werdykt K6).
    const groupRow = await waitFor(() => {
      const row = document.querySelector('tr[data-group-row="true"]') as HTMLElement | null;
      expect(row).not.toBeNull();
      return row as HTMLElement;
    });
    expect(groupRow).toHaveTextContent('PRODUKCJA');
    expect(groupRow).toHaveTextContent('Dyrektor Operacyjny');
    expect(groupRow.querySelectorAll('td')).toHaveLength(1);
    // Kolumny okresów + YTD + STAN.
    expect(screen.getByText('LIP 2026')).toBeInTheDocument();
    expect(screen.getByText('SIE 2026')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
    // Para CEL/Rezultat w komórce okresu, brak danych jako „—", nigdy 0.
    const itemRow = screen.getByText('Czas przezbrojenia').closest('tr') as HTMLElement;
    expect(within(itemRow).getAllByText('CEL').length).toBeGreaterThanOrEqual(2);
    expect(within(itemRow).getAllByText('Rezultat').length).toBeGreaterThanOrEqual(2);
    expect(within(itemRow).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(within(itemRow).queryByText('0')).toBeNull();
    // Akcja Menu 3 z SSOT.
    expect(screen.getByText('Dodaj miernik')).toBeInTheDocument();
  });

  it('POZIOM 2 → 3: dwuklik w miernik otwiera KARTĘ N z zapamiętanym raportem', async () => {
    mockApi();
    renderReport(`/results/kpi/scorecards/${SCORECARD_ID}`);

    await waitFor(() => expect(screen.getByText('Czas przezbrojenia')).toBeInTheDocument());
    fireEvent.doubleClick(screen.getByText('Czas przezbrojenia'));

    expect(navigateMock).toHaveBeenCalledWith(
      `/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`
    );
  });

  it('POZIOM 3: karta N ma DOKŁADNIE trzystopniową ścieżkę, w tej kolejności', async () => {
    mockApi();
    renderTool(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`);

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument()
    );

    await waitFor(async () =>
      expect(await breadcrumbLabels()).toEqual([
        'Rejestr KPI',
        'Przegląd operacyjny Q3',
        'Czas przezbrojenia',
      ])
    );
  });

  it('POZIOM 3: adres bez parametru dalej działa — stopień raportu z REALNEJ przynależności', async () => {
    mockApi();
    renderTool(`/results/kpi/${KPI_ID}`);

    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument()
    );

    await waitFor(async () =>
      expect(await breadcrumbLabels()).toEqual([
        'Rejestr KPI',
        'Przegląd operacyjny Q3',
        'OEE linii pakowania',
      ])
    );
  });

  it('MUTACJA (c): raport stoi MIĘDZY rejestrem a miernikiem, nie pod miernikiem', async () => {
    mockApi();
    renderTool(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`);
    await waitFor(() =>
      expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument()
    );

    const labels = await waitFor(async () => {
      const l = await breadcrumbLabels();
      expect(l).toHaveLength(3);
      return l;
    });
    expect(labels.indexOf('Przegląd operacyjny Q3')).toBe(1);
    expect(labels.indexOf('Czas przezbrojenia')).toBe(2);
    expect(labels.indexOf('Przegląd operacyjny Q3')).toBeLessThan(
      labels.indexOf('Czas przezbrojenia')
    );
  });
});
