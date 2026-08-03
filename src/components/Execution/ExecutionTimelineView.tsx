/**
 * ExecutionTimelineView
 *
 * Gantt-style timeline view for initiatives in execution phase.
 * Shows timeline bars based on planned/actual dates with status-based coloring.
 *
 * T039: Timeline Management — filters, warnings, dependency lines, audit-ready updates
 * T040: Risk signals integration — risk badges on bars, warning strip
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  GripHorizontal,
  Route,
  Search,
  Shield,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { bumpInitiativeRefresh } from '../../store/useInitiativeRefreshStore';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { FullInitiative, InitiativeStatus } from '../../types';
import { isExecutionFlagEnabled } from './executionFeatureFlags';

// ============================================
// TYPES
// ============================================

export interface DelaySignalItem {
  id: string;
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  entityName: string;
  deviationType: 'LATE_START' | 'LATE_FINISH_RISK' | 'DEADLINE_RISK' | 'OVERDUE';
  severity: 'WARNING' | 'CRITICAL';
  daysDeviation: number;
  whySlipReasons: Array<{ reason: string; detail: string }>;
}

interface ExecutionTimelineViewProps {
  initiatives: FullInitiative[];
  onInitiativeClick: (initiative: FullInitiative) => void;
  onUpdateInitiative?: (initiative: FullInitiative) => void;
  onTimelineUpdate?: (initiativeId: string, field: string, value: string, reason?: string) => void;
  onDependenciesChanged?: () => void;
  projectId?: string;
  riskSignals?: RiskSignalItem[];
  delaySignals?: DelaySignalItem[];
  governedTimelineWarnings?: TimelineWarning[];
  /**
   * #76 — real CPM (server/src/services/criticalPathService.ts, task-level)
   * rolled up to initiative granularity. Keyed by initiativeId. When present
   * (non-empty), it REPLACES the client-side heuristic (computeExecutionCriticalPath)
   * for ring-highlighting; when absent/empty the heuristic keeps rendering exactly
   * as before (fail-soft — no CPM data should never look different from today).
   */
  serverCriticalPath?: Map<string, CriticalPathInfo>;
}

/** Roll-up of task-level CPM onto one initiative: is any of its tasks on the
 *  critical path, and what's the tightest (minimum) slack among them. */
export interface CriticalPathInfo {
  isCritical: boolean;
  slackDays: number;
}

export interface RiskSignalItem {
  id: string;
  initiativeId: string;
  initiativeName: string;
  signalType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  suggestedAction: string;
}

interface TimelineFilters {
  status: string;
  priority: string;
  owner: string;
  search: string;
}

interface PortfolioDependency {
  id: string;
  fromInitiativeId: string;
  toInitiativeId: string;
  type: string;
  projectId?: string | null;
}

// ============================================
// STATUS COLORS
// ============================================

const STATUS_COLORS: Record<
  InitiativeStatus,
  { bg: string; border: string; text: string; progress: string }
> = {
  [InitiativeStatus.PENDING_REVIEW]: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    progress: 'bg-amber-500',
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
    // §9.2④ crimson is NEVER a status — use info/blue-violet, not primary(=crimson)
    bg: 'bg-indigo-500/20',
    border: 'border-indigo-500/50',
    text: 'text-indigo-500 dark:text-indigo-400',
    progress: 'bg-indigo-500',
  },
  [InitiativeStatus.EXECUTING]: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    progress: 'bg-blue-500',
  },
  [InitiativeStatus.BLOCKED]: {
    bg: 'bg-danger-500/20',
    border: 'border-danger-500/50',
    text: 'text-danger-400',
    progress: 'bg-danger-500',
  },
  [InitiativeStatus.DONE]: {
    bg: 'bg-green-500/20',
    border: 'border-green-500/50',
    text: 'text-green-400',
    progress: 'bg-green-500',
  },
  [InitiativeStatus.TRACKING]: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    progress: 'bg-blue-500',
  },
  [InitiativeStatus.DRAFT]: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-c-text-muted',
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
    text: 'text-gray-600',
    progress: 'bg-gray-500',
  },
  [InitiativeStatus.ARCHIVED]: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/50',
    text: 'text-c-text-muted',
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
// DEPENDENCY VALIDATION
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
// CRITICAL PATH
// ============================================

