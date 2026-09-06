/**
 * Chat V9 / NAV-M2-lite — kill-switch for the workspace breadcrumb
 * pill.
 *
 * When ON (default), a small `Chat › <view label>` pill renders
 * above non-chat workspace views. When OFF, the component returns
 * null pixel-for-pixel identically to the pre-NAV-M2-lite layout.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_workspaceBreadcrumb=0|1`.
 *   2. `localStorage["ff.workspace_breadcrumb"]`.
 *   3. `import.meta.env.VITE_WORKSPACE_BREADCRUMB`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.workspace_breadcrumb';
const QUERY_KEY = 'ff_workspaceBreadcrumb';
const ENV_KEY = 'VITE_WORKSPACE_BREADCRUMB';

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
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isWorkspaceBreadcrumbEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const WORKSPACE_BREADCRUMB_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
