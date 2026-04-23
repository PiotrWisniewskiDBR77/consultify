/**
 * Chat V10 / V10-RSR-006 — feature flag for `MissionBudget`
 * (R-RESEARCH-6, Wave A seed).
 *
 * Runtime contract lives in
 * `src/models/research/MissionBudget.ts`. Default OFF —
 * Wave A seed pins the four-kind cost catalogue, `MissionBudgetV1`
 * shape, the pure `burnBudget` reducer, and three invariants.
 * Per-source cost attribution and tenant spend ledger are Wave B.
 */

const LS_KEY = 'ff.research_mission_budget';
const QUERY_KEY = 'ff_research_mission_budget';
const ENV_KEY = 'VITE_RESEARCH_MISSION_BUDGET';

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

export function isResearchMissionBudgetEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const RESEARCH_MISSION_BUDGET_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