function computeExecutionCriticalPath(initiatives: FullInitiative[]): Set<string> {
  // Readability fix (#76): this heuristic used to also mark every BLOCKED/overdue
  // initiative as "critical path" (danger ring). Those are already flagged by
  // computeTimelineWarnings (amber ring + AlertTriangle badge + WarningsStrip),
  // so double-marking them here just piled a second red ring on top of the amber
  // one for no new information — the exact "too much red at once" complaint in #76.
  // The critical-path ring below is reserved for genuine longest-dependency-chain
  // membership (used only as a fallback when no server-side CPM data is available).
  const ids = new Set<string>();

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

  const longestTo = new Map<string, number>();
  const pathPrev = new Map<string, string | null>();

  function getDuration(init: FullInitiative): number {
    const start = init.startDate || init.plannedStartDate;
    const end = init.plannedEndDate || init.endDate;
    if (start && end) {
      return Math.max(
        1,
        Math.round((new Date(end).getTime() - new Date(start).getTime()) / (7 * 86400000))
      );
    }
    return 2;
  }

  initiatives.forEach((i) => {
    longestTo.set(i.id, getDuration(i));
    pathPrev.set(i.id, null);
  });

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
// TIMELINE WARNING COMPUTATION
// ============================================

interface TimelineWarning {
  initiativeId: string;
  initiativeName: string;
  type: 'overdue' | 'blocked' | 'dependency_conflict' | 'sla_approaching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  daysOverdue?: number;
}

function computeTimelineWarnings(initiatives: FullInitiative[]): TimelineWarning[] {
  const warnings: TimelineWarning[] = [];
  const now = new Date();

  for (const init of initiatives) {
    if (init.status === InitiativeStatus.DONE || init.status === InitiativeStatus.CANCELLED)
      continue;

    const endDate = init.plannedEndDate || init.slaDeadline;
    if (endDate && new Date(endDate) < now) {
      const daysOverdue = Math.floor((now.getTime() - new Date(endDate).getTime()) / 86400000);
      warnings.push({
        initiativeId: init.id,
        initiativeName: init.name,
        type: 'overdue',
        severity: daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium',
        message: `${daysOverdue}d overdue`,
        daysOverdue,
      });
    }

    if (init.status === InitiativeStatus.BLOCKED) {
      warnings.push({
        initiativeId: init.id,
        initiativeName: init.name,
        type: 'blocked',
        severity: 'high',
        message: init.blockedReason || 'Blocked',
      });
    }
  }

  warnings.sort((a, b) => {
    const sev = { critical: 4, high: 3, medium: 2, low: 1 };
    return (sev[b.severity] || 0) - (sev[a.severity] || 0);
  });
  return warnings.slice(0, 10);
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
  hasRiskSignal?: boolean;
  riskSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  delaySignal?: DelaySignalItem;
  onDragEnd?: (weeksDelta: number) => void;
  /** M14/2.5 — baseline (original plan) week indices; render a ghost bar when valid. */
  baselineStartIdx?: number;
  baselineEndIdx?: number;
  showBaseline?: boolean;
  /** #76 — tightest task-level slack (days) among this initiative's tasks, from
   *  the real CPM. Only set when server CPM data is available; used for the
   *  bar's hover tooltip so slack is visible without opening the initiative. */
  criticalSlackDays?: number | null;
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
  hasRiskSignal,
  riskSeverity,
  delaySignal,
  onDragEnd,
  baselineStartIdx,
  baselineEndIdx,
  showBaseline,
  criticalSlackDays,
}) => {
  const { t } = useTranslation();
  const colors = STATUS_COLORS[initiative.status] || STATUS_COLORS[InitiativeStatus.EXECUTING];
  const span = Math.max(1, endIdx - startIdx + 1);
  const progress = initiative.progress || 0;
  const leftPercent = (startIdx / totalWeeks) * 100;
  // Readability fix (#76): the bar itself never showed its date range — you had
  // to click into the initiative to find out. A native title tooltip is the
  // cheapest fix that needs zero visual redesign.
  const rangeStart = initiative.startDate || initiative.plannedStartDate;
  const rangeEnd = initiative.actualEndDate || initiative.plannedEndDate || initiative.endDate;
  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('pl-PL') : '?');
  const barTooltipLines = [
    `${initiative.name} (${progress}%)`,
    `${fmtDate(rangeStart)} → ${fmtDate(rangeEnd)}`,
  ];
  if (isOnCriticalPath) {
    barTooltipLines.push(
      typeof criticalSlackDays === 'number'
        ? t('execution.timeline.slackDays', { count: Math.max(0, Math.round(criticalSlackDays)) })
        : t('execution.timeline.criticalPath')
    );
  }
  const barTooltip = barTooltipLines.join('\n');
  // M14/2.5 — baseline ghost bar: render only when enabled, indices valid, and the
  // plan actually differs from the current bar (slip/pull-in worth showing).
  const hasBaseline =
    showBaseline &&
    typeof baselineStartIdx === 'number' &&
    baselineStartIdx >= 0 &&
    typeof baselineEndIdx === 'number' &&
    baselineEndIdx >= baselineStartIdx &&
    (baselineStartIdx !== startIdx || baselineEndIdx !== endIdx);
  const baselineLeftPercent = hasBaseline ? (baselineStartIdx! / totalWeeks) * 100 : 0;
  const baselineWidthPercent = hasBaseline
    ? ((baselineEndIdx! - baselineStartIdx! + 1) / totalWeeks) * 100
    : 0;
  const baselineSlipWeeks = hasBaseline ? endIdx - baselineEndIdx! : 0;
  const widthPercent = (span / totalWeeks) * 100;
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragEnd = useCallback(() => {
    if (onDragEnd && dragOffset !== 0) {
      const weekWidth = 100 / totalWeeks;
      const weeksDelta = Math.round(dragOffset / weekWidth);
      if (weeksDelta !== 0) onDragEnd(weeksDelta);
    }
    setDragOffset(0);
  }, [dragOffset, onDragEnd, totalWeeks]);

  return (
    <>
      {hasBaseline && (
        <div
          className="absolute top-12 h-1.5 rounded-full bg-black/10 dark:bg-white/10 z-0"
          style={{
            left: `${baselineLeftPercent}%`,
            width: `${baselineWidthPercent}%`,
            minWidth: '40px',
          }}
          title={`Plan bazowy (baseline)${
            baselineSlipWeeks > 0
              ? `— ${baselineSlipWeeks} tyg. poślizgu`
              : baselineSlipWeeks < 0
                ? `— ${-baselineSlipWeeks} tyg. przed planem`
                : ''
          }`}
          data-testid="gantt-baseline"
        />
      )}
      <motion.div
        onClick={onClick}
        drag={onDragEnd ? 'x' : false}
        dragMomentum={false}
        dragElastic={0}
        onDrag={(_, info) => {
          setDragOffset((info.offset.x / window.innerWidth) * 100);
        }}
        onDragEnd={handleDragEnd}
        className={`
        absolute top-2 h-10 rounded-lg group transition-shadow hover:shadow-lg hover:z-10
        ${colors.bg} border ${colors.border}
        ${isOnCriticalPath ? 'ring-2 ring-danger-500/50' : ''}
        ${hasWarning ? 'ring-1 ring-amber-400/70' : ''}
        ${onDragEnd ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
      `}
        style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '60px' }}
        whileHover={{ scale: 1.02 }}
        whileTap={onDragEnd ? { scale: 0.98 } : undefined}
        title={barTooltip}
      >
        {hasWarning && (
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center z-20"
            title={warningMessage}
          >
            <AlertTriangle size={10} className="text-c-text" />
          </div>
        )}
        {hasRiskSignal && (
          <div
            className={`absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center z-20 ${
              riskSeverity === 'CRITICAL'
                ? 'bg-danger-600'
                : riskSeverity === 'HIGH'
                  ? 'bg-amber-500'
                  : 'bg-yellow-500'
            }`}
            title={`Risk: ${riskSeverity}`}
          >
            <Shield size={9} className="text-white" />
          </div>
        )}
        {delaySignal && (
          <div
            className={`absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold z-20 whitespace-nowrap ${
              delaySignal.severity === 'CRITICAL'
                ? 'bg-danger-600 text-white'
                : 'bg-amber-500 text-c-text'
            }`}
            title={`${delaySignal.deviationType}: ${delaySignal.daysDeviation}d${delaySignal.whySlipReasons.length > 0 ? ' — ' + delaySignal.whySlipReasons.map((r) => r.detail).join(', ') : ''}`}
          >
            {delaySignal.deviationType === 'OVERDUE'
              ? 'SLIP'
              : delaySignal.deviationType === 'LATE_START'
                ? 'LATE'
                : 'RISK'}{' '}
            {delaySignal.daysDeviation}d
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
            <AlertTriangle size={14} className="shrink-0 text-danger-500" />
          )}
          <span className="ml-auto text-xs text-c-text-muted shrink-0">{progress}%</span>
        </div>
      </motion.div>
    </>
  );
};

