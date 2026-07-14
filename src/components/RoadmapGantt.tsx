/**
 * RoadmapGantt
 *
 * Strategic Roadmap Gantt Chart with:
 * - Drag-and-drop to move initiatives
 * - Resize handles to adjust duration
 * - Dependency visualization (SVG arrows between bars)
 * - Dependency validation (D4.1) — warns about illogical sequences, circular deps
 * - Clean toolbar (D4.2) — zoom, scroll, fullscreen clearly separated
 * - Critical path highlighting (D5.1) — longest chain of dependent tasks
 * - Full-screen mode
 * - Zoom levels (Month/Quarter)
 * - Status indicators
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  GripVertical,
  Link,
  Maximize2,
  MessageSquare,
  Minimize2,
  Route,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { InitiativeStatus } from '../types/core';
import { Initiative } from '../types/domain';
import { StatusTransitionDropdown } from './PMO/StatusTransitionDropdown';

type Quarter = string;

interface FullInitiative extends Initiative {
  axis: string;
  quarter?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  dependencies?: any[];
  name: string;
  readinessPercent?: number;
  missingReadiness?: string[];
  conflictCount?: number;
}

interface RoadmapGanttProps {
  initiatives: FullInitiative[];
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onInitiativeClick?: (initiative: FullInitiative) => void;
  onCreateDependency?: (
    fromId: string,
    toId: string,
    type: 'FINISH_TO_START' | 'START_TO_START'
  ) => void;
  // D4.4: PM perspective check
  onPMPerspectiveCheck?: (initiativeId: string) => void;
  // D4.5: Open contextual chat for an initiative
  onOpenScheduleChat?: (initiativeId: string) => void;
}

interface GanttInitiative extends Omit<FullInitiative, 'status'> {
  status: string;
}

type ZoomLevel = 'month' | 'quarter';

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

// Generate months for the timeline
const generateMonths = (startYear: number, numMonths: number) => {
  const months = [];
  let year = startYear;
  let month = 0;

  for (let i = 0; i < numMonths; i++) {
    months.push({
      index: i,
      month,
      year,
      label: new Date(year, month).toLocaleDateString('pl-PL', { month: 'short' }),
      fullLabel: new Date(year, month).toLocaleDateString('pl-PL', {
        month: 'long',
        year: 'numeric',
      }),
    });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return months;
};

// Axis colors
// Kolory DANYCH (kategoryczne, per oś transformacji) → paleta c-tag-* (§15.1).
// Przypisanie po STABILNYM indeksie (kolejność w mapie). NIGDY crimson jako dana.
// UWAGA §15.1: 7 osi > 5 serii widocznych — łamie limit czytelności; do decyzji Piotra
// o grupowaniu osi (zalogowane w RAPORCIE Fala 4).
const AXIS_COLORS: Record<string, string> = {
  processes: 'bg-c-tag-1',
  digitalProducts: 'bg-c-tag-2',
  dataManagement: 'bg-c-tag-3',
  culture: 'bg-c-tag-4',
  aiMaturity: 'bg-c-tag-5',
  businessModels: 'bg-c-tag-6',
  cybersecurity: 'bg-c-tag-7',
};

// Status colors
const STATUS_COLORS: Record<string, string> = {
  approved: 'border-l-4 border-l-green-500',
  active: 'border-l-4 border-l-c-focus-solid',
  on_hold: 'border-l-4 border-l-danger-500 animate-pulse',
  APPROVED: 'border-l-4 border-l-green-500',
  EXECUTING: 'border-l-4 border-l-c-focus-solid',
  BLOCKED: 'border-l-4 border-l-danger-500 animate-pulse',
};

// ============================================
// D4.1: DEPENDENCY VALIDATION
// ============================================

interface DependencyWarning {
  initiativeId: string;
  type: 'schedule_conflict' | 'circular' | 'missing_predecessor';
  message: string;
  severity: 'warning' | 'error';
}

/**
 * Validates task order and dependencies.
 * Returns warnings for:
 * - Tasks starting before their predecessor ends (schedule conflict)
 * - Circular dependencies
 * - Missing predecessor references
 */
