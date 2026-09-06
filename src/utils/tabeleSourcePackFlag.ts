/**
 * Block C · EPIC-T12 · client-side kill switch for the Tabele Source Pack
 * builder panel.
 *
 * Mirrors `melsTabeleFlag`, `tabeleAiEditorFlag`, and `tabeleQaFlag` so
 * operator overrides work consistently across Tabele rollouts.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_tabeleSourcePack=0|1`
 *   2. `localStorage["ff.tabele_source_pack"]`
 *   3. `import.meta.env.VITE_TABELE_SOURCE_PACK`
 *   4. Default: OFF until backend `ENABLE_TABLE_SOURCE_PACK` is enabled.
 */

const LS_KEY = 'ff.tabele_source_pack';
const QUERY_KEY = 'ff_tabeleSourcePack';
const ENV_KEY = 'VITE_TABELE_SOURCE_PACK';

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

export function isTabeleSourcePackEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TABELE_SOURCE_PACK_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
