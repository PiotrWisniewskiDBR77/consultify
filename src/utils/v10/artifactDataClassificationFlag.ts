/**
 * Chat V10 / V10-ART-004 — feature flag for DataClassification gating.
 *
 * What this flag gates
 * --------------------
 * Adoption of `DATA_CLASSIFICATION_POLICIES` + `canExportToFormat` as
 * the single export / egress / masking resolver. When ON, the
 * ArtifactStore (V10-ART-015) blocks exports that violate the table;
 * when OFF, V9 legacy export proceeds.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 */

const LS_KEY = 'ff.artifact_data_classification';
const QUERY_KEY = 'ff_artifact_data_classification';
const ENV_KEY = 'VITE_ARTIFACT_DATA_CLASSIFICATION';

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

export function isArtifactDataClassificationEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_DATA_CLASSIFICATION_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
