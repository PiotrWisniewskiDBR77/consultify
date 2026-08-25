/**
 * InitiativeCalendar (M13 Depth · Seria R · R3 / M13c + drag-reschedule).
 *
 * Month/week calendar for an initiative's schedule. Takes a normalized
 * ScheduleItem[] (from `buildScheduleItems`) and renders items on their start
 * day. Native HTML5 drag-and-drop reschedules an item to a new day, preserving
 * its duration.
 *
 * Drag-reschedule is available only when the caller supplies a canonical
 * writer callback. Otherwise this legacy schedule projection is read-only.
 */
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { toIsoDate } from '@/services/initiativeSchedule';
import type { ScheduleItem, ScheduleItemType } from '@/types/initiativeSchedule';

export interface InitiativeCalendarProps {
  items: ScheduleItem[];
  /** Called after a successful reschedule so the parent can refresh its state. */
  onReschedule?: (
    itemId: string,
    sourceKind: ScheduleItemType,
    sourceId: string,
    start: string,
    end: string
  ) => void | Promise<void>;
  loading?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

type ViewMode = 'month' | 'week';

const TYPE_DOT: Record<ScheduleItemType, string> = {
  task: 'bg-c-info',
  milestone: 'bg-amber-500',
  phase: 'bg-emerald-500',
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeekMonday(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon=0
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -day);
}
/** Whole-day delta between two `yyyy-mm-dd` strings (b - a), or 0 if unparseable. */
function dayDelta(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((tb - ta) / DAY_MS);
}
/** Shift a `yyyy-mm-dd` string by n whole days, returning a `yyyy-mm-dd`. */
function shiftIso(dateIso: string, days: number): string {
  const base = new Date(dateIso).getTime();
  return toIsoDate(new Date(base + days * DAY_MS).toISOString()) ?? dateIso;
}

export const InitiativeCalendar: React.FC<InitiativeCalendarProps> = ({
  items,
  onReschedule,
  loading,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Local optimistic overrides: itemId → { start, end } (yyyy-mm-dd), saving flag.
  const [overrides, setOverrides] = useState<
    Map<string, { start: string; end: string; saving?: boolean }>
  >(new Map());

  // Apply optimistic overrides on top of the incoming items (single source).
  const effectiveItems = useMemo(
    () =>
      items.map((it) => {
        const ov = overrides.get(it.id);
        return ov ? { ...it, start: ov.start, end: ov.end } : it;
      }),
    [items, overrides]
  );

  const statuses = useMemo(
    () => Array.from(new Set(effectiveItems.map((i) => i.status).filter(Boolean) as string[])),
    [effectiveItems]
  );

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? effectiveItems
        : effectiveItems.filter((i) => i.status === statusFilter),
    [effectiveItems, statusFilter]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of filtered) {
      if (!it.start) continue;
      const arr = map.get(it.start) || [];
      arr.push(it);
      map.set(it.start, arr);
    }
    return map;
  }, [filtered]);

  const undated = useMemo(() => filtered.filter((i) => !i.start), [filtered]);

  // Build the visible day grid.
  const days = useMemo(() => {
    if (view === 'week') {
      const start = startOfWeekMonday(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const first = startOfMonth(cursor);
    const gridStart = startOfWeekMonday(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursor, view]);

  const todayIso = iso(new Date());
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdayLabels = useMemo(() => {
    const mon = startOfWeekMonday(new Date());
    return Array.from({ length: 7 }, (_, i) =>
      addDays(mon, i).toLocaleDateString(undefined, { weekday: 'short' })
    );
  }, []);

  const shift = (dir: number) => {
    setCursor((c) =>
      view === 'week' ? addDays(c, dir * 7) : new Date(c.getFullYear(), c.getMonth() + dir, 1)
    );
  };

  const persist = useCallback(
    async (item: ScheduleItem, newStart: string, newEnd: string) => {
      if (!onReschedule) return;
      try {
        if (item.sourceKind === 'task') {
          await Api.put(`/api/pmo/tasks/${encodeURIComponent(item.sourceId)}`, {
            startedAt: newStart,
            dueDate: newEnd,
          });
        }
        await onReschedule(item.id, item.sourceKind, item.sourceId, newStart, newEnd);
        setOverrides((prev) => {
          const next = new Map(prev);
          next.set(item.id, { start: newStart, end: newEnd });
          return next;
        });
      } catch {
        // Rollback the optimistic move.
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [onReschedule]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dayIso: string) => {
      e.preventDefault();
      if (!onReschedule) return;
      const id = e.dataTransfer.getData('text/plain');
      // Resolve against the effective (override-aware) item so a second drag
      // shifts from the item's current position, not its server start.
      const item = effectiveItems.find((i) => i.id === id);
      if (!item || !item.start || item.start === dayIso) return;

      const delta = dayDelta(item.start, dayIso);
      if (delta === 0) return;
      const newStart = dayIso;
      const newEnd = item.end ? shiftIso(item.end, delta) : dayIso;

      // Optimistic move first, then persist (rollback on failure).
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(item.id, { start: newStart, end: newEnd, saving: true });
        return next;
      });
      void persist(item, newStart, newEnd);
    },
    [effectiveItems, persist, onReschedule]
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-navy-700">
        <CalendarDays size={15} className="text-slate-500 dark:text-slate-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">
          {monthLabel}
        </span>
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            aria-label={t('initiatives.calendarView.prev')}
            onClick={() => shift(-1)}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="px-2 py-0.5 text-xs rounded-md hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-300"
          >
            {t('initiatives.calendarView.today')}
          </button>
          <button
            type="button"
            aria-label={t('initiatives.calendarView.next')}
            onClick={() => shift(1)}
            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="flex-1" />

        {statuses.length > 0 && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 px-2 py-1"
          >
            <option value="all">{t('initiatives.calendarView.allStatuses')}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}

        <div className="inline-flex rounded-md border border-slate-200 dark:border-navy-700 overflow-hidden">
          {(['month', 'week'] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              className={`px-2.5 py-1 text-xs ${
                view === m
                  ? 'bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-slate-100'
                  : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700'
              }`}
            >
              {t(`initiatives.calendarView.${m}`)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="px-3 py-6 text-center text-sm text-slate-400">
          {t('initiatives.calendarView.loading')}
        </div>
      )}

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-navy-800">
        {weekdayLabels.map((w) => (
          <div
            key={w}
            className="px-2 py-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className={`grid grid-cols-7 ${view === 'month' ? 'grid-rows-6' : ''}`}>
        {days.map((d) => {
          const dIso = iso(d);
          const inMonth = view === 'week' || d.getMonth() === cursor.getMonth();
          const dayItems = byDay.get(dIso) || [];
          return (
            <div
              key={dIso}
              data-day={dIso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, dIso)}
              className={`min-h-[84px] border-b border-r border-slate-100 dark:border-navy-800 p-1 ${
                inMonth ? '' : 'bg-slate-50/60 dark:bg-navy-950/40'
              }`}
            >
              <div
                className={`text-[11px] mb-1 text-right pr-0.5 ${
                  dIso === todayIso
                    ? 'font-bold text-c-info dark:text-c-info'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayItems.map((it) => {
                  const saving = overrides.get(it.id)?.saving;
                  return (
                    <div
                      key={it.id}
                      draggable={!!onReschedule}
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', it.id)}
                      title={`${it.title}${saving ? ' (…)' : ''}`}
                      className={`flex items-center gap-1 rounded px-1 py-0.5 bg-slate-100 dark:bg-navy-800 transition-opacity ${
                        onReschedule ? 'cursor-grab active:cursor-grabbing' : ''
                      } ${saving ? 'opacity-60' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[it.type]}`} />
                      <span className="text-[11px] text-slate-700 dark:text-slate-200 truncate">
                        {it.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Undated bucket */}
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
                <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[it.type]}`} />
                {it.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          {t('initiatives.calendarView.empty')}
        </div>
      )}
    </div>
  );
};

export default InitiativeCalendar;
