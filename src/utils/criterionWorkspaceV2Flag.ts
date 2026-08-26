/**
 * Criterion Workspace V2 — kill-switch for the SPEC-A (Rekord) reshell of
 * `CriterionWorkspace` (Audits › warsztat kryterium).
 *
 * DEC-88 (owner accept, 2026-08-26, Variant A on all four decision cards):
 * 18-link audit chain grouped into 4 macro-phases (Planowanie 1-3 · Badanie
 * 4-8 · Ustalenia 9-12 · Naprawa i zamknięcie 13-18), evidence/findings stay
 * `StandardTable` embedded per-phase, right panel follows
 * `ARTIFACT_PANEL_SECTION_ORDER` with a "Rola i uprawnienia" group as the
 * first Properties block, Menu 1 primary tracks the current link.
 *
 * DEC-97 (owner accept, 2026-08-26, real-component screenshots — "jest
 * super"): default flipped ON. V1 stays reachable via the explicit
 * `?ff_criterionWorkspaceV2=0` / `localStorage["ff.criterion_workspace_v2"]
 * = "off"` escape hatch for regression comparison; it is otherwise retired
 * from the default path.
 *
 * Mechanika (18 ogniw, API, role, tabele dowodów/ustaleń) NIE się zmienia —
 * ten ekran przeprojektowuje WYŁĄCZNIE powłokę/układ (patrz
 * `CriterionWorkspaceGate.tsx`, który renderuje V1 lub V2 na podstawie tej
 * flagi, bez zmiany trasy).
 *
 * Where this flag gates
 * ----------------------
 *   * `CriterionWorkspaceGate` — when ON (default, DEC-97), renders
 *     `v2/CriterionWorkspaceV2`. When explicitly OFF, renders the existing
 *     `CriterionWorkspace` (V1) UNCHANGED.
 *
 * Resolution order (highest wins), identical contract to
 * `initiativesBulkStubFlag.ts` / `m03DecisionWorkspaceFlag.ts` /
 * `ideaInspectorRightRailFlag.ts` (post-DEC-94: `query ?? local ?? env ??
 * true`):
 *   1. URL query `?ff_criterionWorkspaceV2=0|1` — instant per-session bypass
 *      (used by the dev-render harness / regression checks to force V1
 *      without touching the default).
 *   2. `localStorage["ff.criterion_workspace_v2"]` — user/org override.
 *   3. `import.meta.env.VITE_CRITERION_WORKSPACE_V2` — build-time override.
 *   4. Default: ON (DEC-97). Disable per-session with `off`/`0`/`false` on
 *      any of the above.
 *
 * Resolution result is cached at module scope (matches
 * `ideaInspectorRightRailFlag.ts`) — call `resetCriterionWorkspaceV2FlagCache`
 * between reads in tests.
 */

const LS_KEY = 'ff.criterion_workspace_v2';
const QUERY_KEY = 'ff_criterionWorkspaceV2';
const ENV_KEY = 'VITE_CRITERION_WORKSPACE_V2';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean | null {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta?.env?.[ENV_KEY]);
  } catch {
    return null;
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

let cached: boolean | null = null;

/**
 * Resolution: query > localStorage > env > default (ON, DEC-97). Any read
 * error along the chain resolves to the default rather than throwing, so a
 * hostile/locked-down `window` never blocks the screen from rendering.
 * Result is cached at module scope — call
 * `resetCriterionWorkspaceV2FlagCache` to force a re-read (tests, or after
 * an in-session override changes query/localStorage).
 */
export function isCriterionWorkspaceV2Enabled(): boolean {
  if (cached !== null) return cached;
  let resolved: boolean;
  try {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    const fromEnv = readEnvFlag();
    resolved = fromQuery ?? fromLs ?? fromEnv ?? true;
  } catch {
    resolved = true;
  }
  cached = resolved;
  return cached;
}

export const resetCriterionWorkspaceV2FlagCache = (): void => {
  cached = null;
};

export const CRITERION_WORKSPACE_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
