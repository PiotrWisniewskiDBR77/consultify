/**
 * Chat V10 / V10-ART-002 — feature flag for the ArtifactType registry.
 *
 * What this flag gates
 * --------------------
 * Adoption of `ARTIFACT_TYPE_REGISTRY` as the single lookup for
 * artifact-type metadata (renderer, supported ops, default
 * classification, export formats). Wave A seed ships only the
 * registry; the gate becomes meaningful when per-type implementation
 * tickets (V10-ART-006, V10-ART-016..020) start resolving renderer /
 * default classification through this registry instead of hard-coded
 * switch statements.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_artifact_type_registry=0|1`
 *   2. localStorage `ff.artifact_type_registry`
 *   3. env          `VITE_ARTIFACT_TYPE_REGISTRY`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.artifact_type_registry';
const QUERY_KEY = 'ff_artifact_type_registry';
const ENV_KEY = 'VITE_ARTIFACT_TYPE_REGISTRY';

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

export function isArtifactTypeRegistryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_TYPE_REGISTRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
