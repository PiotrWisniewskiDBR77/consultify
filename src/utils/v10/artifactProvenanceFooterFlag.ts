/**
 * Chat V10 / V10-ART-025 — feature flag for the watermark +
 * provenance footer on external shares.
 *
 * Runtime contract lives in
 * `src/models/artifact/ProvenanceFooter.ts`. Default OFF —
 * Wave A seed pins the ProvenanceFooter shape, the closed footer-
 * target catalogue, WatermarkSpec, and the three invariants;
 * Wave B PDF/PPTX/XLSX renderer integration consumes these shapes.
 */

const LS_KEY = 'ff.artifact_provenance_footer';
const QUERY_KEY = 'ff_artifact_provenance_footer';
const ENV_KEY = 'VITE_ARTIFACT_PROVENANCE_FOOTER';

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

export function isArtifactProvenanceFooterEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_PROVENANCE_FOOTER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
