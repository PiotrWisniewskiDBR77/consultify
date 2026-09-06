/**
 * ExecutionWorkloadView
 *
 * Resource allocation and capacity planning view for execution phase.
 *
 * D5.2: Workload heatmap with:
 * - Toggle between weekly and monthly views
 * - Person/team rows
 * - Color coding: green (low) → yellow (medium) → red (high/overallocated)
 * - Initiative breakdown on click
 * - Team average totals row
 * - Parameterizable time range
 */

import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import React, { type Dispatch, type SetStateAction, useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { FullInitiative, InitiativeStatus } from '../../types';

interface ExecutionWorkloadViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  projectId?: string;
  /**
   * If provided, the view becomes controlled and will use this state instead of internal one.
   * Useful when you want to render controls in a parent (e.g. top module bar).
   */
  controls?: {
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    weekCount: number;
    setWeekCount: (count: number) => void;
    monthCount: number;
    setMonthCount: (count: number) => void;
    startDate: Date;
    setStartDate: Dispatch<SetStateAction<Date>>;
  };
  /** Hide the internal controls bar (date range / toggles). */
  showControls?: boolean;
}

// ============================================
// TYPES
// ============================================

type ViewMode = 'weekly' | 'monthly';

interface ResourceAllocation {
  initiativeId: string;
  initiativeName: string;
  percentage: number;
  status: InitiativeStatus;
}

interface PersonWorkload {
  userId: string;
  userName: string;
  avatar?: string;
  role?: string;
  allocations: Map<string, ResourceAllocation[]>; // periodKey -> allocations
}

interface TimePeriod {
  key: string;
  label: string;
  shortLabel: string;
  startDate: Date;
  endDate: Date;
}

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

const generateWeeks = (startDate: Date, numWeeks: number): TimePeriod[] => {
  const periods: TimePeriod[] = [];
  const current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay() + 1);

  for (let i = 0; i < numWeeks; i++) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekNum = getWeekNumber(weekStart);

    periods.push({
      key: `${weekStart.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`,
      label: `W${weekNum}`,
      shortLabel: `W${weekNum}`,
      startDate: weekStart,
      endDate: weekEnd,
    });
    current.setDate(current.getDate() + 7);
  }

  return periods;
};

