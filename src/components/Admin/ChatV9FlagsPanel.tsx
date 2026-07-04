/**
 * Chat V9 / ADMIN AG1 v1 — feature flag control panel.
 *
 * Purpose
 * -------
 * Surfaces `CHAT_V9_FLAGS` as a live, interactive table so owners / SRE
 * can
 *
 *   - see every registered V9 flag at a glance,
 *   - spot which flags are **overridden** away from the shipped
 *     default in the current browser session,
 *   - flip individual flags ON / OFF / back-to-default without a
 *     redeploy (via `localStorage` writes), and
 *   - nuke every override with a single "Reset all" button.
 *
 * This component is intentionally presentational + thin — every write
 * goes through the write-side helpers on `chatV9FeatureFlags.ts`, so
 * the SSR-safety, private-mode fallback and quota handling stay in one
 * place.
 *
 * Mounting
 * --------
 * The panel has no opinion about how it is surfaced. `ChatV9FlagsOverlay`
 * mounts it behind a URL query toggle (`?v9flags=1`) so power users can
 * reach it on any page without a route change. Custom admin routes can
 * mount it directly.
 */

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardX,
  Link as LinkIcon,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildChatV9FlagDocSummary } from '../../utils/buildChatV9FlagDocSummary';
import { buildChatV9FlagOverrideUrl } from '../../utils/buildChatV9FlagOverrideUrl';
import type { ChatV9Block, ChatV9FlagDescriptor } from '../../utils/chatV9FeatureFlags';
import {
  CHAT_V9_FLAGS,
  clearChatV9FlagOverride,
  getChatV9FlagOverrideState,
  getChatV9FlagSnapshot,
  resetAllChatV9FlagOverrides,
  setChatV9FlagOverride,
} from '../../utils/chatV9FeatureFlags';
import {
  buildChatV9FlagSnapshotText,
  copyTextToClipboard,
} from '../../utils/chatV9FlagsSnapshotText';
import { isFlagsPanelDescriptionExpandEnabled } from '../../utils/flagsPanelDescriptionExpandFlag';
import { isFlagsPanelDocLinksEnabled } from '../../utils/flagsPanelDocLinksFlag';
import { isFlagsPanelFilterEscapeClearEnabled } from '../../utils/flagsPanelFilterEscapeClearFlag';
import { isFlagsPanelFilterEnabled } from '../../utils/flagsPanelFilterFlag';
import { isFlagsPanelGroupingEnabled } from '../../utils/flagsPanelGroupingFlag';
import { isFlagsPanelOverrideUrlCopyEnabled } from '../../utils/flagsPanelOverrideUrlCopyFlag';
import { isFlagsPanelRowShortcutsEnabled } from '../../utils/flagsPanelRowShortcutsFlag';
import { isFlagsPanelShortcutCheatSheetEnabled } from '../../utils/flagsPanelShortcutCheatSheetFlag';
import { isFlagsPanelStickyGroupHeadersEnabled } from '../../utils/flagsPanelStickyGroupHeadersFlag';
import { isFlagsSnapshotCopyEnabled } from '../../utils/flagsSnapshotCopyFlag';
import { groupChatV9Flags } from '../../utils/groupChatV9Flags';
import { matchChatV9Flag } from '../../utils/matchChatV9Flag';
import { shouldOfferChatV9FlagExpand } from '../../utils/shouldOfferChatV9FlagExpand';

