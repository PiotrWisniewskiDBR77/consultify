/**
 * Chat V9 / NAV-M2-lite — floating workspace breadcrumb pill.
 *
 * What the user sees
 * ------------------
 * On any non-chat workspace view where the user has an active
 * conversation, a small pill renders at the top-center of the
 * viewport:
 *
 *     ╭───────────────────────────────────────────╮
 *     │ Chat ▾  ›  Assessment  ›  SIRI rollout    │
 *     ╰───────────────────────────────────────────╯
 *
 * The `Chat` segment is a button: clicking it calls the existing
 * `returnToFullChat()` action (same verb `BackToChatButton` /
 * `BackToChatShortcut` use, so the three affordances stay
 * behaviourally consistent). A small `▾` caret button next to it
 * (NAV-M3-lite) opens a popover listing the N most-recent
 * sibling conversations; selecting one calls
 * `setActiveConversation(id)` and then `returnToFullChat()` so
 * the user lands in the chosen chat at the main chat surface.
 *
 * The middle view label and trailing conversation title are
 * plain text so the user cannot "navigate to themselves". When
 * no active conversation title is available (NAV-M2-lite+ off,
 * blank title, or `activeConversationId` absent from the
 * conversations array), the pill collapses back to the original
 * NAV-M2-lite two-segment shape (`Chat › View`).
 *
 * Placement rationale
 * -------------------
 * Top-center (`fixed top-14 left-1/2 -translate-x-1/2`) keeps the
 * pill out of the sidebar's overflow zone regardless of whether
 * the left sidebar is open. `BackToChatButton` already owns
 * top-right (`right-3`); separating the two surfaces avoids
 * overlap and visually pairs "where am I" (left/center) with
 * "get me out" (right).
 *
 * Visibility contract (matches `buildWorkspaceBreadcrumb`)
 * --------------------------------------------------------
 * The component returns `null` when:
 *   - The `ff.workspace_breadcrumb` kill-switch is OFF.
 *   - `buildWorkspaceBreadcrumb` returned `null` (hidden view, no
 *     active conversation, or degraded input).
 *   - `returnToFullChat` is not a function (store hydration race
 *     — mirrors the defensive guard in `BackToChatButton`).
 *
 * Telemetry
 * ---------
 * Intentionally none. The breadcrumb is a wayfinding affordance;
 * `navigation_back_to_chat_clicked` (NAV-M1) already captures the
 * "user returned to chat" signal from the button path, and adding
 * a breadcrumb-specific event would duplicate it for zero product-
 * decision value. Same call the T-TR1.3 copy-citations ticket
 * made.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { useAppStore } from '../../store/useAppStore';
import { useConversationStore } from '../../store/useConversationStore';
import type { AppView } from '../../types';
import {
  buildRecentConversationsList,
  countEligibleRecentConversations,
  type RecentConversationEntry,
} from '../../utils/buildRecentConversationsList';
import {
  buildWorkspaceBreadcrumb,
  type WorkspaceBreadcrumb as BreadcrumbShape,
} from '../../utils/buildWorkspaceBreadcrumb';
import { isWorkspaceBreadcrumbConversationEnabled } from '../../utils/workspaceBreadcrumbConversationFlag';
import { isWorkspaceBreadcrumbEnabled } from '../../utils/workspaceBreadcrumbFlag';
import { isWorkspaceBreadcrumbRecentsEnabled } from '../../utils/workspaceBreadcrumbRecentsFlag';
import { isWorkspaceBreadcrumbRecentsPinnedEnabled } from '../../utils/workspaceBreadcrumbRecentsPinnedFlag';
import { isWorkspaceBreadcrumbRecentsViewAllEnabled } from '../../utils/workspaceBreadcrumbRecentsViewAllFlag';
import { RecentConversationsDropdown } from './RecentConversationsDropdown';

export interface WorkspaceBreadcrumbProps {
  /**
   * Test seam so unit tests can force the enabled / disabled paths
   * without touching URL / localStorage / env. Production never
   * sets it.
   */
  isEnabled?: () => boolean;
  /**
   * Test seam for the NAV-M2-lite+ conversation-segment kill-
   * switch. When `false`, the builder renders the 2-segment
   * NAV-M2-lite shape regardless of whether a conversation title
   * is present. Production never sets this.
   */
  isConversationSegmentEnabled?: () => boolean;
  /**
   * Test seam for the NAV-M3-lite recents-dropdown kill-switch.
   * Production always reads from
   * `isWorkspaceBreadcrumbRecentsEnabled`.
   */
  isRecentsEnabled?: () => boolean;
  /**
   * Test seam for the NAV-M3-lite+ pinned-conversations kill-
   * switch. When `false`, the builder ignores the upstream
   * `starred` / `isPinned` flags and the dropdown renders with
   * pure chronological ordering (the original NAV-M3-lite v1
   * shape). Production never sets this.
   */
  isRecentsPinnedEnabled?: () => boolean;
  /**
   * Test seam for the NAV-M3-lite++ "View all" footer kill-
   * switch. When `false`, the footer row never renders even
   * when the recents list overflows the cap.
   */
  isRecentsViewAllEnabled?: () => boolean;
  /**
   * Test seam for the eligibility counter. Lets tests force an
   * overflow / no-overflow regime without reshaping the full
   * `conversations` array. Production always reads from
   * `countEligibleRecentConversations`.
   */
  countEligibleRecents?: (input: {
    conversations: ReturnType<typeof useConversationStore.getState>['conversations'];
    activeConversationId: string | null | undefined;
  }) => number;
  /**
   * Test seam for the pure breadcrumb builder. Injecting the
   * builder lets tests pin the exact segments list without
   * depending on the current shape of the `AppView` enum. Prod
   * callers never set this.
   */
  build?: (input: {
    view: AppView | null | undefined;
    hasActiveConversation: boolean;
    conversationTitle?: string | null;
    conversationSegmentEnabled?: boolean;
  }) => BreadcrumbShape | null;
  /**
   * Test seam for the pure recents-list builder. Injecting it
   * lets tests pin the exact popover entries without having to
   * reshape the full `conversations` array.
   */
  buildRecents?: (input: {
    conversations: ReturnType<typeof useConversationStore.getState>['conversations'];
    activeConversationId: string | null | undefined;
    pinnedEnabled: boolean;
  }) => RecentConversationEntry[];
}