// ============================================
// WARNINGS STRIP
// ============================================

const WarningsStrip: React.FC<{
  warnings: TimelineWarning[];
  onWarningClick: (initiativeId: string) => void;
}> = ({ warnings, onWarningClick }) => {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;

  const sevColors = {
    critical: 'bg-danger-500/20 text-danger-400 border-danger-500/30',
    high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-slate-500/20 text-c-text-secondary border-slate-500/30',
  };

  return (
    <div className="shrink-0 px-4 py-2 border-b border-c-border-subtle bg-amber-50/50 dark:bg-amber-900/10">
      <div className="flex items-center gap-2 mb-1.5">
        <AlertTriangle size={14} className="text-amber-500" />
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
          {t('execution.warnings.title')} ({warnings.length})
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {warnings.map((w) => (
          <button
            key={`${w.type}-${w.initiativeId}`}
            onClick={() => {
              onWarningClick(w.initiativeId);
              trackFunnelEvent('execution_warning_clicked', { type: w.type, severity: w.severity });
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors hover:opacity-80 ${sevColors[w.severity]}`}
          >
            <span className="font-medium truncate max-w-[200px]">{w.initiativeName}</span>
            <span className="opacity-70">·</span>
            <span>{w.message}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================
// FILTER BAR
// ============================================

const FilterBar: React.FC<{
  filters: TimelineFilters;
  onChange: (filters: TimelineFilters) => void;
  initiatives: FullInitiative[];
}> = ({ filters, onChange, initiatives }) => {
  const { t } = useTranslation();

  const statuses = useMemo(() => {
    const set = new Set<string>();
    initiatives.forEach((i) => set.add(i.status));
    return Array.from(set).sort();
  }, [initiatives]);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    initiatives.forEach((i) => {
      if (i.ownerBusiness) {
        map.set(
          i.ownerBusinessId || i.ownerBusiness.id,
          `${i.ownerBusiness.firstName || ''} ${i.ownerBusiness.lastName || ''}`.trim()
        );
      }
      if (i.ownerExecution) {
        map.set(
          i.ownerExecutionId || i.ownerExecution.id,
          `${i.ownerExecution.firstName || ''} ${i.ownerExecution.lastName || ''}`.trim()
        );
      }
    });
    return Array.from(map.entries());
  }, [initiatives]);

  return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-c-border-subtle bg-c-surface">
      <Filter size={14} className="text-c-text-muted shrink-0" />
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        className="text-xs bg-c-surface-raised border border-c-border-subtle rounded px-2 py-1.5 text-c-text-secondary"
      >
        <option value="">{t('execution.timeline.allStatuses')}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={filters.priority}
        onChange={(e) => onChange({ ...filters, priority: e.target.value })}
        className="text-xs bg-c-surface-raised border border-c-border-subtle rounded px-2 py-1.5 text-c-text-secondary"
      >
        <option value="">{t('execution.timeline.allPriorities')}</option>
        {['Critical', 'High', 'Medium', 'Low'].map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {owners.length > 0 && (
        <select
          value={filters.owner}
          onChange={(e) => onChange({ ...filters, owner: e.target.value })}
          className="text-xs bg-c-surface-raised border border-c-border-subtle rounded px-2 py-1.5 text-c-text-secondary"
        >
          <option value="">{t('execution.timeline.allOwners')}</option>
          {owners.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      )}
      <div className="relative ml-auto">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-c-text-muted" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder={t('execution.timeline.searchPlaceholder')}
          className="text-xs bg-c-surface-raised border border-c-border-subtle rounded pl-7 pr-7 py-1.5 w-48 text-c-text-secondary placeholder:text-c-text-muted"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: '' })}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-c-text-muted"
          >
            <X size={12} />
          </button>
        )}
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
  onUpdateInitiative,
  onTimelineUpdate,
  onDependenciesChanged,
  projectId,
  riskSignals,
  delaySignals,
  governedTimelineWarnings,
  serverCriticalPath,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewWeeks, setViewWeeks] = useState(12);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TimelineFilters>({
    status: '',
    priority: '',
    owner: '',
    search: '',
  });
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 14);
    return today;
  });

  const [depsOpen, setDepsOpen] = useState(false);
  const [depsLoading, setDepsLoading] = useState(false);
  const [deps, setDeps] = useState<PortfolioDependency[]>([]);
  const [newDepFrom, setNewDepFrom] = useState('');
  const [newDepTo, setNewDepTo] = useState('');

  const trackedRef = useRef(false);
  useEffect(() => {
    if (!trackedRef.current) {
      trackFunnelEvent('execution_timeline_viewed', {});
      trackedRef.current = true;
    }
  }, []);

  const loadDependencies = useCallback(async () => {
    setDepsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (projectId) qs.set('projectId', projectId);
      const data = await Api.get(`/initiatives/portfolio/dependencies?${qs.toString()}`);
      setDeps((data as any)?.dependencies || []);
    } catch {
      // non-blocking
    } finally {
      setDepsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!depsOpen) return;
    loadDependencies();
  }, [depsOpen, loadDependencies]);

  const handleCreateDependency = useCallback(async () => {
    if (!newDepFrom || !newDepTo) return;
    if (newDepFrom === newDepTo) {
      toast.error(t('execution.timeline.deps.self', 'Cannot create self-dependency'));
      return;
    }
    try {
      await Api.post('/initiatives/portfolio/dependencies', {
        fromInitiativeId: newDepFrom,
        toInitiativeId: newDepTo,
        type: 'FINISH_TO_START',
        projectId: projectId || null,
      });
      toast.success(t('execution.timeline.deps.created', 'Dependency created'));
      trackFunnelEvent('execution_dependency_created', { from: newDepFrom, to: newDepTo });
      setNewDepFrom('');
      setNewDepTo('');
      await loadDependencies();
      onDependenciesChanged?.();
      bumpInitiativeRefresh();
    } catch (e: any) {
      toast.error(e?.message || t('execution.timeline.deps.createFailed', 'Failed to create'));
    }
  }, [newDepFrom, newDepTo, projectId, t, loadDependencies, onDependenciesChanged]);

  const handleDeleteDependency = useCallback(
    async (id: string) => {
      try {
        await Api.delete(`/initiatives/portfolio/dependencies/${id}`);
        toast.success(t('execution.timeline.deps.deleted', 'Dependency removed'));
        trackFunnelEvent('execution_dependency_deleted', { id });
        await loadDependencies();
        onDependenciesChanged?.();
        bumpInitiativeRefresh();
      } catch (e: any) {
        toast.error(e?.message || t('execution.timeline.deps.deleteFailed', 'Failed to delete'));
      }
    },
    [t, loadDependencies, onDependenciesChanged]
  );

  const filteredInitiatives = useMemo(() => {
    let result = initiatives;
    if (filters.status) result = result.filter((i) => i.status === filters.status);
    if (filters.priority) result = result.filter((i) => i.priority === filters.priority);
    if (filters.owner)
      result = result.filter(
        (i) =>
          i.ownerBusinessId === filters.owner ||
          i.ownerExecutionId === filters.owner ||
          i.ownerTechnicalId === filters.owner
      );
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return result;
  }, [initiatives, filters]);

  const riskSignalsByInit = useMemo(() => {
    const map = new Map<string, RiskSignalItem[]>();
    if (!riskSignals) return map;
    for (const sig of riskSignals) {
      const existing = map.get(sig.initiativeId) || [];
      existing.push(sig);
      map.set(sig.initiativeId, existing);
    }
    return map;
  }, [riskSignals]);

  const delaySignalsByInit = useMemo(() => {
    const map = new Map<string, DelaySignalItem>();
    if (!delaySignals) return map;
    for (const sig of delaySignals) {
      if (sig.entityType === 'INITIATIVE' && !map.has(sig.entityId)) {
        map.set(sig.entityId, sig);
      }
    }
    return map;
  }, [delaySignals]);

  const weeks = useMemo(() => generateWeeks(startDate, viewWeeks), [startDate, viewWeeks]);
  const months = useMemo(() => getMonthsFromWeeks(weeks), [weeks]);

  const depWarnings = useMemo(
    () => validateInitiativeDependencies(filteredInitiatives),
    [filteredInitiatives]
  );
  const warningsByInit = useMemo(() => {
    const map = new Map<string, DepWarning[]>();
    depWarnings.forEach((w) => {
      const existing = map.get(w.initiativeId) || [];
      existing.push(w);
      map.set(w.initiativeId, existing);
    });
    return map;
  }, [depWarnings]);

  const timelineWarnings = useMemo(() => {
    if (governedTimelineWarnings && governedTimelineWarnings.length > 0) {
      return governedTimelineWarnings;
    }
    return computeTimelineWarnings(filteredInitiatives);
  }, [filteredInitiatives, governedTimelineWarnings]);

  const getWeekIndex = useCallback(
    (dateStr: string | undefined): number => {
      if (!dateStr) return -1;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return -1;
      const firstWeekStart = weeks[0]?.date;
      if (!firstWeekStart) return -1;
      const diffTime = date.getTime() - firstWeekStart.getTime();
      return Math.max(0, Math.min(Math.floor(diffTime / (7 * 86400000)), weeks.length - 1));
    },
    [weeks]
  );

  const processedInitiatives = useMemo(() => {
    return filteredInitiatives
      .filter((i) => i.startDate || i.plannedEndDate || i.endDate)
      .map((initiative) => {
        const startIdx =
          getWeekIndex(initiative.startDate) >= 0 ? getWeekIndex(initiative.startDate) : 0;
        const endDateStr =
          initiative.actualEndDate || initiative.plannedEndDate || initiative.endDate;
        let endIdx = getWeekIndex(endDateStr);
        if (endIdx < 0 || endIdx < startIdx) endIdx = Math.min(startIdx + 2, weeks.length - 1);
        // M14/2.5 — baseline (original plan) week indices for the ghost bar overlay.
        const baselineStartIdx = getWeekIndex(initiative.plannedStartDate);
        const baselineEndIdx = getWeekIndex(initiative.plannedEndDate);
        return { ...initiative, startIdx, endIdx, baselineStartIdx, baselineEndIdx };
      })
      .sort((a, b) => a.startIdx - b.startIdx);
  }, [filteredInitiatives, getWeekIndex, weeks.length]);

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
      if (!placed) rows.push([initiative]);
    });
    return rows;
  }, [processedInitiatives]);

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
    const diffDays = (today.getTime() - firstWeekStart.getTime()) / 86400000;
    const position = (diffDays / (viewWeeks * 7)) * 100;
    return position < 0 || position > 100 ? null : position;
  }, [weeks, viewWeeks]);

  // #76 — prefer the real, task-level CPM (server/src/services/criticalPathService.ts)
  // rolled up per initiative when it's available; fall back to the client-side
  // longest-chain heuristic otherwise (unchanged behavior — fail-soft).
  const usingServerCriticalPath = !!serverCriticalPath && serverCriticalPath.size > 0;

  const criticalPathIds = useMemo(() => {
    if (!showCriticalPath) return new Set<string>();
    if (usingServerCriticalPath) {
      const ids = new Set<string>();
      serverCriticalPath!.forEach((info, initiativeId) => {
        if (info.isCritical) ids.add(initiativeId);
      });
      return ids;
    }
    return computeExecutionCriticalPath(filteredInitiatives);
  }, [filteredInitiatives, showCriticalPath, serverCriticalPath, usingServerCriticalPath]);

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
    filteredInitiatives.forEach((init) => {
      const deps = init.relatedInitiatives?.filter((r) => r.relationType === 'DEPENDS_ON') || [];
      const toPos = initiativePositionMap.get(init.id);
      if (!toPos) return;
      deps.forEach((dep) => {
        const fromPos = initiativePositionMap.get(dep.relatedInitiativeId);
        if (!fromPos) return;
        lines.push({
          fromId: dep.relatedInitiativeId,
          toId: init.id,
          x1Pct: ((fromPos.endIdx + 1) / viewWeeks) * 100,
          y1Row: fromPos.row,
          x2Pct: (toPos.startIdx / viewWeeks) * 100,
          y2Row: toPos.row,
          isCritical: criticalPathIds.has(init.id) && criticalPathIds.has(dep.relatedInitiativeId),
          isConflict: warningsByInit.has(init.id),
        });
      });
    });
    return lines;
  }, [filteredInitiatives, initiativePositionMap, viewWeeks, criticalPathIds, warningsByInit]);

  const navigateTimeline = (direction: 'prev' | 'next') => {
    setStartDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
      return d;
    });
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    setStartDate(d);
  };

  const handleBarDragEnd = useCallback(
    (initiative: FullInitiative, weeksDelta: number) => {
      if (!onUpdateInitiative && !onTimelineUpdate) return;
      const startStr = initiative.startDate || initiative.plannedStartDate;
      const endStr = initiative.plannedEndDate || initiative.endDate;
      if (!startStr) return;

      if (onTimelineUpdate) {
        const newStart = new Date(startStr);
        newStart.setDate(newStart.getDate() + weeksDelta * 7);
        onTimelineUpdate(initiative.id, 'planned_start_date', newStart.toISOString());
        if (endStr) {
          const newEnd = new Date(endStr);
          newEnd.setDate(newEnd.getDate() + weeksDelta * 7);
          onTimelineUpdate(initiative.id, 'planned_end_date', newEnd.toISOString());
        }
        trackFunnelEvent('execution_timeline_initiative_updated', { field: 'dates', weeksDelta });
        return;
      }

      if (onUpdateInitiative) {
        const newStart = new Date(startStr);
        newStart.setDate(newStart.getDate() + weeksDelta * 7);
        const updates: Partial<FullInitiative> = { ...initiative };
        if (initiative.startDate) updates.startDate = newStart.toISOString();
        if (initiative.plannedStartDate) {
          const np = new Date(initiative.plannedStartDate);
          np.setDate(np.getDate() + weeksDelta * 7);
          updates.plannedStartDate = np.toISOString();
        }
        if (endStr) {
          const ne = new Date(endStr);
          ne.setDate(ne.getDate() + weeksDelta * 7);
          if (initiative.plannedEndDate) updates.plannedEndDate = ne.toISOString();
          if (initiative.endDate) updates.endDate = ne.toISOString();
        }
        onUpdateInitiative(updates as FullInitiative);
        trackFunnelEvent('execution_timeline_initiative_updated', { field: 'dates', weeksDelta });
      }
    },
    [onUpdateInitiative, onTimelineUpdate]
  );

  const handleWarningClick = useCallback(
    (initiativeId: string) => {
      const init = initiatives.find((i) => i.id === initiativeId);
      if (init) onInitiativeClick(init);
    },
    [initiatives, onInitiativeClick]
  );

  const handleFilterChange = useCallback((newFilters: TimelineFilters) => {
    setFilters(newFilters);
    trackFunnelEvent('execution_timeline_filtered', {
      status: newFilters.status || 'all',
      priority: newFilters.priority || 'all',
      hasSearch: !!newFilters.search,
    });
  }, []);

  const activeFilters = filters.status || filters.priority || filters.owner || filters.search;
  const ROW_HEIGHT = 56;

  return (
    <div className="h-full flex flex-col bg-c-bg">
      {/* Controls */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-c-border-subtle bg-c-surface">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateTimeline('prev')}
            className="p-1.5 text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised rounded transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-xs font-medium text-c-text-secondary hover:text-c-text hover:bg-white/10 rounded transition-colors"
          >
            {t('execution.timeline.today')}
          </button>
          <button
            onClick={() => navigateTimeline('next')}
            className="p-1.5 text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised rounded transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          {depWarnings.length > 0 && (
            <>
              <div className="w-px h-4 bg-c-border-subtle mx-1" />
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                <AlertTriangle size={11} />
                {depWarnings.length}{' '}
                {depWarnings.length === 1
                  ? t('execution.timeline.warning')
                  : t('execution.timeline.warnings')}
              </span>
            </>
          )}
          {riskSignals && riskSignals.length > 0 && (
            <>
              <div className="w-px h-4 bg-c-border-subtle mx-1" />
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-danger-900/30 text-danger-400">
                <Shield size={11} /> {riskSignals.length}{' '}
                {t('execution.riskSignals.title').toLowerCase()}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDepsOpen(true)}
            className="p-1.5 rounded-lg transition-colors text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised"
            title={t('execution.timeline.deps.manage', 'Manage dependencies')}
            data-testid="timeline-deps-button"
          >
            <GripHorizontal size={16} />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${showFilters || activeFilters ? 'bg-blue-900/30 text-blue-400' : 'text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised'}`}
            title={
              showFilters
                ? t('execution.timeline.filters.hide', 'Hide filters')
                : t('execution.timeline.filters.show', 'Show filters')
            }
          >
            <Filter size={16} />
          </button>
          <button
            onClick={() => setShowCriticalPath((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors ${showCriticalPath ? 'bg-danger-900/30 text-danger-400' : 'text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised'}`}
            title={
              showCriticalPath
                ? t('execution.timeline.hideCriticalPath')
                : t('execution.timeline.showCriticalPath')
            }
          >
            <Route size={16} />
          </button>
          <div className="w-px h-4 bg-c-border-subtle" />
          <div className="flex items-center gap-1 bg-c-surface-raised rounded-lg p-1 border border-c-border-subtle">
            {[8, 12, 16, 24].map((w) => (
              <button
                key={w}
                onClick={() => setViewWeeks(w)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${viewWeeks === w ? 'bg-blue-500/20 text-blue-400' : 'text-c-text-muted hover:text-c-text-secondary'}`}
              >
                {w}W
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <FilterBar filters={filters} onChange={handleFilterChange} initiatives={initiatives} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dependencies Manager */}
      <AnimatePresence>
        {depsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setDepsOpen(false)}
            data-testid="timeline-deps-modal"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="w-full max-w-2xl rounded-xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
                <div className="flex items-center gap-2">
                  <Route size={16} className="text-blue-500" />
                  <span className="text-sm font-semibold text-c-text">
                    {t('execution.timeline.deps.title', 'Dependencies')}
                  </span>
                </div>
                <button
                  onClick={() => setDepsOpen(false)}
                  className="p-1.5 rounded-lg text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                      {t('execution.timeline.deps.predecessor', 'Predecessor')}
                    </label>
                    <select
                      value={newDepFrom}
                      onChange={(e) => setNewDepFrom(e.target.value)}
                      className="w-full text-xs bg-c-surface-raised border border-c-border-subtle rounded px-2 py-2 text-c-text-secondary"
                      data-testid="timeline-deps-from"
                    >
                      <option value="">{t('execution.timeline.deps.select', 'Select')}</option>
                      {initiatives.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-c-text-muted mb-1">
                      {t('execution.timeline.deps.successor', 'Successor')}
                    </label>
                    <select
                      value={newDepTo}
                      onChange={(e) => setNewDepTo(e.target.value)}
                      className="w-full text-xs bg-c-surface-raised border border-c-border-subtle rounded px-2 py-2 text-c-text-secondary"
                      data-testid="timeline-deps-to"
                    >
                      <option value="">{t('execution.timeline.deps.select', 'Select')}</option>
                      {initiatives.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateDependency}
                    disabled={!newDepFrom || !newDepTo}
                    className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold"
                    data-testid="timeline-deps-add"
                  >
                    {t('execution.timeline.deps.add', 'Add')}
                  </button>
                </div>

                <div className="rounded-lg border border-c-border-subtle overflow-hidden">
                  <div className="px-3 py-2 bg-c-surface-raised text-[11px] font-semibold text-c-text-secondary">
                    {t('execution.timeline.deps.current', 'Current dependencies')}
                  </div>
                  <div className="divide-y divide-c-border-subtle">
                    {depsLoading ? (
                      <div className="p-3 text-sm text-c-text-muted">
                        {t('execution.timeline.deps.loading', 'Loading...')}
                      </div>
                    ) : deps.length === 0 ? (
                      <div className="p-3 text-sm text-c-text-muted">
                        {t('execution.timeline.deps.empty', 'No dependencies')}
                      </div>
                    ) : (
                      deps.map((d) => {
                        const from = initiatives.find((i) => i.id === d.fromInitiativeId)?.name;
                        const to = initiatives.find((i) => i.id === d.toInitiativeId)?.name;
                        return (
                          <div
                            key={d.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs text-c-text truncate">
                                {from || d.fromInitiativeId} → {to || d.toInitiativeId}
                              </div>
                              <div className="text-[10px] text-c-text-muted">{d.type}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteDependency(d.id)}
                              className="px-2 py-1 rounded-md text-xs text-danger-500 hover:bg-danger-500/10"
                            >
                              {t('execution.timeline.deps.remove', 'Remove')}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <WarningsStrip warnings={timelineWarnings} onWarningClick={handleWarningClick} />

      {/* Timeline Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <div className="min-w-[800px]">
          <div className="sticky top-0 z-20 flex bg-c-surface border-b border-c-border-subtle">
            {months.map((m, idx) => (
              <div
                key={`${m.month}-${m.year}-${idx}`}
                className="text-center py-2 border-r border-c-border-subtle last:border-r-0"
                style={{ width: `${(m.span / viewWeeks) * 100}%` }}
              >
                <span className="text-sm font-semibold text-c-text">
                  {m.month} {m.year}
                </span>
              </div>
            ))}
          </div>
          <div className="sticky top-[40px] z-10 flex bg-c-surface-raised border-b border-c-border-subtle">
            {weeks.map((week, idx) => (
              <div
                key={`week-${idx}`}
                className="flex-1 px-1 py-2 text-center border-r border-c-border-subtle last:border-r-0"
              >
                <div className="text-xs font-medium text-c-text-muted">{week.label}</div>
                <div className="text-[10px] text-c-text-muted">
                  {week.date.toLocaleDateString('en-US', { day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
          <div className="relative">
            {todayPosition !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-c-text z-20"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-c-text text-c-surface text-[10px] font-medium rounded shadow-lg">
                  {t('execution.timeline.today')}
                </div>
              </div>
            )}
            <div className="absolute inset-0 flex pointer-events-none">
              {weeks.map((_, idx) => (
                <div
                  key={`grid-${idx}`}
                  className="flex-1 border-r border-c-border-subtle last:border-r-0"
                />
              ))}
            </div>
            {dependencyLines.length > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-15"
                style={{ width: '100%', height: initiativeRows.length * ROW_HEIGHT }}
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
                    <polygon points="0 0, 8 3, 0 6" fill="var(--c-border-strong)" />
                  </marker>
                  <marker
                    id="exec-arrow-crit"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="var(--c-danger)" />
                  </marker>
                  <marker
                    id="exec-arrow-warn"
                    markerWidth="8"
                    markerHeight="6"
                    refX="8"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 3, 0 6" fill="var(--c-warning)" />
                  </marker>
                </defs>
                {dependencyLines.map((line, idx) => {
                  const y1 = line.y1Row * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const y2 = line.y2Row * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const stroke = line.isCritical
                    ? 'var(--c-danger)'
                    : line.isConflict
                      ? 'var(--c-warning)'
                      : 'var(--c-border-strong)';
                  const marker = line.isCritical
                    ? 'url(#exec-arrow-crit)'
                    : line.isConflict
                      ? 'url(#exec-arrow-warn)'
                      : 'url(#exec-arrow)';
                  return (
                    <path
                      key={idx}
                      d={`M ${line.x1Pct}% ${y1} C ${(line.x1Pct + line.x2Pct) / 2}% ${y1}, ${(line.x1Pct + line.x2Pct) / 2}% ${y2}, ${line.x2Pct}% ${y2}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={line.isCritical ? 2 : 1.5}
                      strokeDasharray={line.isConflict ? '5 3' : 'none'}
                      markerEnd={marker}
                      opacity={0.6}
                    />
                  );
                })}
              </svg>
            )}
            {initiativeRows.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-c-text-muted">
                <div className="text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {activeFilters
                      ? t('execution.timeline.noResults')
                      : t('execution.empty.noInExecution')}
                  </p>
                </div>
              </div>
            ) : (
              initiativeRows.map((row, rowIdx) => (
                <div key={rowIdx} className="relative h-14 border-b border-c-border-subtle">
                  {row.map((initiative) => {
                    const initWarnings = warningsByInit.get(initiative.id) || [];
                    const initRisks = riskSignalsByInit.get(initiative.id) || [];
                    const initDelay = delaySignalsByInit.get(initiative.id);
                    return (
                      <TimelineBar
                        key={initiative.id}
                        initiative={initiative}
                        startIdx={initiative.startIdx}
                        endIdx={initiative.endIdx}
                        totalWeeks={viewWeeks}
                        onClick={() => onInitiativeClick(initiative)}
                        isOnCriticalPath={criticalPathIds.has(initiative.id)}
                        criticalSlackDays={serverCriticalPath?.get(initiative.id)?.slackDays}
                        hasWarning={initWarnings.length > 0}
                        warningMessage={initWarnings.map((w) => w.message).join('\n')}
                        hasRiskSignal={initRisks.length > 0}
                        riskSeverity={initRisks.length > 0 ? initRisks[0].severity : undefined}
                        delaySignal={initDelay}
                        baselineStartIdx={
                          (initiative as { baselineStartIdx?: number }).baselineStartIdx
                        }
                        baselineEndIdx={(initiative as { baselineEndIdx?: number }).baselineEndIdx}
                        showBaseline={isExecutionFlagEnabled('ganttBaseline')}
                        onDragEnd={
                          onUpdateInitiative || onTimelineUpdate
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
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 border-t border-c-border-subtle bg-c-surface text-xs flex-wrap">
        <div className="flex items-center gap-4">
          {[
            { status: InitiativeStatus.APPROVED, label: 'Ready' },
            { status: InitiativeStatus.EXECUTING, label: 'In Progress' },
            { status: InitiativeStatus.BLOCKED, label: 'Blocked' },
            { status: InitiativeStatus.DONE, label: 'Done' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded ${STATUS_COLORS[status].progress}`} />
              <span className="text-c-text-muted">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-3 h-3 rounded ring-2 ring-danger-500/50 bg-danger-500/20" />
          <span className="text-c-text-muted">
            {usingServerCriticalPath
              ? t('execution.timeline.criticalPath')
              : t('execution.timeline.criticalPathEstimate')}
          </span>
        </div>
        {riskSignals && riskSignals.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Shield size={12} className="text-danger-500" />
            <span className="text-c-text-muted">{t('execution.riskSignals.title')}</span>
          </div>
        )}
        {depWarnings.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-c-text-muted">{t('execution.timeline.scheduleWarning')}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-danger-500" />
          <span className="text-c-text-muted">{t('execution.timeline.today')}</span>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTimelineView;
