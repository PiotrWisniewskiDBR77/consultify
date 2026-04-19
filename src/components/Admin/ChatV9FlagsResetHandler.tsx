/**
 * Chat V9 / ADMIN AG1 v1.3 — URL reset one-liner handler.
 *
 * What this does
 * --------------
 * When the page loads with `?v9flags=reset` in the query string and
 * the user is authorised (SUPERADMIN / OWNER / ADMIN), this headless
 * component:
 *
 *   1. Calls `resetAllChatV9FlagOverrides()` — the same write-side
 *      helper the panel's "Reset all" button uses.
 *   2. Rewrites the URL to `?v9flags=1` via `history.replaceState`
 *      so a refresh does not re-trigger the reset and so the
 *      overlay pops open on top of the user's current route for a
 *      visible confirmation ("All flags at their shipped defaults"
 *      in the header).
 *   3. Dispatches the existing `chat-v9-flags:open` CustomEvent so
 *      the overlay opens immediately on the same navigation (no
 *      reload required). Falls through to the URL-driven open if
 *      the overlay is not mounted yet.
 *
 * Unauthorised users still get their URL cleaned (so the reset
 * query does not stick around), but the write-side helper is never
 * called. Role gating is defence-in-depth: the helper itself only
 * mutates `localStorage` in the current browser, so the worst a
 * non-admin could do is clear their own overrides.
 *
 * Deliberate non-goals
 * --------------------
 * The handler runs **exactly once per mount**, not on every
 * `popstate`. A SPA navigation that produces `?v9flags=reset` later
 * in the session should trigger a fresh mount if it matters; the
 * alternative (re-evaluating on every history change) would make
 * the reset semantics fuzzy — users expect a "reset link" to act
 * once, not every time they go back.
 */

import React, { useEffect } from 'react';

import { useAppStore } from '../../store/useAppStore';
import type { User } from '../../types';
import { resetAllChatV9FlagOverrides } from '../../utils/chatV9FeatureFlags';
import { isFlagsResetUrlEnabled } from '../../utils/flagsResetUrlFlag';

import { isV9FlagsOverlayAuthorized } from './ChatV9FlagsOverlay';

const QUERY_KEY = 'v9flags';
const RESET_VALUE = 'reset';
const OPEN_EVENT = 'chat-v9-flags:open';
const OPEN_VALUE = '1';

function readResetQuery(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const raw = new URLSearchParams(window.location.search).get(QUERY_KEY);
    return typeof raw === 'string' && raw.trim().toLowerCase() === RESET_VALUE;
  } catch {
    return false;
  }
}

function rewriteQueryToOpenMode(): void {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  try {
    const params = new URLSearchParams(window.location.search);
    params.set(QUERY_KEY, OPEN_VALUE);
    const newSearch = `?${params.toString()}`;
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state ?? null,
      '',
      `${pathname}${newSearch}${hash ?? ''}`
    );
  } catch {
    // History mutation is best-effort. Not a blocker for the
    // reset itself, which already happened before this call.
  }
}

function stripQueryKey(): void {
  if (typeof window === 'undefined' || !window.location || !window.history) return;
  try {
    const params = new URLSearchParams(window.location.search);
    params.delete(QUERY_KEY);
    const serialized = params.toString();
    const newSearch = serialized.length > 0 ? `?${serialized}` : '';
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state ?? null,
      '',
      `${pathname}${newSearch}${hash ?? ''}`
    );
  } catch {
    // Same best-effort contract as rewriteQueryToOpenMode.
  }
}

export interface ChatV9FlagsResetHandlerProps {
  /**
   * Test seam for the feature flag. Production defaults to the
   * standard resolver.
   */
  isEnabled?: () => boolean;
  /**
   * Test seam for the authorisation predicate. Production reads
   * `currentUser` from the Zustand store.
   */
  authorize?: (user: User | null | undefined) => boolean;
  /**
   * Test seam for the write-side helper. Production calls the
   * registry's `resetAllChatV9FlagOverrides` directly.
   */
  performReset?: () => void;
}

export const ChatV9FlagsResetHandler: React.FC<ChatV9FlagsResetHandlerProps> = ({
  isEnabled = isFlagsResetUrlEnabled,
  authorize = isV9FlagsOverlayAuthorized,
  performReset,
}) => {
  const currentUser = useAppStore((state) => state.currentUser);

  useEffect(() => {
    if (!isEnabled()) return;
    if (!readResetQuery()) return;

    if (!authorize(currentUser)) {
      // Clean the URL so the reset query does not persist for
      // non-admin sessions. Never touch localStorage.
      stripQueryKey();
      return;
    }

    try {
      if (typeof performReset === 'function') {
        performReset();
      } else {
        resetAllChatV9FlagOverrides();
      }
    } catch {
      // The overlay will still open — admins can inspect state
      // manually and retry via the "Reset all" button.
    }

    rewriteQueryToOpenMode();

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent(OPEN_EVENT));
      } catch {
        // Older browsers without CustomEvent support fall back to
        // the URL-driven overlay open on the next render tick.
      }
    }
  }, [authorize, currentUser, isEnabled, performReset]);

  return null;
};

export default ChatV9FlagsResetHandler;
