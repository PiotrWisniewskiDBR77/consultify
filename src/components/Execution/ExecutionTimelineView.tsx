/**
 * ExecutionTimelineView
 * 
 * Gantt-style timeline view for execution phase initiatives.
 * Displays APPROVED, EXECUTING, BLOCKED, and DONE initiatives on a timeline.
 * 
 * Features:
 * - Status-colored bars (Executing=cyan, Blocked=red, Done=green)
 * - Dependencies visualization
 * - Critical path highlighting
 * - Today marker
 * - Zoom controls (week/month/quarter)
 */

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flag,
  Milestone,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FullInitiative, InitiativeStatus } from '../../types';

// ============================================
// TYPES
// ============================================

interface ExecutionTimelineViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  projectId?: string;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

interface TimelineColumn {
  label: string;
  subLabel?: string;
  startDate: Date;
  endDate: Date;
}

// ============================================
// STATUS COLORS
// ============================================

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  [InitiativeStatus.APPROVED]: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
  },
  [InitiativeStatus.EXECUTING]: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400',
  },
  [InitiativeStatus.BLOCKED]: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
  },
  [InitiativeStatus.DONE]: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const startOfQuarter = (date: Date): Date => {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
};

const formatWeek = (date: Date): string => {
  const weekNum = getWeekNumber(date);
  return `W${weekNum}`;
};

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const formatMonth = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short' });
};

