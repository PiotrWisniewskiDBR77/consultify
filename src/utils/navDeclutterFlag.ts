/**
 * Nav declutter flag (Q1 — `Harvard/wdrozenie-100/_AUDYT_NADMIAR_ELEMENTOW_2026-07-11.md`).
 *
 * Root cause A from the audit: `BETA_ADMINS_EXEMPT=true` (see betaAccess.ts) makes
 * the owner/admin see EVERY sidebar module, including empty closed-beta ones
 * (Audits — "empty module, no real content"; Meeting — "post-GA beta") and every
 * beta badge, even on modules that are actually GA (Results/Finance/Materials).
 * That is the direct cause of the "too many elements" complaint — a regular user
 * never sees this noise.
 *
 * When this flag is ON:
 *   1. Closed-beta modules (Audits, Meeting — anything `BETA_MENU_STATUS: 'closed'`)
 *      are hidden from the sidebar ENTIRELY, including for administrators —
 *      effectively `BETA_ADMINS_EXEMPT = false` for those items only. See
 *      `declutterMenu()` in `betaAccess.ts`.
 *   2. The 'beta' badge is stripped from modules whose beta status is 'open'
 *      (GA per D-A: Results/Finance/Materials) since they no longer carry beta
 *      risk — only the badge visual is removed, access is untouched.
 *
 * When OFF (default): navigation renders exactly as it does today — additive,
 * zero behavior change. Per rule #7 (CLAUDE.md) this ships OFF until the owner
 * has approved the decluttered nav on a screenshot rendered by the assistant
 * first (dev-render harness, no `?ff_navDeclutter=1` as the first check).
 *
 * Resolution order (highest wins) — mirrors `melsCanvasFlag.ts`:
 *   1. URL query `?ff_navDeclutter=0|1` — operator bypass for staging /
 *      visual-review smoke runs.
 *   2. `localStorage["ff.nav_declutter"]` — user / org override.
 *   3. `import.meta.env.VITE_NAV_DECLUTTER` — build-time override.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.nav_declutter';
const QUERY_KEY = 'ff_navDeclutter';
const ENV_KEY = 'VITE_NAV_DECLUTTER';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  // Default OFF: when no build-time override is set, today's nav (unchanged) is
  // the default surface. An explicit `1`/`true` env value opts in.
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

export function isNavDeclutterEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const NAV_DECLUTTER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
