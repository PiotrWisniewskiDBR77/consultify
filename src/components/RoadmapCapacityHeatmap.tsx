/**
 * RoadmapCapacityHeatmap
 *
 * Shows resource capacity and workload across the roadmap timeline.
 * Highlights overallocation and helps with workload balancing.
 */

import { AlertTriangle, Calendar, TrendingUp, Users, Zap } from 'lucide-react';
import React, { useMemo } from 'react';

import { FullInitiative } from '../types';

interface CapacityData {
  month: string;
  year: number;
  initiativeCount: number;
  totalEffort: number;
  capacity: number;
  utilizationPercent: number;
  isOverloaded: boolean;
}

interface RoadmapCapacityHeatmapProps {
  initiatives: FullInitiative[];
  teamCapacity?: number; // Hours per month
  onMonthClick?: (month: string, year: number) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const RoadmapCapacityHeatmap: React.FC<RoadmapCapacityHeatmapProps> = ({
  initiatives,
  teamCapacity = 160, // Default: 1 FTE
  onMonthClick,
}) => {
  // Calculate capacity data per month
  const capacityData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const data: CapacityData[] = [];

    // Generate 24 months of data
    for (let i = 0; i < 24; i++) {
      const monthIndex = i % 12;
      const year = currentYear + Math.floor(i / 12);
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0);

      // Count initiatives active in this month
      let initiativeCount = 0;
      let totalEffort = 0;

      initiatives.forEach((init) => {
        const initAsAny = init as any;
        let initStart: Date | null = null;
        let initEnd: Date | null = null;

        // Try to get dates from initiative
        if (initAsAny.plannedStartDate && initAsAny.plannedEndDate) {
          initStart = new Date(initAsAny.plannedStartDate);
          initEnd = new Date(initAsAny.plannedEndDate);
        } else if (initAsAny.quarter) {
          const qIndex = parseInt(initAsAny.quarter.replace('Q', '')) - 1;
          initStart = new Date(currentYear, qIndex * 3, 1);
          initEnd = new Date(currentYear, (qIndex + 1) * 3, 0);
        }

        if (initStart && initEnd) {
          // Check if initiative overlaps with this month
          if (initStart <= monthEnd && initEnd >= monthStart) {
            initiativeCount++;
            // Estimate effort (simplified: 40 hours per initiative per month)
            totalEffort += 40;
          }
        }
      });

      const utilizationPercent = Math.round((totalEffort / teamCapacity) * 100);

      data.push({
        month: MONTHS[monthIndex],
        year,
        initiativeCount,
        totalEffort,
        capacity: teamCapacity,
        utilizationPercent,
        isOverloaded: utilizationPercent > 100,
      });
    }