const formatQuarter = (date: Date): string => {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${quarter}`;
};

// ============================================
// TIMELINE BAR COMPONENT
// ============================================

interface TimelineBarProps {
  initiative: FullInitiative;
  leftPercent: number;
  widthPercent: number;
  onClick: () => void;
}

const TimelineBar: React.FC<TimelineBarProps> = ({
  initiative,
  leftPercent,
  widthPercent,
  onClick,
}) => {
  const colors = STATUS_COLORS[initiative.status] || STATUS_COLORS[InitiativeStatus.EXECUTING];
  const progress = initiative.progress || 0;

  return (
    <div
      onClick={onClick}
      className={`
        absolute top-2 h-10 rounded-lg cursor-pointer group
        transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10
        ${colors.bg} border ${colors.border}
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 3)}%`,
      }}
    >
      {/* Progress overlay */}
      <div
        className={`absolute inset-0 ${colors.bg} rounded-lg opacity-50`}
        style={{ width: `${progress}%` }}
      />

      {/* Content */}
      <div className="relative h-full flex items-center gap-2 px-3 overflow-hidden">
        {/* Name */}
        <span className={`text-sm font-medium truncate ${colors.text}`}>
          {initiative.name}
        </span>

        {/* Indicators */}
        {initiative.priority === 'CRITICAL' && (
          <AlertTriangle size={14} className="shrink-0 text-red-500" />
        )}
        {initiative.isCriticalPath && (
          <Flag size={14} className="shrink-0 text-amber-500" />
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl">
        <div className="font-medium mb-1">{initiative.name}</div>
        <div className="text-slate-400">
          {initiative.status} • {progress}% complete
        </div>
        {initiative.plannedEndDate && (
          <div className="text-slate-500">
            Due: {new Date(initiative.plannedEndDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ExecutionTimelineView: React.FC<ExecutionTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
  projectId,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return zoom === 'week' ? startOfWeek(now) : 
           zoom === 'month' ? startOfMonth(now) : 
           startOfQuarter(now);
  });

  // Generate columns based on zoom level
  const columns = useMemo((): TimelineColumn[] => {
    const cols: TimelineColumn[] = [];
    let current = new Date(startDate);
    const numCols = zoom === 'week' ? 12 : zoom === 'month' ? 6 : 4;

    for (let i = 0; i < numCols; i++) {
      let colStart: Date;
      let colEnd: Date;
      let label: string;
      let subLabel: string | undefined;

      if (zoom === 'week') {
        colStart = startOfWeek(current);
        colEnd = addDays(colStart, 6);
        label = formatWeek(colStart);
        subLabel = colStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        current = addDays(current, 7);
      } else if (zoom === 'month') {
        colStart = startOfMonth(current);
        colEnd = addMonths(colStart, 1);
        colEnd.setDate(colEnd.getDate() - 1);
        label = formatMonth(colStart);
        subLabel = colStart.getFullYear().toString();
        current = addMonths(current, 1);
      } else {
        colStart = startOfQuarter(current);
        colEnd = addMonths(colStart, 3);
        colEnd.setDate(colEnd.getDate() - 1);
        label = formatQuarter(colStart);
        subLabel = colStart.getFullYear().toString();
        current = addMonths(current, 3);
      }

      cols.push({ label, subLabel, startDate: colStart, endDate: colEnd });
    }

    return cols;
  }, [startDate, zoom]);

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    if (columns.length === 0) return { start: new Date(), end: new Date() };
    return {
      start: columns[0].startDate,
      end: columns[columns.length - 1].endDate,
    };
  }, [columns]);

  // Calculate position for an initiative
  const getPositionForInitiative = (initiative: FullInitiative) => {
    const start = initiative.plannedStartDate 
      ? new Date(initiative.plannedStartDate) 
      : new Date();
    const end = initiative.plannedEndDate 
      ? new Date(initiative.plannedEndDate) 
      : addDays(start, 30);

    const rangeStart = timelineRange.start.getTime();
    const rangeEnd = timelineRange.end.getTime();
    const totalRange = rangeEnd - rangeStart;

    const leftPercent = Math.max(0, ((start.getTime() - rangeStart) / totalRange) * 100);
    const rightPercent = Math.min(100, ((end.getTime() - rangeStart) / totalRange) * 100);
    const widthPercent = rightPercent - leftPercent;

    return { leftPercent, widthPercent };
  };

  // Group initiatives by row (non-overlapping)
  const initiativeRows = useMemo(() => {
    const rows: FullInitiative[][] = [];
    const sortedInitiatives = [...initiatives].sort((a, b) => {
      const aStart = a.plannedStartDate ? new Date(a.plannedStartDate).getTime() : 0;
      const bStart = b.plannedStartDate ? new Date(b.plannedStartDate).getTime() : 0;
      return aStart - bStart;
    });

    sortedInitiatives.forEach((initiative) => {
      const initStart = initiative.plannedStartDate 
        ? new Date(initiative.plannedStartDate).getTime() 
        : 0;
      const initEnd = initiative.plannedEndDate 
        ? new Date(initiative.plannedEndDate).getTime() 
        : initStart + 30 * 24 * 60 * 60 * 1000;

      let placed = false;
      for (const row of rows) {
        const overlaps = row.some((existing) => {
          const existStart = existing.plannedStartDate 
            ? new Date(existing.plannedStartDate).getTime() 
            : 0;
          const existEnd = existing.plannedEndDate 
            ? new Date(existing.plannedEndDate).getTime() 
            : existStart + 30 * 24 * 60 * 60 * 1000;
          return !(initEnd < existStart || initStart > existEnd);
        });

        if (!overlaps) {
          row.push(initiative);
          placed = true;
          break;
        }
      }

      if (!placed) {
        rows.push([initiative]);
      }
    });

    return rows;
  }, [initiatives]);

  // Today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    const rangeStart = timelineRange.start.getTime();
    const rangeEnd = timelineRange.end.getTime();
    const totalRange = rangeEnd - rangeStart;
    
    if (today < timelineRange.start || today > timelineRange.end) return null;
    
    return ((today.getTime() - rangeStart) / totalRange) * 100;
  }, [timelineRange]);

  // Navigation
  const navigate = (direction: 'prev' | 'next') => {
    const amount = direction === 'prev' ? -1 : 1;
    setStartDate((prev) => {
      if (zoom === 'week') return addDays(prev, amount * 7 * 4);
      if (zoom === 'month') return addMonths(prev, amount * 3);
      return addMonths(prev, amount * 6);
    });
  };

  const changeZoom = (newZoom: ZoomLevel) => {
    setZoom(newZoom);
    const now = new Date();
    if (newZoom === 'week') setStartDate(startOfWeek(now));
    else if (newZoom === 'month') setStartDate(startOfMonth(now));
    else setStartDate(startOfQuarter(now));
  };

  return (
    <div className="h-full flex flex-col bg-navy-900">
      {/* Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-950">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('prev')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-800 rounded"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-white min-w-[100px] text-center">
            {columns[0]?.label} - {columns[columns.length - 1]?.label}
          </span>
          <button
            onClick={() => navigate('next')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-800 rounded"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          {(['week', 'month', 'quarter'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              onClick={() => changeZoom(level)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize ${
                zoom === level 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Column Headers */}
          <div className="sticky top-0 z-10 flex bg-navy-900 border-b border-navy-700">
            {columns.map((col, idx) => (
              <div
                key={idx}
                className="flex-1 px-4 py-3 text-center border-r border-navy-700 last:border-r-0"
              >
                <div className="text-sm font-semibold text-white">{col.label}</div>
                {col.subLabel && (
                  <div className="text-xs text-slate-500">{col.subLabel}</div>
                )}
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Today marker */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-medium rounded">
                  Today
                </div>
              </div>
            )}

            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {columns.map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 border-r border-navy-800 last:border-r-0"
                />
              ))}
            </div>

            {/* Initiative rows */}
            {initiativeRows.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-500">
                <div className="text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No initiatives in execution</p>
                </div>
              </div>
            ) : (
              initiativeRows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className="relative h-14 border-b border-navy-800"
                >
                  {row.map((initiative) => {
                    const { leftPercent, widthPercent } = getPositionForInitiative(initiative);
                    return (
                      <TimelineBar
                        key={initiative.id}
                        initiative={initiative}
                        leftPercent={leftPercent}
                        widthPercent={widthPercent}
                        onClick={() => onInitiativeClick(initiative)}
                      />
                    );
                  })}
                </div>
              ))
            )}

            {/* Padding */}
            {initiativeRows.length > 0 && initiativeRows.length < 5 && (
              <div style={{ height: `${(5 - initiativeRows.length) * 56}px` }} />
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-navy-700 bg-navy-950 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${colors.bg} border ${colors.border}`} />
              <span>{status.charAt(0) + status.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-0.5 bg-red-500" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Flag size={12} className="text-amber-500" />
          <span>Critical Path</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTimelineView;
