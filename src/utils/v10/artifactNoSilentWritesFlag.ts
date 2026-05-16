/**
 * Chat V10 / V10-ART-010 — feature flag for the no-silent-writes
 * runtime invariant.
 *
 * **On-by-construction.** Per master plan §4.3 and `ADR-V10-002`,
 * this flag ships `default: true`. Disabling it is an incident-
 * response kill switch only; V10 CI invariant 23 mirror asserts it
 * is a member of the on-by-construction allowlist.
 *
 * When ON, `ArtifactStore.writeVersion` refuses direct calls that
 * bypass the `MutationProposal` → `applyProposal` path.
 * When OFF (kill-switch), the guard is skipped — only to unblock
 * disaster recovery. The ESLint rule that forbids direct writes at
 * the source-code level is not gated by this flag; lint drift would
 * require a separate rule disable.
 */

const LS_KEY = 'ff.artifact_no_silent_writes';
const QUERY_KEY = 'ff_artifact_no_silent_writes';
const ENV_KEY = 'VITE_ARTIFACT_NO_SILENT_WRITES';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

const HARDCODED_DEFAULT = true;

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
    return parsed === null ? HARDCODED_DEFAULT : parsed;
  } catch {
    return HARDCODED_DEFAULT;
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

export function isArtifactNoSilentWritesEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_NO_SILENT_WRITES_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
