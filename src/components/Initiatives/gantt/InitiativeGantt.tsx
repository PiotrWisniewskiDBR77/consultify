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

/**
 * DEC-615: one row of the fixed name column (mockup `.lrow`). The name lives
 * HERE, never inside the bar — a short window used to swallow it.
 */
export interface GanttRowLabel {
  /** ScheduleItem.id this label belongs to. */
  id: string;
  name: string;
  /** Second line, e.g. "Planned · Quality lead". */
  meta?: string | null;
  /** In-execution rows carry the frozen dot colour. */
  frozen?: boolean;
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
  /**
   * DEC-615: presence of the name column switches the axis into plan-timeline
   * mode (208px labels, week/month grid, TODAY badge, one-line legend). Absent
   * = the legacy task-level layout of an initiative artifact.
   */
  rowLabels?: GanttRowLabel[];
  /**
   * DEC-608: plan lifecycle. Anything but DRAFT freezes every bar and shows the
   * read-only notice. Absent = no plan gate (legacy consumer).
   */
  planStatus?: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  /** Action inside the read-only notice of a published plan. */
  onNewDraftVersion?: () => void;
}

type GanttZoom = 'day' | 'week' | 'month';

// Kolor BELKI per typ pozycji harmonogramu = dana kategoryczna → paleta c-tag-* (§15.1,
// stabilny indeks wg kolejności). NIGDY crimson jako dana (task miał wcześniej tailwind-brand leak, zmapowany na crimson).
// c-tag-* to zmienne var() (bez <alpha-value>) → fill solidny, bez modyfikatorów /NN. ≤5 serii.
const TYPE_BAR: Record<ScheduleItemType, string> = {
  task: 'bg-c-tag-1 text-c-tag-foreground hover:opacity-90 cursor-grab active:cursor-grabbing',
  milestone: 'bg-c-tag-2 text-c-tag-foreground hover:opacity-90',
  // F13: faza to JEDYNY typ w osi czasu planu portfela, wiec jej kolor jest tym,
  // ktory widac na ekranie planu. `c-tag-3` (violet #9d5bd2) czytal sie jak kolor
  // AI/marki i dawal bialemu tekstowi tylko ~3:1. Pasek Gantta to WYPELNIENIE
  // slupka wykresu, wiec kanonicznym zrodlem jest paleta `c-chart-*` (§15.1,
  // blue-first, nigdy alarm): `c-chart-1` #2f6f95 = 5.48:1 pod bialy tekst i
  // czytelnie odrozniony od granatu pozycji zamrozonych. Tekst `text-c-surface`,
  // nie `text-c-tag-foreground`: w ciemnym motywie `c-chart-1` jasnieje do
  // #5aa3d4 i biel daje tam 2.75:1 (zmierzone pikselowo), a `c-surface` =
  // #0f172a daje 6.46:1; w jasnym `c-surface` = biel, czyli te same 5.48:1.
  phase: 'bg-c-chart-1 text-c-surface hover:opacity-90',
};

/**
 * DEC-615 §3.3: pozycja W REALIZACJI = odwrocenie tokenow (`bg-c-text
 * text-c-surface`, 21:1 jasny / ~16:1 ciemny), NIE surowy Tailwind `navy-900`
 * i NIE nowy token `--c-exec` z makiety — SSOT kolorow zostaje `src/index.css`.
 */
const EXEC_BAR = 'bg-c-text text-c-surface cursor-not-allowed';

/**
 * Sciezka krytyczna to DANA kategoryczna, wiec nie moze byc crimsonem
 * (`ring-c-danger` = pulapka nr 1). `c-chart-2` #2f8f6b (3.99:1, AA-Large dla
 * grafiki) jest odroznialny od niebieskich paskow, od bursztynowej obwodki
 * konfliktu i od niebieskiego pierscienia fokusu.
 */
const CRITICAL_RING = 'ring-2 ring-c-chart-2 ring-offset-1 ring-offset-c-surface';

