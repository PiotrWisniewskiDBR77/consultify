/**
 * TimelineSection - Status-aware timeline management for initiatives.
 *
 * N-mode canvas component — renders as flat, quiet UI with typography + whitespace.
 * NO CollapsibleSection — left nav already identifies the section.
 *
 * Renders different views based on initiative lifecycle phase:
 *   ESTIMATE       → Draft: target date + estimated duration
 *   PLANNING       → Full editor: dates, milestones, phases, mini-Gantt
 *   READY_TO_LOCK  → Review: read-only summary + readiness checklist
 *   BASELINED      → Locked: baseline vs actual + progress + health
 *   TRACKING       → Same as BASELINED with overdue signals
 *   COMPLETED      → Read-only execution summary
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3, §2.5.5
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  Info,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { useInitiativeContext } from './InitiativeContext';
import type { TimelinePlannerHandle } from './TimelinePlanner';
import { TimelinePlanner } from './TimelinePlanner';
import type { InitiativeSectionProps, TimelineMilestone, TimelinePhase } from './types';
import { getTimelineMode, TIMELINE_MODE_META } from './types';

// ==========================================
// HELPERS
// ==========================================

function toISODate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function formatDate(d: string | null | undefined, locale = 'en'): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function daysBetween(a: string, b: string): number | null {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.ceil((db - da) / (1000 * 60 * 60 * 24));
}

function genId(): string {
  return `ms-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ==========================================
// MILESTONE STATUS CONFIG
// ==========================================

const MILESTONE_STATUS_CONFIG: Record<
  string,
  { label: string; labelPl: string; dotColor: string }
> = {
  pending: { label: 'Pending', labelPl: 'Oczekujący', dotColor: 'bg-slate-400' },
  in_progress: { label: 'In Progress', labelPl: 'W toku', dotColor: 'bg-blue-500 animate-pulse' },
  completed: { label: 'Completed', labelPl: 'Ukończony', dotColor: 'bg-emerald-500' },
  missed: { label: 'Missed', labelPl: 'Pominięty', dotColor: 'bg-red-500' },
};

// ==========================================
// SUB-COMPONENTS — N BLOCKS KIT
// ==========================================

/** Callout — info/warning/success banner (N blocks kit §2.5.5) */
const Callout: React.FC<{ variant: 'info' | 'warning' | 'success'; children: React.ReactNode }> = ({
  variant,
  children,
}) => {
  const styles = {
    info: 'bg-blue-50/60 dark:bg-blue-500/5 border-blue-200/60 dark:border-blue-500/20 text-blue-700 dark:text-blue-300',
    warning:
      'bg-amber-50/60 dark:bg-amber-500/5 border-amber-200/60 dark:border-amber-500/20 text-amber-700 dark:text-amber-300',
    success:
      'bg-emerald-50/60 dark:bg-emerald-500/5 border-emerald-200/60 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  };
  const icons = {
    info: <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />,
    warning: <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />,
    success: <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />,
  };
  return (
    <div
      className={`flex items-start gap-2.5 p-3.5 rounded-2xl border text-xs leading-relaxed ${styles[variant]}`}
    >
      {icons[variant]}
      <span>{children}</span>
    </div>
  );
};

/** TimelineBar — mini horizontal Gantt with milestone markers */
const TimelineBar: React.FC<{
  startDate: string;
  endDate: string;
  milestones: TimelineMilestone[];
  phases?: TimelinePhase[];
  isPolish: boolean;
  showProgress?: boolean;
}> = ({ startDate, endDate, milestones, phases, isPolish, showProgress = false }) => {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const rangeMs = endMs - startMs;
  if (rangeMs <= 0) return null;

  const toPercent = (d: string) => {
    const ms = new Date(d).getTime();
    return Math.max(0, Math.min(100, ((ms - startMs) / rangeMs) * 100));
  };

  const now = Date.now();
  const progressPercent = showProgress
    ? Math.max(0, Math.min(100, ((now - startMs) / rangeMs) * 100))
    : 0;

  // Month labels
  const months: { label: string; percent: number }[] = [];
  const curr = new Date(startDate);
  curr.setDate(1);
  curr.setMonth(curr.getMonth() + 1);
  while (curr.getTime() < endMs) {
    const pct = toPercent(curr.toISOString());
    if (pct > 5 && pct < 95) {
      months.push({
        label: curr.toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB', { month: 'short' }),
        percent: pct,
      });
    }
    curr.setMonth(curr.getMonth() + 1);
  }

  const phaseColors = [
    'bg-cyan-500/30 dark:bg-cyan-500/20',
    'bg-blue-500/30 dark:bg-blue-500/20',
    'bg-purple-500/30 dark:bg-purple-500/20',
    'bg-violet-500/30 dark:bg-violet-500/20',
  ];

  return (
    <div className="relative pt-1 pb-6">
      {/* Track */}
      <div className="relative h-3 rounded-full bg-slate-200/80 dark:bg-navy-700/80 overflow-hidden">
        {phases?.map((phase, idx) => {
          const left = toPercent(phase.startDate);
          const right = toPercent(phase.endDate);
          return (
            <div
              key={phase.id}
              className={`absolute top-0 h-full ${phase.color || phaseColors[idx % phaseColors.length]}`}
              style={{ left: `${left}%`, width: `${right - left}%` }}
              title={phase.name}
            />
          );
        })}
        {showProgress && progressPercent > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            className="absolute top-0 h-full bg-gradient-to-r from-cyan-500/50 to-blue-500/50 rounded-full"
          />
        )}
      </div>

      {/* Today marker */}
      {showProgress && progressPercent > 0 && progressPercent < 100 && (
        <div
          className="absolute top-0 w-0.5 h-5 bg-cyan-500 dark:bg-cyan-400"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-cyan-500 whitespace-nowrap">
            {isPolish ? 'Dziś' : 'Today'}
          </div>
        </div>
      )}

      {/* Milestone markers */}
      {milestones.map((ms) => {
        const pct = toPercent(ms.date);
        const isCompleted = ms.status === 'completed';
        const isMissed = ms.status === 'missed';
        return (
          <div
            key={ms.id}
            className="absolute"
            style={{ left: `${pct}%`, top: '0px' }}
            title={`${ms.name}: ${formatDate(ms.date, isPolish ? 'pl' : 'en')}`}
          >
            <div
              className={`w-3 h-3 rounded-full border-2 -translate-x-1/2 ${
                isCompleted
                  ? 'bg-emerald-500 border-emerald-500'
                  : isMissed
                    ? 'bg-red-500 border-red-500'
                    : 'bg-white dark:bg-navy-800 border-purple-500'
              }`}
            />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[9px] text-slate-500 dark:text-slate-400">{ms.name}</span>
            </div>
          </div>
        );
      })}

      {/* Month ticks */}
      {months.map((m) => (
        <div
          key={m.label + m.percent}
          className="absolute"
          style={{ left: `${m.percent}%`, top: '14px' }}
        >
          <div className="w-px h-2 bg-slate-300 dark:bg-navy-600 -translate-x-1/2" />
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <span className="text-[8px] text-slate-400">{m.label}</span>
          </div>
        </div>
      ))}

      {/* Start / End labels */}
      <div className="flex justify-between mt-3">
        <span className="text-[9px] text-slate-400">
          {formatDate(startDate, isPolish ? 'pl' : 'en')}
        </span>
        <span className="text-[9px] text-slate-400">
          {formatDate(endDate, isPolish ? 'pl' : 'en')}
        </span>
      </div>
    </div>
  );
};

