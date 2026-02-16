/**
 * ExecutionTimelineView
 *
 * Gantt-style timeline view for initiatives in execution phase.
 * Shows timeline bars based on planned/actual dates with status-based coloring.
 *
 * D4.1: Dependency validation — warns about illogical sequences
 * D5.1: Dependency lines (SVG arrows), critical path highlight, drag-to-move bars
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Route,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { FullInitiative, InitiativeStatus } from '../../types';

interface ExecutionTimelineViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  onUpdateInitiative?: (initiative: FullInitiative) => void;
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
    text: 'text-slate-500 dark:text-slate-400',
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
    text: 'text-slate-500 dark:text-slate-400',
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
// D4.1: DEPENDENCY VALIDATION
// ============================================

interface DepWarning {
  initiativeId: string;
  message: string;
  severity: 'warning' | 'error';
}

function validateInitiativeDependencies(initiatives: FullInitiative[]): DepWarning[] {
  const warnings: DepWarning[] = [];
  const initMap = new Map<string, FullInitiative>();
  initiatives.forEach((i) => initMap.set(i.id, i));

  initiatives.forEach((init) => {
    const related = init.relatedInitiatives?.filter((r) => r.relationType === 'DEPENDS_ON');
    if (!related || related.length === 0) return;

    related.forEach((rel) => {
      const predecessor = initMap.get(rel.relatedInitiativeId);
      if (!predecessor) return;

      const predEnd = predecessor.plannedEndDate || predecessor.endDate;
      const thisStart = init.startDate || init.plannedStartDate;

      if (predEnd && thisStart && new Date(thisStart) < new Date(predEnd)) {
        warnings.push({
          initiativeId: init.id,
          message: `"${init.name}" starts before "${predecessor.name}" ends`,
          severity: 'warning',
        });
      }
    });
  });

  return warnings;
}

// ============================================
// D5.1: CRITICAL PATH
// ============================================

function computeExecutionCriticalPath(initiatives: FullInitiative[]): Set<string> {
  const ids = new Set<string>();
  const today = new Date();

  // Mark blocked and overdue as critical
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

  // Also compute longest dependency chain
  const initMap = new Map<string, FullInitiative>();
  initiatives.forEach((i) => initMap.set(i.id, i));

  const successors = new Map<string, string[]>();
  initiatives.forEach((i) => successors.set(i.id, []));

  initiatives.forEach((init) => {
    const deps = init.relatedInitiatives?.filter((r) => r.relationType === 'DEPENDS_ON') || [];
    deps.forEach((dep) => {
      if (initMap.has(dep.relatedInitiativeId)) {
        const succs = successors.get(dep.relatedInitiativeId) || [];
        succs.push(init.id);
        successors.set(dep.relatedInitiativeId, succs);
      }
    });
  });

  // Simple longest path
  const longestTo = new Map<string, number>();
  const pathPrev = new Map<string, string | null>();

  function getDuration(init: FullInitiative): number {
    const start = init.startDate || init.plannedStartDate;
    const end = init.plannedEndDate || init.endDate;
    if (start && end) {
      return Math.max(
        1,
        Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
      );
    }
    return 2;
  }

  initiatives.forEach((i) => {
    longestTo.set(i.id, getDuration(i));
    pathPrev.set(i.id, null);
  });

  // Process (simplified — works for DAGs without explicit topo sort)
  for (let iter = 0; iter < initiatives.length; iter++) {
    initiatives.forEach((init) => {
      const currentLen = longestTo.get(init.id) || 0;
      (successors.get(init.id) || []).forEach((succ) => {
        const succInit = initMap.get(succ);
        if (!succInit) return;
        const newLen = currentLen + getDuration(succInit);
        if (newLen > (longestTo.get(succ) || 0)) {
          longestTo.set(succ, newLen);
          pathPrev.set(succ, init.id);
        }
      });
    });
  }

  let maxLen = 0;
  let maxEnd = '';
  longestTo.forEach((len, id) => {
    if (len > maxLen) {
      maxLen = len;
      maxEnd = id;
    }
  });

  if (maxEnd && maxLen > 0) {
    let current: string | null = maxEnd;
    while (current) {
      ids.add(current);
      current = pathPrev.get(current) || null;
    }
  }

  return ids;
}

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
  hasWarning?: boolean;
  warningMessage?: string;
  onDragEnd?: (weeksDelta: number) => void;
}

const TimelineBar: React.FC<TimelineBarProps> = ({
  initiative,
  startIdx,
  endIdx,
  totalWeeks,
  onClick,
  isOnCriticalPath,
  hasWarning,
  warningMessage,
  onDragEnd,
}) => {
  const colors = STATUS_COLORS[initiative.status] || STATUS_COLORS[InitiativeStatus.EXECUTING];
  const span = Math.max(1, endIdx - startIdx + 1);
  const progress = initiative.progress || 0;
  const leftPercent = (startIdx / totalWeeks) * 100;
  const widthPercent = (span / totalWeeks) * 100;
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragEnd = useCallback(() => {
    if (onDragEnd && dragOffset !== 0) {
      const weekWidth = 100 / totalWeeks;
      const weeksDelta = Math.round(dragOffset / weekWidth);
      if (weeksDelta !== 0) {
        onDragEnd(weeksDelta);
      }
    }
    setDragOffset(0);
  }, [dragOffset, onDragEnd, totalWeeks]);

  return (
    <motion.div
      onClick={onClick}
      drag={onDragEnd ? 'x' : false}
      dragMomentum={false}
      dragElastic={0}
      onDrag={(_, info) => {
        const containerWidth = 100; // percent
        setDragOffset((info.offset.x / window.innerWidth) * containerWidth);
      }}
      onDragEnd={handleDragEnd}
      className={`
        absolute top-2 h-10 rounded-lg group
        transition-shadow hover:shadow-lg hover:z-10
        ${colors.bg} border ${colors.border}
        ${isOnCriticalPath ? 'ring-2 ring-red-500/50' : ''}
        ${hasWarning ? 'ring-1 ring-amber-400/70' : ''}
        ${onDragEnd ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      `}
      style={{
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minWidth: '60px',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={onDragEnd ? { scale: 0.98 } : undefined}
    >
      {/* D4.1: Warning badge */}
      {hasWarning && (
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center z-20"
          title={warningMessage}
        >
          <AlertTriangle size={10} className="text-slate-900 dark:text-white" />
        </div>
      )}

      <div
        className={`absolute inset-y-0 left-0 ${colors.progress} opacity-30 rounded-l-lg`}
        style={{ width: `${progress}%` }}
      />
      <div className="relative h-full flex items-center gap-2 px-3 overflow-hidden">
        {onDragEnd && (
          <GripHorizontal
            size={12}
            className="opacity-30 shrink-0 group-hover:opacity-70 transition-opacity"
          />
        )}
        <div className={`w-2 h-2 rounded-full ${colors.progress} shrink-0`} />
        <span className={`text-sm font-medium truncate ${colors.text}`}>{initiative.name}</span>
        {initiative.priority === 'Critical' && (
          <AlertTriangle size={14} className="shrink-0 text-red-500" />
        )}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 shrink-0">
          {progress}%
        </span>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN TIMELINE VIEW
// ============================================

export const ExecutionTimelineView: React.FC<ExecutionTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
  onUpdateInitiative,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(12);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 14);
    return today;
  });

  const weeks = useMemo(() => generateWeeks(startDate, viewWeeks), [startDate, viewWeeks]);
  const months = useMemo(() => getMonthsFromWeeks(weeks), [weeks]);

  // D4.1: Dependency validation
  const depWarnings = useMemo(() => validateInitiativeDependencies(initiatives), [initiatives]);
  const warningsByInit = useMemo(() => {
    const map = new Map<string, DepWarning[]>();
    depWarnings.forEach((w) => {
      const existing = map.get(w.initiativeId) || [];
      existing.push(w);
      map.set(w.initiativeId, existing);
    });
    return map;
  }, [depWarnings]);

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

  // Flat map for SVG line drawing: initiative id -> { row, startIdx, endIdx }
  const initiativePositionMap = useMemo(() => {
    const map = new Map<string, { row: number; startIdx: number; endIdx: number }>();
    initiativeRows.forEach((row, rowIdx) => {
      row.forEach((init) => {
        map.set(init.id, { row: rowIdx, startIdx: init.startIdx, endIdx: init.endIdx });
      });
    });
    return map;
  }, [initiativeRows]);

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

  // D5.1: Critical path
  const criticalPathIds = useMemo(
    () => (showCriticalPath ? computeExecutionCriticalPath(initiatives) : new Set<string>()),
    [initiatives, showCriticalPath]
  );

  // D5.1: Dependency lines for SVG
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      fromId: string;
      toId: string;
      x1Pct: number;
      y1Row: number;
      x2Pct: number;
      y2Row: number;
      isCritical: boolean;
      isConflict: boolean;
    }> = [];

    initiatives.forEach((init) => {
      const deps = init.relatedInitiatives?.filter((r) => r.relationType === 'DEPENDS_ON') || [];
      const toPos = initiativePositionMap.get(init.id);
      if (!toPos) return;

      deps.forEach((dep) => {
        const fromPos = initiativePositionMap.get(dep.relatedInitiativeId);
        if (!fromPos) return;

        const isCritical =
          criticalPathIds.has(init.id) && criticalPathIds.has(dep.relatedInitiativeId);
        const isConflict = warningsByInit.has(init.id);

        lines.push({
          fromId: dep.relatedInitiativeId,
          toId: init.id,
          x1Pct: ((fromPos.endIdx + 1) / viewWeeks) * 100,
          y1Row: fromPos.row,
          x2Pct: (toPos.startIdx / viewWeeks) * 100,
          y2Row: toPos.row,
          isCritical,
          isConflict,
        });
      });
    });

    return lines;
  }, [initiatives, initiativePositionMap, viewWeeks, criticalPathIds, warningsByInit]);

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

  // D5.1: Handle drag to move
  const handleBarDragEnd = useCallback(
    (initiative: FullInitiative, weeksDelta: number) => {
      if (!onUpdateInitiative) return;

      const startStr = initiative.startDate || initiative.plannedStartDate;
      const endStr = initiative.plannedEndDate || initiative.endDate;

      if (!startStr) return;

      const newStart = new Date(startStr);
      newStart.setDate(newStart.getDate() + weeksDelta * 7);

      const updates: Partial<FullInitiative> = {
        ...initiative,
      };

      if (initiative.startDate) {
        updates.startDate = newStart.toISOString();
      }
      if (initiative.plannedStartDate) {
        const newPStart = new Date(initiative.plannedStartDate);
        newPStart.setDate(newPStart.getDate() + weeksDelta * 7);
        updates.plannedStartDate = newPStart.toISOString();
      }

      if (endStr) {
        const newEnd = new Date(endStr);
        newEnd.setDate(newEnd.getDate() + weeksDelta * 7);
        if (initiative.plannedEndDate) updates.plannedEndDate = newEnd.toISOString();
        if (initiative.endDate) updates.endDate = newEnd.toISOString();
      }

      onUpdateInitiative(updates as FullInitiative);
    },
    [onUpdateInitiative]
  );

  const ROW_HEIGHT = 56; // h-14

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Timeline Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTimeline('prev')}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateTimeline('next')}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          {/* D4.1: Warning count */}
          {depWarnings.length > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-navy-700 mx-1" />
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                <AlertTriangle size={11} />
                {depWarnings.length} warning{depWarnings.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        {/* Right: View controls */}
        <div className="flex items-center gap-3">
          {/* Critical path toggle */}
          <button
            onClick={() => setShowCriticalPath((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showCriticalPath
                ? 'bg-red-900/30 text-red-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
            title={showCriticalPath ? 'Hide critical path' : 'Show critical path'}
          >
            <Route size={16} />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-navy-700" />

          {/* Week range selector */}
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-navy-800 rounded-lg p-1 border border-slate-200 dark:border-navy-700">
            {[8, 12, 16].map((w) => (
              <button
                key={w}
                onClick={() => setViewWeeks(w)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  viewWeeks === w
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {w}W
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Month Headers */}
          <div className="sticky top-0 z-20 flex bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
            {months.map((m, idx) => (
              <div
                key={`${m.month}-${m.year}-${idx}`}
                className="text-center py-2 border-r border-slate-200 dark:border-navy-700 last:border-r-0"
                style={{ width: `${(m.span / viewWeeks) * 100}%` }}
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {m.month} {m.year}
                </span>
              </div>
            ))}
          </div>

          {/* Week Headers */}
          <div className="sticky top-[40px] z-10 flex bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
            {weeks.map((week, idx) => (
              <div
                key={`week-${idx}`}
                className="flex-1 px-1 py-2 text-center border-r border-slate-200 dark:border-navy-700 last:border-r-0"
              >
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {week.label}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
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
                  className="flex-1 border-r border-slate-200 dark:border-navy-800 last:border-r-0"
                />
              ))}
            </div>

            {/* D5.1: SVG dependency lines */}
            {dependencyLines.length > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-15"
                style={{
                  width: '100%',
                  height: initiativeRows.length * ROW_HEIGHT,
                }}
              >
                <defs>
                  <marker
                    id="exec-arrow"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#64748b" />
                  </marker>
                  <marker
                    id="exec-arrow-crit"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#ef4444" />
                  </marker>
                  <marker
                    id="exec-arrow-warn"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
                  </marker>
                </defs>
                {dependencyLines.map((line, idx) => {
                  const y1 = line.y1Row * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const y2 = line.y2Row * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const stroke = line.isCritical
                    ? '#ef4444'
                    : line.isConflict
                      ? '#f59e0b'
                      : '#64748b';
                  const marker = line.isCritical
                    ? 'url(#exec-arrow-crit)'
                    : line.isConflict
                      ? 'url(#exec-arrow-warn)'
                      : 'url(#exec-arrow)';
                  const sw = line.isCritical ? 2 : 1.5;
                  const dash = line.isConflict ? '5 3' : 'none';

                  return (
                    <path
                      key={idx}
                      d={`M ${line.x1Pct}% ${y1} C ${(line.x1Pct + line.x2Pct) / 2}% ${y1}, ${(line.x1Pct + line.x2Pct) / 2}% ${y2}, ${line.x2Pct}% ${y2}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={sw}
                      strokeDasharray={dash}
                      markerEnd={marker}
                      opacity={0.6}
                    />
                  );
                })}
              </svg>
            )}

            {/* Initiative rows */}
            {initiativeRows.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-slate-500 dark:text-slate-400">
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
                <div
                  key={rowIdx}
                  className="relative h-14 border-b border-slate-200 dark:border-navy-800"
                >
                  {row.map((initiative) => {
                    const initWarnings = warningsByInit.get(initiative.id) || [];
                    return (
                      <TimelineBar
                        key={initiative.id}
                        initiative={initiative}
                        startIdx={initiative.startIdx}
                        endIdx={initiative.endIdx}
                        totalWeeks={viewWeeks}
                        onClick={() => onInitiativeClick(initiative)}
                        isOnCriticalPath={criticalPathIds.has(initiative.id)}
                        hasWarning={initWarnings.length > 0}
                        warningMessage={initWarnings.map((w) => w.message).join('\n')}
                        onDragEnd={
                          onUpdateInitiative
                            ? (weeksDelta) => handleBarDragEnd(initiative, weeksDelta)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-xs flex-wrap">
        <div className="flex items-center gap-4">
          {[
            { status: InitiativeStatus.APPROVED, label: 'Ready' },
            { status: InitiativeStatus.EXECUTING, label: 'In Progress' },
            { status: InitiativeStatus.BLOCKED, label: 'Blocked' },
            { status: InitiativeStatus.DONE, label: 'Done' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${STATUS_COLORS[status].progress}`} />
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded ring-2 ring-red-500/50 bg-red-500/20" />
          <span className="text-slate-500 dark:text-slate-400">Critical/Overdue</span>
        </div>
        {depWarnings.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400">Schedule Warning</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-red-500" />
          <span className="text-slate-500 dark:text-slate-400">Today</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTimelineView;
