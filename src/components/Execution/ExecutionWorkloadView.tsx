/**
 * ExecutionWorkloadView
 * 
 * Resource allocation and capacity planning view for execution phase.
 * Shows team workload as a heat map with:
 * - Person/team rows
 * - Week columns
 * - Allocation percentage per cell
 * - Color coding for capacity (green/yellow/red)
 * - Initiative breakdown on click
 */

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { FullInitiative, InitiativeStatus } from '../../types';

interface ExecutionWorkloadViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  projectId?: string;
}

// ============================================
// TYPES
// ============================================

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
  weeklyAllocations: Map<string, ResourceAllocation[]>; // weekKey -> allocations
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const generateWeeks = (startDate: Date, numWeeks: number = 8): { key: string; label: string; date: Date }[] => {
  const weeks: { key: string; label: string; date: Date }[] = [];
  const current = new Date(startDate);
  current.setDate(current.getDate() - current.getDay() + 1); // Start from Monday

  for (let i = 0; i < numWeeks; i++) {
    const weekDate = new Date(current);
    const weekNum = getWeekNumber(weekDate);
    weeks.push({
      key: `${weekDate.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`,
      label: `W${weekNum}`,
      date: weekDate,
    });
    current.setDate(current.getDate() + 7);
  }

  return weeks;
};

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getAllocationColor = (percentage: number): string => {
  if (percentage === 0) return 'bg-navy-800';
  if (percentage < 50) return 'bg-emerald-500/30';
  if (percentage <= 80) return 'bg-emerald-500/50';
  if (percentage <= 100) return 'bg-amber-500/50';
  return 'bg-red-500/50';
};

const getAllocationTextColor = (percentage: number): string => {
  if (percentage === 0) return 'text-slate-600';
  if (percentage <= 80) return 'text-emerald-400';
  if (percentage <= 100) return 'text-amber-400';
  return 'text-red-400';
};

// ============================================
// WORKLOAD CELL COMPONENT
// ============================================

interface WorkloadCellProps {
  allocations: ResourceAllocation[];
  onClick: () => void;
}

const WorkloadCell: React.FC<WorkloadCellProps> = ({ allocations, onClick }) => {
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const isOverallocated = totalPercentage > 100;
  const bgColor = getAllocationColor(totalPercentage);
  const textColor = getAllocationTextColor(totalPercentage);

  return (
    <button
      onClick={onClick}
      className={`
        w-full h-12 rounded-lg transition-all border border-transparent
        hover:border-cyan-500/50 hover:scale-105
        ${bgColor}
        flex items-center justify-center
      `}
    >
      {totalPercentage > 0 && (
        <div className="flex items-center gap-1">
          <span className={`text-sm font-bold ${textColor}`}>
            {totalPercentage}%
          </span>
          {isOverallocated && (
            <AlertTriangle size={12} className="text-red-500" />
          )}
        </div>
      )}
    </button>
  );
};

// ============================================
// ALLOCATION DETAIL MODAL
// ============================================

interface AllocationDetailModalProps {
  person: PersonWorkload;
  weekLabel: string;
  allocations: ResourceAllocation[];
  onClose: () => void;
  onInitiativeClick: (initiativeId: string) => void;
}

