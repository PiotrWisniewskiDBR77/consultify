/**
 * Chat signals feed V2 kill-switch. It gates only the second, table-and-preview
 * mode inside the existing Chat signals drawer. Default was OFF until the
 * supervisor accepted the visual evidence (CLAUDE.md sections 7 and 9); Piotr
 * accepted the dyżur-26 feed (post-FIX-1..13, merged m03, DEC-143) on
 * 2026-08-27 and the default flipped to ON. `localStorage`/query "off" (and
 * the other falsy spellings) still disable it per-session. Every read error
 * still fails closed so the existing panel remains reachable.
 */

const LS_KEY = 'ff.chat_signals_feed';
const QUERY_KEY = 'ff_chatSignalsFeed';
const ENV_KEY = 'VITE_CHAT_SIGNALS_FEED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const value = String(raw).trim().toLowerCase();
  if (['1', 'true', 'on'].includes(value)) return true;
  if (['0', 'false', 'off'].includes(value)) return false;
  return null;
}

let cached: boolean | null = null;

export function isChatSignalsFeedEnabled(): boolean {
  if (cached !== null) return cached;
  try {
    const query =
      typeof window === 'undefined'
        ? null
        : parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    let local: boolean | null = null;
    if (query === null && typeof window !== 'undefined') {
      try {
        local = parseFlag(window.localStorage.getItem(LS_KEY));
      } catch {
        cached = false;
        return cached;
      }
    }
    const env = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    // Default ON since 2026-08-27 owner accept (DEC-143) — only the bottom
    // of the query > localStorage > env > default chain changed; the catch
    // below still fails closed on any read error.
    cached = query ?? local ?? env ?? true;
  } catch {
    cached = false;
  }
  return cached;
}

export const resetChatSignalsFeedFlagCache = (): void => {
  cached = null;
};

export const CHAT_SIGNALS_FEED_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
