/**
 * Chat V9 / T-PM2-lite v1.1 — kill-switch + session-storage
 * helpers for the "don't show again this session" action on the
 * PII heuristic toast.
 *
 * When ON (default), the toast rendered by `PiiHeuristicToast`
 * includes a small dismiss-for-session button. Clicking it sets a
 * `sessionStorage` sentinel (`chatV9.piiToastDismissedForSession`
 * = `'1'`) so subsequent PII hits in the same tab stay silent —
 * no toast, no telemetry — until the user opens a fresh tab
 * (sessionStorage is per-tab).
 *
 * When OFF, the dismiss action never renders and the toast
 * behaves exactly like T-PM2-lite v1: a 4.5s nudge with a 4s
 * cooldown between hits.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_piiHeuristicSessionDismiss=0|1`.
 *   2. `localStorage["ff.pii_heuristic_session_dismiss"]`.
 *   3. `import.meta.env.VITE_PII_HEURISTIC_SESSION_DISMISS`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.pii_heuristic_session_dismiss';
const QUERY_KEY = 'ff_piiHeuristicSessionDismiss';
const ENV_KEY = 'VITE_PII_HEURISTIC_SESSION_DISMISS';

/**
 * Exported so the toast, its tests, and ops runbooks share one
 * canonical spelling of the session-dismiss sentinel.
 */
export const PII_TOAST_SESSION_DISMISS_STORAGE_KEY = 'chatV9.piiToastDismissedForSession';

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

export function isPiiHeuristicSessionDismissEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

/**
 * True when the user has clicked "Don't show again this session"
 * in the current tab. Defensive against missing / blocked
 * sessionStorage (private mode, SSR, quota-exceeded writes
 * earlier in the session).
 */
export function isPiiToastDismissedForSession(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    return window.sessionStorage.getItem(PII_TOAST_SESSION_DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPiiToastDismissedForSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(PII_TOAST_SESSION_DISMISS_STORAGE_KEY, '1');
  } catch {
    // Quota exceeded or private mode — the dismiss is a courtesy,
    // not a contract. Fall through silently; the next toast will
    // still render, which is the safe failure mode.
  }
}

export const PII_HEURISTIC_SESSION_DISMISS_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
