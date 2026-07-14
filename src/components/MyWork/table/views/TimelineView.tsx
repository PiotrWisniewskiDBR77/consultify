/**
 * TimelineView (Platform) — Horizontal timeline renderer for the Table Platform.
 * Shows records as bars on a time axis with configurable zoom (day/week/month),
 * drag-to-resize, color-by-field, and today marker. Pure CSS Grid + SVG.
 */
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
import { SELECT_COLORS } from '../tableTypes';

export type TimelineZoom = 'day' | 'week' | 'month';

export interface TimelineViewConfig {
  startDateFieldId: string;
  endDateFieldId: string;
  titleFieldId: string;
  colorFieldId?: string;
  zoom: TimelineZoom;
}

export interface TimelineViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  config: TimelineViewConfig;
  onRecordUpdate?: (recordId: string, data: Record<string, unknown>) => void;
  onRecordClick?: (recordId: string) => void;
}

const COL_WIDTHS: Record<TimelineZoom, number> = { day: 40, week: 120, month: 200 };
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 220;

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const s = String(val).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  let dow = r.getDay() - 1;
  if (dow < 0) dow = 6;
  r.setDate(r.getDate() - dow);
  return r;
}

interface TimelineSlot {
  date: Date;
  label: string;
  isToday: boolean;
}

