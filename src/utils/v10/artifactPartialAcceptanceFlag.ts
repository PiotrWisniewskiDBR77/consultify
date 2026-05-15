/**
 * Chat V10 / V10-ART-012 — feature flag for partial acceptance of a
 * MutationProposal.
 *
 * Gates `PartialAcceptance` + `deriveRejectedOps` at the applier
 * ingress. When ON, the applier accepts a subset of ops and writes a
 * rejected-ops log on the proposal for learning. Runtime contract
 * lives in `src/models/artifact/PartialAcceptance.ts`. Default OFF.
 */

const LS_KEY = 'ff.artifact_partial_acceptance';
const QUERY_KEY = 'ff_artifact_partial_acceptance';
const ENV_KEY = 'VITE_ARTIFACT_PARTIAL_ACCEPTANCE';

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

export function isArtifactPartialAcceptanceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_PARTIAL_ACCEPTANCE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
