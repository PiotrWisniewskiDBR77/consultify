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
  /** Items already in execution are immutable and rendered in frozen dark navy. */
  frozenItemIds?: string[];
  /** Optional portfolio-plan horizon; keeps 1/3/6/12 month views stable even with sparse dates. */
  rangeStart?: string;
  rangeEnd?: string;
  initialZoom?: GanttZoom;
}

type GanttZoom = 'day' | 'week' | 'month';

// Kolor BELKI per typ pozycji harmonogramu = dana kategoryczna → paleta c-tag-* (§15.1,
// stabilny indeks wg kolejności). NIGDY crimson jako dana (task miał wcześniej tailwind-brand leak, zmapowany na crimson).
// c-tag-* to zmienne var() (bez <alpha-value>) → fill solidny, bez modyfikatorów /NN. ≤5 serii.
const TYPE_BAR: Record<ScheduleItemType, string> = {
  task: 'bg-c-tag-1 hover:opacity-90 cursor-grab active:cursor-grabbing',
  milestone: 'bg-c-tag-2 hover:opacity-90',
  // F13: faza to JEDYNY typ w osi czasu planu portfela, wiec jej kolor jest tym,
  // ktory widac na ekranie planu. `c-tag-3` (violet #9d5bd2) czytal sie jak kolor
  // AI/marki i dawal bialemu tekstowi tylko ~3:1. Pasek Gantta to WYPELNIENIE
  // slupka wykresu, wiec kanonicznym zrodlem jest paleta `c-chart-*` (§15.1,
  // blue-first, nigdy alarm): `c-chart-1` #2f6f95 = 5.48:1 pod bialy tekst i
  // czytelnie odrozniony od granatu pozycji zamrozonych.
  phase: 'bg-c-chart-1 hover:opacity-90',
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
  frozenItemIds,
  rangeStart,
  rangeEnd,
  initialZoom = 'week',
}) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<GanttZoom>(initialZoom);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Local optimistic overrides: itemId → { s, e } in ms
  const [overrides, setOverrides] = useState<
    Map<string, { s: number; e: number; saving?: boolean }>
  >(new Map());

  const criticalSet = useMemo(() => new Set(criticalPathIds || []), [criticalPathIds]);
  const frozenSet = useMemo(() => new Set(frozenItemIds || []), [frozenItemIds]);

  React.useEffect(() => setZoom(initialZoom), [initialZoom]);

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
  /**
   * F13: pozycja ZAMROZONA (w realizacji) bez dat musi byc widoczna W OSI jako
   * jawny brak okna, a nie zniknac do chipow pod wykresem — inaczej czyta sie
   * jak „nie ma jej w planie". Pozostale bezdatowe zostaja chipami (bez zmiany).
   */
  const frozenUndated = useMemo(
    () => undated.filter((i) => frozenSet.has(i.id)),
    [undated, frozenSet]
  );
  const undatedChips = useMemo(
    () => undated.filter((i) => !frozenSet.has(i.id)),
    [undated, frozenSet]
  );

  const range = useMemo(() => {
    const explicitStart = parse(rangeStart ?? null);
    const explicitEnd = parse(rangeEnd ?? null);
    if (dated.length === 0 && (explicitStart === null || explicitEnd === null)) return null;
    const min = startOfWeekMonday(explicitStart ?? Math.min(...dated.map((d) => d.s)));
    const max = explicitEnd ?? Math.max(...dated.map((d) => d.e));
    const weeks = Math.max(1, Math.ceil((max - min) / (7 * DAY_MS)) + 2);
    return { min, weeks };
  }, [dated, rangeEnd, rangeStart]);

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
  const rangeEndMs = range.min + totalMs;
  const totalDays = totalMs / DAY_MS;
  const gridMinWidth = Math.max(480, Math.round(totalDays * PX_PER_DAY[zoom]));
  const pctNum = (ms: number) => Math.max(0, ((ms - range.min) / totalMs) * 100);
  const pct = (ms: number) => `${pctNum(ms)}%`;

  // Column ticks per zoom unit.
  const cols: Array<{ ms: number; label: string }> = [];
  const endMs = rangeEndMs;
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
            const saving = ov?.saving;
            const frozen = frozenSet.has(item.id);
            const canDrag = item.sourceKind === 'task' && Boolean(onReschedule) && !frozen;
            const isCritical = criticalSet.has(item.id);
            /**
             * F13 — PRZYCIECIE DO HORYZONTU. Wczesniej `left` bylo zaciskane do 0
             * (pctNum), ale `width` liczylo sie z PELNEJ dlugosci okna. Okno
             * zaczynajace sie przed poczatkiem horyzontu (np. inicjatywa w
             * realizacji od lutego) dostawalo wiec pasek od 0% o szerokosci
             * calego okna — na ekranie „ciagnie sie przez cala os", jakby nie
             * mialo dat. Rysujemy wylacznie CZESC WSPOLNA okna i horyzontu.
             */
            const startsBefore = effS < range.min;
            const endsAfter = effE > rangeEndMs;
            const visS = Math.max(effS, range.min);
            const visE = Math.min(Math.max(effE, effS + DAY_MS), rangeEndMs);
            /**
             * „Poza horyzontem" = czesc wspolna KROTSZA NIZ DZIEN, nie zwykle
             * porownanie koncow. Os siega ~2 tygodnie za `rangeEnd`, wiec okno
             * zaczynajace sie tuz przed jej koncem dawalo left≈100% i pasek
             * kilkugodzinny — na ekranie PUSTY wiersz, czytany jak brak danych
             * (tak wygladal horyzont 3m dla „Scrap Reduction Programme":
             * start 2027-01-04T00:00Z przy osi konczacej sie 2027-01-04T05:00Z).
             * Kamien milowy (start == koniec) ma z definicji DAY_MS, wiec
             * prog „< 1 dzien" go nie zjada.
             */
            const outside = visE - visS < DAY_MS;
            const left = pct(visS);
            const width = `${Math.max(0, ((visE - visS) / totalMs) * 100)}%`;
            if (outside) {
              return (
                <div
                  key={item.id}
                  className="relative h-8 border-b border-slate-200/50 dark:border-white/[0.03]"
                >
                  <div
                    className="absolute top-1.5 left-0 h-5 inline-flex items-center gap-1 rounded border border-dashed border-c-border-strong bg-c-surface-raised px-1.5"
                    title={`${item.title} • ${t('initiatives.gantt.outsideHorizon', 'Outside horizon')}`}
                  >
                    <span className="text-[10px] text-c-text-secondary truncate">
                      {item.title} · {t('initiatives.gantt.outsideHorizon', 'Outside horizon')}
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className="relative h-8 border-b border-slate-200/50 dark:border-white/[0.03]"
              >
                <div
                  className={`absolute top-1.5 h-5 rounded flex items-center px-1.5 transition-opacity ${
                    frozen ? 'bg-navy-900 dark:bg-navy-950 cursor-not-allowed' : TYPE_BAR[item.type]
                  } ${saving ? 'opacity-60' : ''} ${
                    isCritical ? 'ring-2 ring-c-danger ring-offset-1 ring-offset-c-surface' : ''
                  }`}
                  style={{ left, width, minWidth: '8px' }}
                  title={`${item.title}${isCritical ? ' • critical path' : ''}${frozen ? ' • frozen in execution' : ''}${startsBefore || endsAfter ? ` • ${t('initiatives.gantt.clippedToHorizon', 'clipped to horizon')}` : ''}${saving ? ' (saving…)' : ''}`}
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

          {/* F13: zamrozone bez dat — jawny znacznik w wierszu, nigdy pelny pasek. */}
          {frozenUndated.map((item) => (
            <div
              key={item.id}
              className="relative h-8 border-b border-slate-200/50 dark:border-white/[0.03]"
            >
              <div
                className="absolute top-1.5 left-0 h-5 inline-flex items-center gap-1 rounded border border-dashed border-c-border-strong bg-c-surface-raised px-1.5"
                title={`${item.title} • ${t('initiatives.gantt.noDates', 'No dates')}`}
              >
                <span className="text-[10px] text-c-text-secondary truncate">
                  {item.title} · {t('initiatives.gantt.noDates', 'No dates')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {undatedChips.length > 0 && (
        <div className="px-3 py-2 border-t border-c-border">
          <div className="text-[11px] font-medium text-c-text-muted mb-1">
            {t('initiatives.calendarView.undated')} ({undatedChips.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {undatedChips.map((it) => (
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
