/**
 * ExecutionWorkloadView
 * 
 * Resource allocation and capacity planning view for execution phase.
 * Displays team workload as a heat map with capacity indicators.
 * 
 * Features:
 * - Heat map by person (rows) and weeks (columns)
 * - Color coding: green (<80%), yellow (80-100%), red (>100%)
 * - Click on cell to see initiative breakdown
 * - Team aggregation view
 */

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { FullInitiative, InitiativeStatus } from '../../types';

// ============================================
// TYPES
// ============================================

interface ExecutionWorkloadViewProps {
  initiatives: FullInitiative[];
  projectId?: string;
}

interface ResourceAllocation {
  userId: string;
  userName: string;
  userAvatar?: string;
  role?: string;
  allocations: {
    initiativeId: string;
    initiativeName: string;
    percentage: number;
    startDate: string;
    endDate: string;
  }[];
}

interface WeekColumn {
  weekNumber: number;
  year: number;
  startDate: Date;
  label: string;
}

interface CellData {
  totalAllocation: number;
  initiatives: {
    id: string;
    name: string;
    percentage: number;
  }[];
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

const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addWeeks = (date: Date, weeks: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
};

const getAllocationColor = (percentage: number): string => {
  if (percentage === 0) return 'bg-navy-800';
  if (percentage < 50) return 'bg-green-500/20';
  if (percentage < 80) return 'bg-green-500/40';
  if (percentage <= 100) return 'bg-amber-500/40';
  return 'bg-red-500/40';
};

const getAllocationTextColor = (percentage: number): string => {
  if (percentage === 0) return 'text-slate-600';
  if (percentage <= 100) return 'text-white';
  return 'text-red-300';
};

// ============================================
// CELL TOOLTIP COMPONENT
// ============================================

interface CellTooltipProps {
  data: CellData;
  userName: string;
  weekLabel: string;
}

const CellTooltip: React.FC<CellTooltipProps> = ({ data, userName, weekLabel }) => {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-navy-900 text-white text-xs rounded-lg shadow-xl z-30 min-w-[200px]">
      <div className="font-medium mb-2">{userName} - {weekLabel}</div>
      <div className="text-sm mb-2">
        Total: <span className={data.totalAllocation > 100 ? 'text-red-400' : 'text-green-400'}>
          {data.totalAllocation}%
        </span>
      </div>
      {data.initiatives.length > 0 && (
        <div className="border-t border-navy-700 pt-2 space-y-1">
          {data.initiatives.map((init) => (
            <div key={init.id} className="flex justify-between">
              <span className="text-slate-400 truncate max-w-[140px]">{init.name}</span>
              <span className="text-white ml-2">{init.percentage}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ExecutionWorkloadView: React.FC<ExecutionWorkloadViewProps> = ({
  initiatives,
  projectId,
}) => {
  const { t } = useTranslation();
  
  const [resources, setResources] = useState<ResourceAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => startOfWeek(new Date()));
  const [hoveredCell, setHoveredCell] = useState<{ userId: string; weekIdx: number } | null>(null);
  const [viewMode, setViewMode] = useState<'individual' | 'team'>('individual');

  const numWeeks = 8;

  // Generate week columns
  const weeks = useMemo((): WeekColumn[] => {
    const cols: WeekColumn[] = [];
    let current = new Date(startDate);

    for (let i = 0; i < numWeeks; i++) {
      const weekStart = startOfWeek(current);
      const weekNum = getWeekNumber(weekStart);
      cols.push({
        weekNumber: weekNum,
        year: weekStart.getFullYear(),
        startDate: weekStart,
        label: `W${weekNum}`,
      });
      current = addWeeks(current, 1);
    }

    return cols;
  }, [startDate]);

  // Extract resources from initiatives
  useEffect(() => {
    const extractResources = () => {
      setIsLoading(true);
      
      const resourceMap = new Map<string, ResourceAllocation>();

      initiatives.forEach((initiative) => {
        // Get owners
        const owners = [
          initiative.ownerBusiness && {
            ...initiative.ownerBusiness,
            role: 'Business Owner',
          },
          initiative.ownerTechnical && {
            ...initiative.ownerTechnical,
            role: 'Technical Owner',
          },
          initiative.ownerExecution && {
            ...initiative.ownerExecution,
            role: 'Execution Lead',
          },
        ].filter(Boolean);

        owners.forEach((owner) => {
          if (!owner) return;
          
          const userId = owner.id;
          if (!resourceMap.has(userId)) {
            resourceMap.set(userId, {
              userId,
              userName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Unknown',
              userAvatar: owner.avatarUrl,
              role: owner.role,
              allocations: [],
            });
          }

          const resource = resourceMap.get(userId)!;
          resource.allocations.push({
            initiativeId: initiative.id,
            initiativeName: initiative.name,
            percentage: 25, // Default allocation per initiative
            startDate: initiative.plannedStartDate || new Date().toISOString(),
            endDate: initiative.plannedEndDate || addWeeks(new Date(), 12).toISOString(),
          });
        });
      });

      setResources(Array.from(resourceMap.values()));
      setIsLoading(false);
    };

    extractResources();
  }, [initiatives]);

  // Calculate cell data
  const getCellData = useCallback((resource: ResourceAllocation, week: WeekColumn): CellData => {
    const weekStart = week.startDate.getTime();
    const weekEnd = addWeeks(week.startDate, 1).getTime();

    const activeAllocations = resource.allocations.filter((alloc) => {
      const allocStart = new Date(alloc.startDate).getTime();
      const allocEnd = new Date(alloc.endDate).getTime();
      return allocStart < weekEnd && allocEnd > weekStart;
    });

    const totalAllocation = activeAllocations.reduce((sum, a) => sum + a.percentage, 0);

    return {
      totalAllocation,
      initiatives: activeAllocations.map((a) => ({
        id: a.initiativeId,
        name: a.initiativeName,
        percentage: a.percentage,
      })),
    };
  }, []);

  // Calculate team aggregation
  const teamData = useMemo(() => {
    return weeks.map((week) => {
      let totalAllocation = 0;
      let memberCount = 0;

      resources.forEach((resource) => {
        const cellData = getCellData(resource, week);
        if (cellData.totalAllocation > 0) {
          totalAllocation += cellData.totalAllocation;
          memberCount++;
        }
      });

      return {
        averageAllocation: memberCount > 0 ? Math.round(totalAllocation / memberCount) : 0,
        memberCount,
        totalAllocation,
      };
    });
  }, [resources, weeks, getCellData]);

  // Navigation
  const navigate = (direction: 'prev' | 'next') => {
    setStartDate((prev) => addWeeks(prev, direction === 'prev' ? -4 : 4));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

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
          <span className="text-sm font-medium text-white min-w-[150px] text-center">
            {weeks[0]?.label} - {weeks[weeks.length - 1]?.label} {weeks[0]?.year}
          </span>
          <button
            onClick={() => navigate('next')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-navy-800 rounded"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-navy-800 rounded-lg p-1 border border-navy-700">
          <button
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 ${
              viewMode === 'individual'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User size={14} />
            Individual
          </button>
          <button
            onClick={() => setViewMode('team')}
            className={`px-3 py-1 text-xs font-medium rounded flex items-center gap-1.5 ${
              viewMode === 'team'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={14} />
            Team
          </button>
        </div>
      </div>

      {/* Heat Map */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Header */}
          <div className="sticky top-0 z-10 flex bg-navy-900 border-b border-navy-700">
            <div className="w-48 shrink-0 px-4 py-3 font-medium text-sm text-white border-r border-navy-700">
              {viewMode === 'individual' ? 'Team Member' : 'Team Summary'}
            </div>
            {weeks.map((week, idx) => (
              <div
                key={idx}
                className="flex-1 px-2 py-3 text-center border-r border-navy-700 last:border-r-0"
              >
                <div className="text-sm font-medium text-white">{week.label}</div>
                <div className="text-xs text-slate-500">
                  {week.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {viewMode === 'individual' ? (
            <>
              {resources.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-500">
                  <div className="text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No team members assigned</p>
                  </div>
                </div>
              ) : (
                resources.map((resource) => (
                  <div
                    key={resource.userId}
                    className="flex border-b border-navy-800"
                  >
                    <div className="w-48 shrink-0 px-4 py-3 flex items-center gap-3 border-r border-navy-700">
                      <div className="w-8 h-8 rounded-full bg-navy-700 flex items-center justify-center text-xs text-white">
                        {resource.userName.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-medium text-white truncate">
                          {resource.userName}
                        </div>
                        {resource.role && (
                          <div className="text-xs text-slate-500 truncate">{resource.role}</div>
                        )}
                      </div>
                    </div>
                    {weeks.map((week, weekIdx) => {
                      const cellData = getCellData(resource, week);
                      const isHovered = hoveredCell?.userId === resource.userId && hoveredCell?.weekIdx === weekIdx;

                      return (
                        <div
                          key={weekIdx}
                          className={`flex-1 p-2 border-r border-navy-700 last:border-r-0 relative ${getAllocationColor(cellData.totalAllocation)}`}
                          onMouseEnter={() => setHoveredCell({ userId: resource.userId, weekIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div className={`text-center text-sm font-medium ${getAllocationTextColor(cellData.totalAllocation)}`}>
                            {cellData.totalAllocation > 0 ? `${cellData.totalAllocation}%` : '-'}
                          </div>
                          {cellData.totalAllocation > 100 && (
                            <AlertTriangle size={12} className="absolute top-1 right-1 text-red-400" />
                          )}
                          {isHovered && cellData.totalAllocation > 0 && (
                            <CellTooltip
                              data={cellData}
                              userName={resource.userName}
                              weekLabel={week.label}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </>
          ) : (
            /* Team aggregate view */
            <div className="flex border-b border-navy-800">
              <div className="w-48 shrink-0 px-4 py-4 flex items-center gap-3 border-r border-navy-700">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Users size={16} className="text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Team Average</div>
                  <div className="text-xs text-slate-500">{resources.length} members</div>
                </div>
              </div>
              {weeks.map((week, weekIdx) => {
                const data = teamData[weekIdx];
                return (
                  <div
                    key={weekIdx}
                    className={`flex-1 p-3 border-r border-navy-700 last:border-r-0 ${getAllocationColor(data.averageAllocation)}`}
                  >
                    <div className={`text-center ${getAllocationTextColor(data.averageAllocation)}`}>
                      <div className="text-lg font-bold">{data.averageAllocation}%</div>
                      <div className="text-xs opacity-70">{data.memberCount} active</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-navy-700 bg-navy-950 text-xs text-slate-400">
        <span className="font-medium">Capacity:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500/20" />
          <span>&lt;50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-500/40" />
          <span>50-80%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-500/40" />
          <span>80-100%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-500/40" />
          <span>&gt;100%</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionWorkloadView;
