/**
 * Chat V10 / V10-RSR-013 — feature flag for `ClaimNodeSourceEdge`
 * (R-RESEARCH-13, Wave A seed).
 *
 * Runtime contract lives in
 * `src/models/research/ClaimNodeSourceEdge.ts`. Default OFF —
 * Wave A seed pins `ClaimNode`, `SourceEdge`, `ClaimNodeSourceEdgePair`,
 * the pure `buildClaimNodeWithSourceEdge` builder, and invariants.
 * LLM-based extractor wiring and graph persistence are Wave B.
 */

const LS_KEY = 'ff.research_claim_node_source_edge';
const QUERY_KEY = 'ff_research_claim_node_source_edge';
const ENV_KEY = 'VITE_RESEARCH_CLAIM_NODE_SOURCE_EDGE';

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

export function isResearchClaimNodeSourceEdgeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const RESEARCH_CLAIM_NODE_SOURCE_EDGE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
