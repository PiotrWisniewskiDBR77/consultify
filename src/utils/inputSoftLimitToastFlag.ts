/**
 * Chat V9 / INPUT C-IN6-lite — kill-switch for the one-shot
 * soft-limit inline toast that fires the first time the
 * `InputCharCounter` crosses its rose threshold (default 8000
 * chars, i.e. `value.length >= max`).
 *
 * When ON (default) and the user has not yet opted out this tab,
 * the headless `InputSoftLimitToast` renders a `toast.custom`
 * with a calm "your message crossed the soft limit — Teresa may
 * truncate or summarise" nudge and a "Don't show again this
 * session" button. The button writes a sessionStorage sentinel
 * and the nudge stays silent until the user opens a fresh tab.
 * The toast is purely advisory — Send is never blocked.
 *
 * When OFF, the headless component is a no-op; the counter pill
 * colouring is unchanged and admins see the pre-v1 behaviour
 * pixel-for-pixel.
 *
 * Resolution order (highest wins):
 *   1. URL `?ff_inputSoftLimitToast=0|1`.
 *   2. `localStorage["ff.input_soft_limit_toast"]`.
 *   3. `import.meta.env.VITE_INPUT_SOFT_LIMIT_TOAST`.
 *   4. Default ON.
 */

const LS_KEY = 'ff.input_soft_limit_toast';
const QUERY_KEY = 'ff_inputSoftLimitToast';
const ENV_KEY = 'VITE_INPUT_SOFT_LIMIT_TOAST';

/**
 * SessionStorage sentinel key. `'1'` means "the user clicked
 * 'Don't show again this session' on this toast" and we should
 * stay silent for the rest of this tab's lifetime. Any other
 * value (including absent) means the toast is armed.
 */
export const INPUT_SOFT_LIMIT_TOAST_SESSION_DISMISS_STORAGE_KEY =
  'chatV9.inputSoftLimitToastDismissedForSession';

/**
 * SessionStorage sentinel key. `'1'` means "the toast has already
 * fired once in this tab" and subsequent rising-edge crossings
 * should stay silent. Separate from the dismiss key so a user who
 * saw the nudge but did NOT click "Don't show again" still sees
 * it at most once per tab (the whole point of the -lite scope).
 */
export const INPUT_SOFT_LIMIT_TOAST_SESSION_FIRED_STORAGE_KEY =
  'chatV9.inputSoftLimitToastFiredForSession';

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

export function isInputSoftLimitToastEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export function isInputSoftLimitToastDismissedForSession(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    return (
      window.sessionStorage.getItem(INPUT_SOFT_LIMIT_TOAST_SESSION_DISMISS_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function markInputSoftLimitToastDismissedForSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(INPUT_SOFT_LIMIT_TOAST_SESSION_DISMISS_STORAGE_KEY, '1');
  } catch {
    // SessionStorage write failed — dismissal is a courtesy, not
    // a contract. The in-memory rising-edge ref still suppresses
    // repeats for the rest of this React tree's lifetime.
  }
}

export function hasInputSoftLimitToastFiredForSession(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    return window.sessionStorage.getItem(INPUT_SOFT_LIMIT_TOAST_SESSION_FIRED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markInputSoftLimitToastFiredForSession(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(INPUT_SOFT_LIMIT_TOAST_SESSION_FIRED_STORAGE_KEY, '1');
  } catch {
    // See `markInputSoftLimitToastDismissedForSession`.
  }
}

export const INPUT_SOFT_LIMIT_TOAST_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
