/**
 * Chat V9 / NAV-M3-lite — "recent conversations" dropdown
 * attached to the workspace breadcrumb's `Chat` segment.
 *
 * What the user sees
 * ------------------
 * A small caret button (`▾`) rendered right after the `Chat`
 * link inside the `WorkspaceBreadcrumb` pill. Clicking it opens
 * a short popover listing the most-recent conversations (see
 * `buildRecentConversationsList` for the filtering / sorting
 * contract). Selecting a row:
 *
 *   1. Calls `onSelect(entry.id)` which the parent wires to
 *      `setActiveConversation(id)` + `returnToFullChat()` — same
 *      verb used by NAV-M1 / NAV-M1.1 / NAV-M2-lite, so all four
 *      affordances always land in the same place.
 *   2. Closes the popover.
 *
 * The popover is a pure presentation layer: it never reads from
 * any store itself. Everything (entries, open state, kill-
 * switch) is injected by the parent so the component stays
 * trivially testable without mocking stores or flag resolvers.
 *
 * Accessibility
 * -------------
 * - The trigger has `aria-haspopup="menu"` and
 *   `aria-expanded={open}`.
 * - The popover is a `role="menu"` with `role="menuitem"`
 *   children. Opening focuses the first row; Escape / outside-
 *   click closes. NAV-M3-lite^3 adds a roving arrow-key ring:
 *   ↑/↓ wrap through the menuitems, Home/End jump to the edges,
 *   Tab closes the popover so the natural Tab order resumes
 *   above the trigger. The `ff.workspace_breadcrumb_recents_
 *   arrow_keys` kill-switch falls back to the NAV-M3-lite v1
 *   Tab-only shape.
 * - NAV-M3.4 adds the ARIA-APG menu-button shortcut: pressing
 *   `ArrowDown` while the trigger is focused opens the popover
 *   in one keystroke, and the existing open-effect then lands
 *   focus on the first menuitem so keyboard users never have to
 *   click + Tab. The trigger exposes this via
 *   `aria-keyshortcuts="ArrowDown"` so screen readers announce
 *   the affordance. Gated by
 *   `ff.workspace_breadcrumb_recents_trigger_arrow`.
 * - NAV-M3.5 mirrors NAV-M3.4 on the opposite side: pressing
 *   `ArrowUp` while the trigger is focused opens the popover
 *   AND lands focus on the **last** menuitem, matching the
 *   ARIA-APG menu-button pattern for "opens to the bottom".
 *   When both flags are ON the trigger's `aria-keyshortcuts`
 *   reads `"ArrowDown ArrowUp"`. Gated by
 *   `ff.workspace_breadcrumb_recents_trigger_arrow_up`.
 * - Clicks outside the popover (document-level `mousedown`) and
 *   `Escape` both dismiss, so the popover never gets stranded
 *   if the user clicks the main chat surface.
 */

import React, { useCallback, useEffect, useRef } from 'react';

import type { RecentConversationEntry } from '../../utils/buildRecentConversationsList';
import { isWorkspaceBreadcrumbRecentsArrowKeysEnabled } from '../../utils/workspaceBreadcrumbRecentsArrowKeysFlag';
import { isWorkspaceBreadcrumbRecentsTriggerArrowEnabled } from '../../utils/workspaceBreadcrumbRecentsTriggerArrowFlag';
import { isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled } from '../../utils/workspaceBreadcrumbRecentsTriggerArrowUpFlag';

export interface RecentConversationsDropdownProps {
  /**
   * Pre-built entries from `buildRecentConversationsList`.
   * Parent is responsible for filtering / sorting / truncation.
   * Empty arrays mean the trigger is hidden (no popover to
   * open).
   */
  entries: readonly RecentConversationEntry[];
  /**
   * Controlled open state — parent owns it so closing the
   * popover does not require a re-entry. Matches the pattern
   * `TrustBadge` uses for its popover.
   */
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onSelect: (entryId: string) => void;
  /**
   * NAV-M3-lite++ "View all" footer handler. When provided, a
   * non-`menuitem` footer row renders at the bottom of the
   * popover with a hairline separator above it. Clicking it
   * invokes the handler and closes the popover. The parent is
   * responsible for deciding when to pass this prop (typically
   * only when the filtered recents count exceeds the dropdown
   * cap); the component itself never inspects the entry list
   * for overflow.
   */
  onViewAll?: () => void;
  /**
   * Optional custom label for the footer row (defaults to
   * `View all conversations`). Kept optional so the prop
   * surface stays minimal for callers that just want the
   * default string.
   */
  viewAllLabel?: string;
  /**
   * Optional className appended to the outer wrapper so the
   * parent can nudge positioning (e.g. extra left padding when
   * rendered next to a text label).
   */
  className?: string;
  /**
   * NAV-M3-lite^3 test seam for the arrow-key roving focus
   * kill-switch. Production always uses
   * `isWorkspaceBreadcrumbRecentsArrowKeysEnabled`.
   */
  isArrowKeysEnabled?: () => boolean;
  /**
   * NAV-M3.4 test seam for the trigger-level ArrowDown
   * shortcut. Production always uses
   * `isWorkspaceBreadcrumbRecentsTriggerArrowEnabled`.
   */
  isTriggerArrowEnabled?: () => boolean;
  /**
   * NAV-M3.5 test seam for the trigger-level ArrowUp
   * shortcut. Production always uses
   * `isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled`.
   */
  isTriggerArrowUpEnabled?: () => boolean;
}

