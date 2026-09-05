/**
 * Chat V9 / ADMIN AG1 v1.1 — override indicator.
 *
 * Small floating chip that surfaces one very specific signal:
 *
 *   "You (admin) currently have N V9 flags flipped away from
 *    their shipped defaults in this browser."
 *
 * Behaviour
 * ---------
 * - Returns `null` for non-admins (same role gate as the overlay —
 *   `isV9FlagsOverlayAuthorized`).
 * - Returns `null` when the session has zero overrides. This is the
 *   common case for every admin most of the time; we do not want a
 *   permanent piece of chrome.
 * - Returns `null` unless `shouldShowDebugOverlays()` is true (local
 *   Vite dev, or an explicit `?debug=1` opt-in persisted for the tab
 *   session — see `src/utils/debugOverlays.ts`). 2026-09-05: added so
 *   the pill does not show up as noise on otherwise clean MVP
 *   acceptance screenshots.
 * - When at least one flag is overridden, renders a compact pill in
 *   the bottom-right corner showing the count. Clicking the pill
 *   dispatches `chat-v9-flags:open` — the overlay picks it up via its
 *   existing CustomEvent listener, so this component has zero direct
 *   coupling to the panel internals.
 *
 * Refresh model
 * -------------
 * Overrides are stored in `localStorage`, which has no native React
 * subscription. We poll at a human-friendly cadence (3s) so an admin
 * who flips a flag in a different tab sees the indicator sync within
 * a few seconds. A `storage` event listener would be more efficient
 * but fires only for *cross-tab* writes — same-tab flips from the
 * overlay would still need the poll, so we keep one mechanism.
 */

import { Flag } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { getChatV9FlagOverrides } from '../../utils/chatV9FeatureFlags';
import { shouldShowDebugOverlays } from '../../utils/debugOverlays';
import { isV9FlagsOverlayAuthorized } from './ChatV9FlagsOverlay';

const OPEN_EVENT = 'chat-v9-flags:open';
const POLL_INTERVAL_MS = 3000;

export interface ChatV9FlagsIndicatorProps {
  /**
   * Auth override — same pattern as `ChatV9FlagsOverlay`. Lets tests
   * and future callers decide whether to render without standing up
   * the full app store.
   */
  isAuthorized?: boolean;
  /**
   * Override count override — only used by tests. In production we
   * read `getChatV9FlagOverrides().length`.
   */
  overrideCount?: number;
  /**
   * Polling interval (ms). Tests pass `0` to disable the timer and
   * rely on manual re-renders via `rerender`.
   */
  pollIntervalMs?: number;
}

export const ChatV9FlagsIndicator: React.FC<ChatV9FlagsIndicatorProps> = ({
  isAuthorized,
  overrideCount,
  pollIntervalMs = POLL_INTERVAL_MS,
}) => {
  const storeAuthorized = useAppStore((state) => isV9FlagsOverlayAuthorized(state.currentUser));
  const authorized = typeof isAuthorized === 'boolean' ? isAuthorized : storeAuthorized;

  // Live count of currently-overridden flags. Re-read on mount and
  // on every poll tick so a flip made in this tab (via the panel) or
  // in another tab (via `localStorage.setItem`) eventually reflects.
  const [count, setCount] = useState<number>(() => {
    if (typeof overrideCount === 'number') return overrideCount;
    if (!authorized) return 0;
    try {
      return getChatV9FlagOverrides().length;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    // When the prop is supplied, keep state synced with the prop and
    // skip the poll entirely (tests).
    if (typeof overrideCount === 'number') {
      setCount(overrideCount);
      return undefined;
    }
    if (!authorized) {
      setCount(0);
      return undefined;
    }

    const tick = () => {
      try {
        setCount(getChatV9FlagOverrides().length);
      } catch {
        // Ignore — we'd rather under-report than crash the chrome.
      }
    };
    tick();

    if (pollIntervalMs <= 0) return undefined;
    const id = window.setInterval(tick, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [authorized, overrideCount, pollIntervalMs]);

  const handleClick = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT));
    } catch {
      // `CustomEvent` is not constructible in ancient IE — the
      // indicator is an internal admin tool, we tolerate the no-op.
    }
  }, []);

  if (!authorized) return null;
  if (count <= 0) return null;
  // 2026-09-05: was authorized+count only — the pill rendered on every
  // screen for an admin with a stray override, noise on otherwise clean
  // MVP acceptance screenshots. Now also requires local Vite dev or an
  // explicit `?debug=1` opt-in (see `src/utils/debugOverlays.ts`); the
  // admin/count gates above are unchanged and still evaluated first.
  if (!shouldShowDebugOverlays()) return null;

  return (
    <button
      type="button"
      data-testid="chat-v9-flags-indicator"
      onClick={handleClick}
      aria-label={`Chat V9 — ${count} flag override${count === 1 ? '' : 's'} active (click to manage)`}
      className="fixed bottom-3 right-3 z-[90] inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-md hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 dark:border-amber-600/60 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
    >
      <Flag size={12} strokeWidth={2} />
      <span>
        {count} V9 override{count === 1 ? '' : 's'}
      </span>
    </button>
  );
};

export default ChatV9FlagsIndicator;
