/**
 * Portfolio Timeline View
 *
 * Quarterly timeline/Gantt-style view with dependencies.
 */

import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  getAxisColor,
  getPriorityColors,
  getStatusColors,
  TIMELINE_COLORS,
} from '../../config/portfolioColors';
import { Api } from '../../services/api';
import { PortfolioInitiative } from '../../types';

interface PortfolioTimelineViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  projectId?: string;
}

interface RoadmapWave {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  sortOrder: number;
  status: string;
}

interface Dependency {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: string;
  isSatisfied: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getQuarterInfo = (date: Date) => {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return { quarter, year: date.getFullYear() };
};

const getQuarterStart = (year: number, quarter: number) => {
  return new Date(year, (quarter - 1) * 3, 1);
};

const getQuarterEnd = (year: number, quarter: number) => {
  return new Date(year, quarter * 3, 0);
};

const generateQuarters = (startYear: number, numQuarters: number = 8) => {
  const quarters: { year: number; quarter: number; label: string }[] = [];
  let year = startYear;
  let quarter = 1;

  for (let i = 0; i < numQuarters; i++) {
    quarters.push({
      year,
      quarter,
      label: `Q${quarter} ${year}`,
    });
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }

  return quarters;
};

// ============================================
// TIMELINE BAR COMPONENT
// ============================================

interface TimelineBarProps {
  initiative: PortfolioInitiative;
  startCol: number;
  endCol: number;
  onClick: () => void;
}

const TimelineBar: React.FC<TimelineBarProps> = ({ initiative, startCol, endCol, onClick }) => {
  const statusColors = getStatusColors(initiative.status);
  const axisColor = getAxisColor(initiative.axis);
  const span = Math.max(1, endCol - startCol + 1);

  return (
    <div
      onClick={onClick}
      className={`
                absolute top-2 h-10 rounded-lg cursor-pointer group
                transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10
                ${statusColors.bg} ${statusColors.bgDark}
                border ${statusColors.border} ${statusColors.borderDark}
            `}
      style={{
        left: `calc(${startCol} * 12.5% + 4px)`,
        width: `calc(${span} * 12.5% - 8px)`,
      }}
    >
      {/* Progress overlay — neutral tint (crimson never = data/progress §14.2) */}
      <div
        className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-lg"
        style={{ width: `${initiative.progress}%` }}
      />

      {/* Content */}
      <div className="relative h-full flex items-center gap-2 px-3 overflow-hidden">
        {/* Axis color bar */}
        <div className={`w-1 h-6 rounded-full shrink-0 ${axisColor}`} />

        {/* Name */}
        <span
          className={`text-sm font-medium truncate ${statusColors.text} ${statusColors.textDark}`}
        >
          {initiative.name}
        </span>

        {/* Priority indicator */}
        {initiative.priority === 'CRITICAL' && (
          <AlertTriangle size={14} className="shrink-0 text-danger-500" />
        )}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-c-surface text-c-text text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 shadow-xl border border-c-border">
        <div className="font-medium mb-1">{initiative.name}</div>
        <div className="text-c-text-muted">
          {initiative.targetQuarter || 'No timeline'} • {initiative.progress}% complete
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN TIMELINE VIEW
// ============================================

export const PortfolioTimelineView: React.FC<PortfolioTimelineViewProps> = ({
  initiatives,
  onInitiativeClick,
  projectId,
}) => {
  const [waves, setWaves] = useState<RoadmapWave[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [zoom, setZoom] = useState(1); // 1 = 8 quarters, 2 = 4 quarters
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch waves and dependencies
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (projectId) {
          const wavesRes = await Api.get(`/initiatives/portfolio/waves/${projectId}`);
          setWaves(wavesRes.waves || []);
        }

        const depsRes = await Api.get(
          '/initiatives/portfolio/dependencies' + (projectId ? `?projectId=${projectId}` : '')
        );
        setDependencies(depsRes.dependencies || []);
      } catch (error) {
        console.error('[TimelineView] Fetch error:', error);
      }
    };
    fetchData();
  }, [projectId]);

  // Generate quarters to display
  const quarters = useMemo(() => {
    const numQuarters = zoom === 2 ? 4 : 8;
    return generateQuarters(startYear, numQuarters);
  }, [startYear, zoom]);

  // Parse quarter string (e.g., "Q2 2025") to index
  const getQuarterIndex = (quarterStr: string | undefined): number => {
    if (!quarterStr) return -1;
    const match = quarterStr.match(/Q(\d)\s*(\d{4})/);
    if (!match) return -1;

    const q = parseInt(match[1]);
    const y = parseInt(match[2]);

    return quarters.findIndex((qtr) => qtr.quarter === q && qtr.year === y);
  };