function validateDependencies(initiatives: GanttInitiative[]): DependencyWarning[] {
  const warnings: DependencyWarning[] = [];
  const initMap = new Map<string, GanttInitiative>();
  initiatives.forEach((i) => initMap.set(i.id, i));

  // Check for circular dependencies using DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(id: string, path: string[]): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);

    const init = initMap.get(id);
    if (init?.dependencies) {
      for (const dep of init.dependencies) {
        const depId = typeof dep === 'string' ? dep : dep.initiativeId;
        if (hasCycle(depId, [...path, id])) {
          return true;
        }
      }
    }

    inStack.delete(id);
    return false;
  }

  // Check each initiative
  initiatives.forEach((init) => {
    if (!init.dependencies || init.dependencies.length === 0) return;

    // Check circular
    visited.clear();
    inStack.clear();
    if (hasCycle(init.id, [])) {
      warnings.push({
        initiativeId: init.id,
        type: 'circular',
        message: `Circular dependency detected for "${init.name}"`,
        severity: 'error',
      });
    }

    // Check schedule conflicts
    init.dependencies.forEach((dep: any) => {
      const depId = typeof dep === 'string' ? dep : dep.initiativeId;
      const predecessor = initMap.get(depId);

      if (!predecessor) {
        warnings.push({
          initiativeId: init.id,
          type: 'missing_predecessor',
          message: `Predecessor not found for "${init.name}"`,
          severity: 'warning',
        });
        return;
      }

      // Check if this initiative starts before predecessor ends
      const predEnd = predecessor.plannedEndDate ? new Date(predecessor.plannedEndDate) : null;
      const thisStart = init.plannedStartDate ? new Date(init.plannedStartDate) : null;

      if (predEnd && thisStart && thisStart < predEnd) {
        warnings.push({
          initiativeId: init.id,
          type: 'schedule_conflict',
          message: `"${init.name}" starts before "${predecessor.name}" ends`,
          severity: 'warning',
        });
      }
    });
  });

  return warnings;
}

// ============================================
// D5.1: CRITICAL PATH CALCULATION
// ============================================

/**
 * Computes the critical path — the longest chain of dependent initiatives.
 * Uses topological sort + longest path in DAG.
 */
