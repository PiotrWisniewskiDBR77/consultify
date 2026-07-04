/**
 * Chat V9 / NAV NAV-M1 — "Back to chat" floating button.
 *
 * Why this exists
 * ---------------
 * The NAVIGATION audit flagged a persistent dead-end: a user who deep-
 * links or navigates to an artifact / module view while a conversation
 * is active has no consistent affordance to get back to that chat.
 * Each module today renders its own header, so there are N possible
 * "return" surfaces — none of them are uniformly present, and the
 * browser back button is only reliable when the user *came from* chat.
 *
 * `returnToFullChat()` already exists in the UI slice (it switches
 * `currentView` to AI_CHAT and triggers a router navigation). What
 * was missing was a globally-mounted trigger that always appears when
 * it makes sense and silently hides when it does not.
 *
 * Render contract
 * ---------------
 * The button is mounted once at the App root. It returns `null` unless
 * **all four** of the following hold:
 *
 *   1. The feature flag `back-to-chat-button` resolves to ON.
 *   2. The current view is not `AI_CHAT` (already there) and not
 *      `WELCOME` (nothing to return to).
 *   3. `activeConversationId` is non-null — there is an actual
 *      conversation to go back to.
 *   4. The `returnToFullChat` action is available on the store (it
 *      always is in prod; the guard exists for defensive tests).
 *
 * Behaviour
 * ---------
 *   - Clicking fires `trackFunnelEvent('navigation_back_to_chat_clicked',
 *     { fromView })` with `fromView` pulled from the closed `AppView`
 *     enum (RODO-safe, no ids), then calls `returnToFullChat()`.
 *   - Telemetry failures never block navigation.
 *   - The button has `type="button"` and `aria-label` so keyboard /
 *     screen-reader users get the same affordance as mouse users.
 *
 * Placement
 * ---------
 * Top-right corner, below typical header chrome (`top-14`) and below
 * the z-index of modal overlays (`z-[80]` — lower than
 * `ChatV9FlagsOverlay` at `z-[100]` and `ChatV9FlagsIndicator` at
 * `z-[90]`). Sits in a zone free of sidebar collisions on every
 * module's default layout.
 */

import { ArrowLeft, MessageSquare } from 'lucide-react';
import React, { useCallback } from 'react';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import { AppView } from '../../types';
import { isBackToChatButtonEnabled } from '../../utils/backToChatButtonFlag';

const HIDDEN_VIEWS: ReadonlySet<AppView> = new Set([AppView.AI_CHAT, AppView.WELCOME]);

export interface BackToChatButtonProps {
  /**
   * Test seam so unit tests can force the enabled / disabled paths
   * without touching URL / localStorage / env. Production never sets it.
   */
  isEnabled?: () => boolean;
}

export const BackToChatButton: React.FC<BackToChatButtonProps> = ({
  isEnabled = isBackToChatButtonEnabled,
}) => {
  const currentView = useAppStore((state) => state.currentView);
  const returnToFullChat = useAppStore((state) => state.returnToFullChat);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);

  const handleClick = useCallback(() => {
    try {
      trackFunnelEvent('navigation_back_to_chat_clicked', {
        fromView: currentView,
      });
    } catch {
      // Telemetry is advisory — never block the navigation.
    }
    if (typeof returnToFullChat === 'function') {
      returnToFullChat();
    }
  }, [currentView, returnToFullChat]);

  if (!isEnabled()) return null;
  if (HIDDEN_VIEWS.has(currentView)) return null;
  if (!activeConversationId) return null;
  if (typeof returnToFullChat !== 'function') return null;

  return (
    <button
      type="button"
      data-testid="back-to-chat-button"
      onClick={handleClick}
      aria-label="Back to active conversation"
      title="Back to active conversation"
      className="fixed top-14 right-3 z-[80] inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white/90 backdrop-blur px-3 py-1.5 text-[12px] font-semibold text-primary-700 shadow-md hover:bg-primary-50 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-c-focus dark:border-primary-700/60 dark:bg-navy-900/85 dark:text-primary-200 dark:hover:bg-navy-800"
    >
      <ArrowLeft size={12} strokeWidth={2.25} aria-hidden />
      <MessageSquare size={12} strokeWidth={2.25} aria-hidden />
      <span className="tracking-tight">Back to chat</span>
    </button>
  );
};

export default BackToChatButton;