  // Group initiatives by row (for non-overlapping display)
  const initiativeRows = useMemo(() => {
    const rows: PortfolioInitiative[][] = [];

    const sortedInitiatives = [...initiatives].sort((a, b) => {
      const aIdx = getQuarterIndex(a.targetQuarter);
      const bIdx = getQuarterIndex(b.targetQuarter);
      return aIdx - bIdx;
    });

    sortedInitiatives.forEach((initiative) => {
      const startIdx = getQuarterIndex(initiative.targetQuarter);
      if (startIdx === -1) return;

      // Find a row where this initiative doesn't overlap
      let placed = false;
      for (const row of rows) {
        const overlaps = row.some((existing) => {
          const existingStart = getQuarterIndex(existing.targetQuarter);
          return startIdx === existingStart;
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
  }, [initiatives, quarters]);

  // Today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    const { quarter, year } = getQuarterInfo(today);
    const idx = quarters.findIndex((q) => q.quarter === quarter && q.year === year);
    if (idx === -1) return null;

    // Calculate position within the quarter
    const quarterStart = getQuarterStart(year, quarter);
    const quarterEnd = getQuarterEnd(year, quarter);
    const totalDays = (quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24);
    const daysPassed = (today.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24);
    const withinQuarter = daysPassed / totalDays;

    return ((idx + withinQuarter) / quarters.length) * 100;
  }, [quarters]);

  const navigateTimeline = (direction: 'prev' | 'next') => {
    setStartYear((prev) => (direction === 'prev' ? prev - 1 : prev + 1));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Timeline Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-c-border bg-c-bg">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTimeline('prev')}
            className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-c-text min-w-[80px] text-center">
            {startYear}
          </span>
          <button
            onClick={() => navigateTimeline('next')}
            className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-c-surface rounded-lg p-1 border border-c-border">
          <button
            onClick={() => setZoom(1)}
            className={`px-3 py-1 text-xs font-medium rounded ${zoom === 1 ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
          >
            8 Quarters
          </button>
          <button
            onClick={() => setZoom(2)}
            className={`px-3 py-1 text-xs font-medium rounded ${zoom === 2 ? 'bg-c-surface-raised text-c-text' : 'text-c-text-muted'}`}
          >
            4 Quarters
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          {/* Quarter Headers */}
          <div className="sticky top-0 z-10 flex bg-c-surface border-b border-c-border">
            {quarters.map((q, idx) => (
              <div
                key={`${q.year}-${q.quarter}`}
                className="flex-1 px-4 py-3 text-center border-r border-c-border last:border-r-0"
              >
                <div className="text-sm font-semibold text-c-text">
                  Q{q.quarter}
                </div>
                <div className="text-xs text-c-text-muted">{q.year}</div>
              </div>
            ))}
          </div>

          {/* Rows */}
          <div className="relative">
            {/* Today marker */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-c-accent z-20"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-c-accent text-white text-[10px] font-medium rounded">
                  Today
                </div>
              </div>
            )}

            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {quarters.map((q, idx) => (
                <div
                  key={`grid-${q.year}-${q.quarter}`}
                  className="flex-1 border-r border-c-border-subtle last:border-r-0"
                />
              ))}
            </div>

            {/* Initiative rows */}
            {initiativeRows.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-c-text-muted">
                <div className="text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No initiatives with timeline data</p>
                </div>
              </div>
            ) : (
              initiativeRows.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className="relative h-14 border-b border-c-border-subtle"
                >
                  {row.map((initiative) => {
                    const startIdx = getQuarterIndex(initiative.targetQuarter);
                    if (startIdx === -1) return null;

                    // Default span of 1 quarter
                    const endIdx = startIdx;

                    return (
                      <TimelineBar
                        key={initiative.id}
                        initiative={initiative}
                        startCol={startIdx}
                        endCol={endIdx}
                        onClick={() => onInitiativeClick(initiative)}
                      />
                    );
                  })}
                </div>
              ))
            )}

            {/* Empty state padding */}
            {initiativeRows.length > 0 && initiativeRows.length < 5 && (
              <div style={{ height: `${(5 - initiativeRows.length) * 56}px` }} />
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-c-border bg-c-bg text-xs text-c-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-c-accent" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-danger-500" />
          <span>Critical Path</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowRight size={12} />
          <span>Dependency</span>
        </div>
      </div>
    </div>
  );
};

export default PortfolioTimelineView;
