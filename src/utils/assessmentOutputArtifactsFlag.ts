/**
 * Assessment Output artifacts feature flag (tor "wołacze", 2026-09-02).
 *
 * Gates the entry point (kebab pozycje "Pokaż raport" / "Pokaż jako
 * prezentację" w `AssessmentOutputsTab.tsx`) i dwie trasy
 * (`/assessment/outputs/:outputId/report`,
 * `/assessment/outputs/:outputId/presentation`) do dwóch już zbudowanych i
 * wizualnie zaakceptowanych komponentów: `AssessmentReportView` i
 * `AssessmentPresentationView`.
 *
 * ★ DOMYŚLNIE FALSE. Powód: CLAUDE.md reguła #7 — właściciel nigdy nie jest
 * pierwszym testerem wizualnym. Same ekrany (AssessmentReportView,
 * AssessmentPresentationView) mają akcept Piotra jako komponenty, ale DROGA
 * DOJŚCIA do nich — nowa pozycja w kebabie tabeli Outputs, nowe trasy w
 * AppRoutes — nie była jeszcze pokazana ani zaakceptowana. Zanim Piotr
 * zobaczy pozycję w menu, potrzebny jest dev-render zrzut tej konkretnej
 * ścieżki wejścia. Do tego czasu flaga zostaje OFF.
 *
 * OFF = zachowanie bajt-w-bajt jak dziś: `AssessmentOutputsTab` renderuje
 * dokładnie te same dwie pozycje w kebabie i te same akcje w
 * `StandardPreview` co przed tą zmianą (żadnej nowej pozycji), a obie nowe
 * trasy przekierowują (`<Navigate to="/assessment?tab=outputs" replace />`)
 * zamiast montować komponent.
 *
 * Włączenie do podglądu (dev-render/harness, NIE na żywym Piotrze):
 * `?ff_assessmentOutputArtifacts=1` w URL, lub localStorage
 * `ff.assessment_output_artifacts=1`.
 *
 * Resolution order (first wins): URL query → localStorage → Vite build env →
 * default false. Ten sam system co `unifiedCreateLauncherFlag.ts` /
 * `src/components/Results/resultsFeatureFlags.ts`.
 */

const QUERY_KEY = 'ff_assessmentOutputArtifacts';
const LOCAL_STORAGE_KEY = 'ff.assessment_output_artifacts';
const ENV_KEY = 'VITE_ASSESSMENT_OUTPUT_ARTIFACTS_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

function readEnv(): boolean | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[ENV_KEY]);
  } catch {
    return null;
  }
}

/**
 * True when the Assessment Output artifact screens (report + presentation)
 * and their kebab entry points are enabled. Default OFF — see header
 * comment (CLAUDE.md reguła #7, brak jeszcze pokazanej Piotrowi drogi
 * dojścia). Opt-in: `?ff_assessmentOutputArtifacts=1` lub localStorage
 * `ff.assessment_output_artifacts=1`.
 */
export function isAssessmentOutputArtifactsEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnv();
  if (fromEnv !== null) return fromEnv;
  return false;
}

export const ASSESSMENT_OUTPUT_ARTIFACTS_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
};