const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_H = 32; // px — must match the h-8 grid row below.
/**
 * DEC-615 etap 1b (P2-2): plan rows are tall enough for a TWO-line clamped name
 * (SPEC §3.1 `line-clamp:2`, 11.6px/1.22 ≈ 28px) PLUS the role meta line
 * (9.8px ≈ 13px) and the cell's py-1 — at the old 40px the second name line and
 * the meta overflowed the fixed-height label cell. 52px fits name(2)+meta.
 */
const PLAN_ROW_H = 52;
/** Mockup `.bar` height (22px) and name-column width (208px). */
const PLAN_BAR_H = 22;

/** One axis row, shared by the name column and the track so they cannot drift. */
type GanttRow =
  | { kind: 'bar'; item: ScheduleItem; s: number; e: number }
  | { kind: 'outside'; item: ScheduleItem; s: number; e: number }
  | { kind: 'noWindow'; item: ScheduleItem };

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
/**
 * Północ DNIA KALENDARZOWEGO (lokalnego) jako znacznik UTC. Oś liczy dni, nie
 * milisekundy — inaczej przełączenie czasu letniego w środku horyzontu dodaje
 * godzinę i przesuwa zarówno liczbę kolumn, jak i każdy pasek po tej dacie.
 */
function calendarDayStart(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(ms: number, days: number): number {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
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
  rowLabels,
  planStatus,
  onNewDraftVersion,
}) => {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);

  const planMode = Boolean(rowLabels);
  /** DEC-608: an unpublished (DRAFT) plan is the only editable one. */
  const planEditable = planStatus == null || planStatus === 'DRAFT';
  const rowH = planMode ? PLAN_ROW_H : ROW_H;
  const labelById = useMemo(
    () => new Map((rowLabels ?? []).map((label) => [label.id, label] as const)),
    [rowLabels]
  );

  const [zoom, setZoom] = useState<GanttZoom>(initialZoom);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Local optimistic overrides: itemId → { s, e } in ms
  const [overrides, setOverrides] = useState<
    Map<string, { s: number; e: number; saving?: boolean }>
  >(new Map());

  // SPEC §4.6 / §8 row 2 (etap 2) interaction state:
  //  - focusedId: bar holding the focus ring + drag hint (keyboard target);
  //  - draggingId: bar under an active pointer drag (shows the hint);
  //  - editBase: committed window of the bar being keyboard-edited → Esc reverts to it;
  //  - lastMove: single-level undo — the window the last successful move came FROM.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editBase, setEditBase] = useState<{ id: string; s: number; e: number } | null>(null);
  const [lastMove, setLastMove] = useState<{ id: string; s: number; e: number } | null>(null);

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
    // Legacy task axis pads two weeks so a sparse schedule is not wall-to-wall.
    // The plan axis (DEC-615) ends EXACTLY at the horizon: the accepted mockup
    // draws 12 week columns for a 12-week window and puts TODAY at 3.57%.
    const pad = planMode ? 0 : 2;
    // Dni kalendarzowe, nie milisekundy: horyzont 2026-09-14 → 2026-12-07 ma
    // 84 dni, ale w strefie z przełączeniem czasu (America/Chicago) różnica
    // clocków to 84 dni + 1 h, więc `ceil` dawał 13 kolumn zamiast 12.
    const weeks = Math.max(
      1,
      Math.ceil((calendarDayStart(max) - calendarDayStart(min)) / (7 * DAY_MS)) + pad
    );
    return { min, weeks };
  }, [dated, planMode, rangeEnd, rangeStart]);

  /**
   * SPEC §4.2: ONE save per gesture, on `pointerup`/`Enter` — never on
   * `pointermove` (a naive per-move save of the WHOLE scenario would 409 and
   * lose someone else's change). Optimistic override is already in place; on
   * success we keep it and remember the window we moved FROM (single-level
   * undo); on failure/409 we drop the override so the bar snaps back.
   */
  const commit = useCallback(
    async (
      item: ScheduleItem,
      newS: number,
      newE: number,
      undoS: number,
      undoE: number,
      recordUndo = true
    ) => {
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
        setLastMove(recordUndo ? { id: item.id, s: undoS, e: undoE } : null);
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

  /** SPEC §4.2 undo: re-save the previous window through the same path (button or Ctrl/Cmd+Z). */
  const undoLastMove = useCallback(() => {
    if (!lastMove || !onReschedule) return;
    const item = items.find((i) => i.id === lastMove.id);
    if (!item) return;
    const { id, s, e } = lastMove;
    setLastMove(null);
    setOverrides((prev) => new Map(prev).set(id, { s, e, saving: true }));
    void commit(item, s, e, s, e, false);
  }, [lastMove, onReschedule, items, commit]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, item: ScheduleItem, sMs: number, eMs: number) => {
      if (!range || !onReschedule) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      setDraggingId(item.id);
      setFocusedId(item.id);

      const totalMs = range.weeks * 7 * DAY_MS;
      const gridEl = gridRef.current;
      if (!gridEl) {
        setDraggingId(null);
        return;
      }
      const gridRect = gridEl.getBoundingClientRect();

      const dragStartX = e.clientX;
      const origS = sMs;
      const origE = eMs;
      /**
       * SPEC §8 row 2 „snap dzienny": whole calendar days via local-safe
       * `addDays`. The old `snapToDay` rounded to UTC midnight, which is a
       * different calendar day for local-midnight windows west of Greenwich.
       */
      const dayDeltaAt = (clientX: number) =>
        Math.round(((clientX - dragStartX) / gridRect.width) * totalMs / DAY_MS);

      const onMove = (ev: PointerEvent) => {
        const dayDelta = dayDeltaAt(ev.clientX);
        setOverrides((prev) => {
          const next = new Map(prev);
          if (dayDelta === 0) next.delete(item.id);
          else next.set(item.id, { s: addDays(origS, dayDelta), e: addDays(origE, dayDelta) });
          return next;
        });
      };
      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* capture already released */
        }
        removeListeners();
        setDraggingId(null);
        const dayDelta = dayDeltaAt(ev.clientX);
        if (dayDelta === 0) {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            return next;
          });
          return;
        }
        const newS = addDays(origS, dayDelta);
        const newE = addDays(origE, dayDelta);
        setOverrides((prev) => new Map(prev).set(item.id, { s: newS, e: newE, saving: true }));
        void commit(item, newS, newE, origS, origE);
      };
      // SPEC §4.6: Esc also interrupts a mouse drag and reverts the preview.
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== 'Escape') return;
        ev.preventDefault();
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* capture already released */
        }
        removeListeners();
        setDraggingId(null);
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(item.id);
          return next;
        });
      };
      const removeListeners = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        window.removeEventListener('keydown', onKey);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      window.addEventListener('keydown', onKey);
    },
    [range, commit, onReschedule]
  );

  /**
   * SPEC §4.6 (§13.3c archetype A „Canvas"): minimal keyboard set for a focused
   * plan bar. ←/→ move by a week, Shift+←/→ by a day (preview only); Enter saves
   * once; Esc reverts to the pre-edit window; Ctrl/Cmd+Z undoes the last move.
   * Frozen/published bars swallow the arrows (aria-disabled + reason in title).
   */
  const handleKeyDown = useCallback(
    (
      ev: React.KeyboardEvent<HTMLDivElement>,
      item: ScheduleItem,
      s: number,
      e: number,
      canDrag: boolean
    ) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        undoLastMove();
        return;
      }
      if (!canDrag) {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'Enter') {
          ev.preventDefault();
        }
        return;
      }
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        const step = ev.shiftKey ? 1 : 7;
        const days = ev.key === 'ArrowRight' ? step : -step;
        if (!editBase || editBase.id !== item.id) setEditBase({ id: item.id, s, e });
        setOverrides((prev) =>
          new Map(prev).set(item.id, { s: addDays(s, days), e: addDays(e, days) })
        );
        return;
      }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        if (!editBase || editBase.id !== item.id) return; // nothing pending to save
        const ov = overrides.get(item.id);
        const newS = ov?.s ?? s;
        const newE = ov?.e ?? e;
        const base = editBase;
        setEditBase(null);
        if (newS === base.s && newE === base.e) return;
        setOverrides((prev) => new Map(prev).set(item.id, { s: newS, e: newE, saving: true }));
        void commit(item, newS, newE, base.s, base.e);
        return;
      }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (editBase && editBase.id === item.id) {
          setOverrides((prev) => new Map(prev).set(item.id, { s: editBase.s, e: editBase.e }));
        } else {
          setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            return next;
          });
        }
        setEditBase(null);
        setDraggingId(null);
      }
    },
    [editBase, overrides, undoLastMove, commit]
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
      {planMode && planEditable && onReschedule && (
        <button
          type="button"
          onClick={undoLastMove}
          disabled={!lastMove}
          aria-label={t('initiatives.gantt.undoAria', 'Undo the last window move')}
          className="mr-2 inline-flex items-center gap-1 rounded border border-c-border px-2 py-0.5 text-[11px] text-c-text-secondary enabled:hover:bg-c-surface-raised disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
          </svg>
          {t('initiatives.gantt.undo', 'Undo move')}
        </button>
      )}
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

  const totalDays = range.weeks * 7;
  const axisStartDay = calendarDayStart(range.min);
  const rangeEndMs = addDays(range.min, totalDays);
  /**
   * DEC-615 etap 1b (P2-1): the plan timeline FILLS the track — its columns are
   * flex:1 shares of it (mockup `.tcol{flex:1}`), so there is NO horizontal
   * scroll at horizon 1/3/6/12 and the right-anchored „outside horizon" badge
   * stays in view. Imposing a px-per-day minWidth here made the 14-week grid
   * (~882px at week zoom) wider than the track at 1440×900, scrolled it, and hid
   * the badge. The legacy task axis keeps its px minWidth (day zoom needs it).
   */
  const gridMinWidth = planMode
    ? undefined
    : Math.max(480, Math.round(totalDays * PX_PER_DAY[zoom]));
  /**
   * Pozycja na osi w DNIACH kalendarzowych, nie w milisekundach: pasek z datą
   * 2026-09-28 ma stać na 16.667% osi 12-tygodniowej (makieta PL3) niezależnie
   * od strefy czasowej i od tego, czy w horyzoncie wypada przełączenie czasu.
   */
  const dayOf = (ms: number) => (calendarDayStart(ms) - axisStartDay) / DAY_MS;
  const pctNum = (ms: number) => Math.max(0, (dayOf(ms) * 100) / totalDays);
  const pct = (ms: number) => `${pctNum(ms)}%`;

  // Column ticks per zoom unit.
  const cols: Array<{ ms: number; label: string }> = [];
  const endMs = rangeEndMs;
  if (zoom === 'day') {
    for (let i = 0; i < totalDays; i += 1) {
      const ms = addDays(range.min, i);
      cols.push({ ms, label: new Date(ms).toLocaleDateString(undefined, { day: '2-digit' }) });
    }
  } else if (zoom === 'month') {
    let ms = startOfMonth(range.min);
    while (ms < endMs) {
      cols.push({
        ms,
        label: new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      });
      ms = startOfMonth(addDays(ms, 32));
    }
  } else {
    for (let i = 0; i < range.weeks; i += 1) {
      const ms = addDays(range.min, i * 7);
      cols.push({
        ms,
        label: new Date(ms).toLocaleDateString(
          undefined,
          // DEC-615: the mockup header reads "Sep 14"; the legacy axis read "14 Sep".
          planMode ? { month: 'short', day: '2-digit' } : { day: '2-digit', month: 'short' }
        ),
      });
    }
  }

  const todayMs = Date.now();
  const todayInRange = todayMs >= range.min && todayMs <= rangeEndMs;

  /** Clip a window to the horizon and decide bar vs „outside this horizon". */
  const toRow = (item: ScheduleItem, s: number, e: number): GanttRow => {
    const ov = overrides.get(item.id);
    const effS = ov?.s ?? s;
    const effE = ov?.e ?? e;
    const visS = Math.max(effS, range.min);
    const visE = Math.min(Math.max(effE, effS + DAY_MS), rangeEndMs);
    // Wspólna część w DNIACH — spójnie z `dayOf`, którym rysowana jest oś.
    return dayOf(visE) - dayOf(visS) < 1
      ? { kind: 'outside', item, s: effS, e: effE }
      : { kind: 'bar', item, s: effS, e: effE };
  };

  /**
   * DEC-615: JEDEN model wierszy dla kolumny nazw i dla toru — inaczej dwie
   * listy (`dated` + chipy) rozjezdzalyby sie z etykietami. W trybie planu
   * kazda filtrowana pozycja MA wiersz (bezdatowa = jawny „brak okna"), bo
   * znikniecie inicjatywy do chipow pod wykresem czyta sie jak brak w planie.
   */
  const rows: GanttRow[] = planMode
    ? filtered.map((item) => {
        const s = parse(item.start);
        if (s == null) return { kind: 'noWindow', item };
        return toRow(item, s, Math.max(parse(item.end) ?? s, s));
      })
    : [
        ...dated.map(({ item, s, e }) => toRow(item, s, e)),
        ...frozenUndated.map((item): GanttRow => ({ kind: 'noWindow', item })),
      ];

  // Geometry for dependency connectors: itemId → { rowIndex, sx, ex } (x in %).
  const rowGeom = new Map<string, { row: number; sx: number; ex: number }>();
  rows.forEach((row, idx) => {
    if (row.kind === 'noWindow') return;
    rowGeom.set(row.item.id, { row: idx, sx: pctNum(row.s), ex: pctNum(row.e) });
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

  const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  const barTop = (height: number) => (rowH - height) / 2;

  const renderRow = (row: GanttRow) => {
    const item = row.item;
    const frozen = frozenSet.has(item.id);
    if (row.kind === 'noWindow') {
      return (
        <div
          key={item.id}
          className="relative border-b border-slate-200/50 dark:border-white/[0.03]"
          style={{ height: rowH }}
        >
          <div
            className="absolute left-0 inline-flex h-5 items-center gap-1 rounded border border-dashed border-c-border-strong bg-c-surface-raised px-1.5"
            style={{ top: barTop(20) }}
            title={`${item.title} • ${t('initiatives.gantt.noDates', 'No dates')}`}
          >
            <span className="truncate text-[10px] text-c-text-secondary">
              {planMode
                ? t('initiatives.gantt.noDates', 'No dates')
                : `${item.title} · ${t('initiatives.gantt.noDates', 'No dates')}`}
            </span>
          </div>
        </div>
      );
    }
    if (row.kind === 'outside') {
      /**
       * DEC-615 §4.5: plakietka przy PRAWEJ krawedzi („Starts Sep 28 — outside
       * this horizon →"), nie pasek po lewej — tamten czytal sie jak okno
       * zaczynajace sie dzisiaj. Nazwa zostaje w kolumnie, wiec wiersz nie jest
       * pusty. Prog „czesc wspolna < 1 dzien" (F13) bez zmian.
       */
      const label = t('initiatives.gantt.outsideStarts', {
        date: fmtDay(row.s),
        defaultValue: 'Starts {{date}} — outside this horizon',
      });
      return (
        <div
          key={item.id}
          className="relative border-b border-slate-200/50 dark:border-white/[0.03]"
          style={{ height: rowH }}
        >
          {planMode ? (
            <div
              className="absolute right-1 inline-flex h-[22px] items-center gap-1.5 rounded-[5px] border border-dashed border-c-border-strong px-2 text-[10px] text-c-text-muted"
              style={{ top: barTop(22) }}
              title={`${item.title} • ${label}`}
            >
              <span className="truncate">{label}</span>
              <svg
                viewBox="0 0 24 24"
                className="h-[11px] w-[11px] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h13m-5-6 6 6-6 6" />
              </svg>
            </div>
          ) : (
            <div
              className="absolute left-0 inline-flex h-5 items-center gap-1 rounded border border-dashed border-c-border-strong bg-c-surface-raised px-1.5"
              style={{ top: barTop(20) }}
              title={`${item.title} • ${t('initiatives.gantt.outsideHorizon', 'Outside horizon')}`}
            >
              <span className="truncate text-[10px] text-c-text-secondary">
                {item.title} · {t('initiatives.gantt.outsideHorizon', 'Outside horizon')}
              </span>
            </div>
          )}
        </div>
      );
    }

    const saving = overrides.get(item.id)?.saving;
    /**
     * SPEC §4.1: bramka PRZECIAGANIA = plan SZKIC + zapisywalny + pozycja
     * niezamrozona. Stary warunek `sourceKind === 'task'` blokowal oś planu
     * (PlanCard podaje `'phase'`) i nie mial nic wspolnego z zamrozeniem.
     */
    const canDrag = planEditable && Boolean(onReschedule) && !frozen;
    const isCritical = criticalSet.has(item.id);
    const startsBefore = row.s < range.min;
    const endsAfter = row.e > rangeEndMs;
    const visS = Math.max(row.s, range.min);
    const visE = Math.min(Math.max(row.e, row.s + DAY_MS), rangeEndMs);
    const barHeight = planMode ? PLAN_BAR_H : 20;
    // SPEC §4.6: focused/dragged bar carries the c-focus ring (makieta `.bar.focus`
    // = box-shadow 0 0 0 3px c-focus). The focus ring REPLACES the critical ring
    // so two Tailwind ring widths never collide on one element.
    const isFocused = focusedId === item.id || draggingId === item.id;
    const ringClass = isFocused ? 'ring-[3px] ring-c-focus' : isCritical ? CRITICAL_RING : '';
    const grabClass = planMode && canDrag ? 'cursor-grab active:cursor-grabbing' : '';
    // „Drag to move · N weeks" — N = window duration in whole weeks (makieta: 28d = 4).
    const durDays = Math.max(
      1,
      Math.round((calendarDayStart(row.e) - calendarDayStart(row.s)) / DAY_MS)
    );
    const hintWeeks = Math.max(1, Math.round(durDays / 7));
    const showHint = planMode && canDrag && isFocused;
    return (
      <div
        key={item.id}
        className="relative border-b border-slate-200/50 dark:border-white/[0.03]"
        style={{ height: rowH }}
      >
        <div
          className={`absolute flex items-center px-1.5 transition-opacity ${
            planMode ? 'rounded-[5px] focus:outline-none' : 'rounded'
          } ${frozen ? EXEC_BAR : TYPE_BAR[item.type]} ${saving ? 'opacity-60' : ''} ${ringClass} ${grabClass}`}
          style={{
            left: pct(visS),
            width: `${Math.max(0, ((dayOf(visE) - dayOf(visS)) * 100) / totalDays)}%`,
            minWidth: '8px',
            height: barHeight,
            top: barTop(barHeight),
          }}
          title={`${item.title}${isCritical ? ' • critical path' : ''}${frozen ? ' • frozen in execution' : ''}${startsBefore || endsAfter ? ` • ${t('initiatives.gantt.clippedToHorizon', 'clipped to horizon')}` : ''}${!planEditable ? ` • ${t('initiatives.planCard.publishedReadOnly', { defaultValue: 'This plan is published — create a new version (draft) to change it.' })}` : ''}${saving ? ' (saving…)' : ''}`}
          tabIndex={planMode ? 0 : undefined}
          aria-disabled={planMode ? !canDrag : undefined}
          aria-label={planMode ? item.title : undefined}
          onPointerDown={canDrag ? (ev) => handlePointerDown(ev, item, row.s, row.e) : undefined}
          onKeyDown={
            planMode ? (ev) => handleKeyDown(ev, item, row.s, row.e, canDrag) : undefined
          }
          onFocus={planMode ? () => setFocusedId(item.id) : undefined}
          onBlur={
            planMode
              ? () => {
                  setFocusedId(null);
                  // Focus left with an uncommitted keyboard preview → revert it (like Esc).
                  if (editBase && editBase.id === item.id) {
                    setOverrides((prev) =>
                      new Map(prev).set(item.id, { s: editBase.s, e: editBase.e })
                    );
                    setEditBase(null);
                  }
                }
              : undefined
          }
        >
          {planMode && canDrag && (
            <>
              <span
                className="pointer-events-none absolute left-[3px] top-[5px] bottom-[5px] flex flex-col justify-between opacity-70"
                aria-hidden
              >
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
              </span>
              <span
                className="pointer-events-none absolute right-[3px] top-[5px] bottom-[5px] flex flex-col justify-between opacity-70"
                aria-hidden
              >
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
                <i className="block h-[2px] w-[2px] rounded-full bg-current" />
              </span>
            </>
          )}
          {planMode ? (
            <span className="pointer-events-none mx-auto truncate text-[10.5px] font-semibold">
              {fmtDay(row.s)} → {fmtDay(row.e)}
            </span>
          ) : (
            <span className="pointer-events-none truncate text-[10px]">{item.title}</span>
          )}
          {showHint && (
            <span
              className="pointer-events-none absolute left-0.5 z-20 inline-flex items-center whitespace-nowrap rounded-[5px] bg-c-text px-[7px] text-[9.8px] font-semibold leading-none text-c-surface"
              style={{ top: 'calc(100% + 6px)', height: 19 }}
            >
              <span
                className="absolute -top-[3px] left-3 h-[7px] w-[7px] rotate-45 bg-inherit"
                aria-hidden
              />
              {t('initiatives.gantt.dragHint', {
                count: hintWeeks,
                defaultValue: 'Drag to move · {{count}} weeks',
              })}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface select-none">
      {!planEditable && (
        <div className="border-b border-c-border-subtle px-3 py-2 text-sm">
          <p className="text-c-text-secondary">
            {t('initiatives.planCard.publishedReadOnly', {
              defaultValue: 'This plan is published — create a new version (draft) to change it.',
            })}
          </p>
          {onNewDraftVersion && (
            <button
              type="button"
              onClick={onNewDraftVersion}
              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('initiatives.planCard.newDraftVersion', {
                defaultValue: 'Create a new version (draft)',
              })}
            </button>
          )}
        </div>
      )}
      {toolbar}
      <div className={planMode ? 'flex' : undefined}>
        {/* DEC-615: fixed name column — the name never lives inside the bar. */}
        {planMode && (
          <div className="w-[208px] shrink-0 border-r border-c-border-subtle">
            <div className="flex h-8 items-center border-b border-c-border-subtle px-3 text-[9.5px] font-bold uppercase tracking-[0.09em] text-c-text-muted">
              {t('initiatives.gantt.nameColumnHeader', 'Initiative')}
            </div>
            {rows.map((row) => {
              const label = labelById.get(row.item.id);
              const frozen = frozenSet.has(row.item.id) || Boolean(label?.frozen);
              const dot =
                row.kind === 'outside'
                  ? 'bg-c-border-strong'
                  : frozen
                    ? 'bg-c-text'
                    : 'bg-c-chart-1';
              return (
                <div
                  key={`label-${row.item.id}`}
                  className="flex items-center gap-2 border-b border-c-border-subtle py-1 pl-3 pr-2.5"
                  style={{ height: rowH }}
                >
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-[2px] ${dot}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 text-[11.6px] font-semibold leading-[1.22] text-c-text">
                      {label?.name ?? row.item.title}
                    </span>
                    {label?.meta ? (
                      <span className="mt-px block truncate text-[9.8px] text-c-text-muted">
                        {label.meta}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className={planMode ? 'min-w-0 flex-1 overflow-hidden' : 'overflow-x-auto'}>
          {/* Time header */}
          <div
            className={`relative flex border-b ${
              planMode
                ? 'h-8 items-stretch border-c-border-subtle'
                : 'border-slate-200/50 dark:border-white/[0.03]'
            }`}
            style={{ minWidth: gridMinWidth }}
          >
            {cols.map((c) => (
              <div
                key={c.ms}
                className={
                  planMode
                    ? 'flex flex-1 items-center justify-center border-r border-c-border-subtle text-[9.8px] font-medium text-c-text-muted last:border-r-0 whitespace-nowrap'
                    : 'flex-1 px-2 py-1.5 text-[10px] text-c-text-muted border-r border-slate-200/50 dark:border-white/[0.03] whitespace-nowrap'
                }
              >
                {c.label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div ref={gridRef} className="relative" style={{ minWidth: gridMinWidth }}>
            {planMode && (
              <div className="absolute inset-0 z-0 flex pointer-events-none" aria-hidden>
                {cols.map((c) => (
                  <div
                    key={`v-${c.ms}`}
                    className="flex-1 border-r border-c-border-subtle last:border-r-0"
                  />
                ))}
              </div>
            )}
            {todayInRange && (
              <div
                className="absolute top-0 bottom-0 z-10 bg-c-text pointer-events-none"
                style={{ left: pct(todayMs), width: planMode ? 1.5 : 1 }}
                aria-hidden
              >
                {planMode && (
                  <span className="absolute left-1 top-[3px] inline-flex h-4 items-center rounded-[3px] bg-c-text px-1.5 text-[8.5px] font-bold uppercase tracking-[0.06em] text-c-surface whitespace-nowrap">
                    {t('initiatives.gantt.legend.today', 'Today')}
                  </span>
                )}
              </div>
            )}

            {/* Dependency connectors overlay (x in %, y in row units). */}
            {depEdges.length > 0 && (
              <svg
                className="absolute inset-0 z-[5] pointer-events-none"
                width="100%"
                height={rows.length * rowH}
                viewBox={`0 0 100 ${rows.length}`}
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
                      stroke={edge.critical ? 'var(--c-chart-2)' : 'var(--c-border-strong)'}
                      strokeWidth={edge.critical ? 0.06 : 0.04}
                      vectorEffect="non-scaling-stroke"
                      strokeDasharray={edge.critical ? undefined : '0.4 0.3'}
                    />
                  );
                })}
              </svg>
            )}

            {rows.map(renderRow)}
          </div>
        </div>
      </div>

      {!planMode && undatedChips.length > 0 && (
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

      {/* DEC-615: legenda w JEDNEJ linii pod wykresem (zamiast `<p>` frozenLegend). */}
      {planMode && (
        <div className="flex flex-wrap items-center gap-x-[15px] gap-y-1 border-t border-c-border-subtle px-3 py-2 text-[10.6px] text-c-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[9px] w-[15px] shrink-0 rounded-[2px] bg-c-text" aria-hidden />
            {t('initiatives.gantt.legend.frozen', 'In execution — frozen')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[9px] w-[15px] shrink-0 rounded-[2px] bg-c-chart-1" aria-hidden />
            {t('initiatives.gantt.legend.planned', 'Planned')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-[11px] w-[15px] shrink-0 rounded-[2px] border border-dashed border-c-border-strong"
              aria-hidden
            />
            {t('initiatives.gantt.outsideHorizon', 'Outside horizon')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0 w-[17px] shrink-0 border-t-[1.4px] border-c-border-strong"
              aria-hidden
            />
            {t('initiatives.gantt.legend.dependency', 'Dependency')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0 shrink-0 border-l-[1.5px] border-c-text" aria-hidden />
            {t('initiatives.gantt.legend.today', 'Today')}
          </span>
        </div>
      )}
    </div>
  );
};

export default InitiativeGantt;