const AllocationDetailModal: React.FC<AllocationDetailModalProps> = ({
  person,
  weekLabel,
  allocations,
  onClose,
  onInitiativeClick,
}) => {
  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-navy-700 flex items-center justify-center">
            <User size={20} className="text-slate-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{person.userName}</h3>
            <p className="text-sm text-slate-400">{weekLabel} - {totalPercentage}% allocated</p>
          </div>
        </div>

        {allocations.length === 0 ? (
          <p className="text-center text-slate-500 py-4">No allocations this week</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allocations.map((allocation, idx) => (
              <button
                key={idx}
                onClick={() => onInitiativeClick(allocation.initiativeId)}
                className="w-full p-3 bg-navy-800 rounded-lg text-left hover:bg-navy-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white truncate">
                    {allocation.initiativeName}
                  </span>
                  <span className={`text-sm font-bold ${getAllocationTextColor(allocation.percentage)}`}>
                    {allocation.percentage}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    allocation.status === InitiativeStatus.EXECUTING ? 'bg-cyan-500/20 text-cyan-400' :
                    allocation.status === InitiativeStatus.BLOCKED ? 'bg-red-500/20 text-red-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {allocation.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
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
}) => {
  const [viewWeeks, setViewWeeks] = useState(8);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7); // Start 1 week ago
    return today;
  });
  const [selectedCell, setSelectedCell] = useState<{
    person: PersonWorkload;
    weekKey: string;
    weekLabel: string;
  } | null>(null);

  // Generate weeks
  const weeks = useMemo(() => generateWeeks(startDate, viewWeeks), [startDate, viewWeeks]);

  // Build workload data from initiatives
  const workloadData = useMemo(() => {
    const peopleMap = new Map<string, PersonWorkload>();

    // Process initiatives with owners
    initiatives.forEach(initiative => {
      // Check for assigned owners
      const owners = [
        initiative.ownerBusiness,
        initiative.ownerTechnical,
      ].filter(Boolean);

      if (owners.length === 0) return;

      // Calculate allocation per week based on initiative dates
      const startDateStr = initiative.startDate;
      const endDateStr = initiative.actualEndDate || initiative.plannedEndDate || initiative.endDate;
      
      if (!startDateStr && !endDateStr) return;

      const iStart = startDateStr ? new Date(startDateStr) : new Date();
      const iEnd = endDateStr ? new Date(endDateStr) : new Date(iStart.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Default allocation per person (split equally among owners)
      const allocationPerPerson = Math.round(50 / owners.length); // 50% total, split

      owners.forEach(owner => {
        if (!owner?.id) return;

        const ownerId = owner.id;
        const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Unknown';

        if (!peopleMap.has(ownerId)) {
          peopleMap.set(ownerId, {
            userId: ownerId,
            userName: ownerName,
            avatar: owner.avatarUrl,
            weeklyAllocations: new Map(),
          });
        }

        const person = peopleMap.get(ownerId)!;

        // Add allocation for each week the initiative spans
        weeks.forEach(week => {
          const weekStart = week.date;
          const weekEnd = new Date(week.date);
          weekEnd.setDate(weekEnd.getDate() + 7);

          // Check if initiative overlaps with this week
          if (iStart <= weekEnd && iEnd >= weekStart) {
            const existingAllocations = person.weeklyAllocations.get(week.key) || [];
            existingAllocations.push({
              initiativeId: initiative.id,
              initiativeName: initiative.name,
              percentage: allocationPerPerson,
              status: initiative.status,
            });
            person.weeklyAllocations.set(week.key, existingAllocations);
          }
        });
      });
    });

    return Array.from(peopleMap.values()).sort((a, b) => a.userName.localeCompare(b.userName));
  }, [initiatives, weeks]);

  // Calculate totals per week
  const weeklyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    weeks.forEach(week => {
      let total = 0;
      workloadData.forEach(person => {
        const allocations = person.weeklyAllocations.get(week.key) || [];
        total += allocations.reduce((sum, a) => sum + a.percentage, 0);
      });
      totals.set(week.key, Math.round(total / Math.max(workloadData.length, 1)));
    });
    return totals;
  }, [workloadData, weeks]);

  // Navigation
  const navigateTimeline = (direction: 'prev' | 'next') => {
    setStartDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const handleCellClick = useCallback((person: PersonWorkload, weekKey: string, weekLabel: string) => {
    setSelectedCell({ person, weekKey, weekLabel });
  }, []);

  const handleInitiativeClick = useCallback((initiativeId: string) => {
    const initiative = initiatives.find(i => i.id === initiativeId);
    if (initiative) {
      onInitiativeClick(initiative);
      setSelectedCell(null);
    }
  }, [initiatives, onInitiativeClick]);

  return (
    <div className="h-full flex flex-col bg-navy-950">
      {/* Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-navy-700 bg-navy-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTimeline('prev')}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-white min-w-[100px] text-center">
            {weeks[0]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - 
            {weeks[weeks.length - 1]?.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            onClick={() => navigateTimeline('next')}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          {[6, 8, 12].map(w => (
            <button
              key={w}
              onClick={() => setViewWeeks(w)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                viewWeeks === w 
                  ? 'bg-purple-500/20 text-purple-400' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {w}W
            </button>
          ))}
        </div>
      </div>

      {/* Workload Grid */}
      <div className="flex-1 overflow-auto">
        {workloadData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
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
            <div className="sticky top-0 z-10 flex bg-navy-900 border-b border-navy-700">
              <div className="w-48 shrink-0 px-4 py-3 border-r border-navy-700">
                <span className="text-sm font-semibold text-white">Team Member</span>
              </div>
              {weeks.map(week => (
                <div
                  key={week.key}
                  className="flex-1 px-2 py-3 text-center border-r border-navy-700 last:border-r-0"
                >
                  <div className="text-sm font-medium text-white">{week.label}</div>
                  <div className="text-[10px] text-slate-500">
                    {week.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {workloadData.map(person => (
              <div
                key={person.userId}
                className="flex border-b border-navy-800 hover:bg-navy-900/50"
              >
                <div className="w-48 shrink-0 px-4 py-3 border-r border-navy-700 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs text-white">
                    {person.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{person.userName}</p>
                    {person.role && (
                      <p className="text-xs text-slate-500 truncate">{person.role}</p>
                    )}
                  </div>
                </div>
                {weeks.map(week => {
                  const allocations = person.weeklyAllocations.get(week.key) || [];
                  return (
                    <div key={week.key} className="flex-1 p-1 border-r border-navy-800 last:border-r-0">
                      <WorkloadCell
                        allocations={allocations}
                        onClick={() => handleCellClick(person, week.key, week.label)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Totals Row */}
            <div className="flex bg-navy-900 border-t border-navy-700">
              <div className="w-48 shrink-0 px-4 py-3 border-r border-navy-700">
                <span className="text-sm font-semibold text-slate-400">Team Average</span>
              </div>
              {weeks.map(week => {
                const avgAllocation = weeklyTotals.get(week.key) || 0;
                return (
                  <div
                    key={week.key}
                    className="flex-1 p-2 text-center border-r border-navy-700 last:border-r-0"
                  >
                    <span className={`text-sm font-bold ${getAllocationTextColor(avgAllocation)}`}>
                      {avgAllocation}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-navy-700 bg-navy-900 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500/30" />
            <span className="text-slate-400">&lt;50%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-emerald-500/50" />
            <span className="text-slate-400">50-80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-amber-500/50" />
            <span className="text-slate-400">80-100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-red-500/50" />
            <span className="text-slate-400">&gt;100% (Overallocated)</span>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCell && (
        <AllocationDetailModal
          person={selectedCell.person}
          weekLabel={selectedCell.weekLabel}
          allocations={selectedCell.person.weeklyAllocations.get(selectedCell.weekKey) || []}
          onClose={() => setSelectedCell(null)}
          onInitiativeClick={handleInitiativeClick}
        />
      )}
    </div>
  );
};

export default ExecutionWorkloadView;
