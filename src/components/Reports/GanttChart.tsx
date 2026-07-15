/**
 * GanttChart
 *
 * Interactive timeline visualization for transformation roadmap:
 * - Q1-Q4 quarters, expandable to months
 * - Phase duration bars with milestones
 * - Dependencies (SVG connecting lines with arrowheads)
 * - Dependency validation (D4.1) — warns about illogical sequences
 * - Critical path highlighting (D5.1) — longest chain of dependent phases
 * - Clean toolbar (D4.2) — zoom controls clearly separated
 * - Zoom levels: Month/Quarter/Year
 */

import { motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Flag,
  MessageSquare,
  Route,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Phase {
  id: string;
  name: string;
  namePl: string;
  startMonth: number; // 1-24 (2 years)
  duration: number; // in months
  color: string;
  status?: 'completed' | 'in_progress' | 'pending' | 'at_risk';
  milestones?: Array<{
    month: number;
    label: string;
    labelPl: string;
  }>;
  dependencies?: string[]; // IDs of phases this depends on
}

interface GanttChartProps {
  phases?: Phase[];
  startYear?: number;
  className?: string;
  /** D4.2: Callback to ask AI about schedule sensibility */
  onAskScheduleSensibility?: () => void;
  /** D4.4: Callback for PM perspective schedule verification */
  onPMPerspectiveCheck?: () => void;
  /** D4.5: Callback to open chat in schedule context */
  onOpenScheduleChat?: () => void;
}

// No default phases — component requires real data from parent
const DEFAULT_PHASES: Phase[] = [];

// Status icons and colors — semantic status → design tokens (theme-aware,
// non-crimson). completed=success, in_progress=info, pending=muted, at_risk=danger.
const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle,
    color: 'var(--c-success)',
    label: 'Completed',
    labelPl: 'Zakończone',
  },
  in_progress: {
    icon: Clock,
    color: 'var(--c-info)',
    label: 'In Progress',
    labelPl: 'W trakcie',
  },
  pending: {
    icon: Clock,
    color: 'var(--c-text-muted)',
    label: 'Pending',
    labelPl: 'Oczekujące',
  },
  at_risk: {
    icon: AlertCircle,
    color: 'var(--c-danger)',
    label: 'At Risk',
    labelPl: 'Zagrożone',
  },
};

// ============================================
// D4.1: DEPENDENCY VALIDATION
// ============================================

interface ScheduleWarning {
  phaseId: string;
  type: 'schedule_conflict' | 'circular';
  message: string;
}

