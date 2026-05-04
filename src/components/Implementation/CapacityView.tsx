// @ts-nocheck
/**
 * CapacityView Component
 *
 * PMO Resource Capacity Planning
 *
 * Standards Compliance:
 * - ISO 21500:2021 - Resource Management (Clause 4.4.5)
 * - PMI PMBOK 7th Edition - Resource Optimization / Leveling
 * - PRINCE2 - Resource Forecasting
 *
 * PMO Domain: RESOURCE_RESPONSIBILITY
 */

import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Api } from '../../services/api';

interface WeeklyCapacity {
  userId: string;
  weekStart: string;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  initiativeAllocations: { initiativeId: string; hours: number }[];
  isOverloaded: boolean;
  taskCount: number;
}

interface OverloadedUser {
  userId: string;
  userName: string;
  overloadedWeeks: {
    weekStart: string;
    allocatedHours: number;
    utilizationPercent: number;
  }[];
  sustainedOverload: boolean;
}

interface CapacitySummary {
  projectId: string;
  totalUsersAnalyzed: number;
  overloadedUsers: OverloadedUser[];
  hasOverloads: boolean;
  sustainedOverloads: number;
  suggestions?: { userId: string; type: string; message: string }[];
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  capacity: number;
  allocated: number;
  skills: string[];
  weeklyData?: WeeklyCapacity[];
}

interface CapacityViewProps {
  projectId?: string;
  initiativeId?: string;
}