const generateMonths = (startDate: Date, numMonths: number): TimePeriod[] => {
  const periods: TimePeriod[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  for (let i = 0; i < numMonths; i++) {
    const monthStart = new Date(current);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    periods.push({
      key: `${current.getFullYear()}-M${(current.getMonth() + 1).toString().padStart(2, '0')}`,
      label: `${monthNames[current.getMonth()]} ${current.getFullYear()}`,
      shortLabel: monthNames[current.getMonth()],
      startDate: monthStart,
      endDate: monthEnd,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return periods;
};

// D5.2: Green → Yellow → Red color scale
const getHeatmapColor = (percentage: number): string => {
  if (percentage === 0) return 'bg-slate-100/50 dark:bg-navy-800/50';
  if (percentage <= 30) return 'bg-emerald-500/20';
  if (percentage <= 50) return 'bg-emerald-500/35';
  if (percentage <= 70) return 'bg-emerald-500/50';
  if (percentage <= 85) return 'bg-yellow-500/35';
  if (percentage <= 100) return 'bg-amber-500/45';
  if (percentage <= 120) return 'bg-amber-500/50';
  return 'bg-danger-500/50';
};

const getHeatmapTextColor = (percentage: number): string => {
  if (percentage === 0) return 'text-slate-600';
  if (percentage <= 50) return 'text-emerald-400';
  if (percentage <= 70) return 'text-emerald-300';
  if (percentage <= 85) return 'text-yellow-400';
  if (percentage <= 100) return 'text-amber-400';
  return 'text-danger-400';
};

const getHeatmapBorder = (percentage: number): string => {
  if (percentage === 0) return 'border-transparent';
  if (percentage <= 70) return 'border-emerald-500/20';
  if (percentage <= 100) return 'border-amber-500/30';
  return 'border-danger-500/40';
};

// ============================================
// WORKLOAD CELL COMPONENT
// ============================================

interface WorkloadCellProps {
  allocations: ResourceAllocation[];
  onClick: () => void;
  viewMode: ViewMode;
}

const WorkloadCell: React.FC<WorkloadCellProps> = ({ allocations, onClick, viewMode }) => {
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const isOverallocated = totalPercentage > 100;
  const bgColor = getHeatmapColor(totalPercentage);
  const textColor = getHeatmapTextColor(totalPercentage);
  const borderColor = getHeatmapBorder(totalPercentage);
  const taskCount = allocations.length;

  return (
    <button
      onClick={onClick}
      className={`
        w-full rounded-lg transition-all border
        hover:border-blue-500/50 hover:scale-[1.03] hover:shadow-md
        ${bgColor} ${borderColor}
        flex flex-col items-center justify-center
        ${viewMode === 'monthly' ? 'h-16 gap-0.5' : 'h-12'}
      `}
    >
      {totalPercentage > 0 && (
        <>
          <div className="flex items-center gap-1">
            <span
              className={`font-bold ${textColor} ${viewMode === 'monthly' ? 'text-sm' : 'text-xs'}`}
            >
              {totalPercentage}%
            </span>
            {isOverallocated && <AlertTriangle size={11} className="text-danger-500" />}
          </div>
          {viewMode === 'monthly' && taskCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {taskCount} task{taskCount !== 1 ? 's' : ''}
            </span>
          )}
        </>
      )}
    </button>
  );
};

// ============================================
// ALLOCATION DETAIL MODAL
// ============================================

interface AllocationDetailModalProps {
  person: PersonWorkload;
  periodLabel: string;
  allocations: ResourceAllocation[];
  onClose: () => void;
  onInitiativeClick: (initiativeId: string) => void;
}

const AllocationDetailModal: React.FC<AllocationDetailModalProps> = ({
  person,
  periodLabel,
  allocations,
  onClose,
  onInitiativeClick,
}) => {
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const textColor = getHeatmapTextColor(totalPercentage);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center">
            <User size={20} className="text-slate-500 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">{person.userName}</h3>
            <p className="text-sm text-slate-600">
              {periodLabel} — <span className={textColor}>{totalPercentage}% allocated</span>
            </p>
          </div>
        </div>

        {allocations.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No allocations this period</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allocations.map((allocation, idx) => (
              <button
                key={idx}
                onClick={() => onInitiativeClick(allocation.initiativeId)}
                className="w-full p-3 bg-slate-50 dark:bg-navy-800 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {allocation.initiativeName}
                  </span>
                  <span
                    className={`text-sm font-bold ${getHeatmapTextColor(allocation.percentage)}`}
                  >
                    {allocation.percentage}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      allocation.status === InitiativeStatus.IN_EXECUTION
                        ? 'bg-blue-500/20 text-blue-400'
                        : allocation.status === InitiativeStatus.IN_EXECUTION
                          ? 'bg-danger-500/20 text-danger-400'
                          : 'bg-slate-500/20 text-slate-600'
                    }`}
                  >
                    {allocation.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ============================================
// MAIN WORKLOAD VIEW
// ============================================

export const ExecutionWorkloadView: React.FC<ExecutionWorkloadViewProps> = ({
  initiatives,
  onInitiativeClick,
  projectId,
  controls,
  showControls = true,
}) => {
  const { t } = useTranslation();
  const [internalViewMode, setInternalViewMode] = useState<ViewMode>('monthly');
  const [internalWeekCount, setInternalWeekCount] = useState(8);
  const [internalMonthCount, setInternalMonthCount] = useState(6);
  const [internalStartDate, setInternalStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });

  const viewMode = controls?.viewMode ?? internalViewMode;
  const setViewMode = controls?.setViewMode ?? setInternalViewMode;
  const weekCount = controls?.weekCount ?? internalWeekCount;
  const setWeekCount = controls?.setWeekCount ?? setInternalWeekCount;
  const monthCount = controls?.monthCount ?? internalMonthCount;
  const setMonthCount = controls?.setMonthCount ?? setInternalMonthCount;
  const startDate = controls?.startDate ?? internalStartDate;
  const setStartDate = controls?.setStartDate ?? setInternalStartDate;
  const [selectedCell, setSelectedCell] = useState<{
    person: PersonWorkload;
    periodKey: string;
    periodLabel: string;
  } | null>(null);

  // Generate time periods based on view mode
  const periods = useMemo(() => {
    if (viewMode === 'weekly') {
      return generateWeeks(startDate, weekCount);
    }
    return generateMonths(startDate, monthCount);
  }, [viewMode, startDate, weekCount, monthCount]);

  // Build workload data from initiatives
  const workloadData = useMemo(() => {
    const peopleMap = new Map<string, PersonWorkload>();

    initiatives.forEach((initiative) => {
      const owners = [initiative.ownerBusiness, initiative.ownerExecution].filter(Boolean);
      if (owners.length === 0) return;

      const startDateStr = initiative.startDate;
      const endDateStr =
        initiative.actualEndDate || initiative.plannedEndDate || initiative.endDate;

      if (!startDateStr && !endDateStr) return;

      const iStart = startDateStr ? new Date(startDateStr) : new Date();
      const iEnd = endDateStr
        ? new Date(endDateStr)
        : new Date(iStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Estimate allocation based on initiative duration and number of owners
      // Shorter initiatives = more intense; longer = more spread out
      const durationDays = Math.max(1, (iEnd.getTime() - iStart.getTime()) / (1000 * 60 * 60 * 24));
      const intensityFactor =
        durationDays < 30 ? 80 : durationDays < 90 ? 60 : durationDays < 180 ? 40 : 25;
      const allocationPerPerson = Math.round(intensityFactor / owners.length);

      owners.forEach((owner) => {
        if (!owner?.id) return;

        const ownerId = owner.id;
        const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Unknown';

        if (!peopleMap.has(ownerId)) {
          peopleMap.set(ownerId, {
            userId: ownerId,
            userName: ownerName,
            avatar: owner.avatarUrl,
            allocations: new Map(),
          });
        }

        const person = peopleMap.get(ownerId)!;

        periods.forEach((period) => {
          if (iStart <= period.endDate && iEnd >= period.startDate) {
            const existingAllocations = person.allocations.get(period.key) || [];
            existingAllocations.push({
              initiativeId: initiative.id,
              initiativeName: initiative.name,
              percentage: allocationPerPerson,
              status: initiative.status,
            });
            person.allocations.set(period.key, existingAllocations);
          }
        });
      });
    });

    return Array.from(peopleMap.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [initiatives, periods]);

  // Calculate totals per period
  const periodTotals = useMemo(() => {
    const totals = new Map<string, number>();
    periods.forEach((period) => {
      let total = 0;
      workloadData.forEach((person) => {
        const allocations = person.allocations.get(period.key) || [];
        total += allocations.reduce((sum, a) => sum + a.percentage, 0);
      });
      totals.set(period.key, Math.round(total / Math.max(workloadData.length, 1)));
    });
    return totals;
  }, [workloadData, periods]);

  // Calculate max allocation for any person in any period (for scale reference)
  const maxAllocation = useMemo(() => {
    let max = 0;
    workloadData.forEach((person) => {
      periods.forEach((period) => {
        const allocations = person.allocations.get(period.key) || [];
        const total = allocations.reduce((sum, a) => sum + a.percentage, 0);
        if (total > max) max = total;
      });
    });
    return max;
  }, [workloadData, periods]);

  // Navigation
  const navigateTimeline = (direction: 'prev' | 'next') => {
    setStartDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'weekly') {
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      } else {
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
      }
      return newDate;
    });
  };

  const handleCellClick = useCallback(
    (person: PersonWorkload, periodKey: string, periodLabel: string) => {
      setSelectedCell({ person, periodKey, periodLabel });
    },
    []
  );

  const handleInitiativeClick = useCallback(
    (initiativeId: string) => {
      const initiative = initiatives.find((i) => i.id === initiativeId);
      if (initiative) {
        onInitiativeClick(initiative);
        setSelectedCell(null);
      }
    },
    [initiatives, onInitiativeClick]
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Controls */}
      {showControls && (
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
          {/* Left: Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTimeline('prev')}
              className="p-1.5 text-slate-600 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-slate-900 dark:text-white min-w-[140px] text-center">
              {periods[0]?.label} — {periods[periods.length - 1]?.label}
            </span>
            <button
              onClick={() => navigateTimeline('next')}
              className="p-1.5 text-slate-600 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Right: View controls */}
          <div className="flex items-center gap-3">
            {/* View mode toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-navy-800 rounded-lg p-0.5 border border-slate-200 dark:border-navy-700">
              <button
                onClick={() => setViewMode('weekly')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'weekly'
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={12} />
                Weekly
              </button>
              <button
                onClick={() => setViewMode('monthly')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-200'
                }`}
              >
                <CalendarDays size={12} />
                Monthly
              </button>
            </div>

            <div className="w-px h-4 bg-slate-300 dark:bg-navy-700" />

            {/* Period count */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-navy-800 rounded-lg p-1 border border-slate-200 dark:border-navy-700">
              {viewMode === 'weekly'
                ? [6, 8, 12].map((w) => (
                    <button
                      key={w}
                      onClick={() => setWeekCount(w)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        weekCount === w
                          ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {w}W
                    </button>
                  ))
                : [3, 6, 12].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMonthCount(m)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        monthCount === m
                          ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {m}M
                    </button>
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* Workload Grid */}
      <div className="flex-1 overflow-auto">
        {workloadData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No resource allocations found</p>
              <p className="text-xs text-slate-500 mt-1">
                Assign owners to initiatives to see workload
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="sticky top-0 z-10 flex bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
              <div className="w-52 shrink-0 px-4 py-3 border-r border-slate-200 dark:border-navy-700">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Team Member
                </span>
              </div>
              {periods.map((period) => (
                <div
                  key={period.key}
                  className="flex-1 px-2 py-3 text-center border-r border-slate-200 dark:border-navy-700 last:border-r-0"
                >
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {viewMode === 'monthly' ? period.shortLabel : period.label}
                  </div>
                  {viewMode === 'monthly' && (
                    <div className="text-[10px] text-slate-500">
                      {period.startDate.getFullYear()}
                    </div>
                  )}
                  {viewMode === 'weekly' && (
                    <div className="text-[10px] text-slate-500">
                      {period.startDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Person Rows */}
            {workloadData.map((person) => (
              <div
                key={person.userId}
                className="flex border-b border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-900/50"
              >
                <div className="w-52 shrink-0 px-4 py-3 border-r border-slate-200 dark:border-navy-700 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs text-slate-900 dark:text-white shrink-0">
                    {person.userName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {person.userName}
                    </p>
                    {person.role && (
                      <p className="text-xs text-slate-500 truncate">{person.role}</p>
                    )}
                  </div>
                </div>
                {periods.map((period) => {
                  const allocations = person.allocations.get(period.key) || [];
                  return (
                    <div
                      key={period.key}
                      className="flex-1 p-1.5 border-r border-navy-800 last:border-r-0"
                    >
                      <WorkloadCell
                        allocations={allocations}
                        onClick={() => handleCellClick(person, period.key, period.label)}
                        viewMode={viewMode}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Totals Row */}
            <div className="flex bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-700">
              <div className="w-52 shrink-0 px-4 py-3 border-r border-slate-200 dark:border-navy-700">
                <span className="text-sm font-semibold text-slate-600">Team Average</span>
              </div>
              {periods.map((period) => {
                const avgAllocation = periodTotals.get(period.key) || 0;
                return (
                  <div
                    key={period.key}
                    className="flex-1 p-2 text-center border-r border-slate-200 dark:border-navy-700 last:border-r-0"
                  >
                    <span className={`text-sm font-bold ${getHeatmapTextColor(avgAllocation)}`}>
                      {avgAllocation}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* D5.2: Enhanced Legend with heatmap scale */}
      <div className="shrink-0 px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <span className="text-slate-600 font-medium">Load:</span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5">
              {[
                { pct: 0, label: '0%' },
                { pct: 30, label: '30%' },
                { pct: 50, label: '50%' },
                { pct: 70, label: '70%' },
                { pct: 85, label: '85%' },
                { pct: 100, label: '100%' },
                { pct: 120, label: '>100%' },
              ].map(({ pct, label }) => (
                <div key={pct} className="flex flex-col items-center gap-0.5">
                  <div className={`w-6 h-3 rounded-sm ${getHeatmapColor(pct)}`} />
                  <span className="text-[9px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-px h-3 bg-slate-300 dark:bg-navy-700 mx-1" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-emerald-500/35" />
              <span className="text-slate-500 dark:text-slate-400">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-amber-500/45" />
              <span className="text-slate-500 dark:text-slate-400">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded-sm bg-danger-500/50" />
              <span className="text-slate-500 dark:text-slate-400">Overallocated</span>
            </div>
          </div>
          {maxAllocation > 100 && (
            <>
              <div className="w-px h-3 bg-slate-300 dark:bg-navy-700 mx-1" />
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={11} className="text-danger-500" />
                <span className="text-danger-400">Peak: {maxAllocation}%</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCell && (
        <AllocationDetailModal
          person={selectedCell.person}
          periodLabel={selectedCell.periodLabel}
          allocations={selectedCell.person.allocations.get(selectedCell.periodKey) || []}
          onClose={() => setSelectedCell(null)}
          onInitiativeClick={handleInitiativeClick}
        />
      )}
    </div>
  );
};

export default ExecutionWorkloadView;
