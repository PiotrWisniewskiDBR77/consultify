/**
 * Assessment Light shell — feature flag for the DRD assessment session
 * redesign (`<DRDLightShell>`). Gates the DRD session editor between the
 * current multi-surface shell (Formularz / Tabela / Macierz toggle + Manage +
 * AI Triage/Interpretation bar + WorkflowStatusBar + governance lane) and the
 * new lightweight, dense single-surface shell.
 *
 * Where this flag gates
 * ---------------------
 *   * `<AssessmentSessionEditorView>` (framework === 'drd') branches at render
 *     between the legacy shell (unchanged) and `<DRDLightShell>` when ON.
 *   * `<DRDLightShell>` is a pure UI swap: it reuses the SAME answers data
 *     path (`areasToFormData` / `formDataToAreas` round-trip, identical
 *     `data` + `onChange` contract as `<DRDForm>`) and wires "Generuj raport"
 *     to the existing report workflow handler. No data-path change — flipping
 *     the flag never touches persistence (mirrors `melsCanvasFlag`).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_assessmentLight=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.assessment_light"]` — user / org override.
 *   3. `import.meta.env.VITE_ASSESSMENT_LIGHT` — build-time override.
 *   4. Default: OFF. Ships behind an OFF flag so the proven legacy DRD shell
 *      stays the default surface until Piotr signs off on the redesign on
 *      demo. Set any override to `1` to preview.
 */

const LS_KEY = 'ff.assessment_light';
const QUERY_KEY = 'ff_assessmentLight';
const ENV_KEY = 'VITE_ASSESSMENT_LIGHT';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, the legacy DRD shell is
  // the default surface. An explicit `1`/`true` env value opts in.
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isAssessmentLightEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ASSESSMENT_LIGHT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