/** HealthIndicators — mini stat cards for tracking phase */
const HealthIndicators: React.FC<{
  startVariance: number | null;
  milestoneDone: number;
  milestoneTotal: number;
  openRisks: number;
  isPolish: boolean;
}> = ({ startVariance, milestoneDone, milestoneTotal, openRisks, isPolish }) => {
  const spiLabel =
    startVariance === null
      ? '—'
      : startVariance <= 0
        ? isPolish
          ? 'W terminie'
          : 'On time'
        : `+${startVariance}d`;
  const spiColor =
    startVariance === null
      ? 'text-slate-400'
      : startVariance <= 0
        ? 'text-emerald-500'
        : startVariance <= 7
          ? 'text-amber-500'
          : 'text-red-500';

  const cards = [
    { label: isPolish ? 'Odchylenie' : 'Variance', value: spiLabel, color: spiColor },
    {
      label: isPolish ? 'Kamienie' : 'Milestones',
      value: `${milestoneDone}/${milestoneTotal}`,
      color:
        milestoneDone === milestoneTotal && milestoneTotal > 0
          ? 'text-emerald-500'
          : 'text-blue-500',
    },
    {
      label: isPolish ? 'Otwarte ryzyka' : 'Open risks',
      value: String(openRisks),
      color: openRisks > 2 ? 'text-red-500' : openRisks > 0 ? 'text-amber-500' : 'text-emerald-500',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="flex flex-col items-center p-3 rounded-2xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/50 dark:border-navy-700/50"
        >
          <span className="text-[10px] text-slate-500 mb-1">{c.label}</span>
          <span className={`text-sm font-bold ${c.color}`}>{c.value}</span>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT — N-mode canvas section
// ==========================================

export const TimelineSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    initiative,
    isPolish,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isGeneratingAI,
    handleGenerateAI,
    status,
    targetDate,
    setTargetDate,
    decisions,
    tasks,
    users,
    timelineMilestones,
    setTimelineMilestones,
    timelinePhases,
    setTimelinePhases,
    timelineLocked,
    baselineVersion,
    estimatedDurationMonths,
    setEstimatedDurationMonths,
    raidItems,
    dependencies,
  } = useInitiativeContext();

  // Local UI state
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseStart, setNewPhaseStart] = useState('');
  const [newPhaseEnd, setNewPhaseEnd] = useState('');

  // Planner handle ref (exposes openAddPanel)
  const plannerRef = useRef<TimelinePlannerHandle | null>(null);

  // Derived values
  const mode = getTimelineMode(status);
  const modeMeta = TIMELINE_MODE_META[mode];

  const plannedStart = startDate || initiative?.plannedStartDate || initiative?.planned_start_date;
  const plannedEnd = endDate || initiative?.plannedEndDate || initiative?.planned_end_date;
  const actualStart =
    initiative?.actualStartDate ||
    initiative?.actual_start_date ||
    initiative?.execution_started_at;
  const actualEnd = initiative?.actualEndDate || initiative?.actual_end_date;

  const duration = useMemo(() => daysBetween(plannedStart, plannedEnd), [plannedStart, plannedEnd]);

  const timelineProgress = useMemo(() => {
    if (!plannedStart || !plannedEnd) return 0;
    const start = new Date(plannedStart).getTime();
    const end = new Date(plannedEnd).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }, [plannedStart, plannedEnd]);

  const daysRemaining = useMemo(() => {
    if (!plannedEnd) return null;
    return daysBetween(new Date().toISOString(), plannedEnd);
  }, [plannedEnd]);

  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  const startVariance = useMemo(() => {
    if (!plannedStart || !actualStart) return null;
    return daysBetween(plannedStart, actualStart);
  }, [plannedStart, actualStart]);

  const endVariance = useMemo(() => {
    if (!plannedEnd || !actualEnd) return null;
    return daysBetween(plannedEnd, actualEnd);
  }, [plannedEnd, actualEnd]);

  const milestonesDone = timelineMilestones.filter((m) => m.status === 'completed').length;
  const openRisks = raidItems.filter((r) => r.type === 'risk' && r.status !== 'CLOSED').length;

  // Milestone actions
  const handleAddMilestone = useCallback(() => {
    if (!newMilestoneName.trim() || !newMilestoneDate) return;
    const ms: TimelineMilestone = {
      id: genId(),
      name: newMilestoneName.trim(),
      date: newMilestoneDate,
      status: 'pending',
    };
    setTimelineMilestones((prev) => [...prev, ms].sort((a, b) => a.date.localeCompare(b.date)));
    setNewMilestoneName('');
    setNewMilestoneDate('');
    setShowAddMilestone(false);
  }, [newMilestoneName, newMilestoneDate, setTimelineMilestones]);

  const handleRemoveMilestone = useCallback(
    (id: string) => setTimelineMilestones((prev) => prev.filter((m) => m.id !== id)),
    [setTimelineMilestones]
  );

  const handleToggleMilestoneStatus = useCallback(
    (id: string) =>
      setTimelineMilestones((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                status: m.status === 'completed' ? 'pending' : 'completed',
                actualDate:
                  m.status === 'completed' ? undefined : new Date().toISOString().split('T')[0],
              }
            : m
        )
      ),
    [setTimelineMilestones]
  );

  // Phase actions
  const handleAddPhaseAction = useCallback(() => {
    if (!newPhaseName.trim() || !newPhaseStart || !newPhaseEnd) return;
    const phase: TimelinePhase = {
      id: genId(),
      name: newPhaseName.trim(),
      startDate: newPhaseStart,
      endDate: newPhaseEnd,
      order: timelinePhases.length + 1,
    };
    setTimelinePhases((prev) =>
      [...prev, phase].sort((a, b) => a.startDate.localeCompare(b.startDate))
    );
    setNewPhaseName('');
    setNewPhaseStart('');
    setNewPhaseEnd('');
    setShowAddPhase(false);
  }, [newPhaseName, newPhaseStart, newPhaseEnd, timelinePhases.length, setTimelinePhases]);

  const handleRemovePhase = useCallback(
    (id: string) => setTimelinePhases((prev) => prev.filter((p) => p.id !== id)),
    [setTimelinePhases]
  );

  // ==========================================
  // RENDER — N-mode flat layout
  // ==========================================

  return (
    <div className="space-y-6">
      {/* ── Section Header (H2 + actions) ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Harmonogram' : 'Timeline'}
          </h2>
          <span className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${modeMeta.color}`}>
            {isPolish ? modeMeta.labelPl : modeMeta.label}
          </span>
          {timelineLocked && baselineVersion && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
              <Lock size={9} /> v{baselineVersion}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {daysRemaining !== null &&
            (mode === 'BASELINED' || mode === 'TRACKING' || mode === 'PLANNING') && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${
                  isOverdue
                    ? 'bg-red-500/10 text-red-500'
                    : daysRemaining <= 14
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-cyan-500/10 text-cyan-500'
                }`}
              >
                {isOverdue
                  ? `${Math.abs(daysRemaining)}d ${isPolish ? 'po terminie' : 'overdue'}`
                  : `${daysRemaining}d ${isPolish ? 'do końca' : 'left'}`}
              </span>
            )}
          <button
            onClick={() => plannerRef.current?.openAddPanel()}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary-500 transition-colors"
          >
            <Plus size={12} />
            {isPolish ? 'Dodaj' : 'Add item'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          MODE: ESTIMATE (DRAFT → REVIEW)
          ══════════════════════════════════════════════ */}
      {mode === 'ESTIMATE' && (
        <>
          <TimelinePlanner
            plannedStart={plannedStart || null}
            plannedEnd={plannedEnd || null}
            tasks={tasks}
            decisions={decisions}
            milestones={timelineMilestones}
            users={users}
            isPolish={isPolish}
            editable={true}
            onUpdateStart={(d) => setStartDate(d)}
            onUpdateEnd={(d) => setEndDate(d)}
            handleRef={plannerRef}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════
          MODE: PLANNING (PROMOTED → PLANNING)
          ══════════════════════════════════════════════ */}
      {mode === 'PLANNING' && (
        <>
          {/* Date summary strip */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Czas trwania' : 'Duration'}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {duration ? `${duration} ${isPolish ? 'dni' : 'days'}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">{isPolish ? 'Kwartał' : 'Quarter'}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {initiative?.targetQuarter || initiative?.target_quarter || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {isPolish ? 'Kamienie' : 'Milestones'}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {timelineMilestones.length}
                </span>
              </div>
            </div>
          </div>

          {/* Full timeline planner with Table / Gantt toggle */}
          <TimelinePlanner
            plannedStart={plannedStart || null}
            plannedEnd={plannedEnd || null}
            tasks={tasks}
            decisions={decisions}
            milestones={timelineMilestones}
            users={users}
            isPolish={isPolish}
            editable={true}
            onUpdateStart={(d) => setStartDate(d)}
            onUpdateEnd={(d) => setEndDate(d)}
            handleRef={plannerRef}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════
          MODE: READY_TO_LOCK (APPROVED)
          ══════════════════════════════════════════════ */}
      {mode === 'READY_TO_LOCK' && (
        <>
          <Callout variant="warning">
            {isPolish
              ? 'Harmonogram czeka na zatwierdzenie PMO (Schedule Lock). Po zatwierdzeniu daty zostaną zamrożone jako baseline.'
              : 'Timeline awaiting PMO approval (Schedule Lock). After approval, dates will be frozen as baseline.'}
          </Callout>

          {/* Read-only dates */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  {isPolish ? 'Data startu' : 'Start date'}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-white">
                  {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-[10px] text-slate-400 block mb-0.5">
                  {isPolish ? 'Data końca' : 'End date'}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-white">
                  {formatDate(plannedEnd, isPolish ? 'pl' : 'en')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {isPolish ? 'Czas trwania' : 'Duration'}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {duration ? `${duration} ${isPolish ? 'dni' : 'days'}` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">{isPolish ? 'Kwartał' : 'Quarter'}</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {initiative?.targetQuarter || initiative?.target_quarter || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Mini Timeline */}
          {plannedStart && plannedEnd && (
            <TimelineBar
              startDate={plannedStart}
              endDate={plannedEnd}
              milestones={timelineMilestones}
              phases={timelinePhases}
              isPolish={isPolish}
            />
          )}

          {/* Read-only milestones */}
          {timelineMilestones.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-3">
                {isPolish ? 'Kamienie milowe' : 'Milestones'}
              </span>
              <div className="space-y-1.5">
                {timelineMilestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-purple-500/60" />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{ms.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatDate(ms.date, isPolish ? 'pl' : 'en')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Readiness Checklist */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-3">
              {isPolish ? 'Gotowość harmonogramu' : 'Schedule Readiness'}
            </span>
            <div className="space-y-2">
              {[
                {
                  labelEn: 'Start & end dates defined',
                  labelPl: 'Daty start i koniec zdefiniowane',
                  met: !!plannedStart && !!plannedEnd,
                },
                {
                  labelEn: 'At least 1 milestone',
                  labelPl: 'Co najmniej 1 kamień milowy',
                  met: timelineMilestones.length >= 1,
                },
                {
                  labelEn: 'Dependencies mapped',
                  labelPl: 'Zależności zmapowane',
                  met: dependencies.length > 0,
                },
              ].map((item) => (
                <div
                  key={item.labelEn}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl ${
                    item.met
                      ? 'bg-emerald-500/5 border border-emerald-500/20'
                      : 'bg-slate-50/50 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      item.met ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'
                    }`}
                  >
                    {item.met ? (
                      <Check size={12} className="text-white" />
                    ) : (
                      <X size={12} className="text-white" />
                    )}
                  </div>
                  <span
                    className={`text-xs ${item.met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                  >
                    {isPolish ? item.labelPl : item.labelEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════
          MODE: BASELINED / TRACKING (SCHEDULED → EXECUTING)
          ══════════════════════════════════════════════ */}
      {(mode === 'BASELINED' || mode === 'TRACKING') && (
        <>
          {timelineLocked && (
            <Callout variant="success">
              {isPolish
                ? `Harmonogram zamrożony. Daty odzwierciedlają zatwierdzony baseline${baselineVersion ? ` v${baselineVersion}` : ''}.`
                : `Timeline is locked. Dates reflect the approved baseline${baselineVersion ? ` v${baselineVersion}` : ''}.`}
            </Callout>
          )}

          {/* Baseline vs Actual Table */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isPolish ? 'Baseline vs Rzeczywistość' : 'Baseline vs Actual'}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40 bg-slate-50/40 dark:bg-navy-800/30">
                  <th className="text-left px-5 py-2 text-slate-500 font-medium"> </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {isPolish ? 'Planowane' : 'Planned'}
                  </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {isPolish ? 'Rzeczywiste' : 'Actual'}
                  </th>
                  <th className="text-right px-5 py-2 text-slate-500 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">Start</td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {actualStart ? formatDate(actualStart, isPolish ? 'pl' : 'en') : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {startVariance !== null ? (
                      <span
                        className={
                          startVariance > 0
                            ? 'text-red-500'
                            : startVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-400'
                        }
                      >
                        {startVariance > 0 ? '+' : ''}
                        {startVariance}d
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">End</td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {formatDate(plannedEnd, isPolish ? 'pl' : 'en')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {actualEnd ? formatDate(actualEnd, isPolish ? 'pl' : 'en') : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {endVariance !== null ? (
                      <span
                        className={
                          endVariance > 0
                            ? 'text-red-500'
                            : endVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-400'
                        }
                      >
                        {endVariance > 0 ? '+' : ''}
                        {endVariance}d
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                    {isPolish ? 'Czas trwania' : 'Duration'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {duration ? `${duration} ${isPolish ? 'dni' : 'days'}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" colSpan={2}>
                    {actualStart
                      ? (() => {
                          const endPoint = actualEnd || new Date().toISOString();
                          const d = daysBetween(actualStart, endPoint);
                          return d !== null
                            ? `${d} ${isPolish ? 'dni' : 'days'}${!actualEnd ? (isPolish ? ' (w toku)' : ' (ongoing)') : ''}`
                            : '—';
                        })()
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Time Progress Bar */}
          {plannedStart && plannedEnd && (
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wide text-slate-500">
                  {isPolish ? 'Postęp czasu' : 'Time Progress'}
                </span>
                <span
                  className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-cyan-500'}`}
                >
                  {timelineProgress}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(timelineProgress, 100)}%` }}
                  className={`h-full rounded-full ${
                    isOverdue
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : timelineProgress > 80
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-slate-400">
                  {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                </span>
                <span className="text-[9px] text-slate-400">
                  {formatDate(plannedEnd, isPolish ? 'pl' : 'en')}
                </span>
              </div>
            </div>
          )}

          {/* Milestone Tracking */}
          {timelineMilestones.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-3">
                {isPolish ? 'Śledzenie kamieni milowych' : 'Milestone Tracking'}
              </span>
              <div className="space-y-1.5">
                {timelineMilestones.map((ms) => {
                  const msVariance =
                    ms.actualDate && ms.date ? daysBetween(ms.date, ms.actualDate) : null;
                  return (
                    <div
                      key={ms.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40 group"
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleToggleMilestoneStatus(ms.id)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                            ms.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-slate-200 dark:bg-navy-700 hover:bg-emerald-200 dark:hover:bg-emerald-800'
                          }`}
                        >
                          {ms.status === 'completed' && <Check size={12} className="text-white" />}
                        </button>
                        <span
                          className={`text-xs ${ms.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {ms.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {formatDate(ms.date, isPolish ? 'pl' : 'en')}
                        </span>
                        {ms.actualDate && (
                          <span className="text-[10px] text-slate-500">
                            → {formatDate(ms.actualDate, isPolish ? 'pl' : 'en')}
                          </span>
                        )}
                        {msVariance !== null && (
                          <span
                            className={`text-[10px] font-medium ${msVariance > 0 ? 'text-red-500' : msVariance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}
                          >
                            {msVariance > 0 ? '+' : ''}
                            {msVariance}d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Health Indicators */}
          <HealthIndicators
            startVariance={startVariance}
            milestoneDone={milestonesDone}
            milestoneTotal={timelineMilestones.length}
            openRisks={openRisks}
            isPolish={isPolish}
          />
        </>
      )}

      {/* ══════════════════════════════════════════════
          MODE: COMPLETED (DONE → TRACKING)
          ══════════════════════════════════════════════ */}
      {mode === 'COMPLETED' && (
        <>
          {/* Execution Summary */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {isPolish ? 'Podsumowanie realizacji' : 'Execution Summary'}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40 bg-slate-50/40 dark:bg-navy-800/30">
                  <th className="text-left px-5 py-2 text-slate-500 font-medium"> </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {isPolish ? 'Planowane' : 'Planned'}
                  </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {isPolish ? 'Rzeczywiste' : 'Actual'}
                  </th>
                  <th className="text-right px-5 py-2 text-slate-500 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">Start</td>
                  <td className="px-3 py-2.5">
                    {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                  </td>
                  <td className="px-3 py-2.5">
                    {actualStart ? formatDate(actualStart, isPolish ? 'pl' : 'en') : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {startVariance !== null ? (
                      <span
                        className={
                          startVariance > 0
                            ? 'text-red-500'
                            : startVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-400'
                        }
                      >
                        {startVariance > 0 ? '+' : ''}
                        {startVariance}d
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">End</td>
                  <td className="px-3 py-2.5">{formatDate(plannedEnd, isPolish ? 'pl' : 'en')}</td>
                  <td className="px-3 py-2.5">
                    {actualEnd ? formatDate(actualEnd, isPolish ? 'pl' : 'en') : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {endVariance !== null ? (
                      <span
                        className={
                          endVariance > 0
                            ? 'text-red-500'
                            : endVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-400'
                        }
                      >
                        {endVariance > 0 ? '+' : ''}
                        {endVariance}d
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Final milestones */}
          {timelineMilestones.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-3">
                {isPolish ? 'Kamienie milowe — wynik' : 'Milestones — Final'}
              </span>
              <div className="space-y-1.5">
                {timelineMilestones.map((ms) => {
                  const msVariance =
                    ms.actualDate && ms.date ? daysBetween(ms.date, ms.actualDate) : null;
                  return (
                    <div
                      key={ms.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            ms.status === 'completed'
                              ? 'bg-emerald-500'
                              : ms.status === 'missed'
                                ? 'bg-red-500'
                                : 'bg-slate-300 dark:bg-navy-600'
                          }`}
                        >
                          {ms.status === 'completed' ? (
                            <Check size={12} className="text-white" />
                          ) : ms.status === 'missed' ? (
                            <X size={12} className="text-white" />
                          ) : (
                            <Clock size={12} className="text-white" />
                          )}
                        </div>
                        <span className="text-xs text-slate-700 dark:text-slate-300">
                          {ms.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          {formatDate(ms.date, isPolish ? 'pl' : 'en')}
                        </span>
                        {ms.actualDate && (
                          <>
                            <ChevronRight size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-500">
                              {formatDate(ms.actualDate, isPolish ? 'pl' : 'en')}
                            </span>
                          </>
                        )}
                        {msVariance !== null && (
                          <span
                            className={`text-[10px] font-medium ${msVariance > 0 ? 'text-red-500' : msVariance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}
                          >
                            {msVariance > 0 ? '+' : ''}
                            {msVariance}d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Final Health Badge */}
          {(endVariance !== null || startVariance !== null) && (
            <div className="text-center py-6 rounded-2xl bg-white/70 dark:bg-navy-900/70 border border-slate-200/60 dark:border-navy-700/60">
              {endVariance !== null && endVariance <= 0 ? (
                <>
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {isPolish ? 'W terminie' : 'On time'}
                    {endVariance < 0 &&
                      ` (${Math.abs(endVariance)} ${isPolish ? 'dni wcześniej' : 'days early'})`}
                  </p>
                </>
              ) : endVariance !== null ? (
                <>
                  <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {isPolish ? 'Opóźnione' : 'Delayed'} (+{endVariance} {isPolish ? 'dni' : 'days'}
                    )
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm text-slate-500">{isPolish ? 'Zakończone' : 'Completed'}</p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