export const CapacityView: React.FC<CapacityViewProps> = ({ projectId, initiativeId }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchCapacityData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If we have a projectId, fetch overload data
      if (projectId) {
        const overloadsResponse = await Api.get(`/capacity/project/${projectId}/overloads`);
        setCapacitySummary(overloadsResponse);

        // Transform overloaded users to members format
        if (overloadsResponse.overloadedUsers) {
          const transformedMembers: TeamMember[] = overloadsResponse.overloadedUsers.map(
            (u: OverloadedUser) => ({
              id: u.userId,
              name: u.userName,
              role: 'Team Member',
              capacity: 40,
              allocated: u.overloadedWeeks[0]?.allocatedHours || 40,
              skills: [],
              weeklyData: u.overloadedWeeks.map((w) => ({
                userId: u.userId,
                weekStart: w.weekStart,
                allocatedHours: w.allocatedHours,
                availableHours: 40,
                utilizationPercent: w.utilizationPercent,
                initiativeAllocations: [],
                isOverloaded: w.utilizationPercent > 100,
                taskCount: 0,
              })),
            })
          );
          setMembers(transformedMembers);
        }
      } else {
        // Fallback: show sample data when no project selected
        setMembers([
          {
            id: '1',
            name: 'Jan Kowalski',
            role: 'Project Manager',
            capacity: 40,
            allocated: 45,
            skills: ['Project Management', 'Agile', 'Risk Analysis'],
          },
          {
            id: '2',
            name: 'Anna Nowak',
            role: 'Technical Lead',
            capacity: 40,
            allocated: 38,
            skills: ['Architecture', 'Cloud', 'Security'],
          },
          {
            id: '3',
            name: 'Piotr Wiśniewski',
            role: 'Business Analyst',
            capacity: 40,
            allocated: 32,
            skills: ['Requirements', 'UX', 'Process Mapping'],
          },
          {
            id: '4',
            name: 'Maria Zielińska',
            role: 'Developer',
            capacity: 40,
            allocated: 40,
            skills: ['React', 'Node.js', 'TypeScript'],
          },
          {
            id: '5',
            name: 'Tomasz Lewandowski',
            role: 'QA Engineer',
            capacity: 40,
            allocated: 25,
            skills: ['Test Automation', 'Selenium', 'Performance Testing'],
          },
        ]);
      }
    } catch (err: any) {
      console.error('[CapacityView] Error:', err);
      setError(err.message || 'Failed to load capacity data');

      // Set fallback data
      setMembers([
        {
          id: '1',
          name: 'Jan Kowalski',
          role: 'Project Manager',
          capacity: 40,
          allocated: 45,
          skills: ['Project Management', 'Agile', 'Risk Analysis'],
        },
        {
          id: '2',
          name: 'Anna Nowak',
          role: 'Technical Lead',
          capacity: 40,
          allocated: 38,
          skills: ['Architecture', 'Cloud', 'Security'],
        },
        {
          id: '3',
          name: 'Piotr Wiśniewski',
          role: 'Business Analyst',
          capacity: 40,
          allocated: 32,
          skills: ['Requirements', 'UX', 'Process Mapping'],
        },
        {
          id: '4',
          name: 'Maria Zielińska',
          role: 'Developer',
          capacity: 40,
          allocated: 40,
          skills: ['React', 'Node.js', 'TypeScript'],
        },
        {
          id: '5',
          name: 'Tomasz Lewandowski',
          role: 'QA Engineer',
          capacity: 40,
          allocated: 25,
          skills: ['Test Automation', 'Selenium', 'Performance Testing'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCapacityData();
  }, [fetchCapacityData]);

  // Calculate summary stats
  const totalCapacity = members.reduce((sum, m) => sum + m.capacity, 0);
  const totalAllocated = members.reduce((sum, m) => sum + m.allocated, 0);
  const utilizationRate =
    totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;
  const overallocatedCount = members.filter((m) => m.allocated > m.capacity).length;

  const getUtilizationColor = (allocated: number, capacity: number) => {
    const rate = (allocated / capacity) * 100;
    if (rate > 100) return 'text-rose-500';
    if (rate >= 80) return 'text-amber-500';
    if (rate >= 50) return 'text-green-500';
    return 'text-blue-500';
  };

  const getProgressColor = (allocated: number, capacity: number) => {
    const rate = (allocated / capacity) * 100;
    if (rate > 100) return 'bg-rose-500';
    if (rate >= 80) return 'bg-amber-500';
    if (rate >= 50) return 'bg-green-500';
    return 'bg-blue-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Users className="text-blue-500" size={24} />
            Capacity Planning
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Resource allocation and availability
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCapacityData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Capacity</div>
          <div className="text-2xl font-bold text-navy-900 dark:text-white">{totalCapacity}h</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">per week</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Allocated</div>
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {totalAllocated}h
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">committed</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Utilization</div>
          <div
            className={`text-2xl font-bold ${
              utilizationRate > 100
                ? 'text-rose-600'
                : utilizationRate >= 80
                  ? 'text-amber-600'
                  : 'text-green-600'
            }`}
          >
            {utilizationRate}%
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">overall rate</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Overallocated</div>
          <div
            className={`text-2xl font-bold ${overallocatedCount > 0 ? 'text-rose-600' : 'text-green-600'}`}
          >
            {overallocatedCount}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">team members</div>
        </div>
      </div>

      {/* Overallocation Warning */}
      {overallocatedCount > 0 && (
        <div className="flex items-start gap-3 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-500/20 rounded-xl">
          <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
              {overallocatedCount} team member{overallocatedCount > 1 ? 's are' : ' is'}{' '}
              overallocated
            </p>
            <p className="text-xs text-rose-600/70 dark:text-rose-400/70 mt-1">
              Review task assignments or consider adding resources to maintain delivery quality
            </p>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {capacitySummary?.suggestions && capacitySummary.suggestions.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-500/20 rounded-xl p-4">
          <h4 className="font-semibold text-primary-700 dark:text-primary-300 mb-3">
            AI Recommendations
          </h4>
          <div className="space-y-2">
            {capacitySummary.suggestions.map((suggestion, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    suggestion.type === 'REASSIGN'
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  {suggestion.type}
                </span>
                <span className="text-slate-600 dark:text-slate-400">{suggestion.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Capacity List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4">
          <span className="w-48">Team Member</span>
          <span className="w-32">Role</span>
          <span className="w-40">Utilization</span>
          <span className="w-24 text-right">Hours</span>
          <span className="w-8"></span>
        </div>

        {members.map((member) => {
          const utilizationPercent = Math.round((member.allocated / member.capacity) * 100);
          const isOverallocated = member.allocated > member.capacity;
          const isExpanded = expandedMember === member.id;

          return (
            <div
              key={member.id}
              className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden"
            >
              <div
                className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors ${
                  isOverallocated ? 'border-l-4 border-l-rose-500' : ''
                }`}
                onClick={() => setExpandedMember(isExpanded ? null : member.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar & Name */}
                  <div className="w-48 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">
                      {member.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')}
                    </div>
                    <div>
                      <div className="font-medium text-navy-900 dark:text-white">{member.name}</div>
                      {isOverallocated && (
                        <span className="text-xs text-rose-500 font-medium">Overallocated</span>
                      )}
                    </div>
                  </div>

                  {/* Role */}
                  <div className="w-32 text-sm text-slate-500 dark:text-slate-400">
                    {member.role}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-navy-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(member.allocated, member.capacity)} rounded-full transition-all`}
                          style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`text-sm font-medium ${getUtilizationColor(member.allocated, member.capacity)}`}
                      >
                        {utilizationPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="w-24 text-right">
                    <span
                      className={`font-medium ${getUtilizationColor(member.allocated, member.capacity)}`}
                    >
                      {member.allocated}h
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {' '}
                      / {member.capacity}h
                    </span>
                  </div>

                  {/* Expand */}
                  <div className="w-8 flex justify-center">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/50">
                  {member.skills && member.skills.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                        Skills
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {member.skills.map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-1 bg-slate-200 dark:bg-navy-800 text-xs rounded-full text-slate-600 dark:text-slate-400"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {member.weeklyData && member.weeklyData.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                        Weekly Breakdown
                      </h5>
                      <div className="space-y-2">
                        {member.weeklyData.map((week, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm p-2 bg-white dark:bg-navy-900 rounded-lg"
                          >
                            <span className="text-slate-700 dark:text-slate-300">
                              Week of {new Date(week.weekStart).toLocaleDateString('pl-PL')}
                            </span>
                            <span
                              className={`font-medium ${week.isOverloaded ? 'text-rose-600' : 'text-primary-600'}`}
                            >
                              {week.allocatedHours}h ({week.utilizationPercent}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!member.weeklyData || member.weeklyData.length === 0) && (
                    <div>
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                        Allocations
                      </h5>
                      <div className="text-sm text-slate-500 dark:text-slate-400 p-2">
                        No detailed allocation data available
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Capacity Forecast Chart */}
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h4 className="font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-blue-500" />
          Capacity Overview
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {members.filter((m) => m.allocated <= m.capacity * 0.8).length}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Available (&lt;80%)
            </div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {
                members.filter((m) => m.allocated > m.capacity * 0.8 && m.allocated <= m.capacity)
                  .length
              }
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              At Capacity (80-100%)
            </div>
          </div>
          <div className="text-center p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <div className="text-3xl font-bold text-rose-600 dark:text-rose-400">
              {members.filter((m) => m.allocated > m.capacity).length}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Overloaded (&gt;100%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapacityView;
