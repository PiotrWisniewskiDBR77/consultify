/**
 * Chat V10 / V10-ART-022 — feature flag for the ArtifactStore
 * contract (tenant-isolation + P90-latency + version-
 * immutability invariants).
 *
 * Runtime contract lives in
 * `src/models/artifact/ArtifactStoreContract.ts`. Default OFF —
 * Wave A seed pins the 6-operation catalogue, the 200ms P90
 * latency budget, the 500-char search query cap, the row-level
 * tenant isolation rule, and the version-immutability rule; the
 * Wave B Postgres-backed service `src/services/artifact/
 * ArtifactStore.ts` binds to this contract.
 */

const LS_KEY = 'ff.artifact_store_contract';
const QUERY_KEY = 'ff_artifact_store_contract';
const ENV_KEY = 'VITE_ARTIFACT_STORE_CONTRACT';

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

export function isArtifactStoreContractEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_STORE_CONTRACT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
