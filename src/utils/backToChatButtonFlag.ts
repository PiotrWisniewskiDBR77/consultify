/**
 * Chat V9 / NAV NAV-M1 — feature flag for the "Back to chat" floating button.
 *
 * Where this flag gates
 * ---------------------
 *   - `BackToChatButton` renders a small fixed-position pill in the top-
 *     right corner whenever the user is on a non-chat view AND has an
 *     active conversation. Clicking it calls the existing
 *     `returnToFullChat()` action in the UI slice.
 *   - When the flag is off, the component returns `null` and the
 *     existing navigation paths (sidebar, browser back, per-view
 *     headers) are entirely unaffected.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_backToChatButton=0|1` — operator bypass.
 *   2. `localStorage["ff.back_to_chat_button"]` — user / org override.
 *   3. `import.meta.env.VITE_BACK_TO_CHAT_BUTTON` — build-time default.
 *   4. Default: ON. The button is purely additive — it surfaces an
 *      action (`returnToFullChat`) that already exists but had no
 *      global affordance. Kill-switch is safe because removing the
 *      button reverts to the status quo where users rely on the
 *      sidebar / browser back / module-level headers.
 */

const LS_KEY = 'ff.back_to_chat_button';
const QUERY_KEY = 'ff_backToChatButton';
const ENV_KEY = 'VITE_BACK_TO_CHAT_BUTTON';

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

export function isBackToChatButtonEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const BACK_TO_CHAT_BUTTON_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
