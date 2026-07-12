/**
 * StandardQuestion (SPEC-Q) — feature flag for the 4th artifact format:
 * the canonical diagnostic **question card** (`<StandardQuestion>`).
 * Companion to `executionLightFlag.ts` / `financeLightFlag.ts` /
 * `resultsLightFlag.ts` / `assessmentLightFlag.ts` — SAME resolution order,
 * SAME OFF-by-default posture.
 *
 * Where this flag gates
 * ---------------------
 *   * NOT wired into any existing screen yet (Interview / DRD / Assessment).
 *     This step only ships the new presentational component + the flag + the
 *     dev-render harness (CLAUDE.md rule #7: the owner never sees a real
 *     screen before a clean, self-rendered harness screenshot is approved).
 *     Real wiring (branch at render, same pattern as the *LightShell flags)
 *     is a later step, only after Piotr signs off on the harness.
 *   * `<StandardQuestion>` is presentational-only (props in, JSX out — no
 *     store / API / context), so flipping this flag on later never touches
 *     persistence.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_standardQuestion=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.standard_question"]` — user / org override.
 *   3. `import.meta.env.VITE_STANDARD_QUESTION` — build-time override.
 *   4. Default: OFF. Ships behind an OFF flag so nothing changes on demo
 *      until Piotr signs off on the SPEC-Q card. Set any override to `1`
 *      to preview.
 */

const LS_KEY = 'ff.standard_question';
const QUERY_KEY = 'ff_standardQuestion';
const ENV_KEY = 'VITE_STANDARD_QUESTION';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, SPEC-Q is not shown.
  // An explicit `1`/`true` env value opts in.
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

export function isStandardQuestionEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const STANDARD_QUESTION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
