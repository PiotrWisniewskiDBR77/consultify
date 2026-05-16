/**
 * Chat V10 / V10-ART-008 — feature flag for the typed ArtifactOp union.
 *
 * Gates adoption of `assertArtifactOp` + `reverseArtifactOp` at the
 * MutationProposal ingress (V10-ART-007) and the apply pipeline
 * (V10-ART-010). When ON, proposals MUST carry typed ops from the
 * closed union; when OFF, the legacy opaque-kind placeholder is
 * accepted. Default OFF.
 * See `ADR-V10-002`.
 */

const LS_KEY = 'ff.artifact_typed_ops';
const QUERY_KEY = 'ff_artifact_typed_ops';
const ENV_KEY = 'VITE_ARTIFACT_TYPED_OPS';

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

export function isArtifactTypedOpsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_TYPED_OPS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
