/**
 * DOC-0 (DEC-593) — reveal flag for the single read-only document viewer.
 *
 * Why a flag: the viewer replaces four bespoke document views behind ONE
 * read-only surface, and the open-path switch (list row → viewer instead of
 * Report Builder) is a behaviour change the owner must accept on a screenshot
 * first (canon: "Piotr nigdy nie jest pierwszym testerem wizualnym").
 *
 * ★ Default = OFF. OFF → nothing renders the viewer, every existing open path
 * keeps its current target byte-for-byte. ON → `DocumentViewer` is reachable
 * from the caller that opts in.
 *
 * Order of precedence (highest wins), mirroring `src/utils/templatesGalleryFlag.ts`:
 *   1. URL query `?ff_doc0_document_viewer=0|1` — operator/dev/dev-render bypass.
 *   2. `localStorage["ff.doc0DocumentViewer"]` — user/org override.
 *   3. `import.meta.env.VITE_DOC0_DOCUMENT_VIEWER` — build time.
 *   4. Default: OFF (fail-closed — an unparsable value is OFF, never ON).
 */

const LS_KEY = 'ff.doc0DocumentViewer';
const QUERY_KEY = 'ff_doc0_document_viewer';
const ENV_KEY = 'VITE_DOC0_DOCUMENT_VIEWER';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
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

export function isDocumentViewerEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const DOCUMENT_VIEWER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