    return data;
  }, [initiatives, teamCapacity]);

  // Utilization intensity — NON-red sequential scale (§Heatmap): normal load reads as a
  // neutral→emphasis ramp on ONE sequential hue (c-tag-6 sage via opacity), so the map
  // is not alarmist. Only true overallocation (>100%) escalates to c-danger.
  // (c-chart-* sequential tokens pending VA1; using c-tag-6 opacity ramp defensively.)
  const getUtilizationColor = (percent: number): string => {
    if (percent === 0) return 'bg-c-surface-raised';
    if (percent <= 50) return 'bg-c-tag-6/25';
    if (percent <= 75) return 'bg-c-tag-6/50';
    if (percent <= 100) return 'bg-c-tag-6/80';
    if (percent <= 125) return 'bg-c-warning/80';
    return 'bg-c-danger';
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const overloaded = capacityData.filter((d) => d.isOverloaded).length;
    const avgUtilization =
      capacityData.reduce((sum, d) => sum + d.utilizationPercent, 0) / capacityData.length;
    const peakMonth = capacityData.reduce((max, d) =>
      d.utilizationPercent > max.utilizationPercent ? d : max
    );

    return {
      overloadedMonths: overloaded,
      avgUtilization: Math.round(avgUtilization),
      peakMonth,
    };
  }, [capacityData]);

  // Group by year
  const yearGroups = useMemo(() => {
    const groups: { year: number; months: CapacityData[] }[] = [];
    let currentYear = -1;

    capacityData.forEach((d) => {
      if (d.year !== currentYear) {
        currentYear = d.year;
        groups.push({ year: d.year, months: [] });
      }
      groups[groups.length - 1].months.push(d);
    });

    return groups;
  }, [capacityData]);

  return (
    <div className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-c-border-subtle">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-c-text flex items-center gap-2">
            <Users size={18} className="text-c-text-muted" />
            Capacity Overview
          </h3>
          <div className="flex items-center gap-4 text-xs">
            {stats.overloadedMonths > 0 && (
              <div className="flex items-center gap-1 text-c-danger">
                <AlertTriangle size={14} />
                {stats.overloadedMonths} months overloaded
              </div>
            )}
            <div className="flex items-center gap-1 text-c-text-muted">
              <TrendingUp size={14} />
              Avg: {stats.avgUtilization}%
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-4 border-b border-c-border-subtle">
        <div className="text-center">
          <p className="text-xs text-c-text-muted">Team Capacity</p>
          <p className="text-lg font-bold text-c-text">{teamCapacity}h/mo</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-c-text-muted">Avg Utilization</p>
          <p
            className={`text-lg font-bold ${
              stats.avgUtilization > 100 ? 'text-c-danger' : 'text-c-success'
            }`}
          >
            {stats.avgUtilization}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-c-text-muted">Peak Month</p>
          <p className="text-lg font-bold text-c-warning">
            {stats.peakMonth.month} {stats.peakMonth.year}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-c-text-muted">Overloaded</p>
          <p
            className={`text-lg font-bold ${
              stats.overloadedMonths > 0 ? 'text-c-danger' : 'text-c-success'
            }`}
          >
            {stats.overloadedMonths} months
          </p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="p-4">
        {yearGroups.map((group) => (
          <div key={group.year} className="mb-4 last:mb-0">
            <p className="text-xs font-semibold text-c-text-muted mb-2">{group.year}</p>
            <div className="grid grid-cols-12 gap-1">
              {group.months.map((d, idx) => (
                <div
                  key={idx}
                  onClick={() => onMonthClick?.(d.month, d.year)}
                  className={`relative group rounded-md p-2 cursor-pointer transition-all hover:ring-2 hover:ring-c-focus-solid ${getUtilizationColor(
                    d.utilizationPercent
                  )}`}
                >
                  <p className="text-[10px] font-medium text-center text-c-text">{d.month}</p>
                  <p
                    className={`text-xs font-bold text-center ${
                      d.isOverloaded ? 'text-white' : 'text-c-text-secondary'
                    }`}
                  >
                    {d.utilizationPercent}%
                  </p>
                  {d.isOverloaded && (
                    <div className="absolute -top-1 -right-1">
                      <AlertTriangle size={12} className="text-white drop-shadow" />
                    </div>
                  )}

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                    <div className="bg-c-text text-c-surface text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                      <p className="font-semibold">
                        {d.month} {d.year}
                      </p>
                      <p>{d.initiativeCount} initiatives</p>
                      <p>
                        {d.totalEffort}h / {d.capacity}h
                      </p>
                      <p className={d.isOverloaded ? 'text-c-danger' : ''}>
                        {d.utilizationPercent}% utilized
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 bg-c-surface-raised border-t border-c-border-subtle">
        <div className="flex items-center justify-center gap-4 text-xs text-c-text-secondary">
          <span className="text-c-text-muted">Utilization:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-surface-raised border border-c-border-subtle" />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-tag-6/25" />
            <span>1-50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-tag-6/50" />
            <span>51-75%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-tag-6/80" />
            <span>76-100%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-warning/80" />
            <span>101-125%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-c-danger" />
            <span>&gt;125%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoadmapCapacityHeatmap;
