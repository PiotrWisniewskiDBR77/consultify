/**
 * TimelineView — Gantt-style horizontal timeline for the Idea Table.
 *
 * Renders rows as bars on a date axis. Supports:
 * - Auto-detect date columns (start/end)
 * - Drag to move bars, drag edges to resize
 * - Dependency arrows from edges
 * - Color-coded by row accent or status
 * - Zoom levels: day, week, month
 */
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableEdge, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';
import { resolveDateViewSetup, ViewSetupEmptyState } from './ViewSetupEmptyState';

type ZoomLevel = 'day' | 'week' | 'month';

interface TimelineViewProps {
  nodes: TableNode[];
  edges: TableEdge[];
  columns: ColumnDef[];
  locked?: boolean;
  onFieldChange?: (nodeId: string, field: string, value: any) => void;
  onNodeClick?: (nodeId: string) => void;
  /**
   * Empty-state escape hatches. Without them the Timeline tab is a dead end:
   * it can only describe what is missing, never fix it (incydent 2026-07-27).
   */
  onAddDateColumn?: () => void;
  onShowDateColumn?: (columnKey: string) => void;
  onBackToTable?: () => void;
  onAddRow?: () => void;
}

const DAY_MS = 86400000;
const CELL_WIDTHS: Record<ZoomLevel, number> = { day: 32, week: 48, month: 80 };

function parseDate(val: any): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay() + 1);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  nodes,
  edges,
  columns,
  locked = false,
  onFieldChange,
  onNodeClick,
  onAddDateColumn,
  onShowDateColumn,
  onBackToTable,
  onAddRow,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [scrollOffset, setScrollOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    nodeId: string;
    mode: 'move' | 'resize-end';
    startX: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);

  const dateCols = useMemo(() => columns.filter((c) => c.type === 'date' && c.visible), [columns]);
  const startCol = dateCols[0]?.key || 'start_date';
  const endCol = dateCols[1]?.key || dateCols[0]?.key || 'end_date';

  const timelineData = useMemo(() => {
    const items: { node: TableNode; start: Date; end: Date; color: string }[] = [];
    for (const node of nodes) {
      const s = parseDate(node.data?.[startCol]);
      if (!s) continue;
      const e = parseDate(node.data?.[endCol]) || addDays(s, 7);
      const color = node.data?.color || ROW_ACCENT_COLORS[items.length % ROW_ACCENT_COLORS.length];
      items.push({ node, start: s, end: e < s ? addDays(s, 1) : e, color });
    }
    return items;
  }, [endCol, nodes, startCol]);

  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (timelineData.length === 0) {
      const now = new Date();
      return { rangeStart: addDays(now, -7), rangeEnd: addDays(now, 30), totalDays: 37 };
    }
    let min = timelineData[0].start;
    let max = timelineData[0].end;
    for (const item of timelineData) {
      if (item.start < min) min = item.start;
      if (item.end > max) max = item.end;
    }
    const rs = addDays(min, -7);
    const re = addDays(max, 14);
    return { rangeStart: rs, rangeEnd: re, totalDays: diffDays(rs, re) };
  }, [timelineData]);

  const cellWidth = CELL_WIDTHS[zoom];
  const cellsPerUnit = zoom === 'day' ? 1 : zoom === 'week' ? 7 : 30;

  const headerCells = useMemo(() => {
    const cells: { label: string; width: number; isToday?: boolean }[] = [];
    const today = new Date();
    let d = new Date(rangeStart);
    while (d < rangeEnd) {
      let label: string;
      let next: Date;
      if (zoom === 'day') {
        label = `${d.getDate()}`;
        next = addDays(d, 1);
      } else if (zoom === 'week') {
        const ws = startOfWeek(d);
        label = `W${Math.ceil((ws.getDate() + 6) / 7)} ${ws.toLocaleDateString(isPl ? 'pl' : 'en', { month: 'short' })}`;
        next = addDays(ws, 7);
      } else {
        const ms = startOfMonth(d);
        label = ms.toLocaleDateString(isPl ? 'pl' : 'en', { month: 'short', year: '2-digit' });
        next = new Date(ms.getFullYear(), ms.getMonth() + 1, 1);
      }
      const width = diffDays(d, next > rangeEnd ? rangeEnd : next) * (cellWidth / cellsPerUnit);
      const isToday = zoom === 'day' && d.toDateString() === today.toDateString();
      cells.push({ label, width: Math.max(width, cellWidth), isToday });
      d = next;
    }
    return cells;
  }, [cellWidth, cellsPerUnit, isPl, rangeEnd, rangeStart, zoom]);

  const getBarStyle = useCallback(
    (start: Date, end: Date) => {
      const left = diffDays(rangeStart, start) * (cellWidth / cellsPerUnit);
      const width = Math.max(diffDays(start, end) * (cellWidth / cellsPerUnit), 16);
      return { left, width };
    },
    [cellWidth, cellsPerUnit, rangeStart]
  );

  const handleMouseDown = useCallback(
    (nodeId: string, mode: 'move' | 'resize-end', e: React.MouseEvent, start: Date, end: Date) => {
      if (locked) return;
      e.stopPropagation();
      setDragging({ nodeId, mode, startX: e.clientX, origStart: start, origEnd: end });
    },
    [locked]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !onFieldChange) return;
      const dx = e.clientX - dragging.startX;
      const daysDelta = Math.round(dx / (cellWidth / cellsPerUnit));
      if (daysDelta === 0) return;

      if (dragging.mode === 'move') {
        onFieldChange(
          dragging.nodeId,
          startCol,
          formatDate(addDays(dragging.origStart, daysDelta))
        );
        if (startCol !== endCol) {
          onFieldChange(dragging.nodeId, endCol, formatDate(addDays(dragging.origEnd, daysDelta)));
        }
      } else {
        const newEnd = addDays(dragging.origEnd, daysDelta);
        if (newEnd > dragging.origStart) {
          onFieldChange(dragging.nodeId, endCol, formatDate(newEnd));
        }
      }
    },
    [cellWidth, cellsPerUnit, dragging, endCol, onFieldChange, startCol]
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);

  const totalWidth = headerCells.reduce((s, c) => s + c.width, 0);
  const ROW_HEIGHT = 36;
  const LABEL_WIDTH = 180;

  if (timelineData.length === 0) {
    // Never a bare "no dates to display" any more — name the exact blocker and
    // hand over the action that clears it. `resolveDateViewSetup` returning
    // null while the timeline is still empty means the values sit in a date
    // column this view does not read as the START column; the "column has no
    // dates" copy is the closest honest message for that case too.
    const setupState = resolveDateViewSetup({ columns, rows: nodes }) ?? {
      reason: 'no-values' as const,
      columnName: dateCols[0]?.header || startCol,
      columnKey: dateCols[0]?.key || startCol,
    };
    return (
      <div className="w-full h-full flex items-center justify-center">
        <ViewSetupEmptyState
          view="timeline"
          state={setupState}
          locked={locked}
          onAddColumn={onAddDateColumn}
          onShowColumn={onShowDateColumn}
          onBackToTable={onBackToTable}
          onAddRow={onAddRow}
        />
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-c-border-subtle bg-c-surface-raised flex-shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
          {t('ideas.table.timelineView.timeline', 'Timeline')}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-lg border border-c-border-subtle overflow-hidden">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2 py-1 text-[10px] font-bold transition-colors ${zoom === z ? 'bg-c-info/10 text-c-info' : 'text-c-text-secondary hover:text-c-text'}`}
            >
              {z === 'day'
                ? t('ideas.table.timelineView.day', 'Day')
                : z === 'week'
                  ? t('ideas.table.timelineView.week', 'Week')
                  : t('ideas.table.timelineView.month', 'Month')}
            </button>
          ))}
        </div>
        <button
          onClick={() => setZoom(zoom === 'day' ? 'week' : zoom === 'week' ? 'month' : 'month')}
          className="p-1 rounded text-c-text-secondary hover:text-c-text"
        >
          <ZoomOut size={12} />
        </button>
        <button
          onClick={() => setZoom(zoom === 'month' ? 'week' : zoom === 'week' ? 'day' : 'day')}
          className="p-1 rounded text-c-text-secondary hover:text-c-text"
        >
          <ZoomIn size={12} />
        </button>
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div className="flex" style={{ minWidth: LABEL_WIDTH + totalWidth }}>
          {/* Labels column */}
          <div
            className="flex-shrink-0 border-r border-c-border-subtle"
            style={{ width: LABEL_WIDTH }}
          >
            <div className="h-8 border-b border-c-border-subtle bg-c-surface-raised" />
            {timelineData.map(({ node, color }) => (
              <div
                key={node.id}
                className="flex items-center gap-2 px-3 border-b border-c-border-subtle cursor-pointer hover:bg-c-surface-raised transition-colors"
                style={{ height: ROW_HEIGHT }}
                onClick={() => onNodeClick?.(node.id)}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] font-medium text-c-text truncate">
                  {node.data?.label || node.id}
                </span>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex-1 relative">
            {/* Header */}
            <div className="flex h-8 border-b border-c-border-subtle bg-c-surface-raised sticky top-0 z-10">
              {headerCells.map((cell, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center text-[9px] font-bold border-r border-c-border-subtle flex-shrink-0 ${cell.isToday ? 'bg-c-info/10 text-c-info' : 'text-c-text-secondary'}`}
                  style={{ width: cell.width }}
                >
                  {cell.label}
                </div>
              ))}
            </div>

            {/* Bars */}
            {timelineData.map(({ node, start, end, color }, idx) => {
              const { left, width } = getBarStyle(start, end);
              return (
                <div
                  key={node.id}
                  className="relative border-b border-c-border-subtle"
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {headerCells.map((cell, i) => (
                      <div
                        key={i}
                        className="border-r border-c-border-subtle flex-shrink-0"
                        style={{ width: cell.width }}
                      />
                    ))}
                  </div>

                  {/* Bar */}
                  <div
                    className={`absolute top-1.5 rounded-lg shadow-sm cursor-pointer transition-shadow hover:shadow-md ${dragging?.nodeId === node.id ? 'ring-2 ring-c-focus' : ''}`}
                    style={{
                      left,
                      width,
                      height: ROW_HEIGHT - 12,
                      background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`,
                    }}
                    onClick={() => onNodeClick?.(node.id)}
                    onMouseDown={(e) => handleMouseDown(node.id, 'move', e, start, end)}
                  >
                    <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-white truncate drop-shadow-sm">
                      {node.data?.label || ''}
                    </span>

                    {/* Resize handle (right edge) */}
                    {!locked && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r-lg"
                        onMouseDown={(e) => handleMouseDown(node.id, 'resize-end', e, start, end)}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Dependency arrows (simplified) */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: totalWidth, height: timelineData.length * ROW_HEIGHT + 32 }}
            >
              {edges.map((edge) => {
                const srcIdx = timelineData.findIndex((d) => d.node.id === edge.source);
                const tgtIdx = timelineData.findIndex((d) => d.node.id === edge.target);
                if (srcIdx < 0 || tgtIdx < 0) return null;
                const src = timelineData[srcIdx];
                const tgt = timelineData[tgtIdx];
                const srcBar = getBarStyle(src.start, src.end);
                const tgtBar = getBarStyle(tgt.start, tgt.end);
                const x1 = srcBar.left + srcBar.width;
                const y1 = 32 + srcIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const x2 = tgtBar.left;
                const y2 = 32 + tgtIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const midX = (x1 + x2) / 2;
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={src.color}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      opacity={0.5}
                    />
                    <circle cx={x2} cy={y2} r={3} fill={tgt.color} opacity={0.7} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
