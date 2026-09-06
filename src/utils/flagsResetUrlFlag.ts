/**
 * Chat V9 / ADMIN AG1 v1.3 — feature flag for the URL reset
 * one-liner (`?v9flags=reset`).
 *
 * Why this has its own flag
 * -------------------------
 *   - The URL handler runs **before** the overlay renders, even if
 *     `?v9flags=1` is also present. If anything about the reset
 *     path misbehaves (auth regression, race with a later
 *     navigation, unexpected browser history mutation), we need a
 *     blast-radius-limiting kill-switch independent from the
 *     overlay mount flag.
 *   - It also lets ops distribute URLs like
 *     `https://app.example/path?v9flags=reset` to a broad admin
 *     audience while still being able to rescind the behaviour
 *     centrally if someone sends the link to the wrong list.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_flagsResetUrl=0|1`.
 *   2. `localStorage["ff.flags_reset_url"]`.
 *   3. `import.meta.env.VITE_FLAGS_RESET_URL`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.flags_reset_url';
const QUERY_KEY = 'ff_flagsResetUrl';
const ENV_KEY = 'VITE_FLAGS_RESET_URL';

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

export function isFlagsResetUrlEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const FLAGS_RESET_URL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
