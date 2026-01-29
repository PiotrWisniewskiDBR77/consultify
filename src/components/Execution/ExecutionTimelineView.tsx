/**
 * ExecutionTimelineView
 *
 * Gantt-style timeline view for initiatives in execution phase.
 * Shows timeline bars based on planned/actual dates with status-based coloring.
 */

import { AlertTriangle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { FullInitiative, InitiativeStatus } from '../../types';

interface ExecutionTimelineViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  projectId?: string;
}

// ============================================
// STATUS COLORS
// ============================================

const STATUS_COLORS: Record<
  InitiativeStatus,
  { bg: string; border: string; text: string; progress: string }
> = {
  [InitiativeStatus.PENDING_REVIEW]: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    progress: 'bg-orange-500',
  },
  [InitiativeStatus.PROMOTED]: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    progress: 'bg-blue-500',
  },
  [InitiativeStatus.APPROVED]: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    progress: 'bg-emerald-500',
  },
  [InitiativeStatus.SCHEDULED]: {
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
    progress: 'bg-purple-500',
  },
  [InitiativeStatus.EXECUTING]: {
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    text: 'text-cyan-400',
    progress: 'bg-cyan-500',
  },
  [InitiativeStatus.BLOCKED]: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/50',
    text: 'text-red-400',
    progress: 'bg-red-500',
  },
  [InitiativeStatus.DONE]: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
    progress: 'bg-green-500',
  },
  [InitiativeStatus.TRACKING]: {
    bg: 'bg-teal-500/20',
    border: 'border-teal-500/50',
    text: 'text-teal-400',
    progress: 'bg-teal-500',
  },
  [InitiativeStatus.DRAFT]: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-slate-400',
    progress: 'bg-slate-500',
  },
  [InitiativeStatus.PLANNING]: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    progress: 'bg-blue-500',
  },
  [InitiativeStatus.REVIEW]: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    progress: 'bg-amber-500',
  },
  [InitiativeStatus.CANCELLED]: {
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/50',
    text: 'text-gray-400',
    progress: 'bg-gray-500',
  },
  [InitiativeStatus.ARCHIVED]: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-slate-400',
    progress: 'bg-slate-500',
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const generateWeeks = (
  startDate: Date,
  numWeeks: number = 12
): { date: Date; label: string; weekNum: number }[] => {
  const weeks: { date: Date; label: string; weekNum: number }[] = [];
  const current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay() + 1);

  for (let i = 0; i < numWeeks; i++) {
    const weekDate = new Date(current);
    weeks.push({
      date: weekDate,
      label: `W${getWeekNumber(weekDate)}`,
      weekNum: getWeekNumber(weekDate),
    });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
};

const getMonthsFromWeeks = (
  weeks: { date: Date }[]
): { month: string; year: number; startIdx: number; span: number }[] => {
  const months: { month: string; year: number; startIdx: number; span: number }[] = [];
  let currentMonth = -1;
  let currentYear = -1;

  weeks.forEach((week, idx) => {
    const m = week.date.getMonth();
    const y = week.date.getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      if (months.length > 0) {
        months[months.length - 1].span = idx - months[months.length - 1].startIdx;
      }
      months.push({
        month: week.date.toLocaleDateString('en-US', { month: 'short' }),
        year: y,
        startIdx: idx,
        span: 1,
      });
      currentMonth = m;
      currentYear = y;
    }
  });

  if (months.length > 0) {
    months[months.length - 1].span = weeks.length - months[months.length - 1].startIdx;
  }

  return months;
};

// ============================================
// TIMELINE BAR COMPONENT
// ============================================

interface TimelineBarProps {
  initiative: FullInitiative;
  startIdx: number;
  endIdx: number;
  totalWeeks: number;
  onClick: () => void;
  isOnCriticalPath?: boolean;
}

const TimelineBar: React.FC<TimelineBarProps> = ({
  initiative,
  startIdx,
  endIdx,
  totalWeeks,
  onClick,
  isOnCriticalPath,
}) => {
  const colors = STATUS_COLORS[initiative.status] || STATUS_COLORS[InitiativeStatus.EXECUTING];
  const span = Math.max(1, endIdx - startIdx + 1);
  const progress = initiative.progress || 0;
  const leftPercent = (startIdx / totalWeeks) * 100;
  const widthPercent = (span / totalWeeks) * 100;

  return (
    <div
      onClick={onClick}
      className={`
        absolute top-2 h-10 rounded-lg cursor-pointer group
        transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10
        ${colors.bg} border ${colors.border}
        ${isOnCriticalPath ? 'ring-2 ring-red-500/50' : ''}
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: '60px',
      }}
    >
      <div
        className={`absolute inset-y-0 left-0 ${colors.progress} opacity-30 rounded-l-lg`}
        style={{ width: `${progress}%` }}
      />
      <div className="relative h-full flex items-center gap-2 px-3 overflow-hidden">
        <div className={`w-2 h-2 rounded-full ${colors.progress} shrink-0`} />
        <span className={`text-sm font-medium truncate ${colors.text}`}>{initiative.name}</span>
        {initiative.priority === 'Critical' && (
          <AlertTriangle size={14} className="shrink-0 text-red-500" />
        )}
        <span className="ml-auto text-xs text-slate-400 shrink-0">{progress}%</span>
      </div>
    </div>
  );
};

// ============================================
// MAIN TIMELINE VIEW
// ============================================

export const ExecutionTimelineView: React.FC<ExecutionTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(12);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 14);
    return today;
  });

  const weeks = useMemo(() => generateWeeks(startDate, viewWeeks), [startDate, viewWeeks]);
  const months = useMemo(() => getMonthsFromWeeks(weeks), [weeks]);

  const getWeekIndex = useCallback(
    (dateStr: string | undefined): number => {
      if (!dateStr) return -1;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return -1;
      const firstWeekStart = weeks[0]?.date;
      if (!firstWeekStart) return -1;
      const diffTime = date.getTime() - firstWeekStart.getTime();
      const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
      return Math.max(0, Math.min(diffWeeks, weeks.length - 1));
    },
    [weeks]
  );

  const processedInitiatives = useMemo(() => {
    return initiatives
      .filter((i) => i.startDate || i.plannedEndDate || i.endDate)
      .map((initiative) => {
        const startIdx =
          getWeekIndex(initiative.startDate) >= 0 ? getWeekIndex(initiative.startDate) : 0;
        const endDateStr =
          initiative.actualEndDate || initiative.plannedEndDate || initiative.endDate;
        let endIdx = getWeekIndex(endDateStr);
        if (endIdx < 0 || endIdx < startIdx) {
          endIdx = Math.min(startIdx + 2, weeks.length - 1);
        }
        return { ...initiative, startIdx, endIdx };
      })
      .sort((a, b) => a.startIdx - b.startIdx);
  }, [initiatives, getWeekIndex, weeks.length]);

  const initiativeRows = useMemo(() => {
    const rows: (typeof processedInitiatives)[] = [];
    processedInitiatives.forEach((initiative) => {
      let placed = false;
      for (const row of rows) {
        const overlaps = row.some(
          (existing) =>
            !(initiative.endIdx < existing.startIdx || initiative.startIdx > existing.endIdx)
        );
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
  }, [processedInitiatives]);

  const todayPosition = useMemo(() => {
    const today = new Date();
    const firstWeekStart = weeks[0]?.date;
    if (!firstWeekStart) return null;
    const diffTime = today.getTime() - firstWeekStart.getTime();
    const diffDays = diffTime / (24 * 60 * 60 * 1000);
    const position = (diffDays / (viewWeeks * 7)) * 100;
    if (position < 0 || position > 100) return null;
    return position;
  }, [weeks, viewWeeks]);

  const criticalPathIds = useMemo(() => {
    const ids = new Set<string>();
    const today = new Date();
    initiatives.forEach((i) => {
      if (i.status === InitiativeStatus.BLOCKED) {
        ids.add(i.id);
      }
      if (
        i.plannedEndDate &&
        new Date(i.plannedEndDate) < today &&
        i.status !== InitiativeStatus.DONE
      ) {
        ids.add(i.id);
      }
    });
    return ids;
  }, [initiatives]);

  const navigateTimeline = (direction: 'prev' | 'next') => {
    setStartDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    today.setDate(today.getDate() - 14);
    setStartDate(today);
  };

  return (
    <div className="h-full flex flex-col bg-navy-950">
      {/* Timeline Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTimeline('prev')}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateTimeline('next')}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          {[8, 12, 16].map((w) => (
            <button
              key={w}
              onClick={() => setViewWeeks(w)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewWeeks === w
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w}W
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Month Headers */}
          <div className="sticky top-0 z-20 flex bg-navy-900 border-b border-navy-700">
            {months.map((m, idx) => (
              <div
                key={`${m.month}-${m.year}-${idx}`}
                className="text-center py-2 border-r border-navy-700 last:border-r-0"
                style={{ width: `${(m.span / viewWeeks) * 100}%` }}
              >
                <span className="text-sm font-semibold text-white">
                  {m.month} {m.year}
                </span>
              </div>
            ))}
          </div>

          {/* Week Headers */}
          <div className="sticky top-[40px] z-10 flex bg-navy-800 border-b border-navy-700">
            {weeks.map((week, idx) => (
              <div
                key={`week-${idx}`}
                className="flex-1 px-1 py-2 text-center border-r border-navy-700 last:border-r-0"
              >
                <div className="text-xs font-medium text-slate-400">{week.label}</div>
                <div className="text-[10px] text-slate-500">
                  {week.date.toLocaleDateString('en-US', { day: 'numeric' })}
                </div>
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
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-medium rounded shadow-lg">
                  Today
                </div>
              </div>
            )}

            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {weeks.map((_, idx) => (
                <div
                  key={`grid-${idx}`}
                  className="flex-1 border-r border-navy-800 last:border-r-0"
                />
              ))}
            </div>

            {/* Initiative rows */}
            {initiativeRows.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                <div className="text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No initiatives with timeline data</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Add start/end dates to initiatives to see them here
                  </p>
                </div>
              </div>
            ) : (
              initiativeRows.map((row, rowIdx) => (
                <div key={rowIdx} className="relative h-14 border-b border-navy-800">
                  {row.map((initiative) => (
                    <TimelineBar
                      key={initiative.id}
                      initiative={initiative}
                      startIdx={initiative.startIdx}
                      endIdx={initiative.endIdx}
                      totalWeeks={viewWeeks}
                      onClick={() => onInitiativeClick(initiative)}
                      isOnCriticalPath={criticalPathIds.has(initiative.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-navy-700 bg-navy-900 text-xs">
        <div className="flex items-center gap-4">
          {[
            { status: InitiativeStatus.APPROVED, label: 'Ready' },
            { status: InitiativeStatus.EXECUTING, label: 'In Progress' },
            { status: InitiativeStatus.BLOCKED, label: 'Blocked' },
            { status: InitiativeStatus.DONE, label: 'Done' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${STATUS_COLORS[status].progress}`} />
              <span className="text-slate-400">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded ring-2 ring-red-500/50 bg-red-500/20" />
          <span className="text-slate-400">Critical/Overdue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500" />
          <span className="text-slate-400">Today</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTimelineView;
