/**
 * Chat V9 / NAV NAV-M1.1 — feature flag for the "Back to chat"
 * keyboard shortcut.
 *
 * Where this flag gates
 * ---------------------
 *   - `BackToChatShortcut` mounts a single global keydown listener.
 *     Alt+Shift+C (macOS Option+Shift+C) triggers
 *     `returnToFullChat()` whenever the same gates NAV-M1 uses on
 *     its button are satisfied: non-chat view, active conversation,
 *     focus not trapped inside an editable element.
 *   - Separate from `back-to-chat-button` so ops can kill the
 *     shortcut (e.g. if it collides with a third-party extension)
 *     without disabling the visible pill, or vice versa.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_backToChatShortcut=0|1` — operator bypass.
 *   2. `localStorage["ff.back_to_chat_shortcut"]` — user / org override.
 *   3. `import.meta.env.VITE_BACK_TO_CHAT_SHORTCUT` — build-time default.
 *   4. Default: ON. The shortcut is purely additive and self-gated
 *      on both the view and the focus element, so it cannot silently
 *      hijack typing or an already-in-chat session.
 */

const LS_KEY = 'ff.back_to_chat_shortcut';
const QUERY_KEY = 'ff_backToChatShortcut';
const ENV_KEY = 'VITE_BACK_TO_CHAT_SHORTCUT';

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

export function isBackToChatShortcutEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const BACK_TO_CHAT_SHORTCUT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
