/**
 * Chat V10 / V10-RSN-020 — feature flag for deep_research stub workload contract.
 *
 * Runtime contract lives in
 * `src/models/reasoning/DeepResearchStub.ts`. Default OFF —
 * Wave A seed pins the DEEP_RESEARCH_STUB_STATES catalogue,
 * DeepResearchStub shape, buildDeepResearchStub, and runtime invariants;
 * Wave B wires the full research pipeline dispatch and state tracking.
 */

const LS_KEY = 'ff.reasoning_deep_research_stub';
const QUERY_KEY = 'ff_reasoning_deep_research_stub';
const ENV_KEY = 'VITE_REASONING_DEEP_RESEARCH_STUB';

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

export function isReasoningDeepResearchStubEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_DEEP_RESEARCH_STUB_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
