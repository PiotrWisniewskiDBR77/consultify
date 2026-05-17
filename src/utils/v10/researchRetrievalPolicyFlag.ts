/**
 * Chat V10 / V10-RSR-003 — feature flag for `RetrievalPolicy`
 * (R-RESEARCH-3, Wave A seed).
 *
 * Runtime contract lives in
 * `src/models/research/RetrievalPolicy.ts`. Default OFF —
 * Wave A seed pins the three-tier policy enum, `RetrievalPolicyConfig`
 * shape, and four invariants. Runtime fetch-middleware and the
 * open-web admin opt-in settings page are Wave B.
 */

const LS_KEY = 'ff.research_retrieval_policy';
const QUERY_KEY = 'ff_research_retrieval_policy';
const ENV_KEY = 'VITE_RESEARCH_RETRIEVAL_POLICY';

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

export function isResearchRetrievalPolicyEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const RESEARCH_RETRIEVAL_POLICY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
