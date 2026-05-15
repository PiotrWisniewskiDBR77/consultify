/**
 * Chat V10 / V10-ART-001 — feature flag for the unified `Artifact` model.
 *
 * What this flag gates
 * --------------------
 * Adoption of `src/models/artifact/Artifact.ts` (the V10 unified
 * Artifact interface) by downstream modules. Wave A seed ships only
 * the schema + this flag; the gate becomes meaningful when modules
 * start writing through `ArtifactStore` (V10-ART-022) and stop using
 * their legacy per-module storage.
 *
 * Default
 * -------
 * **OFF** — every V10 flag defaults off until the corresponding
 * surface is shipped end-to-end. Enforced by V10 registry invariant
 * "every flag defaults to false". See `ADR-V10-002`.
 *
 * Resolution order (highest wins, V10 helper convention)
 * ------------------------------------------------------
 *   1. URL query   `?ff_artifact_unified_model=0|1`  — operator bypass.
 *   2. localStorage `ff.artifact_unified_model`      — per-user override.
 *   3. env          `VITE_ARTIFACT_UNIFIED_MODEL`     — build-time default.
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.artifact_unified_model';
const QUERY_KEY = 'ff_artifact_unified_model';
const ENV_KEY = 'VITE_ARTIFACT_UNIFIED_MODEL';

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

export function isArtifactUnifiedModelEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_UNIFIED_MODEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
