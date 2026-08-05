/**
 * MyWorkNav — two-level navigation for the My Work hub (M02-P01, reconciles
 * findings M02-010 / M02-017 / M02-023).
 *
 * WHY TWO LEVELS
 * ---------------
 * The flat single-row bar on `origin/demo` already scrolls horizontally when
 * it runs out of room, but it has no scroll affordance — tabs past the fold
 * are silently invisible unless a user thinks to drag the row. Splitting into
 * two levels (group chips, then the active group's tab chips) keeps every
 * group name visible at once and never needs more than 4 tab chips on one
 * row, at the cost of one extra click to switch groups.
 *
 * This file starts from the two-level nav design authored on the unmerged
 * `codex/m02d-manager-ui-evidence-20260804` branch (`MyWorkNav.tsx`, which
 * does not exist on `origin/demo`), per the M02 integration map's
 * recommendation to use it "as a starting design reference, not a mergeable
 * diff" — and fixes its two open findings rather than porting them:
 *
 *   M02-010 (accessible-name gap) — the source branch's level-1 tablist had
 *   `aria-label={groupLabels.radar ? undefined : undefined}`, a ternary that
 *   evaluates to `undefined` on both arms, i.e. NO accessible name at all.
 *   Fixed here: a real, localized `aria-label` on both tablists, and locked
 *   tabs now carry `aria-disabled` + an `aria-label` stating the lock reason
 *   instead of relying on an unreliable `title` tooltip alone.
 *
 *   M02-017 (locked-group activation gap) — the source branch always sent
 *   group-chip clicks to `items[0]`. If a group's first tab happened to be
 *   locked, clicking that group's chip could never switch into the group —
 *   the group's other, unlocked tabs became unreachable from level 1. Fixed
 *   here: group-chip selection targets the group's first UNLOCKED tab, only
 *   falling back to the literal first tab (preserving the existing
 *   "blocked" callback behavior) when every tab in the group is locked.
 *
 * BEHAVIOUR
 * ---------
 * Selecting a group activates that group's first reachable tab, so level 2
 * never shows a group whose tab is not the one being displayed — the active
 * group and the active tab are always the same claim (derived, not stored
 * separately).
 *
 * ACCESSIBILITY
 * -------------
 * Each level is a `tablist` with a real accessible name and roving focus
 * (Left/Right/Home/End); the active item carries `aria-selected`; the
 * level-1 chip owns the level-2 row via `aria-controls`. Locked items are
 * `aria-disabled` and keep a descriptive `aria-label`.
 *
 * OVERFLOW
 * --------
 * Below the width where a level fits, it scrolls horizontally and shows a
 * fade + chevron end-of-scroll affordance so a narrow viewport never
 * silently hides a surface.
 */

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type NavGroup = 'queues' | 'knowledge' | 'automation' | 'oversight';

/** Render order of the groups — day-to-day usage frequency, most-used first. */
export const NAV_GROUP_ORDER: NavGroup[] = ['queues', 'knowledge', 'automation', 'oversight'];

export interface MyWorkNavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  navGroup: NavGroup;
  count?: number;
  isLocked?: boolean;
  lockedReason?: string;
}

export interface MyWorkNavProps {
  tabs: MyWorkNavTab[];
  activeTabId: string;
  /** Localized group names, keyed by group id. */
  groupLabels: Record<NavGroup, string>;
  /** Accessible name for the level-1 (group) tablist. */
  groupsAriaLabel: string;
  onSelectTab: (tabId: string) => void;
  /** Called instead of `onSelectTab` when the tab is gated. */
  onBlockedTab?: (tab: MyWorkNavTab) => void;
  activeChipClassName: string;
  inactiveChipClassName: string;
}

