/**
 * RN-G2 — Results Next registry feature flags (default OFF, live-safe).
 *
 * Historically a deliberately SEPARATE file from
 * `src/components/Results/resultsFeatureFlags.ts`, whose flags belonged to the
 * legacy V8 cockpit (m14Handoff/valueDriverTree/threePairs/...) — mixing the two
 * enums would have invited the exact "conflate old and new" risk the master
 * plan's §12 cutover plan was designed to avoid (docs/product/results-vnext/
 * RN_G2_UI_SCOPE.md §F). That separation paid off: on 2026-09-02 the legacy file
 * was deleted with the whole retired ResultsHub subtree and this one was not
 * touched. It remains the only Results flag file.
 *
 * Resolution order (first wins): URL query (`?ff_x=1`) → localStorage
 * (`ff.results_vnext_x`) → Vite build env (`VITE_RESULTS_VNEXT_X_ENABLED`) →
 * default false. Mirrors `resultsFeatureFlags.ts` / `executionFeatureFlags.ts`.
 *
 * One flag PER DOMAIN (kpi/roi/okr), not per screen — a domain's
 * registry/preview/full-tool ship and are reviewed together as one vertical
 * slice (master plan §9 Etap 5, "trzy równoległe gold flows"). All three
 * default OFF. Promotion to default-ON-outside-prod happens only per-domain,
 * only after that domain's dev-render screenshot round + Piotr's odbiór
 * (CLAUDE.md rule #7) — do NOT flip any of these without a dated comment
 * citing the specific approval, mirroring `resultsFeatureFlags.ts`.
 */

import { isPublicProductionHost } from '@/utils/publicProduction';
import {
  isDemoAcceptanceProfileEnabled,
  type DemoAcceptanceProfileSource,
} from '@/utils/demoAcceptanceProfile';
import { isResultsOwnerReviewModeEnabled } from '@/components/Results/resultsOwnerReviewMode';

type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  kpiRegistry: {
    query: 'ff_resultsVNextKpi',
    localStorage: 'ff.results_vnext_kpi_registry',
    env: 'VITE_RESULTS_VNEXT_KPI_ENABLED',
  },
  roiRegistry: {
    query: 'ff_resultsVNextRoi',
    localStorage: 'ff.results_vnext_roi_registry',
    env: 'VITE_RESULTS_VNEXT_ROI_ENABLED',
  },
  okrRegistry: {
    query: 'ff_resultsVNextOkr',
    localStorage: 'ff.results_vnext_okr_registry',
    env: 'VITE_RESULTS_VNEXT_OKR_ENABLED',
  },
  resultsSearch: {
    query: 'ff_resultsVNextSearch',
    localStorage: 'ff.results_vnext_search',
    env: 'VITE_RESULTS_VNEXT_SEARCH_ENABLED',
  },
  /**
   * DEC-422 (06.09) — both `managementReportEntry` ("Raport zarządczy" link
   * to `ROUTES.REPORTS.MANAGEMENT`) and `attentionEntry` ("Uwaga" link to
   * the now-deleted `/results/attention` view) were REMOVED from the flag
   * table, not just turned off — the owner asked for the buttons gone
   * entirely (see `ResultsVNextRegistryShell.tsx` for the removal note).
   * `ROUTES.REPORTS.MANAGEMENT` itself and its screen are untouched; only
   * this one entry point from Results is gone.
   */
  /**
   * 2026-09-02 (wołacze duty) — gates a new "Archiwum"/"Archive" Menu 2 tab
   * that wires the already-built, already read-only-verified
   * `ResultsVNextLegacyArchivePanel` (`legacy/ResultsVNextLegacyArchivePanel.tsx`)
   * into the KPI/ROI/OKR registry navigation. That panel had a working
   * backend (`GET /api/vnext/results/{kpi,roi,okr}/legacy`, `denyMutations`
   * mounted first) but ZERO caller anywhere in `src/` — its own file header
   * said so explicitly ("deliberately NOT mounted"). This duty only adds
   * the wire, not the look — the panel itself is untouched.
   * Default OFF everywhere (CLAUDE.md reguła #7 — ta droga dojścia nie była
   * jeszcze oglądana przez właściciela na zrzucie; reguła #9 — zakaz
   * masowego włączania). OFF == byte-for-byte today's behaviour: no tab,
   * no route, panel stays unreachable. Same shape as `resultsSearch` above
   * — no D-D default-on set until a dev-render odbiór happens.
   */
  resultsLegacyArchive: {
    query: 'ff_resultsVNextLegacyArchive',
    localStorage: 'ff.results_vnext_legacy_archive',
    env: 'VITE_RESULTS_VNEXT_LEGACY_ARCHIVE_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type ResultsVNextFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/**
 * RN-G6 UI fix (2026-08-12) — persist an EXPLICIT query-string choice into
 * localStorage. Root cause of "click Open, land on not yet enabled": in-app
 * `navigate(path)` calls (e.g. registry → `/results/kpi/:kpiId`) build a bare
 * path string and never carry the current `location.search` along, so a
 * `?ff_resultsVNextKpi=1` typed once in the address bar is gone the instant
 * the user clicks through — `isResultsVNextFlagEnabled` then falls through
 * query(null) → localStorage(unset) → env(unset) → default `false`, even
 * though the user just turned the flag on. Writing the explicit query value
 * into localStorage the moment it is read means every subsequent read this
 * session — including the ones triggered by an in-domain navigate() that
 * dropped the query string — still lands on localStorage (already 2nd in the
 * resolution order below) with the same value. This does NOT change any
 * flag's default (still `false` with no query/localStorage/env present) and
 * only ever fires on an EXPLICIT value in the URL, never automatically.
 */
function writeLocalStorage(key: string, value: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Ignore (private browsing / quota) — the query string still resolves
    // this and every other read that keeps the param in the URL.
  }
}

