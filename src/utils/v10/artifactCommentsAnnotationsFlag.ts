/**
 * Chat V10 / V10-ART-021 — feature flag for the native-review
 * comments + annotations schema (anchor survival + mention
 * notification invariants).
 *
 * Runtime contract lives in
 * `src/models/artifact/CommentsAndAnnotations.ts`. Default OFF —
 * Wave A seed pins the 4-kind annotation catalogue, the
 * anchor-mutation re-attach transition, and the mention-
 * notification invariant; the Wave B side-panel + inline-
 * indicator renderer and notifications delivery pipeline bind
 * to this shape.
 */

const LS_KEY = 'ff.artifact_comments_annotations';
const QUERY_KEY = 'ff_artifact_comments_annotations';
const ENV_KEY = 'VITE_ARTIFACT_COMMENTS_ANNOTATIONS';

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

export function isArtifactCommentsAnnotationsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_COMMENTS_ANNOTATIONS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