function computeCriticalPath(initiatives: GanttInitiative[], currentYear: number): Set<string> {
  const initMap = new Map<string, GanttInitiative>();
  initiatives.forEach((i) => initMap.set(i.id, i));

  // Build adjacency list (predecessor -> successors)
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  initiatives.forEach((i) => {
    if (!successors.has(i.id)) successors.set(i.id, []);
    if (!predecessors.has(i.id)) predecessors.set(i.id, []);
  });

  initiatives.forEach((init) => {
    if (init.dependencies) {
      init.dependencies.forEach((dep: any) => {
        const depId = typeof dep === 'string' ? dep : dep.initiativeId;
        if (initMap.has(depId)) {
          const succs = successors.get(depId) || [];
          succs.push(init.id);
          successors.set(depId, succs);

          const preds = predecessors.get(init.id) || [];
          preds.push(depId);
          predecessors.set(init.id, preds);
        }
      });
    }
  });

  // Calculate duration for each initiative in months
  function getDuration(init: GanttInitiative): number {
    if (init.plannedStartDate && init.plannedEndDate) {
      const start = new Date(init.plannedStartDate);
      const end = new Date(init.plannedEndDate);
      return Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000))
      );
    }
    return 3; // default 3 months
  }

  // Longest path using dynamic programming
  const longestTo = new Map<string, number>(); // longest path ending at node
  const pathPrev = new Map<string, string | null>(); // for backtracking

  // Topological order (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  initiatives.forEach((i) => inDegree.set(i.id, (predecessors.get(i.id) || []).length));

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    topoOrder.push(node);
    (successors.get(node) || []).forEach((succ) => {
      const newDeg = (inDegree.get(succ) || 1) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    });
  }

  // Initialize
  topoOrder.forEach((id) => {
    const init = initMap.get(id)!;
    longestTo.set(id, getDuration(init));
    pathPrev.set(id, null);
  });

  // Process in topological order
  topoOrder.forEach((id) => {
    const currentLen = longestTo.get(id) || 0;
    (successors.get(id) || []).forEach((succ) => {
      const succInit = initMap.get(succ)!;
      const newLen = currentLen + getDuration(succInit);
      if (newLen > (longestTo.get(succ) || 0)) {
        longestTo.set(succ, newLen);
        pathPrev.set(succ, id);
      }
    });
  });

  // Find the end of the longest path
  let maxLen = 0;
  let maxEnd = '';
  longestTo.forEach((len, id) => {
    if (len > maxLen) {
      maxLen = len;
      maxEnd = id;
    }
  });

  // Backtrack to get the full critical path
  const criticalPathIds = new Set<string>();
  if (maxEnd && maxLen > 0) {
    let current: string | null = maxEnd;
    while (current) {
      criticalPathIds.add(current);
      current = pathPrev.get(current) || null;
    }
  }

  return criticalPathIds;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const RoadmapGantt: React.FC<RoadmapGanttProps> = ({
  initiatives,
  onUpdateInitiative,
  onInitiativeClick,
  onCreateDependency,
  onPMPerspectiveCheck,
  onOpenScheduleChat,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const timelineRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('quarter');
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ id: string; edge: 'start' | 'end' } | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hoveredInitiative, setHoveredInitiative] = useState<string | null>(null);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  // Timeline configuration
  const currentYear = new Date().getFullYear();
  const months = useMemo(() => generateMonths(currentYear, 24), [currentYear]);

  // Cell width based on zoom
  const cellWidth = useMemo(() => {
    return zoomLevel === 'month' ? 100 : 300;
  }, [zoomLevel]);

  // D4.1: Dependency validation
  const dependencyWarnings = useMemo(
    () => validateDependencies(initiatives as GanttInitiative[]),
    [initiatives]
  );

  const warningsByInitiative = useMemo(() => {
    const map = new Map<string, DependencyWarning[]>();
    dependencyWarnings.forEach((w) => {
      const existing = map.get(w.initiativeId) || [];
      existing.push(w);
      map.set(w.initiativeId, existing);
    });
    return map;
  }, [dependencyWarnings]);

  // D5.1: Critical path
  const criticalPathIds = useMemo(
    () => computeCriticalPath(initiatives as GanttInitiative[], currentYear),
    [initiatives, currentYear]
  );

  // Calculate positions based on dates or quarters
  const getInitiativePosition = useCallback(
    (init: GanttInitiative) => {
      if (init.plannedStartDate && init.plannedEndDate) {
        const startDate = new Date(init.plannedStartDate);
        const endDate = new Date(init.plannedEndDate);
        const startMonth = (startDate.getFullYear() - currentYear) * 12 + startDate.getMonth();
        const endMonth = (endDate.getFullYear() - currentYear) * 12 + endDate.getMonth();

        const monthWidth = zoomLevel === 'month' ? cellWidth : cellWidth / 3;
        return {
          left: startMonth * monthWidth,
          width: Math.max((endMonth - startMonth + 1) * monthWidth, monthWidth),
        };
      }

      const quarterIndex = QUARTERS.indexOf(init.quarter || 'Q1');
      const monthIndex = quarterIndex * 3;
      const monthWidth = zoomLevel === 'month' ? cellWidth : cellWidth / 3;

      return {
        left: monthIndex * monthWidth,
        width: monthWidth * 3,
      };
    },
    [cellWidth, currentYear, zoomLevel]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (init: GanttInitiative, info: any) => {
      setActiveDrag(null);
      if (!timelineRef.current) return;

      const monthWidth = zoomLevel === 'month' ? cellWidth : cellWidth / 3;
      const monthsMoved = Math.round(info.offset.x / monthWidth);

      if (monthsMoved === 0) return;

      const currentStart = init.plannedStartDate
        ? new Date(init.plannedStartDate)
        : new Date(currentYear, QUARTERS.indexOf(init.quarter || 'Q1') * 3, 1);
      const currentEnd = init.plannedEndDate
        ? new Date(init.plannedEndDate)
        : new Date(currentStart.getTime() + 90 * 24 * 60 * 60 * 1000);

      currentStart.setMonth(currentStart.getMonth() + monthsMoved);
      currentEnd.setMonth(currentEnd.getMonth() + monthsMoved);

      onUpdateInitiative({
        ...(init as any),
        ...init,
        plannedStartDate: currentStart.toISOString(),
        plannedEndDate: currentEnd.toISOString(),
      });

      toast.success(t('roadmap.toast.initiativeMoved', 'Inicjatywa przeniesiona'));
    },
    [cellWidth, currentYear, onUpdateInitiative, zoomLevel]
  );

  // Handle resize
  const handleResize = useCallback(
    (init: GanttInitiative, deltaX: number, edge: 'start' | 'end') => {
      const monthWidth = zoomLevel === 'month' ? cellWidth : cellWidth / 3;
      const monthsDelta = Math.round(deltaX / monthWidth);
      if (monthsDelta === 0) return;

      const currentStart = init.plannedStartDate
        ? new Date(init.plannedStartDate)
        : new Date(currentYear, QUARTERS.indexOf(init.quarter || 'Q1') * 3, 1);
      const currentEnd = init.plannedEndDate
        ? new Date(init.plannedEndDate)
        : new Date(currentStart.getTime() + 90 * 24 * 60 * 60 * 1000);

      if (edge === 'start') {
        currentStart.setMonth(currentStart.getMonth() + monthsDelta);
        if (currentStart >= currentEnd) return;
      } else {
        currentEnd.setMonth(currentEnd.getMonth() + monthsDelta);
        if (currentEnd <= currentStart) return;
      }

      onUpdateInitiative({
        ...(init as any),
        ...init,
        plannedStartDate: currentStart.toISOString(),
        plannedEndDate: currentEnd.toISOString(),
      });
    },
    [cellWidth, currentYear, onUpdateInitiative, zoomLevel]
  );

  // Handle dependency creation
  const handleLinkClick = useCallback(
    (initiativeId: string) => {
      if (!linkingFrom) {
        setLinkingFrom(initiativeId);
        toast(
          t(
            'roadmap.toast.clickToCreateDependency',
            'Kliknij inną inicjatywę, aby utworzyć zależność'
          ),
          { icon: '🔗' }
        );
      } else if (linkingFrom !== initiativeId) {
        onCreateDependency?.(linkingFrom, initiativeId, 'FINISH_TO_START');
        setLinkingFrom(null);
        toast.success(t('roadmap.toast.dependencyCreated', 'Zależność utworzona'));
      } else {
        setLinkingFrom(null);
      }
    },
    [linkingFrom, onCreateDependency]
  );

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Scroll handlers
  const scrollLeft = () => setScrollOffset((prev) => Math.max(0, prev - cellWidth * 3));
  const scrollRight = () => setScrollOffset((prev) => prev + cellWidth * 3);

  // Group by timeline columns
  const timelineGroups = useMemo(() => {
    if (zoomLevel === 'month') {
      return months;
    }
    const quarters = [];
    for (let i = 0; i < months.length; i += 3) {
      const q = (Math.floor(i / 3) % 4) + 1;
      const year = months[i].year;
      quarters.push({
        index: i / 3,
        label: `Q${q}`,
        fullLabel: `Q${q} ${year}`,
        width: cellWidth,
      });
    }
    return quarters;
  }, [months, zoomLevel, cellWidth]);

  // Row index map for dependency arrows
  const initiativeRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    initiatives.forEach((init, idx) => map.set(init.id, idx));
    return map;
  }, [initiatives]);

  // Compute dependency lines for SVG overlay
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isConflict: boolean;
      isCritical: boolean;
    }> = [];

    const ROW_HEIGHT = 80; // matches h-20

    initiatives.forEach((init) => {
      if (!init.dependencies || init.dependencies.length === 0) return;
      const toPos = getInitiativePosition(init as GanttInitiative);
      const toRowIdx = initiativeRowIndex.get(init.id);
      if (toRowIdx === undefined) return;

      init.dependencies.forEach((dep: any) => {
        const depId = typeof dep === 'string' ? dep : dep.initiativeId;
        const depInit = initiatives.find((i) => i.id === depId);
        if (!depInit) return;

        const fromPos = getInitiativePosition(depInit as GanttInitiative);
        const fromRowIdx = initiativeRowIndex.get(depId);
        if (fromRowIdx === undefined) return;

        const hasConflict = warningsByInitiative
          .get(init.id)
          ?.some((w) => w.type === 'schedule_conflict');
        const isCritical =
          showCriticalPath && criticalPathIds.has(init.id) && criticalPathIds.has(depId);

        lines.push({
          fromId: depId,
          toId: init.id,
          x1: fromPos.left + fromPos.width - scrollOffset,
          y1: fromRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          x2: toPos.left - scrollOffset,
          y2: toRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          isConflict: !!hasConflict,
          isCritical,
        });
      });
    });

    return lines;
  }, [
    initiatives,
    getInitiativePosition,
    initiativeRowIndex,
    scrollOffset,
    warningsByInitiative,
    showCriticalPath,
    criticalPathIds,
  ]);

  return (
    <div
      className={`flex flex-col bg-c-bg rounded-xl border border-c-border overflow-hidden shadow-sm ${
        isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
      }`}
    >
      {/* ============================
          D4.2: CLEAN TOOLBAR
          ============================ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-c-surface border-b border-c-border">
        {/* Left: Title & count */}
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-c-text">Strategic Roadmap</h3>
          <span className="text-xs text-c-text-muted bg-c-surface-raised px-2 py-0.5 rounded-full">
            {initiatives.length} initiatives
          </span>
          {dependencyWarnings.length > 0 && showWarnings && (
            <button
              onClick={() => setShowWarnings((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
              title="Dependency warnings"
            >
              <AlertTriangle size={12} />
              {dependencyWarnings.length} warning{dependencyWarnings.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {/* Right: Controls — clearly separated groups */}
        <div className="flex items-center gap-3">
          {/* Group 1: Zoom */}
          <div className="flex items-center bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] p-0.5">
            <button
              onClick={() => setZoomLevel('month')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                zoomLevel === 'month'
                  ? 'bg-c-text text-c-bg shadow-sm'
                  : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setZoomLevel('quarter')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                zoomLevel === 'quarter'
                  ? 'bg-c-text text-c-bg shadow-sm'
                  : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              Quarter
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-c-border" />

          {/* Group 2: Navigation */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={scrollLeft}
              className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={scrollRight}
              className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-c-border" />

          {/* Group 3: View toggles */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowCriticalPath((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showCriticalPath
                  ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400'
                  : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
              }`}
              title={showCriticalPath ? 'Hide critical path' : 'Show critical path'}
            >
              <Route size={16} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* D4.1: Warning banner */}
      {showWarnings && dependencyWarnings.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-l-4 border-l-amber-500 bg-amber-100 dark:bg-amber-900/10 border-b border-amber-300/50 dark:border-amber-800/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">
                Schedule Warnings
              </p>
              <div className="space-y-0.5">
                {dependencyWarnings.slice(0, 3).map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400 truncate">
                    {w.severity === 'error' ? '⛔' : '⚠️'} {w.message}
                  </p>
                ))}
                {dependencyWarnings.length > 3 && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    +{dependencyWarnings.length - 3} more warnings
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowWarnings(false)}
              className="p-0.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header Row */}
      <div className="flex border-b border-c-border bg-c-surface">
        <div className="w-72 min-w-[288px] p-3 font-bold text-xs uppercase text-c-text-muted border-r border-c-border shrink-0">
          Initiative
        </div>
        <div
          className="flex-1 overflow-hidden"
          style={{ transform: `translateX(-${scrollOffset}px)` }}
        >
          <div className="flex" style={{ width: timelineGroups.length * cellWidth }}>
            {timelineGroups.map((group: any, idx) => (
              <div
                key={idx}
                className="border-r border-c-border last:border-r-0 p-2 text-center"
                style={{ width: cellWidth }}
              >
                <span className="font-bold text-xs text-c-text-muted whitespace-nowrap">
                  {group.fullLabel || group.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto relative">
        {initiatives.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-c-text-muted">
            <div className="text-center">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No approved initiatives on roadmap</p>
              <p className="text-sm">Approve initiatives to add them here</p>
            </div>
          </div>
        ) : (
          <>
            {/* D5.1: SVG overlay for dependency arrows */}
            <svg
              ref={svgRef}
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                left: 288, // w-72 offset
                width: `calc(100% - 288px)`,
                height: initiatives.length * 80,
              }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--c-border-strong)" />
                </marker>
                <marker
                  id="arrowhead-warning"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--c-warning)" />
                </marker>
                <marker
                  id="arrowhead-critical"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--c-danger)" />
                </marker>
              </defs>
              {dependencyLines.map((line, idx) => {
                const isSameRow = line.y1 === line.y2;
                const midX = (line.x1 + line.x2) / 2;
                const curveOffset = isSameRow ? 0 : (line.y2 - line.y1) * 0.3;

                const stroke = line.isCritical
                  ? 'var(--c-danger)'
                  : line.isConflict
                    ? 'var(--c-warning)'
                    : 'var(--c-border-strong)';
                const marker = line.isCritical
                  ? 'url(#arrowhead-critical)'
                  : line.isConflict
                    ? 'url(#arrowhead-warning)'
                    : 'url(#arrowhead)';
                const strokeWidth = line.isCritical ? 2.5 : 1.5;
                const dashArray = line.isConflict ? '6 3' : 'none';

                return (
                  <path
                    key={idx}
                    d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1 + curveOffset}, ${midX} ${line.y2 - curveOffset}, ${line.x2} ${line.y2}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    markerEnd={marker}
                    opacity={0.7}
                  />
                );
              })}
            </svg>

            {/* Initiative rows */}
            {initiatives.map((init: GanttInitiative) => {
              const position = getInitiativePosition(init);
              const barColor = AXIS_COLORS[init.axis] || 'bg-c-text-muted';
              const statusBorder = STATUS_COLORS[init.status || ''] || '';
              const isActive = activeDrag === init.id || hoveredInitiative === init.id;
              const isLinking = linkingFrom === init.id;
              const isCritical = showCriticalPath && criticalPathIds.has(init.id);
              const warnings = warningsByInitiative.get(init.id) || [];
              const hasWarning = warnings.length > 0;

              return (
                <div
                  key={init.id}
                  className={`flex border-b border-c-border group hover:bg-c-surface-raised transition-colors ${
                    isLinking ? 'bg-c-accent-soft' : ''
                  } ${isCritical ? 'bg-danger-50/50 dark:bg-danger-900/5' : ''}`}
                >
                  {/* Info Column */}
                  <div
                    className="w-72 min-w-[288px] p-3 text-sm border-r border-c-border z-10 bg-inherit relative shrink-0 cursor-pointer hover:bg-c-surface-raised"
                    onClick={() => onInitiativeClick?.(init as FullInitiative)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${barColor} shrink-0`} />
                      {/* D4.1: Warning indicator */}
                      {hasWarning && (
                        <div className="shrink-0" title={warnings.map((w) => w.message).join('\n')}>
                          <AlertTriangle
                            size={12}
                            className={
                              warnings.some((w) => w.severity === 'error')
                                ? 'text-danger-500'
                                : 'text-amber-500'
                            }
                          />
                        </div>
                      )}
                      {/* D5.1: Critical path indicator */}
                      {isCritical && (
                        <div className="shrink-0" title="On critical path">
                          <Route size={12} className="text-danger-500" />
                        </div>
                      )}
                      <div className="font-semibold text-c-text truncate flex-1" title={init.name}>
                        {init.name}
                      </div>
                      {onCreateDependency && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLinkClick(init.id);
                          }}
                          className={`p-1 rounded transition-colors shrink-0 ${
                            isLinking
                              ? 'bg-c-text text-c-bg'
                              : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
                          }`}
                          title="Create dependency"
                        >
                          <Link size={12} />
                        </button>
                      )}
                      {/* D4.4: PM perspective check */}
                      {onPMPerspectiveCheck && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPMPerspectiveCheck(init.id);
                          }}
                          className="p-1 rounded text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title="PM Perspective Check"
                        >
                          <Eye size={12} />
                        </button>
                      )}
                      {/* D4.5: Open chat for this initiative */}
                      {onOpenScheduleChat && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenScheduleChat(init.id);
                          }}
                          className="p-1 rounded text-c-text-muted hover:text-c-text hover:bg-c-surface-raised transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                          title="Chat about this initiative"
                        >
                          <MessageSquare size={12} />
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-c-text-muted mt-1 flex items-center gap-2">
                      <span className="capitalize">{init.axis}</span>
                      <span>•</span>
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          init.priority === 'high' || init.priority === 'critical'
                            ? 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400'
                            : 'bg-c-surface-raised text-c-text-muted'
                        }`}
                      >
                        {init.priority}
                      </span>
                      {typeof init.readinessPercent === 'number' && (
                        <>
                          <span>•</span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              init.readinessPercent >= 80
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : init.readinessPercent >= 50
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                            }`}
                            title={
                              init.missingReadiness?.length
                                ? `Missing: ${init.missingReadiness.join(', ')}`
                                : 'Readiness'
                            }
                          >
                            {init.readinessPercent}%
                          </span>
                        </>
                      )}
                      {!!init.conflictCount && init.conflictCount > 0 && (
                        <>
                          <span>•</span>
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300"
                            title="Conflicts detected"
                          >
                            <AlertTriangle size={10} className="text-danger-500" />
                            {init.conflictCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timeline Container */}
                  <div
                    ref={(el) => {
                      if (init.id === initiatives[0]?.id) timelineRef.current = el as any;
                    }}
                    className="flex-1 relative h-20 overflow-hidden"
                    style={{ transform: `translateX(-${scrollOffset}px)` }}
                  >
                    {/* Background Grid Lines */}
                    <div
                      className="absolute inset-0 flex pointer-events-none"
                      style={{ width: timelineGroups.length * cellWidth }}
                    >
                      {timelineGroups.map((_: any, idx: number) => (
                        <div
                          key={idx}
                          className="border-r border-c-border-subtle last:border-r-0"
                          style={{ width: cellWidth }}
                        />
                      ))}
                    </div>

                    {/* Draggable Bar */}
                    <motion.div
                      drag="x"
                      dragMomentum={false}
                      dragElastic={0}
                      dragConstraints={{
                        left: 0,
                        right: timelineGroups.length * cellWidth - position.width,
                      }}
                      style={{
                        position: 'absolute',
                        left: position.left,
                        width: position.width,
                        top: '20%',
                        bottom: '20%',
                        zIndex: isActive ? 50 : 10,
                      }}
                      onDragStart={() => setActiveDrag(init.id)}
                      onDragEnd={(e, info) => handleDragEnd(init, info)}
                      onHoverStart={() => setHoveredInitiative(init.id)}
                      onHoverEnd={() => setHoveredInitiative(null)}
                      className={`rounded-lg shadow-md cursor-grab active:cursor-grabbing flex items-center text-white ${barColor} ${statusBorder} text-xs font-medium overflow-hidden ${
                        isActive ? 'ring-2 ring-white ring-offset-2' : ''
                      } ${isCritical ? 'ring-2 ring-danger-500 ring-offset-1' : ''} ${
                        hasWarning ? 'ring-1 ring-amber-400' : ''
                      }`}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      {/* D4.1: Warning badge on bar */}
                      {hasWarning && (
                        <div
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center z-20"
                          title={warnings.map((w) => w.message).join('\n')}
                        >
                          <AlertTriangle size={10} className="text-white" />
                        </div>
                      )}

                      {!!init.conflictCount && init.conflictCount > 0 && !hasWarning && (
                        <div className="absolute right-2 top-2 w-5 h-5 rounded-full bg-black/25 flex items-center justify-center text-[10px] font-bold">
                          {init.conflictCount}
                        </div>
                      )}

                      {/* Resize Handle Start */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizing({ id: init.id, edge: 'start' });
                        }}
                      >
                        <div className="w-0.5 h-4 bg-white/60 rounded" />
                      </div>

                      {/* Content */}
                      <div className="flex items-center gap-1 px-3 flex-1 min-w-0">
                        <GripVertical size={12} className="opacity-50 shrink-0" />
                        <span className="truncate">{init.name}</span>
                      </div>

                      {/* Resize Handle End */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizing({ id: init.id, edge: 'end' });
                        }}
                      >
                        <div className="w-0.5 h-4 bg-white/60 rounded" />
                      </div>
                    </motion.div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer with legend */}
      <div className="shrink-0 px-4 py-2 bg-c-surface border-t border-c-border flex items-center gap-4 text-xs text-c-text-muted flex-wrap">
        <span className="font-medium">Legend:</span>
        {Object.entries(AXIS_COLORS)
          .slice(0, 5)
          .map(([axis, color]) => (
            <div key={axis} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="capitalize">{axis.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
          ))}
        {showCriticalPath && (
          <>
            <div className="w-px h-3 bg-c-border-strong" />
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded ring-2 ring-danger-500 bg-danger-500/20" />
              <span>Critical Path</span>
            </div>
          </>
        )}
        {dependencyWarnings.length > 0 && (
          <>
            <div className="w-px h-3 bg-c-border-strong" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-500" />
              <span>Schedule Warning</span>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/50 -z-10" onClick={toggleFullscreen} />
      )}
    </div>
  );
};

export default RoadmapGantt;
