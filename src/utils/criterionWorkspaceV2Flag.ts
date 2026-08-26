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
 * Mechanika (18 ogniw, API, role, tabele dowodów/ustaleń) NIE się zmienia —
 * ten ekran przeprojektowuje WYŁĄCZNIE powłokę/układ (patrz
 * `CriterionWorkspaceGate.tsx`, który renderuje V1 lub V2 na podstawie tej
 * flagi, bez zmiany trasy).
 *
 * Where this flag gates
 * ----------------------
 *   * `CriterionWorkspaceGate` — when OFF (default), renders the existing
 *     `CriterionWorkspace` (V1) UNCHANGED. When ON, renders
 *     `v2/CriterionWorkspaceV2`.
 *
 * Resolution order (highest wins), identical contract to
 * `initiativesBulkStubFlag.ts` / `m03DecisionWorkspaceFlag.ts`:
 *   1. URL query `?ff_criterionWorkspaceV2=0|1` — instant per-session bypass
 *      (used by the dev-render harness to preview V2 without flipping the
 *      default).
 *   2. `localStorage["ff.criterion_workspace_v2"]` — user/org override.
 *   3. `import.meta.env.VITE_CRITERION_WORKSPACE_V2` — build-time override.
 *   4. Default: OFF. Flip ON only after owner acceptance on real-component
 *      screenshots (CLAUDE.md regułą 7 — Piotr nigdy nie jest pierwszym
 *      testerem wizualnym).
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

/** Fail-closed: any read error along the chain resolves to OFF, never ON. */
export function isCriterionWorkspaceV2Enabled(): boolean {
  try {
    const fromQuery = readQueryOverride();
    if (fromQuery !== null) return fromQuery;
    const fromLs = readLocalStorage();
    if (fromLs !== null) return fromLs;
    return readEnvFlag();
  } catch {
    return false;
  }
}

export const CRITERION_WORKSPACE_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
