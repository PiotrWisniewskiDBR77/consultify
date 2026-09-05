/**
 * @vitest-environment jsdom
 *
 * TRZYPOZIOMOWA FORMUŁA KPI — odrzucenie właściciela 2026-09-05 (cytat):
 *   „To nie jest, niestety, to, co wcześniej zgłosiliśmy i omawialiśmy.
 *    Omawialiśmy tabelę; z poziomu tabeli otwiera się lista. Lista ma opis
 *    KPI, kilka pozycji, a każdy KPI ma swoją kartę typu N. Tego tu nie mamy
 *    teraz."
 *
 * Ten test pilnuje STANU NAWIGACJI całej formuły, nie wyglądu:
 *   poziom 1 (`ResultsKpiRegistryPage`) — TABELA ZESTAWIEŃ: nazwa, opis,
 *          liczba wskaźników, wiersz systemowy „Bez zestawienia";
 *          dwuklik w wiersz otwiera LISTĘ zestawienia;
 *   poziom 2 (`KpiCardSetPage`)         — LISTA: nagłówek z nazwą i OPISEM
 *          zestawienia + pozycje; klik w pozycję otwiera kartę wskaźnika;
 *   poziom 3 (`KpiToolPage`)            — karta N wskaźnika ze ŚCIEŻKĄ
 *          „Rejestr KPI › <zestawienie> › <wskaźnik>".
 *
 * BADANIE MUTACYJNE (wykonane 2026-09-05, opisane w teście „kolejność
 * poziomów"): test porównuje ścieżkę jako UPORZĄDKOWANĄ TABLICĘ etykiet i
 * cele nawigacji jako pełne adresy, więc odwrócenie kolejności poziomów
 * (np. powrót do odrzuconej formuły „tabela → karta → zbiór → karta", gdzie
 * zestawienie leży POD wskaźnikiem) wywraca go natychmiast: adres poziomu 2
 * zawierałby wtedy `kpiId`, a środkowym stopniem ścieżki byłaby karta KPI.
 *
 * Konwencja mockowania 1:1 z `KpiToolPage.test.tsx` (mock `Api` na granicy
 * modułu + `useNavigate` jako szpieg — żywa podmiana trasy po `navigate()`
 * jest w tym repo niestabilna w jsdom/React 19/RRDv7; `useParams`/
 * `useSearchParams` zostają PRAWDZIWE, więc wejście w trasę jest ćwiczone
 * uczciwie).
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { currentUser: unknown }) => unknown) =>
    selector({ currentUser: { id: 'user-owner', firstName: 'Piotr', role: 'ADMIN' } }),
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
import { KpiCardSetPage } from '../../../src/components/ResultsVNext/kpiTool/KpiCardSetPage';
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

const CHILD_KPI_ROW = { ...KPI_ROW, kpiId: CHILD_KPI_ID, kpiCode: 'KPI-SMED-002', name: 'Czas przezbrojenia' };

const SCORECARD_ROW = {
  scorecardId: SCORECARD_ID,
  organizationId: 'org-1',
  name: 'Przegląd operacyjny Q3',
  description: 'Zestawienie wskaźników linii pakowania',
  scopeType: 'business_unit',
  scopeId: null,
  ownerUserId: 'user-owner',
  ownerName: 'Anna Kowalczyk',
  reviewFrequency: 'monthly',
  lifecycleStatus: 'active',
  rowVersion: 1,
  createdBy: 'user-owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

/** Zestawienie ma JEDNĄ pozycję (`CHILD_KPI_ID`) — `KPI_ID` zostaje poza nim,
 * więc poziom 1 MUSI pokazać wiersz systemowy „Bez zestawienia". */
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
    addedBy: 'user-owner',
    addedByName: 'Anna Kowalczyk',
    addedAt: '2026-02-01T00:00:00.000Z',
  },
];

