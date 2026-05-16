/**
 * Chat V10 / V10-RSN-004 — feature flag for the reasoning plan
 * formulator + budget attachment.
 *
 * Runtime contract lives in
 * `src/models/reasoning/PlanFormulator.ts`. Default OFF —
 * Wave A seed pins the Plan schema, CHECKPOINT_CADENCES catalogue,
 * PLAN_STEP_KINDS catalogue, PLANNING_WORKLOAD_CLASSES, and the four
 * runtime invariants; the Wave B execution loop (V10-RSN-007), Run
 * Ledger integration (V10-AGT-014), and plan UI (V10-RSN-022) bind
 * to this contract.
 */

const LS_KEY = 'ff.reasoning_plan_formulator';
const QUERY_KEY = 'ff_reasoning_plan_formulator';
const ENV_KEY = 'VITE_REASONING_PLAN_FORMULATOR';

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

export function isReasoningPlanFormulatorEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_PLAN_FORMULATOR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
