/**
 * Vegas Faza 1 (VF1-8/9/10) — feature flag for the SPEC-A canonical
 * empty / skeleton / error states on the three A·Canvas artifacts
 * (Mind Map / Process Flow / Whiteboard, shared shell `IdeaMapWorkspace`).
 *
 * What this flag gates
 * --------------------
 *   * `<IdeaMapWorkspace>` loading placeholder swaps `LoadingState` → the
 *     canonical `SkeletonState variant="canvas"`.
 *   * `<IdeaProcessFlowTool>` loading spinner → `SkeletonState variant="canvas"`,
 *     and the bespoke load-error inline block → canonical `ErrorState`.
 *   * `<IdeaWhiteboardTool>` bespoke skeleton grid → `SkeletonState variant="canvas"`.
 *
 * All swaps are presentational only — the canvas state, autosave, collaboration
 * and data paths are untouched. Default OFF: the proven legacy placeholders stay
 * the default surface until Piotr signs off on the SPEC-A canvas states on demo
 * (rule #7 — Piotr never the first visual tester). Set any override to `1` to
 * preview.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_vf1CanvasSpecA=0|1` — operator bypass for visual review.
 *   2. `localStorage["ff.vf1_canvas_speca"]` — user / org override.
 *   3. `import.meta.env.VITE_VF1_CANVAS_SPECA` — build-time override.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.vf1_canvas_speca';
const QUERY_KEY = 'ff_vf1CanvasSpecA';
const ENV_KEY = 'VITE_VF1_CANVAS_SPECA';

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

export function isVf1CanvasSpecAEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VF1_CANVAS_SPECA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
