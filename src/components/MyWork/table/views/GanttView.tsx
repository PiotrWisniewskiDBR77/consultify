/**
 * GanttView (Platform) — Gantt chart with dependency arrows for the Table Platform.
 * Left panel: record list with hierarchy. Right panel: timeline bars with SVG
 * dependency arrows and optional progress fill. Pure CSS Grid + SVG.
 */
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from '../tableTypes';
import { SELECT_COLORS } from '../tableTypes';

export type GanttZoom = 'day' | 'week' | 'month';

export interface GanttViewConfig {
  startDateFieldId: string;
  endDateFieldId: string;
  titleFieldId: string;
  dependencyFieldId?: string;
  progressFieldId?: string;
  zoom: GanttZoom;
}

export interface GanttViewProps {
  records: TableNode[];
  columns: ColumnDef[];
  config: GanttViewConfig;
  onRecordUpdate?: (recordId: string, data: Record<string, unknown>) => void;
  onRecordClick?: (recordId: string) => void;
}

const COL_WIDTHS: Record<GanttZoom, number> = { day: 36, week: 100, month: 160 };
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 44;
const LABEL_WIDTH = 240;
const BAR_V_PAD = 7;

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

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  let dow = r.getDay() - 1;
  if (dow < 0) dow = 6;
  r.setDate(r.getDate() - dow);
  return r;
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface SlotInfo {
  date: Date;
  label: string;
  isToday: boolean;
}

function buildSlots(start: Date, end: Date, zoom: GanttZoom, isPl: boolean): SlotInfo[] {
  const slots: SlotInfo[] = [];
  const todayStr = toDateStr(new Date());

  if (zoom === 'day') {
    let cur = new Date(start);
    while (cur <= end) {
      slots.push({
        date: new Date(cur),
        label: `${cur.getDate()}`,
        isToday: toDateStr(cur) === todayStr,
      });
      cur = addDays(cur, 1);
    }
  } else if (zoom === 'week') {
    let cur = getWeekStart(start);
    while (cur <= end) {
      const wEnd = addDays(cur, 6);
      const now = new Date();
      slots.push({
        date: new Date(cur),
        label: `${cur.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' })}`,
        isToday: now >= cur && now <= wEnd,
      });
      cur = addDays(cur, 7);
    }
  } else {
    let cur = getMonthStart(start);
    while (cur <= end) {
      const now = new Date();
      slots.push({
        date: new Date(cur),
        label: cur.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
          month: 'short',
          year: '2-digit',
        }),
        isToday: cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth(),
      });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return slots;
}

function dateToPixel(date: Date, rangeStart: Date, zoom: GanttZoom): number {
  const days = daysBetween(rangeStart, date);
  const colW = COL_WIDTHS[zoom];
  if (zoom === 'day') return days * colW;
  if (zoom === 'week') return (days / 7) * colW;
  return (days / 30) * colW;
}

interface GanttRecord {
  record: TableNode;
  start: Date;
  end: Date;
  title: string;
  progress: number;
  dependencies: string[];
}