/**
 * True when the given Results Next registry is enabled. DEC 03.09 wieczór
 * (A1, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md wiersz A1;
 * "14 ekranów Wyników — KPI, OKR, ROI, wyszukiwarka, uwaga" — zatwierdzone
 * 02.09, potwierdzone 03.09 wieczór): kpiRegistry/roiRegistry/okrRegistry/
 * resultsSearch są teraz WSZYSTKIE w D-D default-on — ta sama konwencja co
 * `threePairs`/`deviationDiagnostics` w `resultsFeatureFlags.ts`: ON na
 * demo/stage/dev, OFF na publicznej produkcji (`resultsVNextHostAllowsDefaultOn`
 * / `isPublicProductionHost`). Uwaga: moduł Wyników i tak nie jest w rdzeniu
 * VTS pilota na consultify.ai (`publicProduction.ts` PUBLIC_PRODUCTION_CORE_MENU_IDS
 * — Wyniki tam nie występują, więc menu jest zablokowane niezależnie od tej flagi).
 * (Piąta nazwana domena, „uwaga"/`attentionEntry`, została usunięta w całości
 * DEC-422 06.09 — patrz `ResultsVNextRegistryShell.tsx`.) `resultsLegacyArchive`
 * NIE jest objęty tą decyzją — ma jawny, osobny wyjątek (linie niżej — czeka
 * na odrębny odbiór właściciela na zrzutach). Zostaje default OFF.
 */
export function isResultsVNextFlagEnabled(
  flag: ResultsVNextFlag,
  profileSource?: DemoAcceptanceProfileSource
): boolean {
  if (isResultsOwnerReviewModeEnabled()) return true;
  // ★ 2026-09-02 (tor funkcji, wołacze) — `resultsLegacyArchive` jest WYJĘTY
  // spod zbiorczego profilu demo. Powód, zmierzony a nie przypuszczony:
  // `VITE_DEMO_ACCEPTANCE` jest ustawione na demo (patrz notatka toru grafiki
  // w `docs/program/grafika/status.json`: „ŻYWE NA DEMO — VITE_DEMO_ACCEPTANCE
  // włącza wszystkie trzy rejestry"), więc bez tego wyjątku nowa zakładka
  // „Archiwum" pojawiłaby się na demo NATYCHMIAST, mimo `defaultValue` OFF —
  // czyli właściciel zobaczyłby ją pierwszy, wprost wbrew CLAUDE.md #7.
  // To dokładnie rodzina „flaga OFF w kodzie ≠ flaga wyłączona": wczesny
  // `return true` omija cały łańcuch rozstrzygania. Tryb owner-review WYŻEJ
  // zostaje nietknięty — to jest właśnie ścieżka, którą właściciel ma
  // obejrzeć ekran świadomie. Po akcepcie: skasować ten wyjątek jednym
  // commitem (i wtedy zakładka wejdzie na demo razem z resztą profilu).
  const wyjetyZProfiluDemo = flag === 'resultsLegacyArchive';
  if (!wyjetyZProfiluDemo && isDemoAcceptanceProfileEnabled(profileSource)) return true;
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) {
    writeLocalStorage(keys.localStorage, fromQuery);
    return fromQuery;
  }
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  if (readEnv(keys.env)) return true;
  // DEC 03.09 wieczór (A1): kpiRegistry/roiRegistry/okrRegistry/resultsSearch
  // — cztery z pięciu nazwanych domen "14 ekranów Wyników" (piąta, "uwaga",
  // usunięta DEC-422 06.09) — dołączone do D-D default-on (demo/stage/dev ON,
  // public production OFF). Opt-out per flaga: ?ff_resultsVNext<Flag>=0.
  if (
    flag === 'kpiRegistry' ||
    flag === 'roiRegistry' ||
    flag === 'okrRegistry' ||
    flag === 'resultsSearch'
  ) {
    return resultsVNextHostAllowsDefaultOn(
      typeof window !== 'undefined' ? (window.location?.hostname ?? '') : ''
    );
  }
  // Poza zakresem DEC 03.09 wieczór A1 — nie były nazwane w decyzji, zostają
  // OFF. resultsLegacyArchive: jawnie wyjęty spod profilu demo wyżej, czeka
  // na odrębny odbiór.
  if (flag === 'resultsLegacyArchive') return false;
  return false;
}

/**
 * Guard used by `isPublicProductionHost` callers that want the same shape as
 * `resultsFeatureFlags.ts`'s D-D block, kept here as a documented no-op so a
 * future per-domain promotion has a single, obvious place to add the
 * `!isPublicProductionHost(...)` line (see that file for the pattern).
 */
export function resultsVNextHostAllowsDefaultOn(hostname: string): boolean {
  return !isPublicProductionHost(hostname);
}

export const RESULTS_VNEXT_FLAG_KEYS = FLAGS;
