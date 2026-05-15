/**
 * Chat V10 / V10-ONB-015 — feature flag for the first-export
 * manifest + SHA-256 gate (manifest preview before download,
 * canonical sidecar, version lineage).
 *
 * Gates `ExportManifest` / `ExportPreviewGate` /
 * `assertExportPreviewGateOpen` at the export service ingress.
 * Runtime contract lives in
 * `src/models/onboarding/FirstExportManifest.ts`.
 *
 * **On-by-construction.** The dev plan acceptance criterion is
 * "100% of first exports require manifest preview." The flag's
 * canonical default is ON; disabling it is incident-response only
 * (e.g. hotfix a manifest-computation bug while keeping exports
 * available via a documented fallback).
 */

const LS_KEY = 'ff.onboard_first_export_manifest';
const QUERY_KEY = 'ff_onboard_first_export_manifest';
const ENV_KEY = 'VITE_ONBOARD_FIRST_EXPORT_MANIFEST';

const HARDCODED_DEFAULT = true;

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

export function isOnboardFirstExportManifestEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ONBOARD_FIRST_EXPORT_MANIFEST_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
