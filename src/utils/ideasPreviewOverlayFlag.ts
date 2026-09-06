/**
 * MyWork / Ideas — feature flag for the desktop preview OVERLAY (#4b).
 *
 * What this flag gates
 * --------------------
 *   - When ON, the Ideas list (`MyIdeasListContent`) passes
 *     `desktopPreviewOverlay` to `TableWithPreviewLayout`, so on ≥lg the preview
 *     pane floats as a right-edge overlay ABOVE the card grid instead of being a
 *     flex sibling. Result: the card grid keeps its full width (no reflow from
 *     3→2 columns when the preview opens). Mobile is unchanged (already an overlay).
 *   - When OFF, behaviour is identical to today (flex-sibling preview, table
 *     reflows). Default is OFF because this is a visual change that must be
 *     accepted by the owner on screenshots first (UI rule #7).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_ideasPreviewOverlay=0|1` — operator bypass (for dev-render/demo).
 *   2. `localStorage["ff.ideas_preview_overlay"]` — user override.
 *   3. `import.meta.env.VITE_IDEAS_PREVIEW_OVERLAY` — build-time default.
 *   4. Default: ON (flip 2026-07-13, akcept Piotra; #4b zaakceptowany na
 *      zrzutach light+dark).
 */

const LS_KEY = 'ff.ideas_preview_overlay';
const QUERY_KEY = 'ff_ideasPreviewOverlay';
const ENV_KEY = 'VITE_IDEAS_PREVIEW_OVERLAY';

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

export function isIdeasPreviewOverlayEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  const fromEnv = readEnvFlag();
  if (fromEnv !== null) return fromEnv;
  // #4b zaakceptowany przez Piotra 07-13 (zrzuty light+dark, zero-reflow dowód) → default ON.
  // Opt-out: ?ff_ideasPreviewOverlay=0.
  return true;
}

export const IDEAS_PREVIEW_OVERLAY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