function mockApi(overrides: Record<string, unknown> = {}) {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/vnext/results/kpi/scorecards?')) {
      return overrides.scorecards ?? { scorecards: [SCORECARD_ROW] };
    }
    if (url === `/vnext/results/kpi/scorecards/for-kpi/${KPI_ID}`) {
      return overrides.forKpi ?? { scorecards: [SCORECARD_ROW] };
    }
    if (url === `/vnext/results/kpi/scorecards/for-kpi/${CHILD_KPI_ID}`) {
      return { scorecards: [SCORECARD_ROW] };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}`) {
      return overrides.scorecard ?? { scorecard: SCORECARD_ROW };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}/items`) {
      return overrides.items ?? { items: SCORECARD_ITEMS };
    }
    if (url === `/vnext/results/kpi/scorecards/${SCORECARD_ID}/review-snapshots/published`) {
      return overrides.published ?? { snapshot: null };
    }
    if (url.startsWith('/vnext/results/kpi?')) {
      return { kpis: [KPI_ROW, CHILD_KPI_ROW] };
    }
    if (url === `/vnext/results/kpi/${KPI_ID}` || url.startsWith(`/vnext/results/kpi/${KPI_ID}?`)) {
      return { kpi: KPI_ROW };
    }
    if (url === `/vnext/results/kpi/${CHILD_KPI_ID}` || url.startsWith(`/vnext/results/kpi/${CHILD_KPI_ID}?`)) {
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

function renderTool(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.TOOL} element={<KpiToolPage />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderCardSet(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.RESULTS_KPI.CARD_SET} element={<KpiCardSetPage />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Etykiety ścieżki poziomów W KOLEJNOŚCI — porównywane jako tablica, nie jako
 * zbiór, bo to KOLEJNOŚĆ poziomów była przedmiotem odrzucenia. */
async function breadcrumbLabels(): Promise<string[]> {
  const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' });
  return Array.from(nav.querySelectorAll('button, span'))
    .map((el) => (el.textContent ?? '').trim())
    .filter(Boolean);
}

describe('KPI — trzypoziomowa formuła: tabela zestawień → lista → karta N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  });

  it('POZIOM 1: domyślną tabelą /results/kpi są ZESTAWIENIA — z opisem i liczbą wskaźników', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    expect(screen.getByText('Zestawienie wskaźników linii pakowania')).toBeInTheDocument();
    // Kolumna „Liczba wskaźników" — realna liczba pozycji zestawienia (1).
    // Do czasu policzenia pozycji kolumna pokazuje „—", NIE zero — dlatego
    // czekamy na liczbę zamiast czytać pierwszy render.
    await waitFor(() => {
      const row = screen.getByText('Przegląd operacyjny Q3').closest('tr') as HTMLElement;
      expect(within(row).getByText('1')).toBeInTheDocument();
    });
  });

  it('POZIOM 1: KPI spoza zestawień nie znika — dostaje wiersz systemowy „Bez zestawienia"', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Bez zestawienia')).toBeInTheDocument());
    await waitFor(() => {
      const row = screen.getByText('Bez zestawienia').closest('tr') as HTMLElement;
      // Jeden KPI (`KPI_ID`) nie należy do żadnego zestawienia.
      expect(within(row).getByText('1')).toBeInTheDocument();
      // Wiersz systemowy nie udaje rekordu: bez właściciela i bez daty.
      expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('POZIOM 1 → 2: dwuklik w wiersz otwiera LISTĘ zestawienia (adres bez kpiId)', async () => {
    mockApi();
    renderRegistry();

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    fireEvent.doubleClick(screen.getByText('Przegląd operacyjny Q3'));

    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/zestawienie/${SCORECARD_ID}`);
    expect(navigateMock).not.toHaveBeenCalledWith(expect.stringContaining(KPI_ID));
  });

  it('POZIOM 2: lista ma NAZWĘ, OPIS zestawienia i jego pozycje', async () => {
    mockApi();
    renderCardSet(`/results/kpi/zestawienie/${SCORECARD_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-card-set-page')).toBeInTheDocument());

    const header = await screen.findByTestId('kpi-card-set-header');
    await waitFor(() => expect(header).toHaveTextContent('Przegląd operacyjny Q3'));
    expect(await screen.findByTestId('kpi-card-set-description')).toHaveTextContent(
      'Zestawienie wskaźników linii pakowania'
    );
    expect(screen.getByTestId('kpi-card-set-count')).toHaveTextContent('Wskaźniki: 1');

    const grid = await screen.findByTestId('kpi-card-set-grid');
    expect(grid).toHaveTextContent('Czas przezbrojenia');
    expect(grid).toHaveTextContent('Rola: Podstawowa');
  });

  it('POZIOM 2: bez opublikowanej migawki NIE pokazujemy zmyślonych liczb, tylko uczciwy komunikat', async () => {
    mockApi();
    renderCardSet(`/results/kpi/zestawienie/${SCORECARD_ID}`);

    const notice = await screen.findByTestId('kpi-card-set-snapshot-notice');
    await waitFor(() => expect(notice).toHaveTextContent(/nie ma jeszcze opublikowanej migawki/i));
    expect(screen.getByTestId('kpi-card-set-grid')).toHaveTextContent('—');
  });

  it('POZIOM 2 → 3: klik w pozycję otwiera KARTĘ N wskaźnika z zapamiętanym zestawieniem', async () => {
    mockApi();
    renderCardSet(`/results/kpi/zestawienie/${SCORECARD_ID}`);

    const grid = await screen.findByTestId('kpi-card-set-grid');
    const user = userEvent.setup();
    await user.click(grid.firstElementChild as HTMLElement);

    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`);
  });

  it('POZIOM 3: karta N ma DOKŁADNIE trzystopniową ścieżkę, w tej kolejności', async () => {
    mockApi();
    renderTool(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    await waitFor(async () =>
      expect(await breadcrumbLabels()).toEqual([
        'Rejestr KPI',
        'Przegląd operacyjny Q3',
        'Czas przezbrojenia',
      ])
    );
  });

  it('POZIOM 3: stary adres bez parametru dalej działa — stopień zestawienia bierze się z REALNEJ przynależności', async () => {
    mockApi();
    renderTool(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    await waitFor(async () =>
      expect(await breadcrumbLabels()).toEqual([
        'Rejestr KPI',
        'Przegląd operacyjny Q3',
        'OEE linii pakowania',
      ])
    );
  });

  it('KOLEJNOŚĆ POZIOMÓW (badanie mutacyjne): zestawienie leży NAD wskaźnikiem, nie pod nim', async () => {
    mockApi();
    renderTool(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}`);
    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    const labels = await waitFor(async () => {
      const l = await breadcrumbLabels();
      expect(l).toHaveLength(3);
      return l;
    });

    // Zestawienie jest ŚRODKOWYM stopniem — w odrzuconej formule
    // („tabela → karta KPI → zbiór kart → kolejna karta") środkowym stopniem
    // była KARTA KPI, a zestawienie stopniem trzecim.
    expect(labels[1]).toBe('Przegląd operacyjny Q3');
    expect(labels.indexOf('Przegląd operacyjny Q3')).toBeLessThan(labels.indexOf('Czas przezbrojenia'));
    // Ścieżka NIE zawiera drugiej karty KPI (formuła ma trzy poziomy, nie cztery).
    expect(labels).not.toContain('OEE linii pakowania');

    // A wejście z listy prowadzi w kartę wskaźnika, nie w kolejne zestawienie.
    const user = userEvent.setup();
    const crumb = screen.getByRole('button', { name: 'Przegląd operacyjny Q3' });
    await user.click(crumb);
    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/zestawienie/${SCORECARD_ID}`);
  });
});