interface ChatV9FlagsPanelProps {
  /**
   * Optional close handler. When provided, a dismiss button is rendered
   * in the header — the overlay uses this so the user can close the
   * sheet without relying on the URL alone.
   */
  onClose?: () => void;
  /** Optional test-only title override. */
  title?: string;
  /**
   * Test seam for the snapshot copy button (AG1 v1.2). Production
   * always uses `isFlagsSnapshotCopyEnabled`. Tests inject a stub to
   * force the flag ON / OFF paths without touching localStorage.
   */
  isCopySnapshotEnabled?: () => boolean;
  /**
   * Test seam for the clipboard writer. Production always uses
   * `copyTextToClipboard`. Tests inject a stub that records the
   * payload and returns a canned result.
   */
  writeToClipboard?: typeof copyTextToClipboard;
  /**
   * Test seam for the filter input (AG1 v1.5). Production always
   * uses `isFlagsPanelFilterEnabled`. Tests inject a stub to force
   * the flag ON / OFF paths deterministically.
   */
  isFilterEnabled?: () => boolean;
  /**
   * Test seam for the collapsible grouping (AG1 v1.6). Production
   * always uses `isFlagsPanelGroupingEnabled`.
   */
  isGroupingEnabled?: () => boolean;
  /**
   * Test seam for the per-row spec-doc breadcrumb (AG1 v1.7).
   * Production always uses `isFlagsPanelDocLinksEnabled`.
   */
  isDocLinksEnabled?: () => boolean;
  /**
   * Test seam for the per-row description expansion toggle
   * (AG1 v1.8). Production always uses
   * `isFlagsPanelDescriptionExpandEnabled`.
   */
  isDescriptionExpandEnabled?: () => boolean;
  /**
   * Test seam for the sticky block-group headers (AG1 v1.9).
   * Production always uses
   * `isFlagsPanelStickyGroupHeadersEnabled`.
   */
  isStickyGroupHeadersEnabled?: () => boolean;
  /**
   * Test seam for the per-row keyboard shortcuts (AG1 v1.10).
   * Production always uses `isFlagsPanelRowShortcutsEnabled`.
   */
  isRowShortcutsEnabled?: () => boolean;
  /**
   * Test seam for the header shortcut cheat-sheet pill
   * (AG1 v1.11). Production always uses
   * `isFlagsPanelShortcutCheatSheetEnabled`. The pill only
   * renders when this seam AND `isRowShortcutsEnabled`
   * both return `true` — advertising a shortcut the handler
   * refuses to serve would be a lie, so both gates must agree.
   */
  isShortcutCheatSheetEnabled?: () => boolean;
  /**
   * Test seam for the "Copy override URL" button (AG1
   * v1.12). Production always uses
   * `isFlagsPanelOverrideUrlCopyEnabled`; tests inject a
   * stub to force the ON / OFF paths without touching
   * localStorage.
   */
  isOverrideUrlCopyEnabled?: () => boolean;
  /**
   * Test seam for the "Escape clears the filter input"
   * behaviour (AG1 v1.13). Production always uses
   * `isFlagsPanelFilterEscapeClearEnabled`. Tests inject a
   * stub to force the ON / OFF paths without touching
   * localStorage.
   */
  isFilterEscapeClearEnabled?: () => boolean;
  /**
   * Test seam for the override-URL builder (AG1 v1.12).
   * Production always uses `buildChatV9FlagOverrideUrl`,
   * which reads `window.location` directly. Tests inject a
   * stub that returns a deterministic URL so the clipboard
   * payload assertion is stable across JSDOM versions.
   */
  buildOverrideUrl?: () => string;
}

type CopyFeedback = 'idle' | 'copied' | 'failed';

const COPY_FEEDBACK_MS = 2000;

