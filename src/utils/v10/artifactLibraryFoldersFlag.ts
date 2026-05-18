/**
 * Chat V10 / V10-ART-026 — feature flag for library folders
 * (Drafts / Approved / Exported / Templates).
 *
 * Runtime contract lives in
 * `src/models/artifact/LibraryFolders.ts`. Default OFF —
 * Wave A seed pins the four-folder catalogue, the placement
 * reducer, and the transition-soundness invariant; the Wave B
 * per-tenant library UI + CFO workspace bootstrap bind to these
 * shapes.
 */

const LS_KEY = 'ff.artifact_library_folders';
const QUERY_KEY = 'ff_artifact_library_folders';
const ENV_KEY = 'VITE_ARTIFACT_LIBRARY_FOLDERS';

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

export function isArtifactLibraryFoldersEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_LIBRARY_FOLDERS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
