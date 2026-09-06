/**
 * Block D · EPIC-T14 · client-side kill switch for the Tabele lane
 * Form Intake (JWT) UI: the admin-side `IntakeJwtPanel` and the public
 * `PublicJwtFormPage` route. The flag mirrors the backend feature flag
 * `ENABLE_TABLE_FORM_INTAKE_JWT` so operators can keep the surface dark
 * even after the server-side toggle is on.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_tabeleFormIntake=0|1`
 *   2. `localStorage["ff.tabele_form_intake"]`
 *   3. `import.meta.env.VITE_TABELE_FORM_INTAKE`
 *   4. Default: OFF.
 *
 * Note: the public `PublicJwtFormPage` consults this flag via
 * `import.meta.env` only (URL/localStorage may not be available on the
 * recipient browser before the bundle hydrates). The admin surface
 * consults all three sources because it always runs inside the SPA.
 */

const LS_KEY = 'ff.tabele_form_intake';
const QUERY_KEY = 'ff_tabeleFormIntake';
const ENV_KEY = 'VITE_TABELE_FORM_INTAKE';

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

export function isTabeleFormIntakeEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TABELE_FORM_INTAKE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
