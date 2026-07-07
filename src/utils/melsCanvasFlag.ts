/**
 * EditorShell Wave W (W-1) — feature flag for the canvas (Ideas) MELS shell
 * migration. Gates the four canvases (Mind Map / Process Flow / Idea Table /
 * Whiteboard) between their legacy floating canvas-chrome and the new
 * `<IdeaCanvasMelsView>` (`EditorShell` / `ExecutiveModuleShell` adapter,
 * `centerMode='canvas'`).
 *
 * Where this flag gates
 * ---------------------
 *   * `<IdeaMapWorkspace>` branches at the top of render between the legacy
 *     canvas-chrome (CanvasLeftToolbar + IdeaWorkspaceToolbar +
 *     IdeaWorkspaceTools floating over the canvas) and the shell adapter
 *     when this flag is ON.
 *   * The adapter is presentational only — IdeaMapWorkspace retains ALL
 *     canvas state, effects, autosave, collaboration, refs and handlers,
 *     and forwards ready-made React nodes + chip descriptors to the view.
 *     Flipping the flag is a pure UI swap with no data-path change (mirrors
 *     `melsDeckBuilderFlag` / `melsTabeleFlag`).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_melsCanvas=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.mels_canvas"]` — user / org override.
 *   3. `import.meta.env.VITE_MELS_CANVAS` — build-time override.
 *   4. Default: OFF. Wave W-1 ships behind an OFF flag so the proven legacy
 *      canvas-chrome stays the default surface until Piotr signs off on the
 *      Mind Map reference on demo. Set any override to `1` to preview.
 */

const LS_KEY = 'ff.mels_canvas';
const QUERY_KEY = 'ff_melsCanvas';
const ENV_KEY = 'VITE_MELS_CANVAS';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, the legacy canvas-chrome
  // is the default surface. An explicit `1`/`true` env value opts in.
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

export function isMelsCanvasEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MELS_CANVAS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
