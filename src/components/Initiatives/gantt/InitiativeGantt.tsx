/**
 * InitiativeGantt (M13 Depth · Seria V · V1 — full).
 *
 * Task-level schedule-bar Gantt for an initiative. Consumes the same
 * normalized ScheduleItem[] as the Calendar (one time-source, no drift) and
 * renders time columns with a draggable bar per dated item.
 *
 * Features:
 *  - optional drag-reschedule (W5), persisted only through the supplied
 *    canonical-writer callback; without it this legacy projection is read-only;
 *  - zoom (day / week / month) — visual density of the time axis;
 *  - status filter — narrow the bars to a single status;
 *  - dependency connectors (prop-driven) — L-shaped links between items;
 *  - critical-path highlight (prop-driven) — emphasised bars + connectors.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toIsoDate } from '@/services/initiativeSchedule';
import type { ScheduleItem, ScheduleItemType } from '@/types/initiativeSchedule';

export interface GanttDependency {
  /** ScheduleItem.id of the predecessor. */
  fromId: string;
  /** ScheduleItem.id of the dependent (successor). */
  toId: string;
}

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
  ) => void | Promise<void>;
  /** Dependency edges between items (by ScheduleItem.id) → connector lines. */
  dependencies?: GanttDependency[];
  /** ScheduleItem.ids on the critical path → highlighted bars + connectors. */
  criticalPathIds?: string[];
}

type GanttZoom = 'day' | 'week' | 'month';

