/**
 * Tools Light shell — feature flag for the Discovery Tools module redesign
 * (`<ToolsLightShell>`). Companion to `materialsLightFlag.ts`
 * (`isMaterialsLightEnabled` / `<MaterialsLightShell>`) and
 * `financeLightFlag.ts` (`isFinanceLightEnabled` / `<FinanceLightShell>`) —
 * identical resolution order, identical OFF-by-default posture.
 *
 * Where this flag gates
 * ----------------------
 *   * NOT wired into `DiscoveryToolsHub.tsx` yet. This step only ships the
 *     new component + the flag + the dev-render harness (CLAUDE.md rule #7:
 *     the owner never sees a real screen before a clean, self-rendered
 *     harness screenshot is approved). Real wiring into the hub (branch at
 *     render) is a later step, only after Piotr signs off on the redesign
 *     on the harness screenshot.
 *   * `<ToolsLightShell>` is presentational-only (no store/API dependency),
 *     so flipping this flag on later never touches persistence.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_toolsLight=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.tools_light"]` — user / org override.
 *   3. `import.meta.env.VITE_TOOLS_LIGHT` — build-time override.
 *   4. Default: OFF. Ships behind an OFF flag so the current Discovery Tools
 *      surface (`DiscoveryToolsHub`) stays the default until Piotr signs off
 *      on the redesign on demo. Set any override to `1` to preview.
 */

const LS_KEY = 'ff.tools_light';
const QUERY_KEY = 'ff_toolsLight';
const ENV_KEY = 'VITE_TOOLS_LIGHT';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, the legacy Discovery
  // Tools surface is the default. An explicit `1`/`true` env value opts in.
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

export function isToolsLightEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TOOLS_LIGHT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
