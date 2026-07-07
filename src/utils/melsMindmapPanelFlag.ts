/**
 * Oś P (Powłoka SPEC-A) — feature flag for the Mind Map consolidated right panel.
 *
 * Gates the Mind Map right side between its THREE legacy sliding drawers
 * (`IdeaWorkspaceTools` + `IdeaContextPanel` + `IdeaAISuggestionsPanel`,
 * mutually-exclusive via `activePanel`) and a SINGLE consolidated
 * `<ArtifactRightPanel>` (SPEC-A accordion) that collects their content as
 * accordion sections.
 *
 * Where this flag gates
 * ---------------------
 *   * `<IdeaMapWorkspace>` `renderWorkspaceSiblings()` branches: when this flag
 *     is ON it renders `<IdeaMapConsolidatedPanel>` (one ArtifactRightPanel with
 *     Properties/Tools · Context · AI-Suggestions sections) instead of the three
 *     legacy drawers. Only the Mind Map tool is affected — Process Flow /
 *     Whiteboard / Table keep their legacy panels until Piotr signs off.
 *   * The consolidated panel is a pure "wrap" adapter (like the mels canvas
 *     adapter): it does NOT lift state. It renders the existing panel
 *     components as section children with their `open` forced true and forwards
 *     the exact same props IdeaMapWorkspace already computes. Flipping the flag
 *     is a pure UI regroup with no data-path change (mirrors `melsCanvasFlag`).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_melsMindmapPanel=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.mels_mindmap_panel"]` — user / org override.
 *   3. `import.meta.env.VITE_MELS_MINDMAP_PANEL` — build-time override.
 *   4. Default: OFF. Ships behind an OFF flag so the proven three legacy
 *      drawers stay the default surface until Piotr signs off on the
 *      consolidated Mind Map reference on demo. Set any override to `1` to
 *      preview.
 */

const LS_KEY = 'ff.mels_mindmap_panel';
const QUERY_KEY = 'ff_melsMindmapPanel';
const ENV_KEY = 'VITE_MELS_MINDMAP_PANEL';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, the three legacy drawers
  // are the default surface. An explicit `1`/`true` env value opts in.
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

export function isMindmapConsolidatedPanel(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MELS_MINDMAP_PANEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
