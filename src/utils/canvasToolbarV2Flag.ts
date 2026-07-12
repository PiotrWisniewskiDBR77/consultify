/**
 * Canvas toolbar V2 — feature flag for the lightweight canvas toolbar
 * (`<CanvasToolbarV2>`), built to Piotr's L→R spec from the home review
 * (Harvard/wdrozenie-100/_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md, wpisy
 * #87-#87d): New Canvas (blank first) · document conversions
 * (Prezentacja/Raport/Excel) · idea/note conversions (Mind
 * Map/Process Flow/Whiteboard/Tabela/Notatka) · import/export MD · widok
 * MD<->dokument · X · slim kebab. Removes Promote + Task/Decision/Initiative
 * + Historia from the canvas-level toolbar per Piotr's explicit instruction
 * (#87b/#87c).
 *
 * Where this flag gates
 * ----------------------
 *   * `<WorkCanvasDocumentPanel>` branches at the toolbar render between the
 *     legacy toolbar (unchanged, default) and `<CanvasToolbarV2>` when ON.
 *   * Pure UI swap — no data-path change. The V2 toolbar calls the SAME
 *     underlying handlers (runWorkspaceAction/runOutputAction/exportDocument/
 *     setMode/selectTemplate) as the legacy toolbar.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_canvasToolbarV2=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.canvas_toolbar_v2"]` — user / org override.
 *   3. `import.meta.env.VITE_CANVAS_TOOLBAR_V2` — build-time override.
 *   4. Default: OFF. Ships OFF so the current toolbar stays the default
 *      surface until Piotr signs off on the redesign on demo (doctrine: "Piotr
 *      nigdy nie jest pierwszym testerem wizualnym").
 */

const LS_KEY = 'ff.canvas_toolbar_v2';
const QUERY_KEY = 'ff_canvasToolbarV2';
const ENV_KEY = 'VITE_CANVAS_TOOLBAR_V2';

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

export function isCanvasToolbarV2Enabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const CANVAS_TOOLBAR_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
