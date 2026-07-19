/**
 * NModeCBoard — "Standard C" (ClickUp-style) presentation for artifact detail
 * views. The dense, all-on-one-screen counterpart to the N-mode (Notion-style)
 * left-rail + single-section layout.
 *
 * Design (agreed with owner, 2026-06-06):
 *  - Section navigation lives in a HORIZONTAL TOP BAR (group tabs), not a left
 *    rail — inspired by ClickUp. Clicking a group tab FILTERS the grid to that
 *    group's panels ("All" shows everything).
 *  - Content fills the FULL WIDTH as a fixed 3-column grid of compact section
 *    panels — every section visible at once ("everything on one screen").
 *  - Fewer lines: panels float on a subtle surface; group separation by space,
 *    not dividers. Condensed knowledge for power users on large screens.
 *
 * Driven by the SAME `NModeSection[]` the N-mode consumes — so any NModeShell
 * consumer (Insight, Initiative, …) gets both modes from one data source.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SectionErrorBoundary } from './SectionErrorBoundary';
import type { NModeSection } from './types';

const isVisible = (s: NModeSection): boolean =>
  Boolean(s.alwaysShow) || (s.hasData !== false && !s.cHidden);

const ALL = '__all__';

// Static class strings so Tailwind's content scanner keeps them. xl: only — at
// md (2-col) a span-3 would overflow, so clamp to the grid width there.
const SPAN_CLASS: Record<number, string> = {
  1: '',
  2: 'md:col-span-2 xl:col-span-2',
  3: 'md:col-span-2 xl:col-span-3',
};

interface GroupTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

const GroupTab: React.FC<GroupTabProps> = ({ label, count, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
      active
        ? 'bg-c-surface-raised text-c-text'
        : 'text-c-text-muted hover:bg-state-hover hover:text-c-text-secondary'
    }`}
  >
    <span className="whitespace-nowrap">{label}</span>
    {count > 0 && (
      <span
        className={`inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
          active ? 'bg-c-border-subtle text-c-text' : 'bg-c-surface-raised text-c-text-muted'
        }`}
      >
        {count}
      </span>
    )}
  </button>
);

interface NModeCBoardProps {
  sections: NModeSection[];
}

/**
 * ClickUp-style dense board. Top group-tab bar filters a fixed 3-column grid of
 * compact section panels.
 */
export const NModeCBoard: React.FC<NModeCBoardProps> = ({ sections }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const visible = useMemo(() => sections.filter(isVisible), [sections]);

  // Groups in first-appearance order (consumer controls order via section order).
  const groups = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const s of visible) {
      const g = s.group;
      if (g && !seen.has(g)) {
        seen.add(g);
        order.push(g);
      }
    }
    return order;
  }, [visible]);

  const [activeGroup, setActiveGroup] = useState<string>(ALL);

  // If the active group disappears (data changed), fall back to All.
  useEffect(() => {
    if (activeGroup !== ALL && !groups.includes(activeGroup)) setActiveGroup(ALL);
  }, [groups, activeGroup]);

  const shown = useMemo(
    () => (activeGroup === ALL ? visible : visible.filter((s) => s.group === activeGroup)),
    [visible, activeGroup]
  );

  return (
    <div className="col-span-full mt-4">
      {/* ── Top group-tab bar (ClickUp-style horizontal nav) ───────────────── */}
      {groups.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1">
          <GroupTab
            label={t('sharedComponents.nModeCBoard.all')}
            count={visible.length}
            active={activeGroup === ALL}
            onClick={() => setActiveGroup(ALL)}
          />
          {groups.map((g) => (
            <GroupTab
              key={g}
              label={g}
              count={visible.filter((s) => s.group === g).length}
              active={activeGroup === g}
              onClick={() => setActiveGroup(g)}
            />
          ))}
        </div>
      )}

      {/* ── Fixed 3-column dense panel grid (full width) ───────────────────── */}
      {/* Natural document order (no grid-flow-dense): dense reflow pulled tall
          panels up beside short ones and created worse vertical gaps. Reading
          order top-to-bottom matters more than perfect cell-packing here. */}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((section) => {
          const Icon = section.icon;
          const label = isPolish ? section.label.pl : section.label.en;
          const spanClass = SPAN_CLASS[section.cSpan ?? 1] ?? '';
          return (
            <section
              key={section.id}
              className={`overflow-hidden rounded-2xl border border-slate-200/50 bg-white/60 p-4 backdrop-blur-sm dark:border-navy-700/30 dark:bg-navy-900/30 ${spanClass}`}
            >
              <header className="mb-2.5 flex items-center gap-2">
                <Icon size={14} className="flex-shrink-0 text-slate-500 dark:text-slate-400" />
                <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                  {label}
                </h3>
                {section.badge !== undefined && section.badge > 0 && (
                  <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-200/80 px-1 text-[10px] font-semibold text-slate-500 dark:bg-navy-700/80 dark:text-slate-400">
                    {section.badge}
                  </span>
                )}
              </header>
              <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
                <SectionErrorBoundary sectionLabel={label} isPolish={isPolish}>
                  {section.component}
                </SectionErrorBoundary>
              </div>
            </section>
          );
        })}
      </div>

      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200/60 px-6 py-10 text-center text-sm text-slate-400 dark:border-navy-700/40">
          {t('sharedComponents.nModeCBoard.noSectionsInGroup')}
        </div>
      )}
    </div>
  );
};

export default NModeCBoard;
