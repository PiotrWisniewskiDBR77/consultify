/**
 * COORD-08 · SIRI Prioritisation Matrix — kill switch for the `siri_pm_v2`
 * calculation engine (`src/services/siriPrioritisation.ts`).
 *
 * Mirrors `tabeleQaFlag.ts` / `recordProvenanceFlag.ts` so operator
 * overrides work consistently across rollouts.
 *
 * Where this flag gates
 * ----------------------
 *   - `siriAdapter.prioritise()` (`src/method-core/methods/siri/siriAdapter.ts`)
 *     reads this flag to decide `legacy_v1` vs `siri_pm_v2` WHEN the caller
 *     did not pass an explicit `parameters.calculationVersion`. An explicit
 *     `calculationVersion` always wins over the flag.
 *   - Default is OFF: `legacy_v1` remains the default calculation path
 *     until Piotr accepts `siri_pm_v2` on real fixtures (SIRI-PM whitepaper
 *     Step 6/Step 4 corrections — see SIRI_PM_V1_VS_V2.md).
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_siriPmV2=0|1` — operator bypass.
 *   2. `localStorage["ff.siri_pm_v2"]` — user / org override.
 *   3. `import.meta.env.VITE_SIRI_PM_V2` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.siri_pm_v2';
const QUERY_KEY = 'ff_siriPmV2';
const ENV_KEY = 'VITE_SIRI_PM_V2';

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

export function isSiriPmV2Enabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const SIRI_PM_V2_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