// Kolor BELKI per typ pozycji harmonogramu = dana kategoryczna → paleta c-tag-* (§15.1,
// stabilny indeks wg kolejności). NIGDY crimson jako dana (task miał wcześniej tailwind-brand leak, zmapowany na crimson).
// c-tag-* to zmienne var() (bez <alpha-value>) → fill solidny, bez modyfikatorów /NN. ≤5 serii.
const TYPE_BAR: Record<ScheduleItemType, string> = {
  task: 'bg-c-tag-1 hover:opacity-90 cursor-grab active:cursor-grabbing',
  milestone: 'bg-c-tag-2 hover:opacity-90',
  phase: 'bg-c-tag-3 hover:opacity-90',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_H = 32; // px — must match the h-8 grid row below.

/** px-per-day per zoom level → drives the visual width of the time axis. */
const PX_PER_DAY: Record<GanttZoom, number> = { day: 26, week: 9, month: 3.2 };

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
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function snapToDay(ms: number): number {
  return Math.round(ms / DAY_MS) * DAY_MS;
}

export const InitiativeGantt: React.FC<InitiativeGanttProps> = ({
  items,
  loading,
  onReschedule,
  dependencies,
  criticalPathIds,
}) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<GanttZoom>('week');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Local optimistic overrides: itemId → { s, e } in ms
  const [overrides, setOverrides] = useState<
    Map<string, { s: number; e: number; saving?: boolean }>
  >(new Map());

  const criticalSet = useMemo(() => new Set(criticalPathIds || []), [criticalPathIds]);

  const statuses = useMemo(
    () =>
      Array.from(
        new Set(items.map((i) => (i.status ? String(i.status) : null)).filter(Boolean) as string[])
      ),
    [items]
  );

  const filtered = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((i) => String(i.status) === statusFilter)),
    [items, statusFilter]
  );

  const dated = useMemo(
    () =>
      filtered
        .filter((i) => parse(i.start) != null)
        .map((i) => ({
          item: i,
          s: parse(i.start)!,
          e: Math.max(parse(i.end) ?? parse(i.start)!, parse(i.start)!),
        })),
    [filtered]
  );
  const undated = useMemo(() => filtered.filter((i) => parse(i.start) == null), [filtered]);

  const range = useMemo(() => {
    if (dated.length === 0) return null;
    const min = startOfWeekMonday(Math.min(...dated.map((d) => d.s)));
    const max = Math.max(...dated.map((d) => d.e));
    const weeks = Math.max(1, Math.ceil((max - min) / (7 * DAY_MS)) + 2);
    return { min, weeks };
  }, [dated]);

  const persist = useCallback(
    async (item: ScheduleItem, newS: number, newE: number) => {
      if (!onReschedule) return;
      const startIso = toIsoDate(new Date(newS).toISOString())!;
      const endIso = toIsoDate(new Date(newE).toISOString())!;
      try {
        await onReschedule(item.id, item.sourceKind, item.sourceId, startIso, endIso);
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
      if (!range || !onReschedule) return;
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
    [range, persist, onReschedule]
  );

  // Toolbar (zoom + status filter) — rendered above the grid in all states.
  const toolbar = (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200/50 dark:border-white/[0.03]">
      {statuses.length > 0 && (
        <select
          aria-label={t('initiatives.calendarView.allStatuses', 'All statuses')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-[11px] rounded border border-c-border bg-c-surface px-1.5 py-0.5 text-c-text-secondary"
        >
          <option value="all">{t('initiatives.calendarView.allStatuses', 'All statuses')}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      <div className="flex-1" />
      <div className="inline-flex rounded border border-c-border overflow-hidden">
        {(['day', 'week', 'month'] as GanttZoom[]).map((z) => (
          <button
            key={z}
            type="button"
            aria-pressed={zoom === z}
            onClick={() => setZoom(z)}
            className={`text-[11px] px-2 py-0.5 ${
              zoom === z
                ? 'bg-c-surface-raised text-c-text'
                : 'text-c-text-muted hover:bg-c-surface-raised'
            }`}
          >
            {t(
              `initiatives.gantt.zoom.${z}`,
              z === 'day' ? 'Day' : z === 'week' ? 'Week' : 'Month'
            )}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
        {toolbar}
        <div className="px-3 py-6 text-center text-sm text-c-text-muted">
          {t('initiatives.calendarView.loading')}
        </div>
      </div>
    );
  }
  if (!range) {
    return (
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
        {toolbar}
        <div className="px-3 py-8 text-center text-sm text-c-text-muted">
          {t('initiatives.calendarView.empty')}
        </div>
      </div>
    );
  }

  const totalMs = range.weeks * 7 * DAY_MS;
  const totalDays = totalMs / DAY_MS;
  const gridMinWidth = Math.max(480, Math.round(totalDays * PX_PER_DAY[zoom]));
  const pctNum = (ms: number) => Math.max(0, ((ms - range.min) / totalMs) * 100);
  const pct = (ms: number) => `${pctNum(ms)}%`;

  // Column ticks per zoom unit.
  const cols: Array<{ ms: number; label: string }> = [];
  const endMs = range.min + totalMs;
  if (zoom === 'day') {
    for (let ms = range.min; ms < endMs; ms += DAY_MS) {
      cols.push({ ms, label: new Date(ms).toLocaleDateString(undefined, { day: '2-digit' }) });
    }
  } else if (zoom === 'month') {
    let ms = startOfMonth(range.min);
    while (ms < endMs) {
      cols.push({
        ms,
        label: new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      });
      ms = startOfMonth(ms + 32 * DAY_MS);
    }
  } else {
    for (let i = 0; i < range.weeks; i += 1) {
      const ms = range.min + i * 7 * DAY_MS;
      cols.push({
        ms,
        label: new Date(ms).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
      });
    }
  }

  const todayMs = Date.now();
  const todayInRange = todayMs >= range.min && todayMs <= range.min + totalMs;

  // Geometry for dependency connectors: itemId → { rowIndex, sx, ex } (x in %).
  const rowGeom = new Map<string, { row: number; sx: number; ex: number }>();
  dated.forEach(({ item, s, e }, idx) => {
    const ov = overrides.get(item.id);
    rowGeom.set(item.id, { row: idx, sx: pctNum(ov?.s ?? s), ex: pctNum(ov?.e ?? e) });
  });
  const depEdges = (dependencies || [])
    .map((d) => {
      const from = rowGeom.get(d.fromId);
      const to = rowGeom.get(d.toId);
      if (!from || !to) return null;
      const critical = criticalSet.has(d.fromId) && criticalSet.has(d.toId);
      return { from, to, critical };
    })
    .filter(Boolean) as Array<{
    from: { row: number; sx: number; ex: number };
    to: { row: number; sx: number; ex: number };
    critical: boolean;
  }>;

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface select-none">
      {toolbar}
      <div className="overflow-x-auto">
        {/* Time header */}
        <div
          className="relative flex border-b border-slate-200/50 dark:border-white/[0.03]"
          style={{ minWidth: gridMinWidth }}
        >
          {cols.map((c) => (
            <div
              key={c.ms}
              className="flex-1 px-2 py-1.5 text-[10px] text-c-text-muted border-r border-slate-200/50 dark:border-white/[0.03] whitespace-nowrap"
            >
              {c.label}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        <div ref={gridRef} className="relative" style={{ minWidth: gridMinWidth }}>
          {todayInRange && (
            <div
              className="absolute top-0 bottom-0 w-px bg-c-text z-10 pointer-events-none"
              style={{ left: pct(todayMs) }}
              aria-hidden
            />
          )}

          {/* Dependency connectors overlay (x in %, y in row units). */}
          {depEdges.length > 0 && (
            <svg
              className="absolute inset-0 z-[5] pointer-events-none"
              width="100%"
              height={dated.length * ROW_H}
              viewBox={`0 0 100 ${dated.length}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              {depEdges.map((edge, i) => {
                const y1 = edge.from.row + 0.5;
                const y2 = edge.to.row + 0.5;
                const x1 = edge.from.ex;
                const x2 = edge.to.sx;
                const midX = Math.max(x1 + 1, Math.min(x2 - 1, (x1 + x2) / 2));
                const d = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                return (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={edge.critical ? 'var(--c-danger)' : 'var(--c-border-strong)'}
                    strokeWidth={edge.critical ? 0.06 : 0.04}
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={edge.critical ? undefined : '0.4 0.3'}
                  />
                );
              })}
            </svg>
          )}

          {dated.map(({ item, s, e }) => {
            const ov = overrides.get(item.id);
            const effS = ov?.s ?? s;
            const effE = ov?.e ?? e;
            const left = pct(effS);
            const width = `${(Math.max(effE - effS, DAY_MS) / totalMs) * 100}%`;
            const saving = ov?.saving;
            const canDrag = item.sourceKind === 'task' && Boolean(onReschedule);
            const isCritical = criticalSet.has(item.id);
            return (
              <div
                key={item.id}
                className="relative h-8 border-b border-slate-200/50 dark:border-white/[0.03]"
              >
                <div
                  className={`absolute top-1.5 h-5 rounded flex items-center px-1.5 transition-opacity ${TYPE_BAR[item.type]} ${saving ? 'opacity-60' : ''} ${
                    isCritical ? 'ring-2 ring-c-danger ring-offset-1 ring-offset-c-surface' : ''
                  }`}
                  style={{ left, width, minWidth: '8px' }}
                  title={`${item.title}${isCritical ? ' • critical path' : ''}${saving ? ' (saving…)' : ''}`}
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
      </div>

      {undated.length > 0 && (
        <div className="px-3 py-2 border-t border-c-border">
          <div className="text-[11px] font-medium text-c-text-muted mb-1">
            {t('initiatives.calendarView.undated')} ({undated.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((it) => (
              <span
                key={it.id}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-c-surface-raised text-[11px] text-c-text-secondary"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-c-text-muted" />
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
