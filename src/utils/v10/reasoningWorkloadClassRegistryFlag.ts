/**
 * Chat V10 / V10-RSN-001 — feature flag for the reasoning workload
 * class registry + router.
 *
 * Runtime contract lives in
 * `src/models/reasoning/WorkloadClassRegistry.ts`. Default OFF —
 * Wave A seed pins the 7-class catalogue, the per-class spec
 * (budget / grounding / coverage / hedging), and the four runtime
 * invariants; the Wave B telemetry emitter and per-class executors
 * (V10-RSN-015..021) bind to this contract.
 */

const LS_KEY = 'ff.reasoning_workload_class_registry';
const QUERY_KEY = 'ff_reasoning_workload_class_registry';
const ENV_KEY = 'VITE_REASONING_WORKLOAD_CLASS_REGISTRY';

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

export function isReasoningWorkloadClassRegistryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_WORKLOAD_CLASS_REGISTRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
