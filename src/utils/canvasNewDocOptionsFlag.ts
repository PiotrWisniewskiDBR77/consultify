/**
 * #87a — feature flag for the Canvas "+" New Canvas menu 3-option rebuild
 * (Czysty / Z szablonu / Z canvasa) in `WorkCanvasDocumentPanel`.
 *
 * Gates ONLY the header "+" dropdown content between:
 *   - OFF (default): the legacy single-tier "New Canvas from template" list
 *     (unchanged, still live on demo).
 *   - ON: three explicit sections — (1) Czysty (blank, no preset), (2) Z
 *     szablonu (existing `starterTemplates` gallery, untouched content), (3)
 *     Z canvasa (pick one of the user's other Work Canvas document drafts to
 *     seed the new document from). Every path seeds the docked Teresa via the
 *     canonical `consultify.teresa.pendingPrompt` channel (D17 — one Teresa,
 *     never a second chat).
 *
 * CLAUDE.md #7 — Piotr is never the first visual tester: ships OFF until a
 * dev-render screenshot pass is accepted, then flips default ON.
 *
 * Resolution order (highest wins), mirrors the retired `melsMindmapPanelFlag`:
 *   1. URL query `?ff_canvasNewDocOptions=0|1`
 *   2. `localStorage["ff.canvas_new_doc_options"]`
 *   3. `import.meta.env.VITE_CANVAS_NEW_DOC_OPTIONS`
 *   4. Default: ON (flip 2026-07-13, akcept Piotra; #87a zaakceptowany na
 *      zrzutach light+dark).
 */

const LS_KEY = 'ff.canvas_new_doc_options';
const QUERY_KEY = 'ff_canvasNewDocOptions';
const ENV_KEY = 'VITE_CANVAS_NEW_DOC_OPTIONS';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean | null {
  try {
    return parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
  } catch {
    return null;
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

export function isCanvasNewDocOptionsEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnvFlag();
  if (fromEnv !== null) return fromEnv;
  // #87a zaakceptowany przez Piotra 07-13 (zrzuty light+dark) → default ON.
  // Opt-out: ?ff_canvasNewDocOptions=0 lub localStorage ff.canvas_new_doc_options=0.
  return true;
}

export const CANVAS_NEW_DOC_OPTIONS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