function validatePhaseSchedule(phases: Phase[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const phaseMap = new Map<string, Phase>();
  phases.forEach((p) => phaseMap.set(p.id, p));

  // Check circular dependencies
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function hasCycle(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    inStack.add(id);
    const phase = phaseMap.get(id);
    if (phase?.dependencies) {
      for (const depId of phase.dependencies) {
        if (hasCycle(depId)) return true;
      }
    }
    inStack.delete(id);
    return false;
  }

  phases.forEach((phase) => {
    if (!phase.dependencies || phase.dependencies.length === 0) return;

    // Check circular
    visited.clear();
    inStack.clear();
    if (hasCycle(phase.id)) {
      warnings.push({
        phaseId: phase.id,
        type: 'circular',
        message: `Circular dependency in "${phase.name}"`,
      });
    }

    // Check schedule conflicts
    phase.dependencies.forEach((depId) => {
      const predecessor = phaseMap.get(depId);
      if (!predecessor) return;

      const predEnd = predecessor.startMonth + predecessor.duration;
      if (phase.startMonth < predEnd) {
        warnings.push({
          phaseId: phase.id,
          type: 'schedule_conflict',
          message: `"${phase.name}" starts before "${predecessor.name}" ends (month ${phase.startMonth} < ${predEnd})`,
        });
      }
    });
  });

  return warnings;
}

// ============================================
// D5.1: CRITICAL PATH
// ============================================

function computePhaseCriticalPath(phases: Phase[]): Set<string> {
  const phaseMap = new Map<string, Phase>();
  phases.forEach((p) => phaseMap.set(p.id, p));

  // Build adjacency
  const successors = new Map<string, string[]>();
  phases.forEach((p) => successors.set(p.id, []));

  phases.forEach((phase) => {
    phase.dependencies?.forEach((depId) => {
      if (phaseMap.has(depId)) {
        successors.get(depId)!.push(phase.id);
      }
    });
  });

  // Longest path via DP
  const longestTo = new Map<string, number>();
  const pathPrev = new Map<string, string | null>();

  // Topological order
  const inDegree = new Map<string, number>();
  phases.forEach((p) =>
    inDegree.set(p.id, (p.dependencies || []).filter((d) => phaseMap.has(d)).length)
  );

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

  topoOrder.forEach((id) => {
    longestTo.set(id, phaseMap.get(id)!.duration);
    pathPrev.set(id, null);
  });

  topoOrder.forEach((id) => {
    const currentLen = longestTo.get(id) || 0;
    (successors.get(id) || []).forEach((succ) => {
      const newLen = currentLen + phaseMap.get(succ)!.duration;
      if (newLen > (longestTo.get(succ) || 0)) {
        longestTo.set(succ, newLen);
        pathPrev.set(succ, id);
      }
    });
  });

  let maxLen = 0;
  let maxEnd = '';
  longestTo.forEach((len, id) => {
    if (len > maxLen) {
      maxLen = len;
      maxEnd = id;
    }
  });

  const criticalIds = new Set<string>();
  let current: string | null = maxEnd;
  while (current) {
    criticalIds.add(current);
    current = pathPrev.get(current) || null;
  }

  return criticalIds;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const GanttChart: React.FC<GanttChartProps> = ({
  phases = DEFAULT_PHASES,
  startYear = new Date().getFullYear(),
  className = '',
  onAskScheduleSensibility,
  onPMPerspectiveCheck,
  onOpenScheduleChat,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [zoom, setZoom] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showWarnings, setShowWarnings] = useState(true);

  // D4.1: Validation
  const scheduleWarnings = useMemo(() => validatePhaseSchedule(phases), [phases]);
  const warningsByPhase = useMemo(() => {
    const map = new Map<string, ScheduleWarning[]>();
    scheduleWarnings.forEach((w) => {
      const existing = map.get(w.phaseId) || [];
      existing.push(w);
      map.set(w.phaseId, existing);
    });
    return map;
  }, [scheduleWarnings]);

  // D5.1: Critical path
  const criticalPathIds = useMemo(() => computePhaseCriticalPath(phases), [phases]);

  // Calculate timeline range
  const maxMonth =
    phases.length > 0 ? Math.max(...phases.map((p) => p.startMonth + p.duration)) : 12;
  const totalMonths = Math.ceil(maxMonth / 12) * 12;

  // Generate timeline headers
  const timelineHeaders = useMemo(() => {
    const headers: Array<{ label: string; span: number; key: string }> = [];

    if (zoom === 'month') {
      const monthNames = t('reports.ganttChart.monthNamesShort', {
        returnObjects: true,
      }) as string[];
      for (let m = 1; m <= totalMonths; m++) {
        const year = startYear + Math.floor((m - 1) / 12);
        const monthIndex = (m - 1) % 12;
        headers.push({
          label: `${monthNames[monthIndex]} ${year}`,
          span: 1,
          key: `m${m}`,
        });
      }
    } else if (zoom === 'quarter') {
      for (let q = 0; q < totalMonths / 3; q++) {
        const year = startYear + Math.floor(q / 4);
        const quarter = (q % 4) + 1;
        headers.push({
          label: `Q${quarter} ${year}`,
          span: 3,
          key: `q${q}`,
        });
      }
    } else {
      for (let y = 0; y < totalMonths / 12; y++) {
        headers.push({
          label: `${startYear + y}`,
          span: 12,
          key: `y${y}`,
        });
      }
    }

    return headers;
  }, [zoom, totalMonths, startYear, t]);

  // Cell width based on zoom
  const cellWidth = zoom === 'month' ? 60 : zoom === 'quarter' ? 120 : 200;
  const totalWidth =
    totalMonths *
    (zoom === 'month' ? cellWidth : zoom === 'quarter' ? cellWidth / 3 : cellWidth / 12);

  // Row height for SVG calculations
  const ROW_HEIGHT = 56; // approximate row height in px

  // Compute dependency lines
  const dependencyLines = useMemo(() => {
    const phaseMap = new Map<string, Phase>();
    phases.forEach((p) => phaseMap.set(p.id, p));
    const phaseIndexMap = new Map<string, number>();
    phases.forEach((p, idx) => phaseIndexMap.set(p.id, idx));

    const lines: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      isConflict: boolean;
      isCritical: boolean;
    }> = [];

    const monthWidth = totalWidth / totalMonths;

    phases.forEach((phase) => {
      if (!phase.dependencies) return;
      const toIdx = phaseIndexMap.get(phase.id);
      if (toIdx === undefined) return;

      phase.dependencies.forEach((depId) => {
        const pred = phaseMap.get(depId);
        const fromIdx = phaseIndexMap.get(depId);
        if (!pred || fromIdx === undefined) return;

        const predEndX = (pred.startMonth - 1 + pred.duration) * monthWidth;
        const phaseStartX = (phase.startMonth - 1) * monthWidth;

        const hasConflict = warningsByPhase
          .get(phase.id)
          ?.some((w) => w.type === 'schedule_conflict');
        const isCritical =
          showCriticalPath && criticalPathIds.has(phase.id) && criticalPathIds.has(depId);

        lines.push({
          x1: predEndX,
          y1: fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          x2: phaseStartX,
          y2: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
          isConflict: !!hasConflict,
          isCritical,
        });
      });
    });

    return lines;
  }, [phases, totalWidth, totalMonths, warningsByPhase, showCriticalPath, criticalPathIds]);

  // Empty state when no phases provided (must be after hooks)
  if (phases.length === 0) {
    return (
      <div
        className={`bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-12 text-center ${className}`}
      >
        <Calendar className="w-12 h-12 mx-auto mb-3 text-c-text-secondary" />
        <p className="text-lg font-medium text-c-text">No schedule data</p>
        <p className="text-sm text-c-text-muted mt-1">
          Add phases to your roadmap to see the Gantt chart
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden ${className}`}
    >
      {/* D4.2: Clean Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle bg-c-surface-raised">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-c-text">
            {t('reports.ganttChart.roadmapTitle', 'Transformation Roadmap')}
          </h3>
          {scheduleWarnings.length > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={11} />
              {scheduleWarnings.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03]">
            <button
              onClick={() => setZoom('year')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-l-lg ${
                zoom === 'year' ? 'bg-c-info/15 text-c-info' : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              {t('reports.ganttChart.zoomYear', 'Year')}
            </button>
            <button
              onClick={() => setZoom('quarter')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-x border-c-border-subtle ${
                zoom === 'quarter'
                  ? 'bg-c-info/15 text-c-info'
                  : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              {t('reports.ganttChart.zoomQuarter', 'Quarter')}
            </button>
            <button
              onClick={() => setZoom('month')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors rounded-r-lg ${
                zoom === 'month'
                  ? 'bg-c-info/15 text-c-info'
                  : 'text-c-text-muted hover:text-c-text'
              }`}
            >
              {t('reports.ganttChart.zoomMonth', 'Month')}
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-c-border" />

          {/* Critical path toggle */}
          <button
            onClick={() => setShowCriticalPath((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${
              showCriticalPath
                ? 'bg-c-danger/15 text-c-danger'
                : 'text-c-text-muted hover:text-c-text hover:bg-c-surface-raised'
            }`}
            title={
              showCriticalPath
                ? t('reports.ganttChart.hideCriticalPath', 'Hide critical path')
                : t('reports.ganttChart.showCriticalPath', 'Show critical path')
            }
          >
            <Route size={16} />
          </button>

          {/* D4.2: Ask AI about schedule sensibility */}
          <div className="w-px h-5 bg-c-border" />
          {onAskScheduleSensibility && (
            <button
              onClick={onAskScheduleSensibility}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-c-accent-soft text-c-accent hover:bg-c-accent/15 transition-colors"
              title={t(
                'reports.ganttChart.askAiScheduleTooltip',
                'Ask AI about schedule sensibility'
              )}
            >
              <Sparkles size={14} />
              {t('reports.ganttChart.checkScheduleButton', 'Check schedule')}
            </button>
          )}
          {/* D4.4: PM Perspective schedule verification */}
          {onPMPerspectiveCheck && (
            <button
              onClick={onPMPerspectiveCheck}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-c-info/15 text-c-info hover:bg-c-info/25 transition-colors"
              title={t('reports.ganttChart.pmPerspectiveTooltip', 'PM perspective check')}
            >
              <Shield size={14} />
              {t('reports.ganttChart.pmCheckButton', 'PM Check')}
            </button>
          )}
          {/* D4.5: Chat in schedule context */}
          {onOpenScheduleChat && (
            <button
              onClick={onOpenScheduleChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-c-info/15 text-c-info hover:bg-c-info/25 transition-colors"
              title={t('reports.ganttChart.chatScheduleTooltip', 'Chat about schedule')}
            >
              <MessageSquare size={14} />
              Chat
            </button>
          )}
        </div>
      </div>

      {/* D4.1: Warning banner */}
      {showWarnings && scheduleWarnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/30">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-0.5">
                {t('reports.ganttChart.scheduleWarningsTitle', 'Schedule Warnings')}
              </p>
              {scheduleWarnings.slice(0, 3).map((w, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400 truncate">
                  {w.type === 'circular' ? '⛔' : '⚠️'} {w.message}
                </p>
              ))}
              {scheduleWarnings.length > 3 && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  +{scheduleWarnings.length - 3} more
                </p>
              )}
            </div>
            <button
              onClick={() => setShowWarnings(false)}
              className="p-0.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-2 border-b border-c-border-subtle flex items-center gap-6 text-xs flex-wrap">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
            <span className="text-c-text-secondary">
              {isPolish ? config.labelPl : config.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <Flag className="w-3 h-3 text-c-text-muted" />
          <span className="text-c-text-secondary">
            {t('reports.ganttChart.milestoneLabel', 'Milestone')}
          </span>
        </div>
        {showCriticalPath && (
          <>
            <div className="w-px h-3 bg-c-border" />
            <div className="flex items-center gap-1.5">
              <Route className="w-3 h-3 text-c-danger" />
              <span className="text-c-text-secondary">
                {t('reports.ganttChart.criticalPathLabel', 'Critical Path')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Chart area */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: totalWidth + 200 }}>
          {/* Timeline header */}
          <div className="flex border-b border-c-border-subtle">
            <div className="w-48 flex-shrink-0 px-4 py-2 bg-c-surface-raised font-medium text-sm text-c-text-secondary border-r border-c-border-subtle">
              {t('reports.ganttChart.phaseLabel', 'Phase')}
            </div>
            <div className="flex">
              {timelineHeaders.map((header) => (
                <div
                  key={header.key}
                  className="flex-shrink-0 px-2 py-2 text-center text-xs font-medium text-c-text-muted border-r border-c-border-subtle"
                  style={{
                    width:
                      (cellWidth * header.span) /
                      (zoom === 'month' ? 1 : zoom === 'quarter' ? 3 : 12),
                  }}
                >
                  {header.label}
                </div>
              ))}
            </div>
          </div>

          {/* Phase rows with SVG overlay */}
          <div className="relative">
            {/* D5.1: SVG dependency lines overlay */}
            <svg
              className="absolute pointer-events-none z-20"
              style={{
                left: 192, // w-48
                top: 0,
                width: totalWidth,
                height: phases.length * ROW_HEIGHT,
              }}
            >
              <defs>
                <marker
                  id="gantt-arrow"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--c-border-strong)" />
                </marker>
                <marker
                  id="gantt-arrow-warn"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="var(--c-warning)" />
                </marker>
                <marker
                  id="gantt-arrow-crit"
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
                const midX = (line.x1 + line.x2) / 2;
                const curveY = Math.abs(line.y2 - line.y1) * 0.3;
                const stroke = line.isCritical
                  ? 'var(--c-danger)'
                  : line.isConflict
                    ? 'var(--c-warning)'
                    : 'var(--c-border-strong)';
                const marker = line.isCritical
                  ? 'url(#gantt-arrow-crit)'
                  : line.isConflict
                    ? 'url(#gantt-arrow-warn)'
                    : 'url(#gantt-arrow)';
                const sw = line.isCritical ? 2.5 : 1.5;
                const dash = line.isConflict ? '6 3' : 'none';

                return (
                  <path
                    key={idx}
                    d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1 + curveY}, ${midX} ${line.y2 - curveY}, ${line.x2} ${line.y2}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeDasharray={dash}
                    markerEnd={marker}
                    opacity={0.7}
                  />
                );
              })}
            </svg>

            {phases.map((phase, phaseIndex) => {
              const status = STATUS_CONFIG[phase.status || 'pending'];
              const barStart = ((phase.startMonth - 1) / totalMonths) * 100;
              const barWidth = (phase.duration / totalMonths) * 100;
              const isCritical = showCriticalPath && criticalPathIds.has(phase.id);
              const phaseWarnings = warningsByPhase.get(phase.id) || [];
              const hasWarning = phaseWarnings.length > 0;

              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: phaseIndex * 0.1 }}
                  className={`flex border-b border-c-border-subtle hover:bg-c-surface-raised transition-colors ${
                    isCritical ? 'bg-c-danger/5' : ''
                  }`}
                >
                  {/* Phase name */}
                  <div className="w-48 flex-shrink-0 px-4 py-3 border-r border-c-border-subtle">
                    <div className="flex items-center gap-2">
                      {/* D4.1: Warning indicator */}
                      {hasWarning && (
                        <span title={phaseWarnings.map((w) => w.message).join('\n')}>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        </span>
                      )}
                      {/* D5.1: Critical path indicator */}
                      {isCritical && <Route className="w-3.5 h-3.5 text-c-danger shrink-0" />}
                      {React.createElement(status.icon, {
                        className: 'w-4 h-4 shrink-0',
                        style: { color: status.color },
                      })}
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-c-text truncate">
                          {isPolish ? phase.namePl : phase.name}
                        </p>
                        <p className="text-xs text-c-text-muted">
                          {phase.duration} {t('reports.ganttChart.moSuffix', 'mo.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Timeline bar area */}
                  <div className="flex-1 relative py-2" style={{ minWidth: totalWidth }}>
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timelineHeaders.map((header) => (
                        <div
                          key={header.key}
                          className="flex-shrink-0 border-r border-c-border-subtle"
                          style={{
                            width:
                              (cellWidth * header.span) /
                              (zoom === 'month' ? 1 : zoom === 'quarter' ? 3 : 12),
                          }}
                        />
                      ))}
                    </div>

                    {/* Phase bar */}
                    <motion.div
                      className={`absolute h-8 rounded-lg flex items-center px-2 shadow-sm ${
                        isCritical ? 'ring-2 ring-danger-500 ring-offset-1' : ''
                      } ${hasWarning ? 'ring-1 ring-amber-400' : ''}`}
                      style={{
                        left: `${barStart}%`,
                        width: `${barWidth}%`,
                        backgroundColor: phase.color,
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.3 + phaseIndex * 0.1, duration: 0.5 }}
                    >
                      {/* D4.1: Warning badge */}
                      {hasWarning && (
                        <div
                          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center z-10"
                          title={phaseWarnings.map((w) => w.message).join('\n')}
                        >
                          <AlertTriangle size={8} className="text-white" />
                        </div>
                      )}
                      <span className="text-xs font-medium text-white truncate">
                        {isPolish ? phase.namePl : phase.name}
                      </span>
                    </motion.div>

                    {/* Milestones */}
                    {phase.milestones?.map((milestone, i) => {
                      const milestonePos = ((milestone.month - 1) / totalMonths) * 100;
                      return (
                        <div
                          key={i}
                          className="absolute top-1/2 -translate-y-1/2 z-10 group"
                          style={{ left: `${milestonePos}%` }}
                        >
                          <div
                            className="w-4 h-4 rounded-full bg-c-surface border-2 flex items-center justify-center cursor-pointer transform hover:scale-125 transition-transform"
                            style={{ borderColor: phase.color }}
                          >
                            <Flag className="w-2 h-2" style={{ color: phase.color }} />
                          </div>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-c-surface text-c-text text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {isPolish ? milestone.labelPl : milestone.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="px-4 py-3 bg-c-surface-raised border-t border-c-border-subtle">
        <div className="flex items-center justify-between text-sm">
          <span className="text-c-text-secondary">
            {t('reports.ganttChart.totalTransformationTime', 'Total transformation time')}:{' '}
            <strong className="text-c-text">
              {maxMonth} {t('reports.ganttChart.monthsSuffix', 'months')}
            </strong>
          </span>
          <span className="text-c-text-secondary">
            {phases.length} {t('reports.ganttChart.phasesSuffix', 'phases')} •{' '}
            {phases.reduce((sum, p) => sum + (p.milestones?.length || 0), 0)}{' '}
            {t('reports.ganttChart.milestonesSuffix', 'milestones')}
            {showCriticalPath && criticalPathIds.size > 0 && (
              <>
                {' '}
                •{' '}
                <span className="text-c-danger font-medium">
                  {criticalPathIds.size}{' '}
                  {t('reports.ganttChart.onCriticalPathSuffix', 'on critical path')}
                </span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
