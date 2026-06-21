/**
 * InitiativeGantt (M13 Depth · Seria V · V1).
 *
 * Task-level schedule-bar Gantt for an initiative — the missing piece next to
 * the portfolio quarterly timeline. PURE presentational: consumes the same
 * normalized ScheduleItem[] as the Calendar (one time-source, no drift) and
 * renders week columns with a bar per dated item. Read-only in v1
 * (drag-to-reschedule = follow-up). No external deps. Dark + light.
 */
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ScheduleItem, ScheduleItemType } from '@/types/initiativeSchedule';

export interface InitiativeGanttProps {
  items: ScheduleItem[];
  loading?: boolean;
}

const TYPE_BAR: Record<ScheduleItemType, string> = {
  task: 'bg-primary-500/80',
  milestone: 'bg-amber-500',
  phase: 'bg-emerald-500/70',
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}
function startOfWeekMonday(ms: number): number {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day).getTime();
}

export const InitiativeGantt: React.FC<InitiativeGanttProps> = ({ items, loading }) => {
  const { t } = useTranslation();

  const dated = useMemo(
    () =>
      items
        .filter((i) => parse(i.start) != null)
        .map((i) => ({
          item: i,
          s: parse(i.start)!,
          e: Math.max(parse(i.end) ?? parse(i.start)!, parse(i.start)!),
        })),
    [items]
  );
  const undated = useMemo(() => items.filter((i) => parse(i.start) == null), [items]);

  const range = useMemo(() => {
    if (dated.length === 0) return null;
    const min = startOfWeekMonday(Math.min(...dated.map((d) => d.s)));
    const max = Math.max(...dated.map((d) => d.e));
    const weeks = Math.max(1, Math.ceil((max - min) / (7 * DAY_MS)) + 1);
    return { min, weeks };
  }, [dated]);

  if (loading) {
    return (
      <div className="px-3 py-6 text-center text-sm text-slate-400">
        {t('initiatives.calendarView.loading')}
      </div>
    );
  }
  if (!range) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        {t('initiatives.calendarView.empty')}
      </div>
    );
  }

  const totalMs = range.weeks * 7 * DAY_MS;
  const pct = (ms: number) => `${((ms - range.min) / totalMs) * 100}%`;
  const weekCols = Array.from({ length: range.weeks }, (_, i) => range.min + i * 7 * DAY_MS);
  const todayMs = Date.now();
  const todayInRange = todayMs >= range.min && todayMs <= range.min + totalMs;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-x-auto">
      {/* Week header */}
      <div className="relative flex border-b border-slate-100 dark:border-navy-800 min-w-[480px]">
        {weekCols.map((ms) => (
          <div
            key={ms}
            className="flex-1 px-2 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-navy-800 whitespace-nowrap"
          >
            {new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="relative min-w-[480px]">
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 w-px bg-primary-500/60 z-10"
            style={{ left: pct(todayMs) }}
            aria-hidden
          />
        )}
        {dated.map(({ item, s, e }) => {
          const left = pct(s);
          const width = `${(Math.max(e - s, DAY_MS) / totalMs) * 100}%`;
          return (
            <div
              key={item.id}
              className="relative h-8 border-b border-slate-50 dark:border-navy-800/60"
            >
              <div
                className={`absolute top-1.5 h-5 rounded ${TYPE_BAR[item.type]} flex items-center px-1.5`}
                style={{ left, width, minWidth: '8px' }}
                title={item.title}
              >
                <span className="text-[10px] text-white truncate">{item.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700">
          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mb-1">
            {t('initiatives.calendarView.undated')} ({undated.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((it) => (
              <span
                key={it.id}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 text-[11px] text-slate-600 dark:text-slate-300"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_BAR[it.type]}`} />
                {it.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InitiativeGantt;