export const WorkspaceBreadcrumb: React.FC<WorkspaceBreadcrumbProps> = ({
  isEnabled = isWorkspaceBreadcrumbEnabled,
  isConversationSegmentEnabled = isWorkspaceBreadcrumbConversationEnabled,
  isRecentsEnabled = isWorkspaceBreadcrumbRecentsEnabled,
  isRecentsPinnedEnabled = isWorkspaceBreadcrumbRecentsPinnedEnabled,
  isRecentsViewAllEnabled = isWorkspaceBreadcrumbRecentsViewAllEnabled,
  build = buildWorkspaceBreadcrumb,
  buildRecents,
  countEligibleRecents,
}) => {
  const currentView = useAppStore((state) => state.currentView);
  const returnToFullChat = useAppStore((state) => state.returnToFullChat);
  const activeConversationId = useConversationStore((state) => state.activeConversationId);
  const conversations = useConversationStore((state) => state.conversations);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);
  const isSidebarOpen = useConversationStore((state) => state.isSidebarOpen);
  const toggleSidebar = useConversationStore((state) => state.toggleSidebar);

  const [recentsOpen, setRecentsOpen] = useState<boolean>(false);

  // Resolve the active conversation's title lazily so a noisy
  // `conversations` array (frequent reshuffles on message arrival)
  // does not cause a breadcrumb re-render unless the id or title
  // actually changed. The lookup is O(n) but `n` in practice is
  // small (recent sidebar).
  const activeConversationTitle = useMemo(() => {
    if (!activeConversationId || !Array.isArray(conversations)) return null;
    const match = conversations.find((c) => c && c.id === activeConversationId);
    return match?.title ?? null;
  }, [activeConversationId, conversations]);

  const recentsEnabled = isRecentsEnabled();
  const recentsPinnedEnabled = isRecentsPinnedEnabled();
  const recentsViewAllEnabled = isRecentsViewAllEnabled();

  const recentEntries = useMemo<RecentConversationEntry[]>(() => {
    if (!recentsEnabled) return [];
    const impl = buildRecents ?? buildRecentConversationsList;
    return impl({
      conversations,
      activeConversationId,
      pinnedEnabled: recentsPinnedEnabled,
    });
  }, [recentsEnabled, recentsPinnedEnabled, buildRecents, conversations, activeConversationId]);

  // Only compute the eligibility count when the "View all"
  // footer has a chance of rendering — skips the loop entirely
  // when either the recents popover or the footer kill-switch
  // is OFF.
  const eligibleCount = useMemo<number>(() => {
    if (!recentsEnabled || !recentsViewAllEnabled) return 0;
    const impl = countEligibleRecents ?? countEligibleRecentConversations;
    return impl({ conversations, activeConversationId });
  }, [
    recentsEnabled,
    recentsViewAllEnabled,
    countEligibleRecents,
    conversations,
    activeConversationId,
  ]);

  const handleChatClick = useCallback(() => {
    if (typeof returnToFullChat === 'function') {
      returnToFullChat();
    }
  }, [returnToFullChat]);

  const handleRecentSelect = useCallback(
    (entryId: string) => {
      if (typeof setActiveConversation === 'function') {
        try {
          setActiveConversation(entryId);
        } catch {
          // Store errors (e.g. optimistic-update race) must not
          // leave the breadcrumb in a half-open state; fall
          // through to the returnToFullChat verb so the user at
          // least lands in chat rather than the current view.
        }
      }
      if (typeof returnToFullChat === 'function') {
        returnToFullChat();
      }
    },
    [setActiveConversation, returnToFullChat]
  );

  const handleViewAll = useCallback(() => {
    if (typeof returnToFullChat === 'function') {
      returnToFullChat();
    }
    // Only open the sidebar if it was closed. `toggleSidebar`
    // is the only mutator the store exposes, so we check the
    // current value before flipping to avoid closing an
    // already-open sidebar. Wrapped in try/catch for the same
    // optimistic-update race as `handleRecentSelect`.
    if (!isSidebarOpen && typeof toggleSidebar === 'function') {
      try {
        toggleSidebar();
      } catch {
        // Intentional no-op — the user is already back in chat
        // thanks to `returnToFullChat()` above.
      }
    }
  }, [returnToFullChat, isSidebarOpen, toggleSidebar]);

  if (!isEnabled()) return null;
  if (typeof returnToFullChat !== 'function') return null;

  const crumb = build({
    view: currentView,
    hasActiveConversation: Boolean(activeConversationId),
    conversationTitle: activeConversationTitle,
    conversationSegmentEnabled: isConversationSegmentEnabled(),
  });
  if (!crumb) return null;

  const showRecents = recentsEnabled && recentEntries.length > 0;
  // The footer is only useful when the popover is hiding
  // siblings. When every eligible sibling already fits in the
  // cap, the "View all" row would point the user at a sidebar
  // list identical to what they just saw — so we suppress it.
  const showViewAll = showRecents && recentsViewAllEnabled && eligibleCount > recentEntries.length;

  return (
    <nav
      data-testid="workspace-breadcrumb"
      aria-label="Breadcrumb"
      className="fixed top-14 left-1/2 z-[80] -translate-x-1/2 pointer-events-none"
    >
      <ol className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 backdrop-blur px-3 py-1 text-[12px] font-medium text-slate-700 shadow-sm dark:border-navy-700 dark:bg-navy-900/85 dark:text-slate-200">
        {crumb.segments.map((segment, idx) => {
          const isLast = idx === crumb.segments.length - 1;
          return (
            <React.Fragment key={`${segment.role}-${idx}`}>
              {idx > 0 && (
                <li aria-hidden className="text-slate-600 dark:text-slate-400 select-none">
                  ›
                </li>
              )}
              <li className="truncate max-w-[32ch]">
                {segment.role === 'chat-link' ? (
                  <span className="inline-flex items-center">
                    <button
                      type="button"
                      data-testid={`workspace-breadcrumb-segment-${idx}`}
                      onClick={handleChatClick}
                      className="rounded px-1 -mx-1 hover:bg-slate-100 dark:hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-c-focus text-primary-700 dark:text-primary-200"
                    >
                      {segment.label}
                    </button>
                    {showRecents && (
                      <RecentConversationsDropdown
                        entries={recentEntries}
                        open={recentsOpen}
                        onOpenChange={setRecentsOpen}
                        onSelect={handleRecentSelect}
                        onViewAll={showViewAll ? handleViewAll : undefined}
                      />
                    )}
                  </span>
                ) : (
                  <span
                    data-testid={`workspace-breadcrumb-segment-${idx}`}
                    aria-current={isLast ? 'page' : undefined}
                    title={segment.title}
                    className={
                      isLast
                        ? 'text-slate-800 dark:text-slate-100'
                        : 'text-slate-500 dark:text-slate-400'
                    }
                  >
                    {segment.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default WorkspaceBreadcrumb;
