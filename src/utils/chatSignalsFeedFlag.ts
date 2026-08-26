/**
 * Chat signals feed V2 kill-switch. It gates only the second, table-and-preview
 * mode inside the existing Chat signals drawer. The default is OFF until the
 * supervisor accepts the visual evidence (CLAUDE.md sections 7 and 9); the
 * supervisor removes that gate after screenshot acceptance. Every read error
 * fails closed so the existing panel remains unchanged.
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
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const env = parseFlag(meta?.env?.[ENV_KEY]);
    cached = query ?? local ?? env ?? false;
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
