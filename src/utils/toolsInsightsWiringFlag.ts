/**
 * Tools Insights Wiring — kill-switch for surfacing the canonical
 * `tool_outputs` snapshot (migration 946, `GET /api/tool-outputs`) inside the
 * Tools module's Outputs/Insights tab aggregate list.
 *
 * DEC-118 (supervisor panel, 2026-08-26, Tools 5.0/10, "PRZERWANY W POŁOWIE"):
 * the output LAYER exists end-to-end in the database and controllers
 * (`tool_outputs` with content_hash/version/supersedes/frozen_at, a REST
 * surface with approve/reopen/revision history, real-DB tests) but the
 * module-level Outputs tab bootstrap
 * (`src/components/Discovery/DiscoveryToolsHub.tsx`'s `fetchData`) never
 * called `Api.listToolOutputs()` — a session could be promoted to an
 * approved Output and a consultant would never see it in the aggregate list
 * (only inside that one session's own workspace, via
 * `src/components/DiscoveryTools/report/ToolOutputsPanel.tsx`, already wired
 * into `ToolWorkspace.tsx`).
 *
 * Mechanika (the `tool_outputs` read surface itself) does NOT change here —
 * this flag gates only whether `DiscoveryToolsHub`'s bootstrap additionally
 * fetches and merges those rows into the aggregate Outputs/Insights list, a
 * layout-affecting change (new row type, new column-icon mapping) per
 * CLAUDE.md's "ZAKAZ MASOWEGO WŁĄCZANIA" rule — shipped OFF until the owner
 * accepted a clean screenshot. Piotr ZAAKCEPTOWAŁ na zrzutach dev-render
 * (2026-08-27) — default flipped to ON (see `ideaInspectorRightRailFlag.ts`
 * DEC-90, commit 1e8bd6b7f4, for the identical flip pattern).
 *
 * COFNIĘTE 28.08 (DEC-158): read-only kontrola bazy staging potwierdziła, że
 * tabela `tool_outputs` NIE ISTNIEJE na tej bazie. Z default=ON bootstrap
 * `DiscoveryToolsHub`'s `fetchData` wołał `Api.listToolOutputs()`
 * bezwarunkowo w `Promise.all`; `ToolOutputsController.listOutputs` →
 * `queryHelpers.queryAll` odrzuca (nie połyka błędu) → 500
 * (`ErrorHandler.ts:190`) → `DiscoveryToolsHub.tsx` przy odpowiedzi 5xx
 * celowo POMIJA fallback `{outputs:[]}` i rzuca dalej → cały hub narzędzi
 * (nie tylko zakładka Insights) pada na pełnoekranowy błąd. Default wraca na
 * OFF, dopóki istnienie tabeli na żywej bazie nie zostanie potwierdzone
 * ponownie. Reguła CLAUDE.md nr 7 (Piotr nigdy nie jest pierwszym testerem
 * wizualnym) — taki ekran nie może wystąpić.
 *
 * Resolution order (highest wins), identical contract to
 * `criterionWorkspaceV2Flag.ts` / `initiativesBulkStubFlag.ts` /
 * `m03DecisionWorkspaceFlag.ts` (query ?? local ?? env ?? default):
 *   1. URL query `?ff_toolsInsightsWiring=1|0`
 *   2. `localStorage["ff.tools_insights_wiring"]`
 *   3. `import.meta.env.VITE_TOOLS_INSIGHTS_WIRING`
 *   4. Default: OFF — cofnięte 28.08 (tool_outputs nie istnieje na bazie
 *      staging, DEC-158); ponowne włączenie dopiero po potwierdzeniu tabeli
 *      na żywej bazie. The outer catch below still resolves to OFF on any
 *      read error, unchanged.
 *
 * Resolution result is cached at module scope — call
 * `resetToolsInsightsWiringFlagCache` between reads in tests.
 */

const LS_KEY = 'ff.tools_insights_wiring';
const QUERY_KEY = 'ff_toolsInsightsWiring';
const ENV_KEY = 'VITE_TOOLS_INSIGHTS_WIRING';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean | null {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta?.env?.[ENV_KEY]);
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

let cached: boolean | null = null;

/**
 * Resolution: query > localStorage > env > default (OFF again since the
 * 2026-08-28 revert, DEC-158 — `tool_outputs` does not exist on the staging
 * database). Any read error along the chain still resolves to OFF rather
 * than throwing — the catch's fail-closed semantics are untouched. Result is
 * cached at module scope — call `resetToolsInsightsWiringFlagCache` to force
 * a re-read (tests, or after an in-session override changes
 * query/localStorage).
 */
export function isToolsInsightsWiringEnabled(): boolean {
  if (cached !== null) return cached;
  let resolved: boolean;
  try {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    const fromEnv = readEnvFlag();
    resolved = fromQuery ?? fromLs ?? fromEnv ?? false;
  } catch {
    resolved = false;
  }
  cached = resolved;
  return cached;
}

export const resetToolsInsightsWiringFlagCache = (): void => {
  cached = null;
};

export const TOOLS_INSIGHTS_WIRING_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