export const RecentConversationsDropdown: React.FC<RecentConversationsDropdownProps> = ({
  entries,
  open,
  onOpenChange,
  onSelect,
  onViewAll,
  viewAllLabel,
  className,
  isArrowKeysEnabled = isWorkspaceBreadcrumbRecentsArrowKeysEnabled,
  isTriggerArrowEnabled = isWorkspaceBreadcrumbRecentsTriggerArrowEnabled,
  isTriggerArrowUpEnabled = isWorkspaceBreadcrumbRecentsTriggerArrowUpEnabled,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  // NAV-M3.5 — the auto-focus-on-open effect reads this marker
  // to decide whether to focus the first or last menuitem.
  // Kept as a ref (not state) so a same-tick ArrowUp → open →
  // effect run never schedules an extra render. Reset to
  // `'first'` after each focus-on-open so subsequent opens
  // (click, ArrowDown) land on the first item by default.
  const openFocusTargetRef = useRef<'first' | 'last'>('first');
  // One ref per menuitem so the roving-focus handler can look up
  // siblings by index without reaching into the DOM. The array is
  // re-seeded on every render so stale refs never leak across
  // entry-list changes.
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  itemRefs.current = [];
  // Read the flag once per render so a same-tick flag flip is
  // visible. `useMemo` is wrong here — the resolver reads URL /
  // storage / env, and we want the latest value every render.
  const arrowKeysEnabled = isArrowKeysEnabled();
  const triggerArrowEnabled = isTriggerArrowEnabled();
  const triggerArrowUpEnabled = isTriggerArrowUpEnabled();
  const entriesCount = entries.length;

  // Close on Escape or outside-click whenever the popover is
  // open. Attach-on-open keeps the listeners quiet the 99% of
  // the time the popover is closed.
  useEffect(() => {
    if (!open) return undefined;
    if (typeof window === 'undefined') return undefined;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };
    const handleMouseDown = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (event.target instanceof Node && container.contains(event.target)) return;
      onOpenChange(false);
    };

    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onOpenChange]);

  // Move focus onto a menuitem on open so keyboard users can
  // Enter-to-select without a Tab cycle. The `defer` pattern
  // avoids focusing before the node is painted. NAV-M3.5 — the
  // `openFocusTargetRef` decides whether we land on the first
  // (default: click, ArrowDown, programmatic open) or the last
  // item (ArrowUp on the trigger). The marker is always reset
  // to `'first'` after use so the next open starts fresh.
  useEffect(() => {
    if (!open) return;
    const target = openFocusTargetRef.current;
    const id = requestAnimationFrame(() => {
      if (target === 'last') {
        const lastIdx = itemRefs.current.length - 1;
        const lastNode = lastIdx >= 0 ? itemRefs.current[lastIdx] : null;
        if (lastNode) {
          lastNode.focus();
        } else {
          firstItemRef.current?.focus();
        }
      } else {
        firstItemRef.current?.focus();
      }
      openFocusTargetRef.current = 'first';
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const handleTriggerClick = useCallback(() => {
    onOpenChange(!open);
  }, [open, onOpenChange]);

  // NAV-M3.4 / NAV-M3.5 — APG menu-button shortcuts on the
  // trigger. ArrowDown opens-to-first, ArrowUp opens-to-last.
  // `preventDefault` suppresses the native page-scroll the
  // browser would otherwise run on the arrows. Enter / Space
  // remain covered by the native `<button>` activation path.
  // The focus target for the next open is stashed on
  // `openFocusTargetRef` and read by the auto-focus effect once
  // the popover renders.
  const handleTriggerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (open) return;
      if (event.key === 'ArrowDown' && triggerArrowEnabled) {
        event.preventDefault();
        openFocusTargetRef.current = 'first';
        onOpenChange(true);
        return;
      }
      if (event.key === 'ArrowUp' && triggerArrowUpEnabled) {
        event.preventDefault();
        openFocusTargetRef.current = 'last';
        onOpenChange(true);
        return;
      }
    },
    [triggerArrowEnabled, triggerArrowUpEnabled, open, onOpenChange]
  );

  const handleItemClick = useCallback(
    (entryId: string) => {
      onSelect(entryId);
      onOpenChange(false);
    },
    [onSelect, onOpenChange]
  );

  const handleViewAllClick = useCallback(() => {
    // Defensive: the parent may race the flag off while the
    // popover is open. Bail silently rather than firing an
    // undefined handler.
    if (typeof onViewAll !== 'function') return;
    onViewAll();
    onOpenChange(false);
  }, [onViewAll, onOpenChange]);

  // Roving arrow-key focus handler (NAV-M3-lite^3). Wrapping is
  // deliberate: a tiny menu with 5 items benefits from ring
  // navigation far more than from a hard stop at the edges. Tab
  // closes the popover so the user returns to the Tab order
  // above the trigger rather than cycling through invisible DOM.
  const handleItemKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (!arrowKeysEnabled) return;
      if (entriesCount === 0) return;

      const focusAt = (target: number) => {
        const clamped = ((target % entriesCount) + entriesCount) % entriesCount;
        const node = itemRefs.current[clamped];
        if (node) node.focus();
      };

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          focusAt(idx + 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          focusAt(idx - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusAt(0);
          break;
        case 'End':
          event.preventDefault();
          focusAt(entriesCount - 1);
          break;
        case 'Tab':
          // Close and let the native Tab propagate so focus lands
          // on the next tabbable above the trigger.
          onOpenChange(false);
          break;
        default:
          break;
      }
    },
    [arrowKeysEnabled, entriesCount, onOpenChange]
  );

  if (entries.length === 0) return null;

  const wrapperClass = className ? `relative inline-flex ${className}` : 'relative inline-flex';

  // Compose the `aria-keyshortcuts` advertisement from the two
  // independent trigger-shortcut flags. When neither flag is ON
  // the attribute is omitted entirely so the DOM matches the
  // pre-NAV-M3.4 build pixel-for-pixel.
  const triggerShortcuts: string[] = [];
  if (triggerArrowEnabled) triggerShortcuts.push('ArrowDown');
  if (triggerArrowUpEnabled) triggerShortcuts.push('ArrowUp');
  const triggerAriaKeyshortcuts =
    triggerShortcuts.length > 0 ? triggerShortcuts.join(' ') : undefined;

  return (
    <div ref={containerRef} className={wrapperClass}>
      <button
        type="button"
        data-testid="workspace-breadcrumb-recents-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Recent conversations (${entries.length})`}
        aria-keyshortcuts={triggerAriaKeyshortcuts}
        data-trigger-arrow={triggerArrowEnabled ? 'true' : 'false'}
        data-trigger-arrow-up={triggerArrowUpEnabled ? 'true' : 'false'}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus text-slate-500 dark:text-slate-400"
      >
        <span aria-hidden className="text-[10px] leading-none">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="menu"
          data-testid="workspace-breadcrumb-recents-menu"
          aria-label="Recent conversations"
          className="absolute left-0 top-full mt-1 z-modal w-64 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-navy-700 dark:bg-navy-900"
        >
          <ul
            data-testid="workspace-breadcrumb-recents-list"
            className="max-h-72 overflow-y-auto py-1 text-[12px] text-slate-700 dark:text-slate-200"
          >
            {entries.map((entry, idx) => (
              <li key={entry.id} role="none">
                <button
                  type="button"
                  ref={(node) => {
                    itemRefs.current[idx] = node;
                    if (idx === 0) firstItemRef.current = node;
                  }}
                  role="menuitem"
                  data-testid={`workspace-breadcrumb-recent-${idx}`}
                  data-pinned={entry.pinned ? 'true' : 'false'}
                  onClick={() => handleItemClick(entry.id)}
                  onKeyDown={(event) => handleItemKeyDown(event, idx)}
                  title={entry.truncated ? entry.fullTitle : undefined}
                  aria-label={entry.pinned ? `Pinned: ${entry.fullTitle}` : undefined}
                  className="flex w-full items-center gap-1.5 truncate px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-navy-800 focus:bg-slate-100 dark:focus:bg-navy-800 focus:outline-none"
                >
                  {entry.pinned && (
                    <span
                      aria-hidden
                      data-testid={`workspace-breadcrumb-recent-${idx}-pin`}
                      className="inline-flex shrink-0 text-[10px] leading-none text-amber-500 dark:text-amber-300"
                    >
                      ★
                    </span>
                  )}
                  <span className="truncate">{entry.label}</span>
                </button>
              </li>
            ))}
          </ul>
          {typeof onViewAll === 'function' && (
            <div
              data-testid="workspace-breadcrumb-recents-footer"
              className="border-t border-slate-200 dark:border-navy-700"
            >
              <button
                type="button"
                data-testid="workspace-breadcrumb-recents-view-all"
                onClick={handleViewAllClick}
                className="block w-full px-3 py-1.5 text-left text-[12px] text-primary-700 hover:bg-slate-100 dark:text-primary-200 dark:hover:bg-navy-800 focus:bg-slate-100 dark:focus:bg-navy-800 focus:outline-none"
              >
                {viewAllLabel ?? 'View all conversations'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentConversationsDropdown;
