/**
 * @vitest-environment jsdom
 *
 * TRZYPOZIOMOWA FORMUŁA KPI — odrzucenie właściciela 2026-09-05 (cytat):
 *   „nad kartą jest ich zestawienie. To jest trzypoziomowe menu. (…) mamy
 *    tabelę, pod nią kartę KPI, piętro niżej – zbiór kart KPI, a poniżej
 *    kolejna karta KPI."
 *
 * Ten test pilnuje STANU NAWIGACJI całej formuły, nie wyglądu:
 *   poziom 2 (`KpiToolPage`)      — ścieżka „Rejestr KPI › <karta>",
 *                                    kafelek zestawienia prowadzi na poziom 3;
 *   poziom 3 (`KpiCardSetPage`)   — ścieżka 3-elementowa, ZBIÓR kart KPI z
 *                                    realnych pozycji zestawienia, kafelek
 *                                    prowadzi na poziom 4 z zachowaną ścieżką;
 *   poziom 4 (`KpiToolPage`)      — ścieżka 4-elementowa z nazwą zestawienia
 *                                    i nazwą karty, z której przyszliśmy.
 *
 * Konwencja mockowania 1:1 z `KpiToolPage.test.tsx` (mock `Api` na granicy
 * modułu + `useNavigate` jako szpieg — żywa podmiana trasy po `navigate()`
 * jest w tym repo niestabilna w jsdom/React 19/RRDv7; `useParams`/
 * `useSearchParams` zostają PRAWDZIWE, więc wejście w trasę jest ćwiczone
 * uczciwie).
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  API_URL: 'http://test',
  getHeaders: () => ({}),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { Api } from '../../../src/services/api';
import { KpiToolPage } from '../../../src/components/ResultsVNext/kpiTool/KpiToolPage';
import { KpiCardSetPage } from '../../../src/components/ResultsVNext/kpiTool/KpiCardSetPage';
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
    if (url === `/vnext/results/kpi/scorecards/for-kpi/${KPI_ID}`) {
      return overrides.forKpi ?? { scorecards: [SCORECARD_ROW] };
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

describe('KPI — trzypoziomowa formuła tabela → karta → zbiór kart → karta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
  });

  it('POZIOM 2: karta KPI ma ścieżkę „Rejestr KPI › <karta>" (dwa stopnie, bez ścieżki zbioru)', async () => {
    mockApi();
    renderTool(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toHaveTextContent('Rejestr KPI');
    expect(nav).toHaveTextContent('OEE linii pakowania');
    // Bez parametrów ścieżki NIE pokazujemy zmyślonego stopnia zbioru.
    expect(nav).not.toHaveTextContent('Przegląd operacyjny Q3');
  });

  it('POZIOM 2 → 3: kafelek zestawienia prowadzi w ZBIÓR kart KPI (piętro niżej)', async () => {
    mockApi();
    renderTool(`/results/kpi/${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    const user = userEvent.setup();
    const navItems = await screen.findAllByText('Zestawienia');
    await user.click(navItems[0]);

    const tile = await screen.findByTestId(`kpi-tool-scorecard-tile-${SCORECARD_ID}`);
    expect(tile).toHaveTextContent('Przegląd operacyjny Q3');
    // Kafelek to `StandardGridCard` w kontenerze z testidem — klikamy sam kafelek.
    await user.click(tile.firstElementChild as HTMLElement);

    expect(navigateMock).toHaveBeenCalledWith(`/results/kpi/${KPI_ID}/zestawienie/${SCORECARD_ID}`);
  });

  it('POZIOM 3: zbiór kart KPI renderuje realne pozycje zestawienia i trzystopniową ścieżkę', async () => {
    mockApi();
    renderCardSet(`/results/kpi/${KPI_ID}/zestawienie/${SCORECARD_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-card-set-page')).toBeInTheDocument());

    const grid = await screen.findByTestId('kpi-card-set-grid');
    expect(grid).toHaveTextContent('Czas przezbrojenia');
    expect(grid).toHaveTextContent('Rola: Podstawowa');

    await waitFor(() => expect(screen.getByText('Przegląd operacyjny Q3')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('OEE linii pakowania')).toBeInTheDocument());
    expect(screen.getByText('Rejestr KPI')).toBeInTheDocument();
  });

  it('POZIOM 3: bez opublikowanej migawki NIE pokazujemy zmyślonych liczb, tylko uczciwy komunikat', async () => {
    mockApi();
    renderCardSet(`/results/kpi/${KPI_ID}/zestawienie/${SCORECARD_ID}`);

    const notice = await screen.findByTestId('kpi-card-set-snapshot-notice');
    await waitFor(() => expect(notice).toHaveTextContent(/nie ma jeszcze opublikowanej migawki/i));
    expect(screen.getByTestId('kpi-card-set-grid')).toHaveTextContent('—');
  });

  it('POZIOM 3 → 4: kafelek KPI prowadzi w KOLEJNĄ kartę KPI z zachowaną ścieżką poziomów', async () => {
    mockApi();
    renderCardSet(`/results/kpi/${KPI_ID}/zestawienie/${SCORECARD_ID}`);

    const grid = await screen.findByTestId('kpi-card-set-grid');
    const user = userEvent.setup();
    await user.click(grid.firstElementChild as HTMLElement);

    expect(navigateMock).toHaveBeenCalledWith(
      `/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}&zKarty=${KPI_ID}`
    );
  });

  it('POZIOM 4: karta otwarta ze zbioru pokazuje pełną, czterostopniową ścieżkę', async () => {
    mockApi();
    renderTool(`/results/kpi/${CHILD_KPI_ID}?zbior=${SCORECARD_ID}&zKarty=${KPI_ID}`);

    await waitFor(() => expect(screen.getByTestId('results-vnext-kpi-tool-page')).toBeInTheDocument());

    const nav = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    await waitFor(() => expect(nav).toHaveTextContent('Przegląd operacyjny Q3'));
    await waitFor(() => expect(nav).toHaveTextContent('OEE linii pakowania'));
    expect(nav).toHaveTextContent('Rejestr KPI');
    expect(nav).toHaveTextContent('Czas przezbrojenia');
  });
});
