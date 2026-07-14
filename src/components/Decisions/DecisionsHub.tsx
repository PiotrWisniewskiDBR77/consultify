/**
 * DecisionsHub — Standalone Decisions module hub.
 *
 * Canonical Menu 3 reference for the Decisions module:
 * - Menu 2: main tabs (My / Awaiting / All) as icon+label pills — no badges on tabs (KANON v3)
 * - Menu 3 (Command Row): preset filter chips left, optional AI actions right
 * - Primary CTA: "New Decision" — no leading `+`, no gradient (KANON v3)
 *
 * Reference pattern: module-hub-standard.md §2 / §3
 */

import { Hourglass, LayoutGrid, Scale, Sparkles, User } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MENU_2_TAB_ACTIVE,
  MENU_2_TAB_INACTIVE,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_BASE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_BASE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  MENU_3_ROW_CLASS,
} from '@/components/shared/ModuleMenu3';

import { DecisionInbox } from './DecisionInbox';

type ViewMode = 'my' | 'awaiting' | 'all';

interface MenuCounts {
  total: number;
  my: number;
  awaiting: number;
}

export const DecisionsHub: React.FC = () => {
  const { t } = useTranslation();

  // Menu 2 active tab maps to the filter passed to DecisionInbox
  const [activeView, setActiveView] = useState<ViewMode>('my');

  // Counts bubbled up from DecisionInbox (optional; start at 0 until inbox fires update)
  const [counts, setCounts] = useState<MenuCounts>({ total: 0, my: 0, awaiting: 0 });

  const handleCountsChange = useCallback(
    (next: { total: number; my: number; awaiting: number; overdue: number; escalated: number }) => {
      setCounts({ total: next.total, my: next.my, awaiting: next.awaiting });
    },
    []
  );

  // -------------------------------------------------------------------
  // Menu 2 tabs — KANON v3: no badge counts on main tabs, no leading `+`
  // -------------------------------------------------------------------
  const tabs: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: 'my', label: t('decisions.myDecisions', 'My decisions'), icon: <User size={16} /> },
    {
      id: 'awaiting',
      label: t('decisions.awaiting', 'Awaiting others'),
      icon: <Hourglass size={16} />,
    },
    { id: 'all', label: t('decisions.all', 'All'), icon: <LayoutGrid size={16} /> },
  ];

  // -------------------------------------------------------------------
  // Menu 3 (Command Row) preset chips — same pattern as My Work > Decyzje
  // -------------------------------------------------------------------
  const presets: Array<{
    id: ViewMode | 'all';
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'all',
      label: t('common.all', 'ALL'),
      count: counts.total,
      icon: <span className={MENU_3_ALL_DOT_CLASS} />,
    },
    {
      id: 'my',
      label: t('decisions.myDecisions', 'My decisions'),
      count: counts.my,
      icon: <User size={14} className="text-blue-400" />,
    },
    {
      id: 'awaiting',
      label: t('decisions.awaiting', 'Awaiting others'),
      count: counts.awaiting,
      icon: <Hourglass size={14} className="text-amber-400" />,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-c-bg text-c-text">
      {/* ----------------------------------------------------------------
          Navigation Bar — Menu 2 + Menu 3 in a single surface block
          Standard: bg-c-surface border-b border-c-border-subtle
          ---------------------------------------------------------------- */}
      <div className="bg-c-surface border-b border-c-border-subtle">
        {/* Menu 2 row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: tabs */}
          <div className="flex items-center gap-2" role="tablist" aria-label="Decisions views">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeView === tab.id}
                onClick={() => setActiveView(tab.id)}
                className={activeView === tab.id ? MENU_2_TAB_ACTIVE : MENU_2_TAB_INACTIVE}
                data-testid={`decisions-tab-${tab.id}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Right cluster: Primary CTA — no leading `+`, no gradient (KANON v3) */}
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={() => {
                /* TODO: open new-decision modal */
              }}
              className="
                inline-flex items-center justify-center h-9 rounded-lg px-4
                text-sm font-medium transition-colors duration-150
                text-c-surface
                bg-c-text hover:opacity-90
                active:scale-[0.98]
                focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-c-focus focus-visible:ring-offset-1
                ring-offset-c-bg
              "
              data-testid="decisions-cta-new"
            >
              {t('decisions.newDecision', 'New Decision')}
            </button>
          </div>
        </div>

        {/* Menu 3 (Command Row) — one row, chips left, AI actions right */}
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            {/* Left: preset filter chips */}
            <div className={MENU_3_LEFT_CLASS}>
              {presets.map((p) => {
                // "ALL" chip maps to activeView === 'all'; My/Awaiting map directly.
                const chipActive = activeView === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActiveView(p.id === 'all' ? 'all' : (p.id as ViewMode))}
                    className={`${MENU_3_CHIP_BASE} ${chipActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}`}
                    data-testid={`decisions-preset-${p.id}`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                    <span
                      className={`${MENU_3_BADGE_BASE} ${chipActive ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}`}
                    >
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right: AI action */}
            <div className={MENU_3_RIGHT_CLASS}>
              <button type="button" className={MENU_3_ACTION_NEUTRAL}>
                <Scale size={14} />
                <Sparkles size={14} />
                {t('decisions.aiAnalyze', 'AI Analyze')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto">
        <DecisionInbox showHeader={false} embedded onCountsChange={handleCountsChange} />
      </div>
    </div>
  );
};

export default DecisionsHub;