export const GanttView: React.FC<GanttViewProps> = ({
  records,
  columns,
  config,
  onRecordUpdate,
  onRecordClick,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<GanttZoom>(config.zoom || 'week');

  const ganttRecords = useMemo((): GanttRecord[] => {
    return records
      .map((r) => {
        const start = parseDate(r.data?.[config.startDateFieldId]);
        const end = parseDate(r.data?.[config.endDateFieldId]);
        if (!start || !end) return null;
        const title = String(r.data?.[config.titleFieldId] || r.data?.label || r.id);
        const progress = config.progressFieldId
          ? Math.min(Math.max(Number(r.data?.[config.progressFieldId]) || 0, 0), 100)
          : 0;

        let deps: string[] = [];
        if (config.dependencyFieldId) {
          const depVal = r.data?.[config.dependencyFieldId];
          if (Array.isArray(depVal)) deps = depVal.map(String);
          else if (typeof depVal === 'string' && depVal)
            deps = depVal.split(',').map((s) => s.trim());
        }

        return {
          record: r,
          start,
          end: end < start ? start : end,
          title,
          progress,
          dependencies: deps,
        };
      })
      .filter(Boolean) as GanttRecord[];
  }, [records, config]);

  const recordIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    ganttRecords.forEach((gr, i) => map.set(gr.record.id, i));
    return map;
  }, [ganttRecords]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (ganttRecords.length === 0) {
      const now = new Date();
      return { rangeStart: addDays(now, -14), rangeEnd: addDays(now, 14) };
    }
    let min = ganttRecords[0].start;
    let max = ganttRecords[0].end;
    for (const gr of ganttRecords) {
      if (gr.start < min) min = gr.start;
      if (gr.end > max) max = gr.end;
    }
    const pad = zoom === 'day' ? 3 : zoom === 'week' ? 7 : 15;
    return { rangeStart: addDays(min, -pad), rangeEnd: addDays(max, pad) };
  }, [ganttRecords, zoom]);

  const slots = useMemo(
    () => buildSlots(rangeStart, rangeEnd, zoom, isPl),
    [rangeStart, rangeEnd, zoom, isPl]
  );
  const colWidth = COL_WIDTHS[zoom];
  const totalWidth = slots.length * colWidth;
  const totalHeight = ganttRecords.length * ROW_HEIGHT;

  const todayPx = useMemo(() => dateToPixel(new Date(), rangeStart, zoom), [rangeStart, zoom]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current && labelScrollRef.current) {
      labelScrollRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  const cycleZoom = useCallback((dir: 'in' | 'out') => {
    setZoom((z) => {
      if (dir === 'in') return z === 'month' ? 'week' : 'day';
      return z === 'day' ? 'week' : 'month';
    });
  }, []);

  const depArrows = useMemo(() => {
    const arrows: { fromX: number; fromY: number; toX: number; toY: number; key: string }[] = [];
    for (const gr of ganttRecords) {
      const toIdx = recordIndexMap.get(gr.record.id);
      if (toIdx === undefined) continue;

      for (const depId of gr.dependencies) {
        const fromIdx = recordIndexMap.get(depId);
        if (fromIdx === undefined) continue;
        const fromRec = ganttRecords[fromIdx];

        const fromX = dateToPixel(fromRec.end, rangeStart, zoom);
        const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const toX = dateToPixel(gr.start, rangeStart, zoom);
        const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        arrows.push({ fromX, fromY, toX, toY, key: `${depId}-${gr.record.id}` });
      }
    }
    return arrows;
  }, [ganttRecords, recordIndexMap, rangeStart, zoom]);

  const startDateCol = columns.find((c) => c.key === config.startDateFieldId);
  const endDateCol = columns.find((c) => c.key === config.endDateFieldId);

  if (!startDateCol || !endDateCol) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-c-text-muted gap-2 p-8">
        <Calendar size={32} />
        <span className="text-sm font-medium">{isPl ? 'Wykres Gantta' : 'Gantt Chart'}</span>
        <span className="text-xs text-c-text-muted/70">
          {isPl
            ? 'Skonfiguruj pola daty początkowej i końcowej w ustawieniach widoku'
            : 'Configure start and end date fields in view settings'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-c-border-subtle">
        <span className="text-xs font-bold text-c-text-secondary">
          {isPl ? 'Wykres Gantta' : 'Gantt Chart'}
          <span className="ml-2 text-[10px] font-normal text-c-text-muted">
            {ganttRecords.length} {isPl ? 'zadań' : 'tasks'}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => cycleZoom('in')}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
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
          >
            <ZoomOut size={14} className="text-c-text-muted" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: record list */}
        <div
          ref={labelScrollRef}
          className="flex-shrink-0 border-r border-c-border-subtle overflow-hidden"
          style={{ width: LABEL_WIDTH }}
        >
          <div
            className="sticky top-0 z-10 bg-c-surface-raised border-b border-c-border-subtle px-3 flex items-center"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-[10px] font-bold text-c-text-muted uppercase tracking-wider flex-1">
              {isPl ? 'Zadanie' : 'Task'}
            </span>
            {config.progressFieldId && (
              <span className="text-[9px] font-bold text-c-text-muted uppercase tracking-wider w-12 text-right">
                %
              </span>
            )}
          </div>
          {ganttRecords.map((gr) => (
            <div
              key={gr.record.id}
              className="flex items-center px-3 gap-2 border-b border-c-border-subtle cursor-pointer hover:bg-c-surface-raised transition-colors"
              style={{ height: ROW_HEIGHT }}
              onClick={() => onRecordClick?.(gr.record.id)}
            >
              <span className="text-[11px] font-medium text-c-text truncate flex-1">
                {gr.title}
              </span>
              {config.progressFieldId && (
                <span className="text-[9px] font-medium text-c-text-secondary w-12 text-right">
                  {gr.progress}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Right panel: timeline */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative" onScroll={handleScroll}>
          {/* Header */}
          <div
            className="sticky top-0 z-10 flex bg-c-surface-raised border-b border-c-border-subtle"
            style={{ width: totalWidth, height: HEADER_HEIGHT }}
          >
            {slots.map((slot, i) => (
              <div
                key={i}
                className={`flex-shrink-0 flex items-center justify-center border-r border-c-border-subtle text-[9px] font-medium ${
                  slot.isToday
                    ? 'text-c-info bg-c-info/10'
                    : 'text-c-text-muted'
                }`}
                style={{ width: colWidth }}
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Grid + bars + arrows */}
          <div className="relative" style={{ width: totalWidth, height: totalHeight }}>
            {/* Grid lines */}
            {slots.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-c-border-subtle"
                style={{ left: i * colWidth }}
              />
            ))}

            {/* Row stripes */}
            {ganttRecords.map((_, i) => (
              <div
                key={i}
                className={`absolute left-0 right-0 ${i % 2 === 1 ? 'bg-c-surface-raised/40' : ''}`}
                style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
              />
            ))}

            {/* Today marker */}
            {todayPx >= 0 && todayPx <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-c-info/70 z-20"
                style={{ left: todayPx }}
              />
            )}

            {/* SVG dependency arrows */}
            <svg
              className="absolute inset-0 z-10 pointer-events-none"
              width={totalWidth}
              height={totalHeight}
            >
              <defs>
                <marker
                  id="gantt-arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L8,3 L0,6 Z" fill="var(--c-border-strong)" />
                </marker>
              </defs>
              {depArrows.map((a) => {
                const midX = a.fromX + (a.toX - a.fromX) / 2;
                return (
                  <path
                    key={a.key}
                    d={`M${a.fromX},${a.fromY} C${midX},${a.fromY} ${midX},${a.toY} ${a.toX},${a.toY}`}
                    fill="none"
                    stroke="var(--c-border-strong)"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#gantt-arrow)"
                  />
                );
              })}
            </svg>

            {/* Bars */}
            {ganttRecords.map((gr, rowIdx) => {
              const left = dateToPixel(gr.start, rangeStart, zoom);
              const right = dateToPixel(gr.end, rangeStart, zoom);
              const width = Math.max(right - left, 6);

              return (
                <div
                  key={gr.record.id}
                  className="absolute z-10 group cursor-pointer"
                  style={{
                    top: rowIdx * ROW_HEIGHT + BAR_V_PAD,
                    left,
                    width,
                    height: ROW_HEIGHT - BAR_V_PAD * 2,
                  }}
                  onClick={() => onRecordClick?.(gr.record.id)}
                >
                  {/* Background bar — categorical tag hue (distinct, non-crimson) */}
                  <div
                    className="absolute inset-0 rounded-md border transition-colors group-hover:brightness-110"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--c-tag-2) 20%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--c-tag-2) 40%, transparent)',
                    }}
                  />

                  {/* Progress fill */}
                  {gr.progress > 0 && (
                    <div
                      className="absolute top-0 left-0 bottom-0 rounded-l-md"
                      style={{
                        width: `${gr.progress}%`,
                        backgroundColor: 'color-mix(in srgb, var(--c-tag-2) 45%, transparent)',
                        borderRadius: gr.progress >= 100 ? '0.375rem' : '0.375rem 0 0 0.375rem',
                      }}
                    />
                  )}

                  {/* Label */}
                  <div className="relative h-full flex items-center px-1.5 overflow-hidden">
                    <span className="text-[8px] font-bold text-c-text truncate">
                      {gr.title}
                    </span>
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

export default GanttView;
