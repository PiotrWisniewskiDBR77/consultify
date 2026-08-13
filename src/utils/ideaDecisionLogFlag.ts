/**
 * Idea Table — real DECISION LOG layer (Program D / epic E08 §6.4,
 * 2026-08-10). Wires `ideaDecisionGovernance.ts` into `IdeaDecisionLogPanel`.
 *
 * New screen (question/recommendation/approver, four-outcome recording,
 * approval gate, version-on-reopen) inside the Matryca (Idea Table)
 * artifact. Per CLAUDE.md #7 ("Piotr nigdy nie jest pierwszym testerem
 * wizualnym"): ships default OFF until the owner has approved a clean,
 * self-rendered screenshot — this flag is that switch.
 *
 * Resolution order (highest wins) — same pattern as
 * `ideaFinancialCaseFlag.ts` / `ideaTableGuidedBarFlag.ts`:
 *   1. URL query `?ff_ideaDecisionLog=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_decision_log"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_DECISION_LOG` — build-time override.
 *   4. Default: OFF.
 *
 * Deliberately does NOT gate the older "Log decyzji" saved-view column
 * preset (`DECISION_COLUMN_KEY`/`resolveDecisionViewSetup` in
 * `ViewSetupEmptyState.tsx`) — that is a separate, pre-existing, already-
 * shipped surface this program does not touch.
 */

import {
  isDemoAcceptanceProfileEnabled,
  type DemoAcceptanceProfileSource,
} from './demoAcceptanceProfile';

const LS_KEY = 'ff.idea_decision_log';
const QUERY_KEY = 'ff_ideaDecisionLog';
const ENV_KEY = 'VITE_IDEA_DECISION_LOG';

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

export function isIdeaDecisionLogEnabled(profileSource?: DemoAcceptanceProfileSource): boolean {
  if (isDemoAcceptanceProfileEnabled(profileSource)) return true;
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const IDEA_DECISION_LOG_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
