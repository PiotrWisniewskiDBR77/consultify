/**
 * QuickFilterBar - Inline filter chips for task filtering
 * Part of Unified MyWork Module
 * UNIFIED DESIGN: Same height/padding/font as NotificationsHub filters
 */

import { AlertCircle, Calendar, CalendarDays, Flame, LayoutGrid } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type QuickFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';

interface QuickFilterBarProps {
  activeFilter: QuickFilter;
  onFilterChange: (filter: QuickFilter) => void;
  counts: {
    overdue: number;
    today: number;
    week: number;
    urgent: number;
  };
  visible?: boolean;
}

interface FilterChip {
  key: QuickFilter;
  label: string;
  icon: React.ElementType;
  count?: number;
}

export const QuickFilterBar: React.FC<QuickFilterBarProps> = ({
  activeFilter,
  onFilterChange,
  counts,
  visible = true,
}) => {
  const { t } = useTranslation();

  if (!visible) return null;

  const filters: FilterChip[] = [
    { key: 'all', label: t('common.all', 'All'), icon: LayoutGrid },
    {
      key: 'overdue',
      label: t('myWork.overdue', 'Overdue'),
      icon: AlertCircle,
      count: counts.overdue,
    },
    { key: 'today', label: t('myWork.today', 'Today'), icon: Calendar, count: counts.today },
    {
      key: 'week',
      label: t('myWork.thisWeek', 'This Week'),
      icon: CalendarDays,
      count: counts.week,
    },
    { key: 'urgent', label: t('myWork.urgent', 'Urgent'), icon: Flame, count: counts.urgent },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700">
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-500 mr-1">
        {t('common.show', 'Show')}:
      </span>

      <div className="flex items-center gap-1.5 flex-wrap">
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const Icon = filter.icon;
          // MYW-PHOTO-006 (P2): a filter reporting a zero count is a valid,
          // clickable state ("available, currently nothing matches") — NOT
          // the same thing as a locked/disabled control. Before this fix
          // both were rendered identically (`disabled` + `opacity-50
          // cursor-not-allowed`), so the owner couldn't tell "nothing here
          // right now" from "this doesn't work". `isZero` now gets its own
          // muted-but-interactive treatment instead of borrowing the
          // disabled look, and the button stays enabled so clicking it still
          // navigates to that (honestly empty) filtered view.
          const isZero = filter.count === 0;

          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => onFilterChange(filter.key)}
              aria-pressed={isActive}
              className={`
                                flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium
                                transition-all duration-150
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900
                                ${
                                  isActive
                                    ? 'bg-slate-700 text-white dark:bg-slate-600 shadow-sm'
                                    : isZero
                                      ? 'bg-white/60 dark:bg-navy-800/40 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-navy-700/70 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-500 dark:hover:text-slate-400'
                                      : 'bg-white dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-white/20'
                                }
                            `}
            >
              <Icon size={11} />
              <span>{filter.label}</span>
              {filter.count !== undefined && (
                <span
                  className={`
                                    px-1 min-w-[16px] text-center text-[10px] rounded-full
                                    ${
                                      isActive
                                        ? 'bg-white/20'
                                        : isZero
                                          ? 'bg-transparent text-slate-400 dark:text-slate-500'
                                          : 'bg-slate-100 dark:bg-white/10'
                                    }
                                `}
                >
                  {filter.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickFilterBar;
