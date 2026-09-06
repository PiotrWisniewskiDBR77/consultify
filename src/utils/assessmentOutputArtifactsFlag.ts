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
 * ★ DOMYŚLNIE TRUE od naprawy MVP 06.09 (evidence/audyt-mvp-20260906/A2/
 * RAPORT_A2.md poz. 5.2, BLOKER: "raport dla Finalne nie istnieje" — trasa
 * przekierowywała na `/assessment?tab=outputs` dla KAŻDEGO assessmentu,
 * niezależnie od statusu). Decyzja CTO: droga dojścia ma być widoczna na
 * MVP — dev-render zrzut tej ścieżki wejścia zrobiony i sprawdzony jako
 * część tej naprawy (evidence/mvp-naprawy-noc-2/), więc warunek reguły #7
 * ("Piotr nigdy nie jest pierwszym testerem wizualnym") jest spełniony:
 * ja renderuję i patrzę pierwszy, Piotr dostaje już zaakceptowaną ścieżkę.
 *
 * Historia (do 06.09): flaga była domyślnie OFF dokładnie z powodu reguły
 * #7 — ekrany docelowe miały akcept jako komponenty, ale droga dojścia
 * (kebab + trasy) nie była jeszcze pokazana. To odróżnienie jest teraz
 * nieaktualne.
 *
 * ON = `AssessmentOutputsTab` renderuje kebab pozycje "Pokaż raport" /
 * "Pokaż jako prezentację", a obie trasy montują docelowy komponent
 * zamiast przekierowywać.
 *
 * Wyłączenie awaryjne (np. regresja na żywo — patrz CLAUDE.md „przycisk
 * cofania"): `?ff_assessmentOutputArtifacts=0` w URL, lub localStorage
 * `ff.assessment_output_artifacts=0`.
 *
 * Resolution order (first wins): URL query → localStorage → Vite build env →
 * default true. Ten sam system co `unifiedCreateLauncherFlag.ts`.
 * (Do 2026-09-02 wskazywalo tu tez `src/components/Results/resultsFeatureFlags.ts`
 * — plik usuniety razem z wygaszonym poddrzewem ResultsHub.)
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
    const env = (import.meta.env as unknown as Record<string, string>);
    return parseFlag(env?.[ENV_KEY]);
  } catch {
    return null;
  }
}

/**
 * True when the Assessment Output artifact screens (report + presentation)
 * and their kebab entry points are enabled. Default ON since naprawa MVP
 * 06.09 (CTO decision — patrz header comment). Opt-out (awaryjny):
 * `?ff_assessmentOutputArtifacts=0` lub localStorage
 * `ff.assessment_output_artifacts=0`.
 */
export function isAssessmentOutputArtifactsEnabled(): boolean {
  const fromQuery = readQuery();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnv();
  if (fromEnv !== null) return fromEnv;
  return true;
}

export const ASSESSMENT_OUTPUT_ARTIFACTS_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
  env: ENV_KEY,
};
