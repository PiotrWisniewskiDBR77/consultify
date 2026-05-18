/**
<<<<<<<< HEAD:src/utils/melsTabeleFlag.ts
 * EPIC-T16 — feature flag for the Tabele MELS shell migration.
 *
 * Where this flag gates
 * ---------------------
 *   * `<TabeleView>` branches between the legacy `KimiWorkspaceShell`
 *     mount and the new `<TabeleMelsView>` (`ExecutiveModuleShell`
 *     adapter) when this flag is ON.
 *   * The adapter is presentational only — it consumes the same
 *     `useKimiArtifactPipeline` state, so flipping the flag is a pure
 *     UI swap with no data-path change.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_melsTabele=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.mels_tabele"]` — user / org override.
 *   3. `import.meta.env.VITE_MELS_TABELE` — build-time default.
 *   4. Default: OFF. The MELS migration ships behind a closed flag
 *      until EPIC-T16-S4 visual review + DBR77 hex scan pass.
========
 * Chat V10 / V10-ART artifact-type registry feature flag.
 *
 * Default OFF until artifact renderers and supported operations use the registry.
>>>>>>>> origin/main:src/utils/v10/artifactTypeRegistryFlag.ts
 */

const LS_KEY = 'ff.mels_tabele';
const QUERY_KEY = 'ff_melsTabele';
const ENV_KEY = 'VITE_MELS_TABELE';

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

export function isMelsTabeleEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MELS_TABELE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
