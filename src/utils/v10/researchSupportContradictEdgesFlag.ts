/**
 * Chat V10 / V10-RSR-014 — feature flag for `SupportContradictEdges`
 * (R-RESEARCH-14, Wave A seed).
 *
 * Runtime contract lives in
 * `src/models/research/SupportContradictEdges.ts`. Default OFF —
 * Wave A seed pins `SUPPORT_STRENGTHS`, `SupportEdge`, `ContradictEdge`,
 * the pure `buildSupportEdge` / `buildContradictEdge` builders, and
 * invariants. LLM pairwise analysis wiring is Wave B.
 */

const LS_KEY = 'ff.research_support_contradict_edges';
const QUERY_KEY = 'ff_research_support_contradict_edges';
const ENV_KEY = 'VITE_RESEARCH_SUPPORT_CONTRADICT_EDGES';

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

export function isResearchSupportContradictEdgesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const RESEARCH_SUPPORT_CONTRADICT_EDGES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