export const ChatV9FlagsPanel: React.FC<ChatV9FlagsPanelProps> = ({
  onClose,
  title,
  isCopySnapshotEnabled = isFlagsSnapshotCopyEnabled,
  writeToClipboard = copyTextToClipboard,
  isFilterEnabled = isFlagsPanelFilterEnabled,
  isGroupingEnabled = isFlagsPanelGroupingEnabled,
  isDocLinksEnabled = isFlagsPanelDocLinksEnabled,
  isDescriptionExpandEnabled = isFlagsPanelDescriptionExpandEnabled,
  isStickyGroupHeadersEnabled = isFlagsPanelStickyGroupHeadersEnabled,
  isRowShortcutsEnabled = isFlagsPanelRowShortcutsEnabled,
  isShortcutCheatSheetEnabled = isFlagsPanelShortcutCheatSheetEnabled,
  isOverrideUrlCopyEnabled = isFlagsPanelOverrideUrlCopyEnabled,
  buildOverrideUrl = () => buildChatV9FlagOverrideUrl(),
  isFilterEscapeClearEnabled = isFlagsPanelFilterEscapeClearEnabled,
}) => {
  // Snapshots are snapshots, not a subscription. `refreshTick` is the
  // cheap way to force a re-render after every write without pulling
  // in a store. We intentionally recompute the snapshot on *every*
  // render (it's a cheap O(flags) map) so external callers that
  // `rerender()` — e.g. the admin menu that flipped a flag via a
  // different path — see fresh state without needing to trigger
  // `bump()`.
  const [, setRefreshTick] = useState(0);
  const bump = useCallback(() => setRefreshTick((n) => n + 1), []);
  const snapshot = getChatV9FlagSnapshot();

  const overridesCount = snapshot.filter((s) => !s.matchesDefault).length;

  const handleToggle = useCallback(
    (id: string, state: 'on' | 'off' | null) => {
      if (state === null) {
        clearChatV9FlagOverride(id);
      } else {
        setChatV9FlagOverride(id, state);
      }
      bump();
    },
    [bump]
  );

  const handleResetAll = useCallback(() => {
    resetAllChatV9FlagOverrides();
    bump();
  }, [bump]);

  // ------------------------------------------------------------------
  // AG1 v1.2 — Copy snapshot to clipboard.
  //
  // `feedback` drives the transient button label (idle → copied → idle,
  // or idle → failed → idle). A ref holds the reset timer so rapid
  // re-clicks collapse into one feedback window rather than stacking.
  // ------------------------------------------------------------------
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>('idle');
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyEnabled = isCopySnapshotEnabled();

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, []);

  // ------------------------------------------------------------------
  // AG1 v1.5 — Filter input.
  //
  // `filterEnabled` is computed once per render so the input disappears
  // the same tick the kill-switch flips. When the flag goes OFF we
  // also reset the query, so flipping it back ON later does not
  // restore a stale filter state.
  // ------------------------------------------------------------------
  const filterEnabled = isFilterEnabled();
  const filterEscapeClearEnabled = isFilterEscapeClearEnabled();
  const [filterQuery, setFilterQuery] = useState('');

  // AG1 v1.13 — Escape clears the filter in place when it has
  // text; falls through when empty so the overlay keeps its
  // one-keystroke dismiss. We both `preventDefault` (so the
  // browser does not clear native "autofill" affordances) and
  // `stopPropagation` (so the overlay does not also see the
  // Escape and close the whole panel). Empty-input Escape is
  // deliberately NOT handled: we want the overlay to see it.
  const handleFilterKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (!filterEscapeClearEnabled) return;
      if (event.key !== 'Escape') return;
      if (filterQuery.length === 0) return;
      if (event.isPropagationStopped?.() || event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setFilterQuery('');
    },
    [filterEscapeClearEnabled, filterQuery.length]
  );

  useEffect(() => {
    if (!filterEnabled && filterQuery.length > 0) {
      setFilterQuery('');
    }
  }, [filterEnabled, filterQuery.length]);

  const visibleFlags = useMemo(() => {
    if (!filterEnabled) return CHAT_V9_FLAGS;
    if (filterQuery.trim().length === 0) return CHAT_V9_FLAGS;
    return CHAT_V9_FLAGS.filter((flag) => matchChatV9Flag(flag, filterQuery));
  }, [filterEnabled, filterQuery]);

  // ------------------------------------------------------------------
  // AG1 v1.6 — Collapsible block groups.
  //
  // `groupingEnabled` is read once per render so the panel flips back
  // to the flat list the same tick the kill-switch goes off. Per-block
  // collapse state is purely local (not persisted): the panel is a
  // rescue tool, and sticky-closing a group that happens to contain
  // the flag the admin needs to flip would be a footgun.
  //
  // The "filter active" rule: while a non-empty query is typed the
  // user wants visible matches to be reachable without extra clicks,
  // so every group with a match is force-expanded for rendering.
  // Collapse state is remembered across toggles — clearing the query
  // restores whatever the admin had collapsed before.
  // ------------------------------------------------------------------
  const groupingEnabled = isGroupingEnabled();
  // AG1 v1.9 — sticky block-group headers. Only meaningful when
  // the AG1 v1.6 grouping is also ON (a flat list has no
  // headers to stick). Reading the kill-switch once per render
  // keeps the panel pixel-stable when either flag flips.
  const stickyGroupHeadersEnabled = groupingEnabled && isStickyGroupHeadersEnabled();
  const [collapsedBlocks, setCollapsedBlocks] = useState<ReadonlySet<ChatV9Block>>(() => new Set());

  // AG1 v1.7 — per-row spec-doc breadcrumb. Resolved once per render
  // so the flag read is cheap and deterministic; `renderFlagRow`
  // closes over the boolean instead of calling the resolver
  // per row.
  const docLinksEnabled = isDocLinksEnabled();

  // AG1 v1.8 — per-row description expansion toggle.
  //
  // `expandedDescriptions` is deliberately not persisted: the
  // panel is a rescue tool, and sticky-expanding a description
  // across sessions would waste vertical space for the common
  // "flip and leave" admin flow. Expansion state is reset any
  // time the panel unmounts (e.g. overlay close).
  const descriptionExpandEnabled = isDescriptionExpandEnabled();
  const [expandedDescriptions, setExpandedDescriptions] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  // AG1 v1.10 — per-row keyboard shortcuts.
  //
  // Resolved once per render so every row sees the same value
  // (no race between the kill-switch resolver and the live
  // snapshot). The row handler below checks the closed-over
  // boolean; when OFF, the `onKeyDown` handler and the
  // `aria-keyshortcuts` attributes are both omitted so the
  // DOM is pixel-identical to the pre-AG1-v1.10 build.
  const rowShortcutsEnabled = isRowShortcutsEnabled();

  // AG1 v1.11 — shortcut cheat-sheet pill.
  //
  // The pill only renders when BOTH kill-switches agree:
  // the v1.10 handler must be live (otherwise the pill
  // would advertise a shortcut that does nothing) AND the
  // v1.11 label kill-switch must be ON (so tenants can
  // hide the pill without losing the behaviour). Composing
  // the two reads here keeps the JSX below a single flag.
  const shortcutCheatSheetEnabled = rowShortcutsEnabled && isShortcutCheatSheetEnabled();

  const handleRowKeyDown = useCallback(
    (flagId: string, event: React.KeyboardEvent<HTMLLIElement>) => {
      if (!rowShortcutsEnabled) return;
      if (event.defaultPrevented) return;
      // A modifier means the user is composing a real shortcut
      // (`⌘O`, `Ctrl+F`, …); never hijack those.
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      // Never steal keystrokes from an editable surface. This
      // keeps typing safe in any future inline input (e.g. a
      // per-row annotation field) without needing a second
      // kill-switch.
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      switch (event.key) {
        case 'o':
          event.preventDefault();
          handleToggle(flagId, 'on');
          return;
        case 'f':
          event.preventDefault();
          handleToggle(flagId, 'off');
          return;
        case 'd':
          event.preventDefault();
          handleToggle(flagId, null);
          return;
        default:
          return;
      }
    },
    [rowShortcutsEnabled, handleToggle]
  );

  const toggleDescriptionExpanded = useCallback((flagId: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(flagId)) {
        next.delete(flagId);
      } else {
        next.add(flagId);
      }
      return next;
    });
  }, []);

  const toggleBlock = useCallback((block: ChatV9Block) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(block)) {
        next.delete(block);
      } else {
        next.add(block);
      }
      return next;
    });
  }, []);

  const groups = useMemo(() => groupChatV9Flags(visibleFlags, CHAT_V9_FLAGS), [visibleFlags]);

  const filterActive = filterEnabled && filterQuery.trim().length > 0;

  const handleCopySnapshot = useCallback(async () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    let result;
    try {
      const text = buildChatV9FlagSnapshotText();
      result = await writeToClipboard(text);
    } catch {
      result = { ok: false as const, reason: 'failed' as const };
    }
    setCopyFeedback(result.ok ? 'copied' : 'failed');
    feedbackTimerRef.current = setTimeout(() => {
      setCopyFeedback('idle');
      feedbackTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [writeToClipboard]);

  // ------------------------------------------------------------------
  // AG1 v1.12 — Copy override URL.
  //
  // Separate feedback state from AG1 v1.2 so the two buttons can flash
  // their transient labels independently. Disabled while there are no
  // overrides (the URL would be no-op and misleading). Reading the
  // flag once per render keeps the JSX pure.
  // ------------------------------------------------------------------
  const overrideUrlCopyEnabled = isOverrideUrlCopyEnabled();
  const [overrideUrlFeedback, setOverrideUrlFeedback] = useState<CopyFeedback>('idle');
  const overrideUrlFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (overrideUrlFeedbackTimerRef.current) {
        clearTimeout(overrideUrlFeedbackTimerRef.current);
        overrideUrlFeedbackTimerRef.current = null;
      }
    };
  }, []);

  const handleCopyOverrideUrl = useCallback(async () => {
    if (overrideUrlFeedbackTimerRef.current) {
      clearTimeout(overrideUrlFeedbackTimerRef.current);
      overrideUrlFeedbackTimerRef.current = null;
    }
    let result;
    try {
      const url = buildOverrideUrl();
      result = await writeToClipboard(url);
    } catch {
      result = { ok: false as const, reason: 'failed' as const };
    }
    setOverrideUrlFeedback(result.ok ? 'copied' : 'failed');
    overrideUrlFeedbackTimerRef.current = setTimeout(() => {
      setOverrideUrlFeedback('idle');
      overrideUrlFeedbackTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [buildOverrideUrl, writeToClipboard]);

  return (
    <div
      data-testid="chat-v9-flags-panel"
      className="w-full max-w-4xl rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl"
    >
      <header className="flex items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-navy-700">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title ?? 'Chat V9 — feature flags'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {overridesCount > 0
              ? `${overridesCount} override${overridesCount === 1 ? '' : 's'} in this browser session`
              : 'All flags at their shipped defaults'}
          </p>
          {shortcutCheatSheetEnabled && (
            <p
              data-testid="chat-v9-flags-shortcut-cheat-sheet"
              data-shortcut-cheat-sheet="true"
              className="mt-1.5 inline-flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
              aria-label="Keyboard shortcuts on focused flag rows: o turns the flag on, f turns it off, d clears the override"
            >
              <span className="uppercase tracking-wide text-[10px] text-slate-600 dark:text-slate-500">
                Shortcuts
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-800 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-200">
                  o
                </kbd>
                <span>ON</span>
              </span>
              <span aria-hidden="true" className="text-slate-600 dark:text-navy-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-800 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-200">
                  f
                </kbd>
                <span>OFF</span>
              </span>
              <span aria-hidden="true" className="text-slate-600 dark:text-navy-600">
                ·
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-800 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:text-slate-200">
                  d
                </kbd>
                <span>default</span>
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {copyEnabled && (
            <button
              type="button"
              data-testid="chat-v9-flags-copy-snapshot"
              data-state={copyFeedback}
              onClick={handleCopySnapshot}
              aria-label={
                copyFeedback === 'copied'
                  ? 'Flag snapshot copied to clipboard'
                  : copyFeedback === 'failed'
                    ? 'Copying flag snapshot failed'
                    : 'Copy flag snapshot to clipboard'
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                copyFeedback === 'copied'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : copyFeedback === 'failed'
                    ? 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-600/60 dark:bg-danger-900/30 dark:text-danger-200'
                    : 'border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {copyFeedback === 'copied' ? (
                <ClipboardCheck size={12} />
              ) : copyFeedback === 'failed' ? (
                <ClipboardX size={12} />
              ) : (
                <ClipboardCopy size={12} />
              )}
              {copyFeedback === 'copied'
                ? 'Copied'
                : copyFeedback === 'failed'
                  ? 'Copy failed'
                  : 'Copy snapshot'}
            </button>
          )}
          {overrideUrlCopyEnabled && (
            <button
              type="button"
              data-testid="chat-v9-flags-copy-override-url"
              data-state={overrideUrlFeedback}
              onClick={handleCopyOverrideUrl}
              disabled={overridesCount === 0}
              aria-label={
                overridesCount === 0
                  ? 'No overrides to share — every flag is at its shipped default'
                  : overrideUrlFeedback === 'copied'
                    ? 'Override URL copied to clipboard'
                    : overrideUrlFeedback === 'failed'
                      ? 'Copying override URL failed'
                      : 'Copy shareable URL that reproduces the current overrides'
              }
              title={
                overridesCount === 0
                  ? 'No overrides to share'
                  : 'Copy shareable URL encoding every current override'
              }
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                overrideUrlFeedback === 'copied'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/60 dark:bg-emerald-900/30 dark:text-emerald-200'
                  : overrideUrlFeedback === 'failed'
                    ? 'border-danger-300 bg-danger-50 text-danger-700 dark:border-danger-600/60 dark:bg-danger-900/30 dark:text-danger-200'
                    : 'border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              {overrideUrlFeedback === 'copied' ? (
                <Check size={12} />
              ) : overrideUrlFeedback === 'failed' ? (
                <ClipboardX size={12} />
              ) : (
                <LinkIcon size={12} />
              )}
              {overrideUrlFeedback === 'copied'
                ? 'Copied'
                : overrideUrlFeedback === 'failed'
                  ? 'Copy failed'
                  : 'Copy URL'}
            </button>
          )}
          <button
            type="button"
            data-testid="chat-v9-flags-reset-all"
            onClick={handleResetAll}
            disabled={overridesCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-navy-700 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={12} />
            Reset all
          </button>
          {onClose && (
            <button
              type="button"
              data-testid="chat-v9-flags-close"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {filterEnabled && CHAT_V9_FLAGS.length > 0 && (
        <div
          data-testid="chat-v9-flags-filter-row"
          className="px-4 py-2 border-b border-slate-200 dark:border-navy-800 bg-slate-50/60 dark:bg-navy-900/40 flex items-center gap-2"
        >
          <Search size={13} className="text-slate-600 dark:text-slate-500 shrink-0" />
          <input
            type="text"
            data-testid="chat-v9-flags-filter-input"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={handleFilterKeyDown}
            data-escape-clear={filterEscapeClearEnabled ? 'true' : 'false'}
            aria-keyshortcuts={filterEscapeClearEnabled ? 'Escape' : undefined}
            placeholder="Filter by title, ticket, block or id"
            aria-label="Filter Chat V9 flags"
            className="flex-1 bg-transparent outline-none text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {filterQuery.length > 0 && (
            <button
              type="button"
              data-testid="chat-v9-flags-filter-clear"
              onClick={() => setFilterQuery('')}
              aria-label="Clear filter"
              className="inline-flex items-center justify-center w-5 h-5 rounded-md text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <X size={12} />
            </button>
          )}
          <span
            data-testid="chat-v9-flags-filter-count"
            className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-500 shrink-0"
          >
            {visibleFlags.length}/{CHAT_V9_FLAGS.length}
          </span>
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto">
        {CHAT_V9_FLAGS.length === 0 ? (
          <div
            data-testid="chat-v9-flags-empty"
            className="p-6 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"
          >
            <AlertTriangle size={14} />
            <span>No Chat V9 flags are registered.</span>
          </div>
        ) : visibleFlags.length === 0 ? (
          <div
            data-testid="chat-v9-flags-filter-empty"
            className="p-6 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2"
          >
            <AlertTriangle size={14} />
            <span>No flags match &quot;{filterQuery}&quot;.</span>
          </div>
        ) : groupingEnabled ? (
          groups.map((group) => {
            if (group.totalFlags === 0) return null;
            // While a filter is active, any group with matches is
            // force-expanded so the admin can see hits without extra
            // clicks. When the filter is inactive or has no matches in
            // this group, fall back to the remembered collapse state.
            const forceExpanded = filterActive && group.hasMatches;
            const isCollapsed = !forceExpanded && collapsedBlocks.has(group.block);
            const overrideCount = group.visibleFlags.filter((flag) => {
              const entry = snapshot.find((s) => s.id === flag.id);
              return entry ? !entry.matchesDefault : false;
            }).length;
            return (
              <section
                key={group.block}
                data-testid={`chat-v9-flags-group-${group.block}`}
                data-collapsed={isCollapsed}
                className="border-b border-slate-200 dark:border-navy-800 last:border-b-0"
              >
                <button
                  type="button"
                  data-testid={`chat-v9-flags-group-header-${group.block}`}
                  data-sticky={stickyGroupHeadersEnabled ? 'true' : 'false'}
                  onClick={() => toggleBlock(group.block)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`chat-v9-flags-group-body-${group.block}`}
                  className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-100 dark:hover:bg-navy-800 text-left ${
                    stickyGroupHeadersEnabled
                      ? // Opaque background + sticky top + z-index so
                        // row content underneath never shows through the
                        // header when it pins to the container top.
                        'sticky top-0 z-10 bg-slate-50 dark:bg-navy-900 shadow-[0_1px_0_0_rgba(148,163,184,0.15)] dark:shadow-[0_1px_0_0_rgba(15,23,42,0.4)]'
                      : 'bg-slate-50/70 dark:bg-navy-900/50'
                  }`}
                >
                  {isCollapsed ? (
                    <ChevronRight
                      size={13}
                      className="text-slate-600 dark:text-slate-500 shrink-0"
                    />
                  ) : (
                    <ChevronDown
                      size={13}
                      className="text-slate-600 dark:text-slate-500 shrink-0"
                    />
                  )}
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-300">
                    {group.block}
                  </span>
                  <span
                    data-testid={`chat-v9-flags-group-count-${group.block}`}
                    className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-500"
                  >
                    {filterActive
                      ? `${group.visibleFlags.length}/${group.totalFlags}`
                      : `${group.totalFlags}`}
                  </span>
                  {overrideCount > 0 && (
                    <span
                      data-testid={`chat-v9-flags-group-overrides-${group.block}`}
                      className="ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      title="Overrides inside this group"
                    >
                      {overrideCount} override{overrideCount === 1 ? '' : 's'}
                    </span>
                  )}
                </button>
                {!isCollapsed && group.visibleFlags.length > 0 && (
                  <ul
                    id={`chat-v9-flags-group-body-${group.block}`}
                    className="divide-y divide-slate-200 dark:divide-navy-800"
                  >
                    {group.visibleFlags.map((flag) => renderFlagRow(flag))}
                  </ul>
                )}
              </section>
            );
          })
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-navy-800">
            {visibleFlags.map((flag) => renderFlagRow(flag))}
          </ul>
        )}
      </div>
    </div>
  );

  // Inline row renderer — kept inside the component so `snapshot`,
  // `handleToggle` and `getChatV9FlagOverrideState` stay closed over.
  // Declared after the JSX so the grouped and flat paths can both
  // call it without duplicating the row markup.
  function renderFlagRow(flag: ChatV9FlagDescriptor) {
    const entry = snapshot.find((s) => s.id === flag.id);
    if (!entry) return null;
    const overrideState = getChatV9FlagOverrideState(flag.id);
    return (
      <li
        key={flag.id}
        data-testid={`chat-v9-flag-row-${flag.id}`}
        data-row-shortcuts={rowShortcutsEnabled ? 'true' : 'false'}
        onKeyDown={rowShortcutsEnabled ? (e) => handleRowKeyDown(flag.id, e) : undefined}
        className="p-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white truncate">
              {flag.title}
            </span>
            <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-500">
              {flag.ticket}
            </span>
            <span
              className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide ${
                entry.enabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-400'
              }`}
            >
              {entry.enabled ? 'on' : 'off'}
            </span>
            {!entry.matchesDefault && (
              <span
                data-testid={`chat-v9-flag-override-${flag.id}`}
                className="text-[10px] rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                title="Overridden away from the shipped default"
              >
                override
              </span>
            )}
          </div>
          {(() => {
            const offerExpand =
              descriptionExpandEnabled &&
              shouldOfferChatV9FlagExpand({ description: flag.description });
            const isExpanded = offerExpand && expandedDescriptions.has(flag.id);
            const descriptionId = `chat-v9-flag-description-${flag.id}`;
            return (
              <>
                <p
                  id={descriptionId}
                  data-testid={`chat-v9-flag-description-${flag.id}`}
                  className={
                    isExpanded
                      ? 'mt-1 text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line'
                      : 'mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-3'
                  }
                >
                  {flag.description}
                </p>
                {offerExpand && (
                  <button
                    type="button"
                    data-testid={`chat-v9-flag-description-expand-${flag.id}`}
                    aria-expanded={isExpanded}
                    aria-controls={descriptionId}
                    onClick={() => toggleDescriptionExpanded(flag.id)}
                    className="mt-1 text-[10px] font-medium text-primary-700 hover:underline dark:text-primary-300 focus:outline-none focus:ring-2 focus:ring-c-focus rounded"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            );
          })()}
          <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-500 font-mono truncate">
            {flag.keys.localStorage}
          </p>
          {docLinksEnabled &&
            (() => {
              const summary = buildChatV9FlagDocSummary(flag);
              if (summary.primary === null) {
                return (
                  <p
                    data-testid={`chat-v9-flag-docs-empty-${flag.id}`}
                    className="mt-1 text-[10px] italic text-slate-600 dark:text-slate-400"
                  >
                    — no spec docs
                  </p>
                );
              }
              return (
                <p
                  data-testid={`chat-v9-flag-docs-${flag.id}`}
                  className="mt-1 text-[10px] text-slate-600 dark:text-slate-500 font-mono truncate select-text"
                  title={summary.tooltip}
                >
                  <span className="text-slate-600 dark:text-slate-500">docs:</span>{' '}
                  <span data-testid={`chat-v9-flag-docs-primary-${flag.id}`}>
                    {summary.primary}
                  </span>
                  {summary.extraCount > 0 && (
                    <span
                      data-testid={`chat-v9-flag-docs-more-${flag.id}`}
                      className="ml-1 text-slate-600 dark:text-slate-500"
                    >
                      (+{summary.extraCount} more)
                    </span>
                  )}
                </p>
              );
            })()}
        </div>

        <div
          role="group"
          aria-label={`Override ${flag.id}`}
          className="flex items-center gap-1 shrink-0"
        >
          <ToggleButton
            active={overrideState === 'on'}
            onClick={() => handleToggle(flag.id, 'on')}
            testId={`chat-v9-flag-on-${flag.id}`}
            label="ON"
            tone="emerald"
            keyShortcut={rowShortcutsEnabled ? 'o' : undefined}
          />
          <ToggleButton
            active={overrideState === 'off'}
            onClick={() => handleToggle(flag.id, 'off')}
            testId={`chat-v9-flag-off-${flag.id}`}
            label="OFF"
            tone="slate"
            keyShortcut={rowShortcutsEnabled ? 'f' : undefined}
          />
          <ToggleButton
            active={overrideState === null}
            onClick={() => handleToggle(flag.id, null)}
            testId={`chat-v9-flag-default-${flag.id}`}
            label="default"
            tone="slate"
            icon={<Check size={12} />}
            keyShortcut={rowShortcutsEnabled ? 'd' : undefined}
          />
        </div>
      </li>
    );
  }
};

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  testId: string;
  label: string;
  tone: 'emerald' | 'slate';
  icon?: React.ReactNode;
  /**
   * AG1 v1.10 — per-row shortcut advertised via
   * `aria-keyshortcuts` (e.g. `"o"`, `"f"`, `"d"`). Undefined
   * when the kill-switch for the row shortcuts is OFF so the
   * DOM matches the pre-AG1-v1.10 output.
   */
  keyShortcut?: string;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({
  active,
  onClick,
  testId,
  label,
  tone,
  icon,
  keyShortcut,
}) => {
  const toneActive =
    tone === 'emerald'
      ? 'bg-emerald-500 text-white border-emerald-500'
      : 'bg-slate-700 text-white border-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200';
  const toneInactive =
    'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800';

  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active}
      aria-keyshortcuts={keyShortcut}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${active ? toneActive : toneInactive}`}
    >
      {icon}
      {label}
    </button>
  );
};

export default ChatV9FlagsPanel;
