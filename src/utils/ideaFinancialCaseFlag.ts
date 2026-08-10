/**
 * Idea Table — FINANCIAL CASE layer (Program E / epic E09, 2026-08-10).
 *
 * New screen (driver-editing surface + case summary + charts) inside the
 * Matryca (Idea Table) artifact. Per CLAUDE.md #7 ("Piotr nigdy nie jest
 * pierwszym testerem wizualnym"): ships default OFF until the owner has
 * approved a clean, self-rendered screenshot — this flag is that switch.
 *
 * Resolution order (highest wins) — same pattern as
 * `ideaTableGuidedBarFlag.ts` / `whiteboardSessionInPanelFlag.ts`:
 *   1. URL query `?ff_ideaFinancialCase=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_financial_case"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_FINANCIAL_CASE` — build-time override.
 *   4. Default: OFF.
 *
 * Separately from the visual flag, `FinancialCaseView` also needs a
 * `computeFn` (see `financialTypes.ts`) wired in by whoever mounts it — the
 * calculation engine is a sibling workstream and is not implemented here.
 */

const LS_KEY = 'ff.idea_financial_case';
const QUERY_KEY = 'ff_ideaFinancialCase';
const ENV_KEY = 'VITE_IDEA_FINANCIAL_CASE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
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

export function isIdeaFinancialCaseEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_FINANCIAL_CASE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
