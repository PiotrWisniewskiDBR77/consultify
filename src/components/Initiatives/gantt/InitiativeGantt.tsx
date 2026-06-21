/**
 * InitiativeGantt (M13 Depth · Seria V · V1+drag).
 *
 * Task-level schedule-bar Gantt for an initiative. Consumes the same
 * normalized ScheduleItem[] as the Calendar (one time-source, no drift) and
 * renders week columns with a draggable bar per dated item.
 *
 * Drag-reschedule (W5): pointer-event based, no external deps.
 * Tasks  → PUT /api/pmo/tasks/:id {startedAt, dueDate}
 * Phases / Milestones → onReschedule callback (caller persists)
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { toIsoDate } from '@/services/initiativeSchedule';
import type { ScheduleItem, ScheduleItemType } from '@/types/initiativeSchedule';

export interface InitiativeGanttProps {
  items: ScheduleItem[];
  loading?: boolean;
  /** Called after a successful reschedule so the parent can refresh its state. */
  onReschedule?: (
    itemId: string,
    sourceKind: ScheduleItemType,
    sourceId: string,
    start: string,
    end: string
  ) => void;
}

const TYPE_BAR: Record<ScheduleItemType, string> = {
  task: 'bg-primary-500/80 hover:bg-primary-500 cursor-grab active:cursor-grabbing',
  milestone: 'bg-amber-500 hover:bg-amber-400',
  phase: 'bg-emerald-500/70 hover:bg-emerald-500',
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
function snapToDay(ms: number): number {
  return Math.round(ms / DAY_MS) * DAY_MS;
}

export const InitiativeGantt: React.FC<InitiativeGanttProps> = ({
  items,
  loading,
  onReschedule,
}) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);

  // Local optimistic overrides: itemId → { s, e } in ms
  const [overrides, setOverrides] = useState<
    Map<string, { s: number; e: number; saving?: boolean }>
  >(new Map());

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
    const weeks = Math.max(1, Math.ceil((max - min) / (7 * DAY_MS)) + 2);
    return { min, weeks };
  }, [dated]);

  const persist = useCallback(
    async (item: ScheduleItem, newS: number, newE: number) => {
      const startIso = toIsoDate(new Date(newS).toISOString())!;
      const endIso = toIsoDate(new Date(newE).toISOString())!;
      try {
        if (item.sourceKind === 'task') {
          await Api.put(`/api/pmo/tasks/${item.sourceId}`, {
            startedAt: new Date(newS).toISOString(),
            dueDate: new Date(newE).toISOString(),
          });
        }
        onReschedule?.(item.id, item.sourceKind, item.sourceId, startIso, endIso);
        setOverrides((prev) => {
          const next = new Map(prev);
          next.set(item.id, { s: newS, e: newE });
          return next;
        });
      } catch {
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [onReschedule]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ScheduleItem, sMs: number, eMs: number) => {
      if (!range) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);

      const totalMs = range.weeks * 7 * DAY_MS;
      const gridEl = gridRef.current;
      if (!gridEl) return;
      const gridRect = gridEl.getBoundingClientRect();

      const dragStartX = e.clientX;
      const origS = sMs;
      const origE = eMs;
      const durMs = origE - origS;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - dragStartX;
        const dMs = (dx / gridRect.width) * totalMs;
        const newS = snapToDay(origS + dMs);
        const newE = newS + durMs;
        setOverrides((prev) => new Map(prev).set(item.id, { s: newS, e: newE }));
      };
      const onUp = (ev: PointerEvent) => {
        el.releasePointerCapture(ev.pointerId);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        const dx = ev.clientX - dragStartX;
        const dMs = (dx / gridRect.width) * totalMs;
        if (Math.abs(dMs) < DAY_MS / 2) {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            return next;
          });
          return;
        }
        const newS = snapToDay(origS + dMs);
        const newE = newS + durMs;
        setOverrides((prev) => new Map(prev).set(item.id, { s: newS, e: newE, saving: true }));
        void persist(item, newS, newE);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    },
    [range, persist]
  );

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
  const pct = (ms: number) => `${Math.max(0, ((ms - range.min) / totalMs) * 100)}%`;
  const weekCols = Array.from({ length: range.weeks }, (_, i) => range.min + i * 7 * DAY_MS);
  const todayMs = Date.now();
  const todayInRange = todayMs >= range.min && todayMs <= range.min + totalMs;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 overflow-x-auto select-none">
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

      {/* Grid rows */}
      <div ref={gridRef} className="relative min-w-[480px]">
        {todayInRange && (
          <div
            className="absolute top-0 bottom-0 w-px bg-primary-500/60 z-10 pointer-events-none"
            style={{ left: pct(todayMs) }}
            aria-hidden
          />
        )}
        {dated.map(({ item, s, e }) => {
          const ov = overrides.get(item.id);
          const effS = ov?.s ?? s;
          const effE = ov?.e ?? e;
          const left = pct(effS);
          const width = `${(Math.max(effE - effS, DAY_MS) / totalMs) * 100}%`;
          const saving = ov?.saving;
          const canDrag = item.sourceKind === 'task';
          return (
            <div
              key={item.id}
              className="relative h-8 border-b border-slate-50 dark:border-navy-800/60"
            >
              <div
                className={`absolute top-1.5 h-5 rounded flex items-center px-1.5 transition-opacity ${TYPE_BAR[item.type]} ${saving ? 'opacity-60' : ''}`}
                style={{ left, width, minWidth: '8px' }}
                title={`${item.title}${saving ? ' (saving…)' : ''}`}
                onPointerDown={
                  canDrag ? (ev) => handlePointerDown(ev, item, effS, effE) : undefined
                }
              >
                <span className="text-[10px] text-white truncate pointer-events-none">
                  {item.title}
                </span>
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
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
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
