/**
 * Block C · EPIC-T10 · client-side kill switch for the Tabele AI Editor panel.
 *
 * Mirrors the resolution order of `melsTabeleFlag` so operator overrides
 * (URL query / localStorage) work consistently across Tabele rollouts.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_tabeleAiEditor=0|1`
 *   2. `localStorage["ff.tabele_ai_editor"]`
 *   3. `import.meta.env.VITE_TABELE_AI_EDITOR`
 *   4. Default: ON (flip bez SHA, akcept Piotra; server flag defaults ON).
 */

const LS_KEY = 'ff.tabele_ai_editor';
const QUERY_KEY = 'ff_tabeleAiEditor';
const ENV_KEY = 'VITE_TABELE_AI_EDITOR';

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
    return parsed === null ? true : parsed; // Default ON — server flag also defaults ON
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

export function isTabeleAiEditorEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TABELE_AI_EDITOR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
