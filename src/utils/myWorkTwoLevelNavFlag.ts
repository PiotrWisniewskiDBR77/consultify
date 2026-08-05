/**
 * M02-P01 (Shell/Nav) — feature flag for the grouped two-level My Work nav
 * (`MyWorkNav`, group chips -> tab chips) that replaces the flat single-row
 * tab bar inside `MyWorkHub.tsx`.
 *
 * Where this flag gates
 * ----------------------
 *   - `MyWorkHub.tsx` main nav row — when OFF (default), the exact current
 *     flat tab bar renders (byte-identical to `origin/demo`, not a
 *     re-implementation behind a branch). When ON, `<MyWorkNav>` renders
 *     instead: level 1 = group chips (Kolejki pracy / Wiedza / Automatyzacja
 *     / Zarządzanie), level 2 = the active group's tab chips.
 *   - This is a brand-new visual surface (CLAUDE.md rule 7/9: nothing
 *     visually new goes live without a clean screenshot + Piotr's accept) →
 *     default **OFF**. Flip to ON only after the evidence pack under
 *     `docs/ui-standards/evidence/final-acceptance-2026-08-05/02-my-work/nav/`
 *     has been reviewed and accepted.
 *
 * Resolution order (highest wins) — same pattern as `clientVaultFlag.ts` /
 * `agentPlanFlag.ts`:
 *   1. URL query `?ff_myWorkTwoLevelNav=0|1` — operator/dev-render bypass.
 *   2. `localStorage["ff.mywork_two_level_nav"]` — user/org override.
 *   3. `import.meta.env.VITE_MYWORK_TWO_LEVEL_NAV` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.mywork_two_level_nav';
const QUERY_KEY = 'ff_myWorkTwoLevelNav';
const ENV_KEY = 'VITE_MYWORK_TWO_LEVEL_NAV';

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
    return parsed === null ? false : parsed; // default OFF — new visual surface, awaiting Piotr's accept
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

export function isMyWorkTwoLevelNavEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const MYWORK_TWO_LEVEL_NAV_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
