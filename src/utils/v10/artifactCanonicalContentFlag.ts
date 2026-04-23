/**
 * Chat V10 / V10-ART-006 — feature flag for per-type canonical content.
 *
 * Gates adoption of `ArtifactCanonicalContent` discriminated union,
 * `assertNodeIdsUnique`, and `assertContentMatchesType` at the
 * ArtifactStore boundary. When ON, writes are rejected unless
 * content is the typed union (not the V10-ART-001 opaque blob) and
 * the owned-node-ids invariant holds. Default OFF. See `ADR-V10-002`.
 */

const LS_KEY = 'ff.artifact_canonical_content';
const QUERY_KEY = 'ff_artifact_canonical_content';
const ENV_KEY = 'VITE_ARTIFACT_CANONICAL_CONTENT';

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

export function isArtifactCanonicalContentEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_CANONICAL_CONTENT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
