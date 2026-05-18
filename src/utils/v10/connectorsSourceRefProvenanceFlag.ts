/**
 * Chat V10 / V10-CON-008 — feature flag for SourceRefProvenance
 * (branded SourceRef carrying connector + session + tenant + fetch metadata
 * + content hash + access class, immutability + tenant-scoping +
 * hash-stability + write-access-retrieval invariants).
 *
 * Runtime contract lives in
 * `src/models/connectors/SourceRefProvenance.ts`. Default OFF —
 * Wave A seed pins the SourceRef shape and four runtime invariants;
 * Wave B retrieval and cache layers attach to this contract.
 */

const LS_KEY = 'ff.connectors_source_ref_provenance';
const QUERY_KEY = 'ff_connectors_source_ref_provenance';
const ENV_KEY = 'VITE_CONNECTORS_SOURCE_REF_PROVENANCE';

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

export function isConnectorsSourceRefProvenanceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CONNECTORS_SOURCE_REF_PROVENANCE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