interface ScrollEdges {
  scrollable: boolean;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * Reports whether a horizontally scrollable element has content hidden off
 * either edge. Recomputed on scroll, on resize, and whenever `deps` change
 * (the level-2 row changes content when the group changes).
 */
function useScrollEdges(deps: unknown[]): [React.RefObject<HTMLDivElement | null>, ScrollEdges] {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({
    scrollable: false,
    atStart: true,
    atEnd: true,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px tolerance: fractional layout widths otherwise report a permanent
    // "not at end" and the affordance would never switch off.
    const maxScroll = el.scrollWidth - el.clientWidth;
    setEdges({
      scrollable: maxScroll > 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return [ref, edges];
}

/** Roving focus for a `tablist`: Left/Right move, Home/End jump. */
function useRovingKeys(onActivate: (index: number) => void) {
  return useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const items = Array.from(
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      );
      if (items.length === 0) return;
      const current = items.findIndex((item) => item === document.activeElement);
      let next = current;
      if (event.key === 'ArrowLeft') next = current <= 0 ? items.length - 1 : current - 1;
      if (event.key === 'ArrowRight') next = current === items.length - 1 ? 0 : current + 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = items.length - 1;
      if (next === current || next < 0) return;
      event.preventDefault();
      items[next].focus();
      onActivate(next);
    },
    [onActivate]
  );
}

const ScrollAffordance: React.FC<{ side: 'start' | 'end'; visible: boolean }> = ({
  side,
  visible,
}) =>
  visible ? (
    <span
      aria-hidden
      data-scroll-affordance={side}
      className={`pointer-events-none absolute top-0 bottom-0 flex w-12 items-center ${
        side === 'end'
          ? 'right-0 justify-end bg-gradient-to-l from-white via-white dark:from-navy-900 dark:via-navy-900'
          : 'left-0 justify-start bg-gradient-to-r from-white via-white dark:from-navy-900 dark:via-navy-900'
      }`}
    >
      {/* The chevron sits on its own solid chip: over a plain gradient it read
          as part of the clipped word behind it rather than as an edge marker. */}
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:ring-white/10">
        {side === 'end' ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </span>
    </span>
  ) : null;

export const MyWorkNav: React.FC<MyWorkNavProps> = ({
  tabs,
  activeTabId,
  groupLabels,
  groupsAriaLabel,
  onSelectTab,
  onBlockedTab,
  activeChipClassName,
  inactiveChipClassName,
}) => {
  const groups = useMemo(
    () =>
      NAV_GROUP_ORDER.map((group) => ({
        group,
        label: groupLabels[group],
        items: tabs.filter((tab) => tab.navGroup === group),
      })).filter((entry) => entry.items.length > 0),
    [tabs, groupLabels]
  );

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  // The active group is DERIVED from the active tab, never stored separately —
  // that is what keeps "you are in this group" and "you are on this tab" from
  // ever disagreeing.
  const activeGroup = activeTab?.navGroup ?? groups[0]?.group;
  const activeGroupEntry = groups.find((entry) => entry.group === activeGroup) ?? groups[0];

  const selectTab = useCallback(
    (tab: MyWorkNavTab | undefined) => {
      if (!tab) return;
      if (tab.isLocked) {
        onBlockedTab?.(tab);
        return;
      }
      onSelectTab(tab.id);
    },
    [onBlockedTab, onSelectTab]
  );

  // M02-017 fix: a group chip must land on the group's first UNLOCKED tab —
  // targeting a blindly-fixed `items[0]` made the whole group unreachable
  // whenever its first tab happened to be locked. Fall back to the literal
  // first tab (preserving the existing blocked-callback UX) only when every
  // tab in the group is locked.
  const firstReachableTab = useCallback(
    (entry: (typeof groups)[number] | undefined) =>
      entry?.items.find((tab) => !tab.isLocked) ?? entry?.items[0],
    []
  );

  const [groupRowRef, groupEdges] = useScrollEdges([groups.length]);
  const [tabRowRef, tabEdges] = useScrollEdges([
    activeGroupEntry?.group,
    activeGroupEntry?.items.length,
  ]);

  const onGroupKeys = useRovingKeys((index) => selectTab(firstReachableTab(groups[index])));
  const onTabKeys = useRovingKeys((index) => selectTab(activeGroupEntry?.items[index]));

  if (groups.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="mywork-nav">
      {/* Level 1 — groups. Names are VISIBLE here, which is the whole point of
          the second level: they no longer compete with nine tabs for one row. */}
      <div className="relative min-w-0">
        <div
          ref={groupRowRef}
          role="tablist"
          aria-label={groupsAriaLabel}
          aria-orientation="horizontal"
          onKeyDown={onGroupKeys}
          data-testid="mywork-nav-groups"
          className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap"
        >
          {groups.map((entry) => {
            const isActiveGroup = entry.group === activeGroupEntry?.group;
            return (
              <button
                key={entry.group}
                type="button"
                role="tab"
                aria-selected={isActiveGroup}
                aria-controls="mywork-nav-tabs"
                tabIndex={isActiveGroup ? 0 : -1}
                data-testid={`mywork-group-${entry.group}`}
                data-nav-group={entry.group}
                onClick={() => selectTab(firstReachableTab(entry))}
                className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                  isActiveGroup
                    ? 'bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-slate-100'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.06]'
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <ScrollAffordance side="start" visible={groupEdges.scrollable && !groupEdges.atStart} />
        <ScrollAffordance side="end" visible={groupEdges.scrollable && !groupEdges.atEnd} />
      </div>

      {/* Level 2 — the surfaces inside the active group. At most four items, so
          this row has room for its labels at every viewport. */}
      <div className="relative min-w-0">
        <div
          ref={tabRowRef}
          id="mywork-nav-tabs"
          role="tablist"
          aria-orientation="horizontal"
          aria-label={activeGroupEntry?.label}
          onKeyDown={onTabKeys}
          data-testid="mywork-nav-tabs"
          data-nav-group={activeGroupEntry?.group}
          className="flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap"
        >
          {activeGroupEntry?.items.map((tab) => {
            const isActive = tab.id === activeTabId;
            const lockedLabel = tab.isLocked
              ? `${tab.label}${tab.lockedReason ? ` — ${tab.lockedReason}` : ''}`
              : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={tab.isLocked || undefined}
                aria-label={lockedLabel}
                tabIndex={isActive ? 0 : -1}
                onClick={() => selectTab(tab)}
                className={`${isActive ? activeChipClassName : inactiveChipClassName} shrink-0`}
                data-testid={`mywork-tab-${tab.id}`}
                data-nav-group={tab.navGroup}
                title={
                  tab.isLocked ? lockedLabel : `${activeGroupEntry.label} · ${tab.label}`
                }
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.isLocked && <Lock size={14} className="opacity-70" aria-hidden />}
              </button>
            );
          })}
        </div>
        <ScrollAffordance side="start" visible={tabEdges.scrollable && !tabEdges.atStart} />
        <ScrollAffordance side="end" visible={tabEdges.scrollable && !tabEdges.atEnd} />
      </div>
    </div>
  );
};

MyWorkNav.displayName = 'MyWorkNav';

export default MyWorkNav;
