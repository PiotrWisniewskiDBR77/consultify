/**
 * Chat V10 / V10-ART-016 — feature flag for the `slide_deck`
 * canonical schema (6 layouts × 4 block kinds) + `move_block` op +
 * serde identity.
 *
 * Gates `TypedSlideDeckContent` / `applyMoveBlock` /
 * `serializeSlideDeck` / `deserializeSlideDeck` /
 * `assertSlideDeckContent` at the renderer + applier ingress.
 * Runtime contract lives in
 * `src/models/artifact/SlideDeckSchema.ts`. Default OFF — the Wave A
 * seed pins the schema; the renderer lands in Wave B.
 */

const LS_KEY = 'ff.artifact_slide_deck_schema';
const QUERY_KEY = 'ff_artifact_slide_deck_schema';
const ENV_KEY = 'VITE_ARTIFACT_SLIDE_DECK_SCHEMA';

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

export function isArtifactSlideDeckSchemaEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_SLIDE_DECK_SCHEMA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
