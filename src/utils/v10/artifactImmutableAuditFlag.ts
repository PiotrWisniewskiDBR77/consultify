/**
 * Chat V10 / V10-ART-023 — feature flag for the immutable
 * audit trail (append-only + per-DataClassification retention).
 *
 * Runtime contract lives in
 * `src/models/artifact/ImmutableAuditTrail.ts`. Default OFF —
 * Wave A seed pins the 6-kind governance catalogue, the
 * per-classification retention floors, the append-only
 * invariant, and the governance-event coverage contract; the
 * Wave B append-only Postgres table + retention sweep bind to
 * these shapes.
 */

const LS_KEY = 'ff.artifact_immutable_audit';
const QUERY_KEY = 'ff_artifact_immutable_audit';
const ENV_KEY = 'VITE_ARTIFACT_IMMUTABLE_AUDIT';

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

export function isArtifactImmutableAuditEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_IMMUTABLE_AUDIT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