function buildSlots(
  rangeStart: Date,
  rangeEnd: Date,
  zoom: TimelineZoom,
  isPl: boolean
): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  const today = toDateStr(new Date());

  if (zoom === 'day') {
    let cur = new Date(rangeStart);
    while (cur <= rangeEnd) {
      slots.push({
        date: new Date(cur),
        label: cur.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' }),
        isToday: toDateStr(cur) === today,
      });
      cur = addDays(cur, 1);
    }
  } else if (zoom === 'week') {
    let cur = getWeekStart(rangeStart);
    while (cur <= rangeEnd) {
      const end = addDays(cur, 6);
      slots.push({
        date: new Date(cur),
        label: `${cur.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' })}`,
        isToday: toDateStr(new Date()) >= toDateStr(cur) && toDateStr(new Date()) <= toDateStr(end),
      });
      cur = addDays(cur, 7);
    }
  } else {
    let cur = getMonthStart(rangeStart);
    while (cur <= rangeEnd) {
      const nowDate = new Date();
      slots.push({
        date: new Date(cur),
        label: cur.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { month: 'long', year: 'numeric' }),
        isToday:
          cur.getFullYear() === nowDate.getFullYear() && cur.getMonth() === nowDate.getMonth(),
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  return slots;
}

function slotOffset(date: Date, rangeStart: Date, zoom: TimelineZoom): number {
  if (zoom === 'day') return daysBetween(rangeStart, date);
  if (zoom === 'week') return daysBetween(getWeekStart(rangeStart), date) / 7;
  const mStart = getMonthStart(rangeStart);
  return (
    (date.getFullYear() - mStart.getFullYear()) * 12 +
    (date.getMonth() - mStart.getMonth()) +
    (date.getDate() - 1) / 30
  );
}

function slotSpan(start: Date, end: Date, zoom: TimelineZoom): number {
  const days = Math.max(daysBetween(start, end), 1);
  if (zoom === 'day') return days;
  if (zoom === 'week') return days / 7;
  return days / 30;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  records,
  columns,
  config,
  onRecordUpdate,
  onRecordClick,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<TimelineZoom>(config.zoom || 'week');
  const [dragState, setDragState] = useState<{
    recordId: string;
    edge: 'start' | 'end' | 'move';
    startX: number;
    origStart: string;
    origEnd: string;
  } | null>(null);

  const colorCol = useMemo(
    () => (config.colorFieldId ? columns.find((c) => c.key === config.colorFieldId) : null),
    [columns, config.colorFieldId]
  );

  const getBarColor = useCallback(
    (record: TableNode): string => {
      if (!colorCol) return 'var(--c-tag-2)';
      const val = String(record.data?.[colorCol.key] || '');
      if (!val) return 'var(--c-tag-2)';
      return (
        colorCol.optionColors?.[val] ||
        SELECT_COLORS[(colorCol.options || []).indexOf(val) % SELECT_COLORS.length] ||
        'var(--c-tag-2)'
      );
    },
    [colorCol]
  );

  const timelineRecords = useMemo(() => {
    return records
      .map((r) => {
        const start = parseDate(r.data?.[config.startDateFieldId]);
        const end = parseDate(r.data?.[config.endDateFieldId]);
        if (!start || !end) return null;
        const title = String(r.data?.[config.titleFieldId] || r.data?.label || r.id);
        return { record: r, start, end: end < start ? start : end, title };
      })
      .filter(Boolean) as { record: TableNode; start: Date; end: Date; title: string }[];
  }, [records, config.startDateFieldId, config.endDateFieldId, config.titleFieldId]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (timelineRecords.length === 0) {
      const now = new Date();
      return { rangeStart: addDays(now, -14), rangeEnd: addDays(now, 14) };
    }
    let min = timelineRecords[0].start;
    let max = timelineRecords[0].end;
    for (const tr of timelineRecords) {
      if (tr.start < min) min = tr.start;
      if (tr.end > max) max = tr.end;
    }
    const pad = zoom === 'day' ? 3 : zoom === 'week' ? 7 : 15;
    return { rangeStart: addDays(min, -pad), rangeEnd: addDays(max, pad) };
  }, [timelineRecords, zoom]);

  const slots = useMemo(
    () => buildSlots(rangeStart, rangeEnd, zoom, isPl),
    [rangeStart, rangeEnd, zoom, isPl]
  );
  const colWidth = COL_WIDTHS[zoom];
  const totalWidth = slots.length * colWidth;

  const todayOffset = useMemo(() => {
    const now = new Date();
    return slotOffset(now, rangeStart, zoom) * colWidth;
  }, [rangeStart, zoom, colWidth]);

  const handleMouseDown = useCallback(
    (
      recordId: string,
      edge: 'start' | 'end' | 'move',
      e: React.MouseEvent,
      origStart: string,
      origEnd: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setDragState({ recordId, edge, startX: e.clientX, origStart, origEnd });
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !onRecordUpdate) return;
      const dx = e.clientX - dragState.startX;
      const dayDelta = Math.round(dx / colWidth) * (zoom === 'day' ? 1 : zoom === 'week' ? 7 : 30);
      if (dayDelta === 0) return;

      const origS = new Date(dragState.origStart + 'T12:00:00');
      const origE = new Date(dragState.origEnd + 'T12:00:00');

      if (dragState.edge === 'start') {
        const newStart = addDays(origS, dayDelta);
        if (newStart <= origE) {
          onRecordUpdate(dragState.recordId, { [config.startDateFieldId]: toDateStr(newStart) });
        }
      } else if (dragState.edge === 'end') {
        const newEnd = addDays(origE, dayDelta);
        if (newEnd >= origS) {
          onRecordUpdate(dragState.recordId, { [config.endDateFieldId]: toDateStr(newEnd) });
        }
      } else {
        onRecordUpdate(dragState.recordId, {
          [config.startDateFieldId]: toDateStr(addDays(origS, dayDelta)),
          [config.endDateFieldId]: toDateStr(addDays(origE, dayDelta)),
        });
      }
    },
    [dragState, onRecordUpdate, colWidth, zoom, config.startDateFieldId, config.endDateFieldId]
  );

  const cycleZoom = useCallback((dir: 'in' | 'out') => {
    setZoom((z) => {
      if (dir === 'in') return z === 'month' ? 'week' : 'day';
      return z === 'day' ? 'week' : 'month';
    });
  }, []);

  const startDateCol = columns.find((c) => c.key === config.startDateFieldId);
  const endDateCol = columns.find((c) => c.key === config.endDateFieldId);

  if (!startDateCol || !endDateCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-2 p-8">
        <Calendar size={32} />
        <span className="text-sm font-medium">{isPl ? 'Widok osi czasu' : 'Timeline View'}</span>
        <span className="text-xs text-c-text-secondary">
          {isPl
            ? 'Skonfiguruj pola daty początkowej i końcowej w ustawieniach widoku'
            : 'Configure start and end date fields in view settings'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      onMouseMove={dragState ? handleMouseMove : undefined}
      onMouseUp={dragState ? handleMouseUp : undefined}
      onMouseLeave={dragState ? handleMouseUp : undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-c-border-subtle">
        <span className="text-xs font-bold text-c-text-muted">
          {isPl ? 'Oś czasu' : 'Timeline'}
          <span className="ml-2 text-[10px] font-normal text-c-text-secondary">
            {timelineRecords.length} {isPl ? 'rekordów' : 'records'}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => cycleZoom('in')}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            title={isPl ? 'Przybliż' : 'Zoom in'}
          >
            <ZoomIn size={14} className="text-c-text-muted" />
          </button>
          <span className="text-[10px] font-medium text-c-text-muted min-w-[50px] text-center capitalize">
            {zoom === 'day'
              ? isPl
                ? 'Dzień'
                : 'Day'
              : zoom === 'week'
                ? isPl
                  ? 'Tydzień'
                  : 'Week'
                : isPl
                  ? 'Miesiąc'
                  : 'Month'}
          </span>
          <button
            onClick={() => cycleZoom('out')}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            title={isPl ? 'Oddal' : 'Zoom out'}
          >
            <ZoomOut size={14} className="text-c-text-muted" />
          </button>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left labels */}
        <div
          className="flex-shrink-0 border-r border-c-border-subtle overflow-y-auto"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="sticky top-0 z-10 bg-c-surface border-b border-c-border-subtle px-3 flex items-center"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider">
              {isPl ? 'Rekord' : 'Record'}
            </span>
          </div>
          {timelineRecords.map((tr) => (
            <div
              key={tr.record.id}
              className="flex items-center px-3 border-b border-c-border-subtle cursor-pointer hover:bg-c-surface-raised transition-colors"
              style={{ height: ROW_HEIGHT }}
              onClick={() => onRecordClick?.(tr.record.id)}
            >
              <span className="text-[11px] font-medium text-c-text truncate">{tr.title}</span>
            </div>
          ))}
        </div>

        {/* Right timeline area */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative">
          {/* Header row */}
          <div
            className="sticky top-0 z-10 flex bg-c-surface border-b border-c-border-subtle"
            style={{ width: totalWidth, height: HEADER_HEIGHT }}
          >
            {slots.map((slot, i) => (
              <div
                key={i}
                className={`flex-shrink-0 flex items-center justify-center border-r border-c-border-subtle text-[9px] font-medium ${
                  slot.isToday ? 'text-c-accent bg-c-accent-soft' : 'text-c-text-muted'
                }`}
                style={{ width: colWidth }}
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Grid lines + bars */}
          <div
            className="relative"
            style={{ width: totalWidth, minHeight: timelineRecords.length * ROW_HEIGHT }}
          >
            {/* Vertical grid lines */}
            {slots.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-c-border-subtle"
                style={{ left: i * colWidth, width: 0 }}
              />
            ))}

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-c-accent-soft z-20"
                style={{ left: todayOffset }}
              >
                <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-c-surface" />
              </div>
            )}

            {/* Row stripes */}
            {timelineRecords.map((_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[color-mix(in_srgb,var(--c-surface-raised)_30%25,transparent)] bg-[color-mix(in_srgb,var(--c-surface)_20%25,transparent)]'}`}
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}

            {/* Bars */}
            {timelineRecords.map((tr, rowIdx) => {
              const left = slotOffset(tr.start, rangeStart, zoom) * colWidth;
              const width = Math.max(slotSpan(tr.start, tr.end, zoom) * colWidth, 8);
              const color = getBarColor(tr.record);
              const startStr = toDateStr(tr.start);
              const endStr = toDateStr(tr.end);

              return (
                <div
                  key={tr.record.id}
                  className="absolute flex items-center group"
                  style={{
                    top: rowIdx * ROW_HEIGHT + 6,
                    left,
                    width,
                    height: ROW_HEIGHT - 12,
                  }}
                >
                  {/* Left resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleMouseDown(tr.record.id, 'start', e, startStr, endStr)}
                  >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-[color-mix(in_srgb,var(--c-surface)_80%25,transparent)]" />
                  </div>

                  {/* Bar body */}
                  <div
                    className="flex-1 h-full rounded-lg flex items-center px-2 overflow-hidden cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
                    style={{ backgroundColor: color + 'cc' }}
                    onClick={() => onRecordClick?.(tr.record.id)}
                    onMouseDown={(e) => handleMouseDown(tr.record.id, 'move', e, startStr, endStr)}
                  >
                    <span className="text-[9px] font-bold text-c-text truncate drop-shadow-sm">
                      {tr.title}
                    </span>
                  </div>

                  {/* Right resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => handleMouseDown(tr.record.id, 'end', e, startStr, endStr)}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-[color-mix(in_srgb,var(--c-surface)_80%25,transparent)]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
