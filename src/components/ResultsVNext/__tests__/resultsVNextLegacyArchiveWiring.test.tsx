/**
 * @vitest-environment jsdom
 *
 * "Archiwum" Menu 2 tab wiring (wołacze duty, 2026-09-02).
 *
 * `ResultsVNextLegacyArchivePanel` (`../legacy/ResultsVNextLegacyArchivePanel.tsx`)
 * has a working, read-only backend (`GET /api/vnext/results/{kpi,roi,okr}/legacy`,
 * `denyMutations` mounted first in every route file) but, before this
 * package, had ZERO caller anywhere in `src/` — its own file header said so
 * explicitly ("deliberately NOT mounted... for the NEXT wave to wire in").
 * This test proves the wire now exists, behind a default-OFF flag
 * (`resultsLegacyArchive`, see `../resultsVNextFeatureFlags.ts`):
 *
 *  1. flag OFF (default) — no "legacy" tab in `getResultsDomainTabs()`, and
 *     the ROI/OKR/KPI registry entry pages never mount the panel, even with
 *     `?resultsView=legacy` already in the URL (e.g. a stale bookmark).
 *  2. flag ON + `?resultsView=legacy` — the tab is present, and each of the
 *     three domain entry pages (`ResultsKpiRegistryPage.tsx`,
 *     `ResultsRoiRegistryPage.tsx`, `ResultsOkrRegistryPage.tsx`) mounts
 *     `ResultsVNextLegacyArchivePanel` with the correct `domain` prop.
 *
 * The panel component itself is mocked out — its own behaviour (loading/
 * error/read-only kebab) already has dedicated coverage in
 * `tests/components/ResultsVNext/ResultsVNextLegacyArchivePanel.test.tsx`.
 * This file only proves the WIRE: tab presence + the mount call with the
 * right `domain`, nothing about the panel's internals.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const legacyPanelMock = vi.fn();

vi.mock('../legacy/ResultsVNextLegacyArchivePanel', () => ({
  ResultsVNextLegacyArchivePanel: (props: { domain: string; className?: string }) => {
    legacyPanelMock(props);
    return <div data-testid={`legacy-panel-mock-${props.domain}`}>legacy-panel:{props.domain}</div>;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : ((fallback as { defaultValue?: string })?.defaultValue ?? _key),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: { currentUser: unknown }) => unknown) =>
    selector({ currentUser: { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'W', role: 'ADMIN' } }),
}));

const apiGet = vi.fn(async (..._args: unknown[]) => ({ kpis: [] }));
vi.mock('@/services/api', () => ({
  Api: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), put: vi.fn() },
}));

import { getResultsDomainTabs } from '../resultsDomainNavigation';
import { RESULTS_VNEXT_FLAG_KEYS } from '../resultsVNextFeatureFlags';
import { ResultsKpiRegistryPage } from '../ResultsKpiRegistryPage';
import { ResultsRoiRegistryPage } from '../ResultsRoiRegistryPage';
import { ResultsOkrRegistryPage } from '../ResultsOkrRegistryPage';

function setSearch(search: string) {
  // `tests/setup.ts` already replaces `window.location` with a plain,
  // writable snapshot object (to stub assign/replace/reload) — a direct
  // field assignment is the established convention for query-string
  // fixtures in this module (see
  // `ResultsKpiRegistryPage.uiStatePersistence.test.tsx`'s own `afterEach`).
  (window.location as unknown as { search: string }).search = search;
}

function enableLegacyArchiveFlag() {
  window.localStorage.setItem(RESULTS_VNEXT_FLAG_KEYS.resultsLegacyArchive.localStorage, '1');
}

describe('Archiwum (resultsLegacyArchive) — wołacz wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockResolvedValue({ kpis: [] });
    window.localStorage.clear();
    setSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setSearch('');
  });

  describe('flaga OFF (domyślnie) — zero zmiany zachowania', () => {
    it('brak zakładki "legacy" w getResultsDomainTabs()', () => {
      const ids = getResultsDomainTabs().map((t) => t.id);
      // DEC-422b/e (06.09): zakładka "search" zastąpiona przez "reports"
      // („Raporty zarządcze"), która NIE stoi za flagą — jest stałym,
      // czwartym elementem Menu 2. Asercja aktualizowana do realnego,
      // zaakceptowanego stanu (dalej zero "legacy" przy fladze OFF).
      expect(ids).toEqual(['kpi', 'okr', 'roi', 'reports']);
      expect(ids).not.toContain('legacy');
    });

    it('ROI: panel NIE jest montowany, nawet z ?resultsView=legacy już w URL', () => {
      setSearch('?resultsView=legacy');
      // StandardModuleBar -> useStandardPanelControls -> useJedenPanel wywołuje
      // dziś useLocation() (react-router) — brak w tym teście, gdy renderuje
      // się PEŁNY Hub (ten branch, legacy panel NIE montuje się). MemoryRouter
      // jak w teście KPI niżej w tym pliku (ten sam plik, ten sam wzorzec).
      render(
        <MemoryRouter initialEntries={['/results/roi']}>
          <ResultsRoiRegistryPage />
        </MemoryRouter>
      );
      // `results-vnext-roi-disabled` NIE jest już renderowane tutaj:
      // `roiRegistry` jest dziś default-ON (DEC 03.09 wieczór A1, patrz
      // resultsVNextFeatureFlags.ts:224+230) — bez ?resultsView=legacy w
      // stanie flagi ta strona montuje realny ResultsRoiHub, nie placeholder
      // "jeszcze nie włączone". Sedno tego testu (i jego nazwy) to WYŁĄCZNIE
      // że legacy-panel się NIE montuje — dokładnie ten sam, jedyny check co
      // w teście KPI niżej w tym pliku (tam nigdy nie było asercji o
      // disabled-testid, bo kpiRegistry był enabled już wcześniej).
      expect(legacyPanelMock).not.toHaveBeenCalled();
    });

    it('OKR: panel NIE jest montowany, nawet z ?resultsView=legacy już w URL', () => {
      setSearch('?resultsView=legacy');
      render(
        <MemoryRouter initialEntries={['/results/okr']}>
          <ResultsOkrRegistryPage />
        </MemoryRouter>
      );
      // Patrz komentarz w teście ROI wyżej — `okrRegistry` też default-ON.
      expect(legacyPanelMock).not.toHaveBeenCalled();
    });

    it('KPI: panel NIE jest montowany, nawet z ?resultsView=legacy już w URL', () => {
      setSearch('?resultsView=legacy');
      render(
        <MemoryRouter initialEntries={['/results/kpi']}>
          <ResultsKpiRegistryPage />
        </MemoryRouter>
      );
      expect(legacyPanelMock).not.toHaveBeenCalled();
    });
  });

  describe('flaga ON (localStorage ff.results_vnext_legacy_archive=1) + ?resultsView=legacy', () => {
    it('zakładka "legacy" pojawia się w getResultsDomainTabs()', () => {
      enableLegacyArchiveFlag();
      const ids = getResultsDomainTabs().map((t) => t.id);
      // "search" (default-ON, DEC 03.09) poprzedza "legacy" w
      // resultsDomainNavigation.ts — patrz komentarz wyżej w tym pliku.
      expect(ids).toEqual(['kpi', 'okr', 'roi', 'reports', 'legacy']);
    });

    it('ROI: montuje ResultsVNextLegacyArchivePanel z domain="roi"', () => {
      enableLegacyArchiveFlag();
      setSearch('?resultsView=legacy');
      render(<ResultsRoiRegistryPage />);
      expect(legacyPanelMock).toHaveBeenCalledTimes(1);
      expect(legacyPanelMock.mock.calls[0][0]).toMatchObject({ domain: 'roi' });
      expect(screen.getByTestId('legacy-panel-mock-roi')).toBeInTheDocument();
    });

    it('OKR: montuje ResultsVNextLegacyArchivePanel z domain="okr"', () => {
      enableLegacyArchiveFlag();
      setSearch('?resultsView=legacy');
      render(<ResultsOkrRegistryPage />);
      expect(legacyPanelMock).toHaveBeenCalledTimes(1);
      expect(legacyPanelMock.mock.calls[0][0]).toMatchObject({ domain: 'okr' });
      expect(screen.getByTestId('legacy-panel-mock-okr')).toBeInTheDocument();
    });

    it('KPI: montuje ResultsVNextLegacyArchivePanel z domain="kpi"', () => {
      enableLegacyArchiveFlag();
      setSearch('?resultsView=legacy');
      render(
        <MemoryRouter initialEntries={['/results/kpi']}>
          <ResultsKpiRegistryPage />
        </MemoryRouter>
      );
      expect(legacyPanelMock).toHaveBeenCalledTimes(1);
      expect(legacyPanelMock.mock.calls[0][0]).toMatchObject({ domain: 'kpi' });
      expect(screen.getByTestId('legacy-panel-mock-kpi')).toBeInTheDocument();
    });

    it('ROI: BEZ ?resultsView=legacy w URL panel NIE jest montowany mimo włączonej flagi', () => {
      enableLegacyArchiveFlag();
      setSearch('');
      // Pełny Hub renderuje się (legacy panel nie montuje się bez
      // ?resultsView=legacy) -> StandardModuleBar -> useJedenPanel ->
      // useLocation() wymaga Router, jak w pozostałych "NIE jest montowany"
      // testach w tym pliku.
      render(
        <MemoryRouter initialEntries={['/results/roi']}>
          <ResultsRoiRegistryPage />
        </MemoryRouter>
      );
      expect(legacyPanelMock).not.toHaveBeenCalled();
    });
  });
});

/**
 * ★ Blok dopisany przez nadzorcę 2026-09-02 po ZMIERZENIU, że sam
 * `defaultValue: false` NIE wystarcza w tej rodzinie flag: `isResultsVNextFlagEnabled`
 * ma na początku dwa wczesne `return true` (owner-review i zbiorczy profil demo
 * `VITE_DEMO_ACCEPTANCE`), a ten drugi JEST ustawiony na demo. Bez wyjątku nowa
 * zakładka „Archiwum" trafiłaby na demo od razu — właściciel zobaczyłby ją pierwszy,
 * wbrew CLAUDE.md #7. Ten test broni wyjątku; skasowanie go musi zapalić czerwone.
 */
describe('Archiwum — profil demo NIE włącza zakładki przed akceptem', () => {
  it('VITE_DEMO_ACCEPTANCE=1 włącza inne flagi Wyników, ale NIE resultsLegacyArchive', async () => {
    const mod = await import('../resultsVNextFeatureFlags');
    const demo = { env: { VITE_DEMO_ACCEPTANCE: '1' }, hostname: 'demo.consultify.ai' };
    expect(mod.isResultsVNextFlagEnabled('kpiRegistry', demo)).toBe(true);
    expect(mod.isResultsVNextFlagEnabled('resultsLegacyArchive', demo)).toBe(false);
  });
});
