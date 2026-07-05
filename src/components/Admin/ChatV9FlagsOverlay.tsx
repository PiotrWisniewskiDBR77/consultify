/**
 * Chat V9 / ADMIN AG1 v1 — URL-triggered overlay for `ChatV9FlagsPanel`.
 *
 * Activation
 * ----------
 * The overlay mounts the flag panel when **both** apply:
 *
 *   1. The current user is authorised (SUPERADMIN / OWNER / ADMIN) —
 *      see `isV9FlagsOverlayAuthorized`. Non-admins never see the
 *      overlay, even if the activation signal is present.
 *   2. One of the following activation signals is active:
 *        - `?v9flags=1` is present in the URL query string, or
 *        - a `chat-v9-flags:open` CustomEvent has been dispatched (a
 *          clean hook for admin surfaces to wire a menu item /
 *          keyboard shortcut without coupling to this file).
 *
 * Closing the overlay dispatches `chat-v9-flags:close` semantics and
 * lets the URL query stay intact so a reload returns the admin to the
 * same state — admins typically want the overlay sticky across
 * navigations while they're debugging.
 *
 * Safety
 * ------
 * The overlay is mounted once at `App` root. When either gate fails
 * it returns `null` and pays no cost. Role gating is defence-in-depth
 * only: the underlying `setChatV9FlagOverride` writes `localStorage`
 * in the *current* browser, so a non-admin who somehow still reached
 * the panel could at worst break their own tab. Still, we do not want
 * non-admins to even see which flags exist — flag names leak roadmap
 * intent.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import type { User } from '../../types';
import { ChatV9FlagsPanel } from './ChatV9FlagsPanel';

const OPEN_EVENT = 'chat-v9-flags:open';
const CLOSE_EVENT = 'chat-v9-flags:close';
const QUERY_KEY = 'v9flags';

/**
 * Pure auth predicate — exported for tests and for any admin surface
 * that wants to decide whether to render the overlay-open button. We
 * normalise the role to upper-case because legacy auth paths have been
 * observed to return mixed-case (`"Admin"`, `"admin"`, …). Missing /
 * anonymous users always fall back to `false`.
 *
 * Note: disabling `react-refresh/only-export-components` here is
 * deliberate — extracting a one-liner predicate into its own file to
 * satisfy HMR would be costlier than the warning it fixes, and the
 * function is pure so Fast Refresh limitations do not affect it.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function isV9FlagsOverlayAuthorized(user: User | null | undefined): boolean {
  const role = typeof user?.role === 'string' ? user.role.trim().toUpperCase() : '';
  return role === 'SUPERADMIN' || role === 'OWNER' || role === 'ADMIN';
}

function readQueryFlag(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const raw = new URLSearchParams(window.location.search).get(QUERY_KEY);
    return raw === '1' || raw === 'true' || raw === 'on';
  } catch {
    return false;
  }
}

export interface ChatV9FlagsOverlayProps {
  /**
   * Auth override — lets tests and future admin surfaces decide
   * whether the overlay is mounted without standing up the full
   * app store. Defaults to the store-read
   * `isV9FlagsOverlayAuthorized(currentUser)`.
   */
  isAuthorized?: boolean;
}

export const ChatV9FlagsOverlay: React.FC<ChatV9FlagsOverlayProps> = ({ isAuthorized }) => {
  // Zustand selector — we only need the role. Using the selector form
  // means unrelated store updates don't re-render this component, so
  // the overlay stays cheap on every route.
  const storeAuthorized = useAppStore((state) => isV9FlagsOverlayAuthorized(state.currentUser));
  const authorized = typeof isAuthorized === 'boolean' ? isAuthorized : storeAuthorized;

  const [open, setOpen] = useState<boolean>(() => readQueryFlag());

  // External wiring hook — any admin surface can call
  // `window.dispatchEvent(new CustomEvent('chat-v9-flags:open'))` to
  // pop the panel without reaching into this file. Close works the
  // same way. The design avoids any coupling between the overlay and
  // admin menus that may land later.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
    };
  }, []);

  // Re-evaluate the URL query after navigations. React Router does not
  // fire `popstate` on programmatic `navigate()` so we listen for the
  // browser event only — the dispatch hook above covers programmatic
  // opens.
  useEffect(() => {
    const onPop = () => setOpen(readQueryFlag());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Close on Escape. Only attached when the overlay is open so we
  // don't pay for a global listener when it isn't rendered.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleClose = useCallback(() => setOpen(false), []);

  // Defence-in-depth role gate. Deliberately checked *after* state
  // wiring (the listeners still attach/detach normally) so a user who
  // is promoted to admin mid-session does not need a page reload to
  // get the overlay — the next `?v9flags=1` or dispatched event will
  // simply start rendering.
  if (!authorized) return null;
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chat V9 feature flags"
      data-testid="chat-v9-flags-overlay"
      className="fixed inset-0 z-toast flex items-start justify-center bg-c-surface/50 backdrop-blur-sm p-4 md:p-8 overflow-y-auto"
      onClick={(e) => {
        // Close on backdrop click. The panel swallows its own click so
        // interacting with buttons doesn't dismiss the overlay.
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-4xl">
        <ChatV9FlagsPanel onClose={handleClose} />
      </div>
    </div>
  );
};

export default ChatV9FlagsOverlay;
