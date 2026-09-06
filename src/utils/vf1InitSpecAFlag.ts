/**
 * VF1 Initiative SPEC-A flag (Vegas Faza 1 batch B, 2026-07-19).
 *
 * `InitiativeDocumentView` (archetype C · Rekord) is being aligned to the
 * SPEC-A artifact contract. Per CLAUDE.md rule #7 (Piotr is never the first
 * visual tester), the NEW visual state changes introduced by this pass —
 * the content-shaped `SkeletonState variant="record"` load skeleton and the
 * whole-surface `ErrorState` (with a clear exit) — go behind this flag,
 * default OFF. At OFF the view renders exactly as before (spinner
 * `LoadingState` + `HubWorkAreaLoadError`), so nothing changes visually until
 * screenshots are reviewed and accepted; a later Vegas pass flips the default
 * after owner acceptance and re-tags the point.
 *
 * Token fixes and a11y (Esc-to-close, focus-visible) are NOT gated — they are
 * unconditional corrections.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_vf1InitSpecA=0|1` — operator bypass for staging / dev checks.
 *   2. `localStorage["ff.vf1InitSpecA"]` — user / org override.
 *   3. `import.meta.env.VITE_VF1_INIT_SPECA` — build-time override.
 *   4. Default: OFF (no visual change until owner acceptance on screenshots).
 */

const LS_KEY = 'ff.vf1InitSpecA';
const QUERY_KEY = 'ff_vf1InitSpecA';
const ENV_KEY = 'VITE_VF1_INIT_SPECA';

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

export function isVf1InitSpecAEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VF1_INIT_SPECA_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
