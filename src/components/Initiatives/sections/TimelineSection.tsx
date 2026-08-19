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

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  GanttChartSquare,
  Info,
  Lock,
  Plus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { buildScheduleItems, computeCriticalPath } from '@/services/initiativeSchedule';

import { InitiativeCalendar } from '../calendar';
import { InitiativeGantt } from '../gantt';
import { useInitiativeContext } from './InitiativeContext';
import type { TimelinePlannerHandle } from './TimelinePlanner';
import { TimelinePlanner } from './TimelinePlanner';
import type { InitiativeSectionProps, TimelineMilestone, TimelinePhase } from './types';
import { getTimelineMode, TIMELINE_MODE_META } from './types';

// ==========================================
// HELPERS
// ==========================================

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

// ==========================================
// AI — Timeline Planning
// ==========================================

type TimelineAiProposal = {
  version: 'timeline_proposal_v1';
  note?: string;
  proposedStartDate: string | null;
  proposedEndDate: string | null;
  phases: Array<{ name: string; startDate: string | null; endDate: string | null }>;
  milestones: Array<{ name: string; date: string | null; status: 'pending' }>;
  rows: Array<{
    tempId: string;
    type:
      | 'task'
      | 'milestone'
      | 'decision'
      | 'info_event'
      | 'notification'
      | 'meeting'
      | 'pause'
      | 'escalation';
    name: string;
    schedulingMode: 'after_previous' | 'fixed_date';
    startDate: string | null;
    durationDays: number | null;
    endDate: string | null;
    estimatedHours: number | null;
    assigneeUserId: string | null;
    linkedTaskId: string | null;
    linkedDecisionId: string | null;
    decisionBlocksNext: boolean | null;
    audience: string | null;
    infoEvent: null | {
      mode: 'cyclical' | 'specific_date' | 'after_event';
      cadence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom' | null;
      assetType: 'internal_report' | 'generated_presentation' | 'external_link' | 'other' | null;
      assetLabel: string | null;
    };
    notification: null | {
      triggerMode: 'cyclical' | 'event_based';
      triggerEvent: 'on_start' | 'on_complete' | 'before_next_action' | 'manual_gate' | null;
      leadDays: number | null;
      cadence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom' | null;
      channel: 'email' | 'slack' | 'meeting' | 'dashboard' | 'other';
      recipientMode: 'person' | 'group';
      recipientUserId: string | null;
      recipientGroupKey:
        | 'project_team'
        | 'steering_committee'
        | 'sponsor_group'
        | 'all_stakeholders'
        | 'custom_group'
        | null;
      rule: string | null;
      message: string | null;
      aiAutoSend: boolean | null;
      aiInstruction: string | null;
    };
    meeting: null | {
      cadence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
      channel: 'online' | 'onsite' | 'hybrid';
      agenda: string | null;
    };
    pauseReason: string | null;
    escalationLevel: string | null;
  }>;
  proposedDependencies: Array<{
    fromTempId: string;
    toTempId: string;
    type: 'FS' | 'SS' | 'FF' | 'SF';
    rationale: string;
  }>;
  criticalPath: string[];
  missingInfo: string[];
  assumptions: string[];
  questions: string[];
};

const safeJsonParse = (raw: string): any | null => {
  const text = String(raw || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

function normalizeIsoDate(input: unknown): string | null {
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || null;
}

function sanitizeTempId(input: unknown): string {
  const s = String(input || '').trim();
  if (!s) return `x${Math.random().toString(36).slice(2, 8)}`;
  return s.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48) || `x${Date.now()}`;
}

function buildTimelineAnalyzeInstruction(): string {
  return [
    `You are a senior PMO / program delivery lead specializing in building realistic, end-to-end initiative timelines.`,
    ``,
    `GOAL`,
    `Create a complete, execution-ready timeline plan for the initiative by sequencing work, governance, and communications into a single coherent flow:`,
    `- tasks and delivery work,`,
    `- decision checkpoints (GO / NO-GO / escalation gates),`,
    `- communications & reporting,`,
    `- recurring meetings (cadence + agenda),`,
    `- notifications (cyclical and event-based),`,
    `- escalations and planned pauses (only if context implies),`,
    `- dependencies between timeline items and a best-effort critical path candidate.`,
    ``,
    `You will receive the full context in the user message (initiative context, users, tasks/decisions/RAID/dependencies, current milestones/phases, and constraints). Use ONLY that context. Do not invent people, dates, vendors, or facts not present.`,
    ``,
    `ABSOLUTE OUTPUT RULES`,
    `- Return ONLY valid JSON. No markdown. No code fences. No commentary.`,
    `- OUTPUT LANGUAGE: English only (translate any non-English context to English).`,
    `- If information is missing, use null and capture it in "missingInfo" / "questions".`,
    `- Be realistic and lean: prefer the minimum set that still makes delivery controllable.`,
    `- Never propose deleting existing items. Only propose: additions + better structure + sequencing.`,
    `- We will apply dependencies only after user acceptance; still propose them in JSON.`,
    ``,
    `DATA ALIGNMENT REQUIREMENTS`,
    `- If referencing an existing task from [TASKS SNAPSHOT], set linkedTaskId (and do NOT duplicate it as a new task).`,
    `- If referencing an existing decision from [DECISIONS SNAPSHOT], set linkedDecisionId.`,
    `- Use person recipients ONLY if the userId exists in [USERS]. Prefer group recipients where possible.`,
    ``,
    `QUALITY BAR`,
    `- A coherent end-to-end flow (not just a list).`,
    `- Include kickoff, governance decisions that unblock progress, reporting cadence, notifications, and (when relevant) go-live decision + stabilization.`,
    `- Dependencies must be plausible and not overly dense.`,
    ``,
    `Return ONLY valid JSON matching this schema EXACTLY:`,
    `{`,
    `  "version": "timeline_proposal_v1",`,
    `  "note": "optional short note",`,
    `  "proposedStartDate": "YYYY-MM-DD" | null,`,
    `  "proposedEndDate": "YYYY-MM-DD" | null,`,
    `  "phases": [{ "name": string, "startDate": "YYYY-MM-DD" | null, "endDate": "YYYY-MM-DD" | null }],`,
    `  "milestones": [{ "name": string, "date": "YYYY-MM-DD" | null, "status": "pending" }],`,
    `  "rows": [`,
    `    {`,
    `      "tempId": string,`,
    `      "type": "task"|"milestone"|"decision"|"info_event"|"notification"|"meeting"|"pause"|"escalation",`,
    `      "name": string,`,
    `      "schedulingMode": "after_previous"|"fixed_date",`,
    `      "startDate": "YYYY-MM-DD" | null,`,
    `      "durationDays": number | null,`,
    `      "endDate": "YYYY-MM-DD" | null,`,
    `      "estimatedHours": number | null,`,
    `      "assigneeUserId": string | null,`,
    `      "linkedTaskId": string | null,`,
    `      "linkedDecisionId": string | null,`,
    `      "decisionBlocksNext": boolean | null,`,
    `      "audience": string | null,`,
    `      "infoEvent": { "mode": "cyclical"|"specific_date"|"after_event", "cadence": "daily"|"weekly"|"biweekly"|"monthly"|"custom"|null, "assetType": "internal_report"|"generated_presentation"|"external_link"|"other"|null, "assetLabel": string|null } | null,`,
    `      "notification": { "triggerMode": "cyclical"|"event_based", "triggerEvent": "on_start"|"on_complete"|"before_next_action"|"manual_gate"|null, "leadDays": number|null, "cadence": "daily"|"weekly"|"biweekly"|"monthly"|"custom"|null, "channel": "email"|"slack"|"meeting"|"dashboard"|"other", "recipientMode": "person"|"group", "recipientUserId": string|null, "recipientGroupKey": "project_team"|"steering_committee"|"sponsor_group"|"all_stakeholders"|"custom_group"|null, "rule": string|null, "message": string|null, "aiAutoSend": boolean|null, "aiInstruction": string|null } | null,`,
    `      "meeting": { "cadence": "daily"|"weekly"|"biweekly"|"monthly"|"custom", "channel": "online"|"onsite"|"hybrid", "agenda": string|null } | null,`,
    `      "pauseReason": string | null,`,
    `      "escalationLevel": string | null`,
    `    }`,
    `  ],`,
    `  "proposedDependencies": [{ "fromTempId": string, "toTempId": string, "type": "FS"|"SS"|"FF"|"SF", "rationale": string }],`,
    `  "criticalPath": [string],`,
    `  "missingInfo": [string],`,
    `  "assumptions": [string],`,
    `  "questions": [string]`,
    `}`,
    ``,
    `SIZE LIMITS`,
    `- phases: 3–6`,
    `- milestones: 6–14`,
    `- rows: 14–40`,
    `- proposedDependencies: 8–35`,
  ].join('\n');
}

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
      'bg-amber-100 dark:bg-amber-500/5 border-l-4 border-l-amber-500 border-amber-300/50 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
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
  const { t } = useTranslation();
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
    'bg-blue-500/30 dark:bg-blue-500/20',
    'bg-blue-500/30 dark:bg-blue-500/20',
    'bg-c-info/30 dark:bg-c-info/20',
    'bg-c-info/30 dark:bg-c-info/20',
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
            className="absolute top-0 h-full bg-gradient-to-r from-blue-500/50 to-blue-500/50 rounded-full"
          />
        )}
      </div>

      {/* Today marker */}
      {showProgress && progressPercent > 0 && progressPercent < 100 && (
        <div
          className="absolute top-0 w-0.5 h-5 bg-blue-500 dark:bg-blue-400"
          style={{ left: `${progressPercent}%` }}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-blue-500 whitespace-nowrap">
            {t('initiatives.timelineSection.today')}
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
                    ? 'bg-danger-500 border-danger-500'
                    : 'bg-white dark:bg-navy-800 border-c-info'
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
            <span className="text-[8px] text-slate-600">{m.label}</span>
          </div>
        </div>
      ))}

      {/* Start / End labels */}
      <div className="flex justify-between mt-3">
        <span className="text-[9px] text-slate-600">
          {formatDate(startDate, isPolish ? 'pl' : 'en')}
        </span>
        <span className="text-[9px] text-slate-600">
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
  const { t } = useTranslation();
  const spiLabel =
    startVariance === null
      ? '—'
      : startVariance <= 0
        ? t('initiatives.timelineSection.onTime')
        : `+${startVariance}d`;
  const spiColor =
    startVariance === null
      ? 'text-slate-600'
      : startVariance <= 0
        ? 'text-emerald-500'
        : startVariance <= 7
          ? 'text-amber-500'
          : 'text-danger-500';

  const cards = [
    { label: t('initiatives.timelineSection.variance'), value: spiLabel, color: spiColor },
    {
      label: t('initiatives.timelineSection.milestonesShort'),
      value: `${milestoneDone}/${milestoneTotal}`,
      color:
        milestoneDone === milestoneTotal && milestoneTotal > 0
          ? 'text-emerald-500'
          : 'text-blue-500',
    },
    {
      label: t('initiatives.timelineSection.openRisks'),
      value: String(openRisks),
      color:
        openRisks > 2 ? 'text-danger-500' : openRisks > 0 ? 'text-amber-500' : 'text-emerald-500',
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
  sectionType: _sectionType,
  expanded: _expanded,
  onToggle: _onToggle,
}) => {
  const { t } = useTranslation();
  const {
    initiative,
    isPolish,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    status,
    targetDate,
    decisions,
    tasks,
    setTasks,
    users,
    timelineMilestones,
    setTimelineMilestones,
    timelinePhases,
    setTimelinePhases,
    timelineLocked,
    baselineVersion,
    estimatedDurationMonths,
    raidItems,
    dependencies,
    timelineAiRequest,
    clearTimelineAiRequest,
  } = useInitiativeContext();

  // M13 Depth · Seria R (M13c) — unified schedule for the calendar view.
  // Single source (buildScheduleItems) shared with the future task Gantt (V1).
  const scheduleItems = useMemo(
    () =>
      buildScheduleItems({
        tasks: tasks || [],
        milestones: timelineMilestones || [],
        timeline: timelinePhases || [],
      }),
    [tasks, timelineMilestones, timelinePhases]
  );

  // V1 Gantt — dependency edges (mapped to ScheduleItem ids by sourceId) + the
  // critical path (longest-duration chain), both fed to the Gantt connectors.
  const ganttDependencies = useMemo(() => {
    const idBySource = new Map(scheduleItems.map((it) => [String(it.sourceId), it.id]));
    return (
      ((dependencies as any[]) || [])
        // The task-dependencies endpoint returns BOTH directions per edge
        // ({direction:'predecessor'} and {direction:'successor'}). Keep one
        // ('successor': sourceTaskId=predecessor, taskId=successor) so each edge
        // is drawn once, in the predecessor→successor direction. Entries from
        // other sources (no `direction`) pass through untouched.
        .filter((d: any) => !d?.direction || d.direction === 'successor')
        .map((d: any) => {
          const fromSrc = d?.fromId ?? d?.sourceId ?? d?.sourceTaskId ?? d?.dependsOnId;
          const toSrc = d?.toId ?? d?.targetId ?? d?.taskId;
          const fromId = fromSrc != null ? idBySource.get(String(fromSrc)) : undefined;
          const toId = toSrc != null ? idBySource.get(String(toSrc)) : undefined;
          return fromId && toId && fromId !== toId ? { fromId, toId } : null;
        })
        .filter(Boolean) as Array<{ fromId: string; toId: string }>
    );
  }, [scheduleItems, dependencies]);

  const criticalPathIds = useMemo(
    () => computeCriticalPath(scheduleItems, ganttDependencies),
    [scheduleItems, ganttDependencies]
  );

  const [scheduleView, setScheduleView] = useState<'none' | 'calendar' | 'gantt'>('none');

  // AI proposal state (Analyze with AI)
  const [aiBusy, setAiBusy] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProposal, setAiProposal] = useState<TimelineAiProposal | null>(null);
  const [applyStartEnd, setApplyStartEnd] = useState(true);
  const [applyPhases, setApplyPhases] = useState(true);
  const [applyMilestones, setApplyMilestones] = useState(true);
  const [applyRows, setApplyRows] = useState(true);
  const [selectedRowByTempId, setSelectedRowByTempId] = useState<Record<string, boolean>>({});
  const [lockCriticalPathChain, setLockCriticalPathChain] = useState(true);
  const [criticalPathKeepByTempId, setCriticalPathKeepByTempId] = useState<Record<string, boolean>>(
    {}
  );
  const [applyOnlyPrimaryDependencies, setApplyOnlyPrimaryDependencies] = useState(true);
  const [primaryDependencyByToTempId, setPrimaryDependencyByToTempId] = useState<
    Record<string, { fromTempId: string; type: 'FS' | 'SS' | 'FF' | 'SF' } | null>
  >({});

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

  // Triggered from CTA bar ("Analyze with AI") — consistent with other sections.
  useEffect(() => {
    if (!timelineAiRequest) return;
    const run = async () => {
      try {
        await runTimelineAiAnalyze();
      } finally {
        clearTimelineAiRequest?.();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineAiRequest?.nonce]);

  const buildAiContextText = useCallback((): string => {
    const usersCompact = (users || []).slice(0, 60).map((u) => ({
      id: String(u?.id || ''),
      firstName: String(u?.firstName || ''),
      lastName: String(u?.lastName || ''),
      email: u?.email ? String(u.email) : null,
    }));
    const tasksCompact = (tasks || []).slice(0, 40).map((t: any) => ({
      id: String(t?.id || ''),
      title: String(t?.title || ''),
      status: String(t?.status || ''),
      assigneeId: t?.assigneeId ? String(t.assigneeId) : null,
      assigneeName: t?.assigneeName ? String(t.assigneeName) : null,
      dueDate: t?.dueDate ? String(t.dueDate) : null,
      estimatedHours:
        typeof t?.estimatedHours === 'number'
          ? Number(t.estimatedHours)
          : (t?.estimatedHours ?? null),
    }));
    const decisionsCompact = (decisions || []).slice(0, 30).map((d: any) => ({
      id: String(d?.id || ''),
      title: String(d?.title || ''),
      type: String(d?.type || ''),
      status: String(d?.status || ''),
      dueDate: d?.dueDate ? String(d.dueDate) : null,
      priority: d?.priority ? String(d.priority) : null,
    }));
    const raidCompact = (raidItems || []).slice(0, 30).map((r: any) => ({
      id: String(r?.id || ''),
      type: String(r?.type || ''),
      title: String(r?.title || ''),
      severity: r?.severity ? String(r.severity) : null,
      status: r?.status ? String(r.status) : null,
    }));
    const depsCompact = (dependencies || []).slice(0, 60).map((d: any) => ({
      fromId: d?.fromId ? String(d.fromId) : d?.sourceId ? String(d.sourceId) : null,
      toId: d?.toId ? String(d.toId) : d?.targetId ? String(d.targetId) : null,
      type: d?.type ? String(d.type) : null,
      note: d?.note ? String(d.note) : null,
    }));

    return [
      `[INITIATIVE CONTEXT]`,
      `Name: ${initiative?.name || ''}`,
      `Status: ${initiative?.status || status || ''}`,
      `Priority: ${initiative?.priority || ''}`,
      `Summary: ${(initiative?.summary || initiative?.description || '').toString()}`,
      `Target date: ${targetDate || initiative?.targetDate || initiative?.target_date || ''}`,
      `Planned start: ${plannedStart || ''}`,
      `Planned end: ${plannedEnd || ''}`,
      `Estimated duration months: ${estimatedDurationMonths ?? ''}`,
      ``,
      `[USERS]`,
      JSON.stringify(usersCompact, null, 2),
      ``,
      `[TASKS SNAPSHOT]`,
      JSON.stringify(tasksCompact, null, 2),
      ``,
      `[DECISIONS SNAPSHOT]`,
      JSON.stringify(decisionsCompact, null, 2),
      ``,
      `[RAID SNAPSHOT]`,
      JSON.stringify(raidCompact, null, 2),
      ``,
      `[DEPENDENCIES SNAPSHOT]`,
      JSON.stringify(depsCompact, null, 2),
      ``,
      `[CURRENT TIMELINE PHASES]`,
      JSON.stringify(
        (timelinePhases || []).map((p) => ({
          id: p.id,
          name: p.name,
          startDate: p.startDate,
          endDate: p.endDate,
        })),
        null,
        2
      ),
      ``,
      `[CURRENT TIMELINE MILESTONES]`,
      JSON.stringify(
        (timelineMilestones || []).map((m) => ({
          id: m.id,
          name: m.name,
          date: m.date,
          status: m.status,
        })),
        null,
        2
      ),
    ].join('\n');
  }, [
    decisions,
    dependencies,
    estimatedDurationMonths,
    initiative,
    plannedEnd,
    plannedStart,
    raidItems,
    status,
    targetDate,
    tasks,
    timelineMilestones,
    timelinePhases,
    users,
  ]);

  const normalizeProposal = useCallback((): TimelineAiProposal | null => {
    const p = aiProposal as any;
    if (!p || p.version !== 'timeline_proposal_v1') return null;
    const phasesRaw = Array.isArray(p.phases) ? p.phases : [];
    const milestonesRaw = Array.isArray(p.milestones) ? p.milestones : [];
    const rowsRaw = Array.isArray(p.rows) ? p.rows : [];
    const depsRaw = Array.isArray(p.proposedDependencies) ? p.proposedDependencies : [];
    const cpRaw = Array.isArray(p.criticalPath) ? p.criticalPath : [];

    const out: TimelineAiProposal = {
      version: 'timeline_proposal_v1',
      note: p.note ? String(p.note) : undefined,
      proposedStartDate: normalizeIsoDate(p.proposedStartDate),
      proposedEndDate: normalizeIsoDate(p.proposedEndDate),
      phases: phasesRaw
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          startDate: normalizeIsoDate(x?.startDate),
          endDate: normalizeIsoDate(x?.endDate),
        }))
        .filter((x: any) => x.name),
      milestones: milestonesRaw
        .map((x: any) => ({
          name: String(x?.name || '').trim(),
          date: normalizeIsoDate(x?.date),
          status: 'pending' as const,
        }))
        .filter((x: any) => x.name),
      rows: rowsRaw
        .map((x: any) => ({
          tempId: sanitizeTempId(x?.tempId),
          type: String(x?.type || 'task'),
          name: String(x?.name || '').trim(),
          schedulingMode:
            String(x?.schedulingMode) === 'fixed_date' ? 'fixed_date' : 'after_previous',
          startDate: normalizeIsoDate(x?.startDate),
          durationDays:
            typeof x?.durationDays === 'number'
              ? Number(x.durationDays)
              : x?.durationDays !== null && x?.durationDays !== undefined
                ? Number(x.durationDays) || null
                : null,
          endDate: normalizeIsoDate(x?.endDate),
          estimatedHours:
            typeof x?.estimatedHours === 'number'
              ? Number(x.estimatedHours)
              : x?.estimatedHours !== null && x?.estimatedHours !== undefined
                ? Number(x.estimatedHours) || null
                : null,
          assigneeUserId: x?.assigneeUserId ? String(x.assigneeUserId) : null,
          linkedTaskId: x?.linkedTaskId ? String(x.linkedTaskId) : null,
          linkedDecisionId: x?.linkedDecisionId ? String(x.linkedDecisionId) : null,
          decisionBlocksNext:
            typeof x?.decisionBlocksNext === 'boolean' ? x.decisionBlocksNext : null,
          audience: x?.audience ? String(x.audience) : null,
          infoEvent: x?.infoEvent && typeof x.infoEvent === 'object' ? x.infoEvent : null,
          notification:
            x?.notification && typeof x.notification === 'object' ? x.notification : null,
          meeting: x?.meeting && typeof x.meeting === 'object' ? x.meeting : null,
          pauseReason: x?.pauseReason ? String(x.pauseReason) : null,
          escalationLevel: x?.escalationLevel ? String(x.escalationLevel) : null,
        }))
        .filter((x: any) => !!x.tempId && !!x.name) as any,
      proposedDependencies: depsRaw
        .map((x: any) => ({
          fromTempId: sanitizeTempId(x?.fromTempId),
          toTempId: sanitizeTempId(x?.toTempId),
          type: String(x?.type || 'FS') as any,
          rationale: String(x?.rationale || '').trim(),
        }))
        .filter((x: any) => x.fromTempId && x.toTempId && x.fromTempId !== x.toTempId),
      criticalPath: cpRaw.map((x: any) => sanitizeTempId(x)).filter(Boolean),
      missingInfo: Array.isArray(p.missingInfo) ? p.missingInfo.map((s: any) => String(s)) : [],
      assumptions: Array.isArray(p.assumptions) ? p.assumptions.map((s: any) => String(s)) : [],
      questions: Array.isArray(p.questions) ? p.questions.map((s: any) => String(s)) : [],
    };

    // Normalize row type allowlist
    const allowed = new Set([
      'task',
      'milestone',
      'decision',
      'info_event',
      'notification',
      'meeting',
      'pause',
      'escalation',
    ]);
    (out.rows as any) = out.rows.map((r: any) => ({
      ...r,
      type: allowed.has(String(r.type)) ? r.type : 'task',
    }));

    return out;
  }, [aiProposal]);

  const buildDependencyCandidates = useCallback((p: TimelineAiProposal) => {
    const rowsByTempId = new Map(p.rows.map((r) => [r.tempId, r]));
    const candidatesByTo = new Map<
      string,
      Array<{ fromTempId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; rationale?: string }>
    >();
    for (const d of p.proposedDependencies || []) {
      if (!rowsByTempId.has(d.fromTempId) || !rowsByTempId.has(d.toTempId)) continue;
      const list = candidatesByTo.get(d.toTempId) || [];
      list.push({
        fromTempId: d.fromTempId,
        type: d.type,
        rationale: d.rationale,
      });
      candidatesByTo.set(d.toTempId, list);
    }
    // Prefer FS first in UI
    for (const [to, list] of candidatesByTo.entries()) {
      list.sort((a, b) => (a.type === 'FS' ? -1 : 1) - (b.type === 'FS' ? -1 : 1));
      candidatesByTo.set(to, list);
    }
    return candidatesByTo;
  }, []);

  const computeDependencyPlan = useCallback(
    (p: TimelineAiProposal) => {
      const selectedTempIds = p.rows
        .filter((r) => !!selectedRowByTempId[r.tempId])
        .map((r) => r.tempId);
      const selectedSet = new Set(selectedTempIds);

      const depsForTo = new Map<string, { fromTempId: string; type: 'FS' | 'SS' | 'FF' | 'SF' }>();

      // 1) Critical Path chain (FS) — if locked
      const cp = (p.criticalPath || []).filter((tid) => selectedSet.has(tid));
      const keptCp = cp.filter((tid) => criticalPathKeepByTempId[tid] !== false);
      if (lockCriticalPathChain) {
        for (let i = 1; i < keptCp.length; i++) {
          const fromTempId = keptCp[i - 1];
          const toTempId = keptCp[i];
          if (fromTempId && toTempId && fromTempId !== toTempId) {
            depsForTo.set(toTempId, { fromTempId, type: 'FS' });
          }
        }
      }

      // 2) Primary dependencies (user-selected) OR AI defaults
      if (applyOnlyPrimaryDependencies) {
        for (const toTempId of selectedTempIds) {
          if (depsForTo.has(toTempId)) continue; // do not override CP
          const picked = primaryDependencyByToTempId[toTempId];
          if (picked && selectedSet.has(picked.fromTempId) && picked.fromTempId !== toTempId) {
            depsForTo.set(toTempId, picked);
          }
        }
      } else {
        for (const d of p.proposedDependencies || []) {
          if (!selectedSet.has(d.fromTempId) || !selectedSet.has(d.toTempId)) continue;
          if (depsForTo.has(d.toTempId)) continue; // do not override CP
          const existing = depsForTo.get(d.toTempId);
          if (!existing) {
            depsForTo.set(d.toTempId, { fromTempId: d.fromTempId, type: d.type });
            continue;
          }
          if (existing.type !== 'FS' && d.type === 'FS') {
            depsForTo.set(d.toTempId, { fromTempId: d.fromTempId, type: d.type });
          }
        }
      }

      // 3) Fallback chain for after_previous items (keeps schedule coherent)
      const ordered = p.rows.filter((r) => selectedSet.has(r.tempId));
      for (let i = 0; i < ordered.length; i++) {
        const r = ordered[i];
        if (r.schedulingMode !== 'after_previous') continue;
        if (depsForTo.has(r.tempId)) continue;
        const prev = ordered[i - 1];
        if (!prev) continue;
        if (prev.tempId === r.tempId) continue;
        depsForTo.set(r.tempId, { fromTempId: prev.tempId, type: 'FS' });
      }

      return { depsForTo, keptCp };
    },
    [
      applyOnlyPrimaryDependencies,
      criticalPathKeepByTempId,
      lockCriticalPathChain,
      primaryDependencyByToTempId,
      selectedRowByTempId,
    ]
  );

  const detectCycles = useCallback((depsForTo: Map<string, { fromTempId: string }>) => {
    // Each node has at most one incoming edge; detect cycles by pointer-chasing.
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const parent = new Map<string, string>();

    const nodes = Array.from(depsForTo.keys());
    for (const start of nodes) {
      if (visited.has(start)) continue;
      let curr: string | undefined = start;
      while (curr && depsForTo.has(curr) && !visited.has(curr)) {
        visited.add(curr);
        inStack.add(curr);
        const nextId: string | undefined = depsForTo.get(curr)?.fromTempId;
        if (!nextId) break;
        if (!parent.has(nextId)) parent.set(nextId, curr);
        if (inStack.has(nextId)) {
          // cycle found: reconstruct
          const cycle: string[] = [nextId];
          let p = curr;
          while (p && p !== nextId) {
            cycle.push(p);
            p = depsForTo.get(p)?.fromTempId || '';
            if (!p) break;
          }
          cycle.reverse();
          return cycle;
        }
        curr = nextId;
      }
      inStack.clear();
      parent.clear();
    }
    return null;
  }, []);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedRowByTempId({});
    setCriticalPathKeepByTempId({});
    setPrimaryDependencyByToTempId({});
  }, []);

  const runTimelineAiAnalyze = useCallback(async () => {
    if (aiBusy) return;
    if (timelineLocked) {
      toast.error(t('initiatives.timelineSection.timelineLocked'));
      return;
    }
    setAiBusy(true);
    try {
      const contextText = buildAiContextText();
      const systemInstruction = buildTimelineAnalyzeInstruction();
      const res = await Api.post('/ai/refine-text', {
        text: contextText,
        mode: 'generate',
        systemInstruction,
        fieldLabel: 'Timeline: analyze',
        artifactContext: {
          title: initiative?.name || '',
          status: initiative?.status || status || '',
          priority: initiative?.priority || '',
          type: 'initiative',
        },
        language: 'en',
      });

      const parsed = safeJsonParse(String(res?.text || ''));
      if (!parsed) {
        toast.error(t('initiatives.timelineSection.failedParseAi'));
        return;
      }

      setAiProposal(parsed as any);
      const normalized = (() => {
        // Use state-based normalize function by temporarily binding via setAiProposal result is async; normalize directly here.
        const p = parsed as any;
        if (!p || p.version !== 'timeline_proposal_v1') return null;
        return p;
      })();
      if (!normalized) {
        toast.error(t('initiatives.timelineSection.unsupportedAiFormat'));
        return;
      }

      // Initialize selections: all rows selected by default
      const rows = Array.isArray((parsed as any)?.rows) ? (parsed as any).rows : [];
      const initSel: Record<string, boolean> = {};
      rows.forEach((r: any) => {
        const tid = sanitizeTempId(r?.tempId);
        if (tid) initSel[tid] = true;
      });
      setSelectedRowByTempId(initSel);
      setLockCriticalPathChain(true);
      const cp = Array.isArray((parsed as any)?.criticalPath) ? (parsed as any).criticalPath : [];
      const cpKeep: Record<string, boolean> = {};
      cp.forEach((tid: any) => {
        const id = sanitizeTempId(tid);
        if (id) cpKeep[id] = true;
      });
      setCriticalPathKeepByTempId(cpKeep);
      setApplyOnlyPrimaryDependencies(true);

      // Default primary deps: per "to", pick first (prefer FS order comes from AI or later UI)
      const deps = Array.isArray((parsed as any)?.proposedDependencies)
        ? (parsed as any).proposedDependencies
        : [];
      const primary: Record<
        string,
        { fromTempId: string; type: 'FS' | 'SS' | 'FF' | 'SF' } | null
      > = {};
      deps.forEach((d: any) => {
        const toTempId = sanitizeTempId(d?.toTempId);
        const fromTempId = sanitizeTempId(d?.fromTempId);
        const type = String(d?.type || 'FS') as 'FS' | 'SS' | 'FF' | 'SF';
        if (!toTempId || !fromTempId || toTempId === fromTempId) return;
        if (primary[toTempId]) return;
        primary[toTempId] = { fromTempId, type };
      });
      setPrimaryDependencyByToTempId(primary);
      setApplyStartEnd(true);
      setApplyPhases(true);
      setApplyMilestones(true);
      setApplyRows(true);
      setShowAIModal(true);
    } catch (e: any) {
      toast.error(e?.message || t('initiatives.timelineSection.aiAnalysisFailed'));
    } finally {
      setAiBusy(false);
    }
  }, [aiBusy, buildAiContextText, initiative, status, t, timelineLocked]);

  const applyTimelineAiProposal = useCallback(() => {
    const normalized = normalizeProposal();
    if (!normalized) {
      toast.error(t('initiatives.timelineSection.noValidProposal'));
      return;
    }

    const nextStart = normalizeIsoDate(normalized.proposedStartDate);
    const nextEnd = normalizeIsoDate(normalized.proposedEndDate);

    if (applyStartEnd) {
      if (nextStart) setStartDate(nextStart);
      if (nextEnd) setEndDate(nextEnd);
    }

    if (applyPhases) {
      const phasesToApply: TimelinePhase[] = normalized.phases
        .map((p, idx) => {
          const s = p.startDate || nextStart || plannedStart || null;
          const e = p.endDate || nextEnd || plannedEnd || null;
          if (!s || !e) return null;
          return {
            id: `phase-ai-${Date.now()}-${idx}`,
            name: p.name,
            startDate: s,
            endDate: e,
            order: idx + 1,
          } as TimelinePhase;
        })
        .filter(Boolean) as any;
      if (phasesToApply.length > 0) setTimelinePhases(phasesToApply);
    }

    if (applyMilestones) {
      const milestonesToApply: TimelineMilestone[] = normalized.milestones
        .map((m, idx) => {
          const d = m.date || null;
          if (!d) return null;
          return {
            id: `ms-ai-${Date.now()}-${idx}`,
            name: m.name,
            date: d,
            status: 'pending',
          } as TimelineMilestone;
        })
        .filter(Boolean) as any;
      if (milestonesToApply.length > 0)
        setTimelineMilestones(milestonesToApply.sort((a, b) => a.date.localeCompare(b.date)));
    }

    if (applyRows) {
      const selectedRowsAll = normalized.rows.filter((r) => !!selectedRowByTempId[r.tempId]);
      // Keep deterministic order from AI output
      const selectedRows = selectedRowsAll;
      const selectedTempIds = selectedRows.map((r) => r.tempId);

      // Build ID mapping
      const tempIdToRowId = new Map<string, string>();
      for (const r of selectedRows) {
        if (r.linkedTaskId) {
          tempIdToRowId.set(r.tempId, `task-${r.linkedTaskId}`);
        } else {
          tempIdToRowId.set(r.tempId, `tr-ai-${sanitizeTempId(r.tempId)}`);
        }
      }

      // Pick a single dependency per target row (best-effort) with priority:
      // 1) critical path adjacency (FS)
      // 2) AI proposedDependencies (prefer FS)
      // 3) fallback: previous selected row for after_previous items
      const depsForTo = new Map<string, { fromTempId: string; type: 'FS' | 'SS' | 'FF' | 'SF' }>();

      const cp = (normalized.criticalPath || []).filter((tid) => selectedTempIds.includes(tid));
      for (let i = 1; i < cp.length; i++) {
        const fromTempId = cp[i - 1];
        const toTempId = cp[i];
        if (fromTempId && toTempId && fromTempId !== toTempId) {
          if (tempIdToRowId.has(fromTempId) && tempIdToRowId.has(toTempId)) {
            depsForTo.set(toTempId, { fromTempId, type: 'FS' });
          }
        }
      }

      for (const d of normalized.proposedDependencies) {
        const fromId = tempIdToRowId.get(d.fromTempId);
        const toId = tempIdToRowId.get(d.toTempId);
        if (!fromId || !toId) continue;
        // Do not override critical-path dependency
        const existing = depsForTo.get(d.toTempId);
        if (!existing) {
          depsForTo.set(d.toTempId, { fromTempId: d.fromTempId, type: d.type });
          continue;
        }
        // If existing is not FS and AI proposes FS, upgrade
        if (existing.type !== 'FS' && d.type === 'FS') {
          depsForTo.set(d.toTempId, { fromTempId: d.fromTempId, type: d.type });
        }
      }

      // Fallback chain for after_previous scheduling: if missing dependency, use previous selected row
      for (let i = 0; i < selectedRows.length; i++) {
        const r = selectedRows[i];
        if (r.schedulingMode !== 'after_previous') continue;
        if (depsForTo.has(r.tempId)) continue;
        const prev = selectedRows[i - 1];
        if (!prev) continue;
        if (prev.tempId === r.tempId) continue;
        depsForTo.set(r.tempId, { fromTempId: prev.tempId, type: 'FS' });
      }

      // Build extra rows + patches for linked tasks
      const rowPatches: Array<{ id: string; patch: any }> = [];
      const extraRows = selectedRows
        .filter((r) => !r.linkedTaskId) // timeline-only or decision/comm rows
        .map((r, idx) => {
          const id = tempIdToRowId.get(r.tempId)!;
          const dep = depsForTo.get(r.tempId);
          const dependsOnId = dep ? tempIdToRowId.get(dep.fromTempId) || null : null;
          const schedulingMode = dependsOnId ? 'after_previous' : r.schedulingMode;

          const base: any = {
            id,
            type: r.type,
            name: r.name,
            startDate:
              r.startDate ||
              (r.schedulingMode === 'fixed_date' ? nextStart || plannedStart || null : null),
            endDate: r.endDate,
            durationDays:
              typeof r.durationDays === 'number' && Number.isFinite(r.durationDays)
                ? r.durationDays
                : null,
            schedulingMode,
            dependsOnId,
            dependencyType: dep?.type || undefined,
            estimatedHours:
              typeof r.estimatedHours === 'number' && Number.isFinite(r.estimatedHours)
                ? r.estimatedHours
                : null,
            assigneeId: r.assigneeUserId || undefined,
            assigneeName: r.assigneeUserId
              ? (() => {
                  const u = users.find((x) => x.id === r.assigneeUserId);
                  return u
                    ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id
                    : undefined;
                })()
              : undefined,
            linkedDecisionId: r.linkedDecisionId || undefined,
            decisionBlocksNext: r.type === 'decision' ? (r.decisionBlocksNext ?? true) : undefined,
            audience: r.audience || undefined,
            pauseReason: r.type === 'pause' ? r.pauseReason || undefined : undefined,
            escalationLevel: r.type === 'escalation' ? r.escalationLevel || undefined : undefined,
            order: 300 + idx,
          };

          if (r.type === 'info_event' && r.infoEvent) {
            base.infoEventMode = r.infoEvent.mode;
            base.infoEventCadence = r.infoEvent.cadence || undefined;
            base.infoAssetType = r.infoEvent.assetType || undefined;
            base.infoAssetLabel = r.infoEvent.assetLabel || undefined;
          }

          if (r.type === 'notification' && r.notification) {
            base.notificationTriggerMode = r.notification.triggerMode;
            base.notificationTriggerEvent = r.notification.triggerEvent || undefined;
            base.notificationLeadDays =
              typeof r.notification.leadDays === 'number' ? r.notification.leadDays : undefined;
            base.notificationCadence = r.notification.cadence || undefined;
            base.notificationChannel = r.notification.channel;
            base.notificationRecipientMode = r.notification.recipientMode;
            base.notificationRecipientUserId = r.notification.recipientUserId || undefined;
            base.notificationRecipientGroupKey = r.notification.recipientGroupKey || undefined;
            base.notificationRule = r.notification.rule || undefined;
            base.notificationMessage = r.notification.message || undefined;
            base.notificationAiAutoSend =
              typeof r.notification.aiAutoSend === 'boolean'
                ? r.notification.aiAutoSend
                : undefined;
            base.notificationAiInstruction = r.notification.aiInstruction || undefined;
          }

          if (r.type === 'meeting' && r.meeting) {
            base.meetingCadence = r.meeting.cadence;
            base.meetingChannel = r.meeting.channel;
            base.meetingAgenda = r.meeting.agenda || undefined;
          }

          return base;
        });

      for (const r of selectedRows.filter((x) => !!x.linkedTaskId)) {
        const id = tempIdToRowId.get(r.tempId)!;
        const dep = depsForTo.get(r.tempId);
        const dependsOnId = dep ? tempIdToRowId.get(dep.fromTempId) || null : null;
        const patch: any = {
          schedulingMode: dependsOnId ? 'after_previous' : r.schedulingMode,
          dependsOnId: dependsOnId || undefined,
          dependencyType: dep?.type || undefined,
          startDate:
            r.startDate ||
            (r.schedulingMode === 'fixed_date'
              ? nextStart || plannedStart || undefined
              : undefined),
          endDate: r.endDate,
          durationDays:
            typeof r.durationDays === 'number' && Number.isFinite(r.durationDays)
              ? r.durationDays
              : undefined,
          estimatedHours:
            typeof r.estimatedHours === 'number' && Number.isFinite(r.estimatedHours)
              ? r.estimatedHours
              : undefined,
        };
        rowPatches.push({ id, patch });
      }

      const manualOrder = selectedRows.map((r) => tempIdToRowId.get(r.tempId)!).filter(Boolean);

      plannerRef.current?.applyAiPlan({
        extraRows,
        rowPatches,
        manualOrder,
      });
    }

    closeAIModal();
    toast.success(t('initiatives.timelineSection.appliedProposal'));
  }, [
    applyMilestones,
    applyPhases,
    applyRows,
    applyStartEnd,
    closeAIModal,
    normalizeProposal,
    plannedEnd,
    plannedStart,
    selectedRowByTempId,
    setEndDate,
    setStartDate,
    setTimelineMilestones,
    setTimelinePhases,
    t,
    users,
  ]);

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

  // ==========================================
  // RENDER — N-mode flat layout
  // ==========================================

  return (
    <div className="space-y-6">
      {/* M13 Depth · Seria R (M13c) + V (V1) — Calendar / Gantt views over one
          schedule source (buildScheduleItems): tasks + milestones + phases. */}
      <div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-navy-700 p-0.5">
          {(
            [
              ['calendar', CalendarDays, t('initiatives.calendarView.calendar', 'Calendar')],
              ['gantt', GanttChartSquare, t('initiatives.calendarView.gantt', 'Gantt')],
            ] as const
          ).map(([key, Icon, label]) => {
            const active = scheduleView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setScheduleView((v) => (v === key ? 'none' : key))}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-slate-900/[0.07] text-slate-900 dark:bg-white/10 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
        {scheduleView === 'calendar' && (
          <div className="mt-2">
            <InitiativeCalendar items={scheduleItems} />
          </div>
        )}
        {scheduleView === 'gantt' && (
          <div className="mt-2">
            <InitiativeGantt
              items={scheduleItems}
              dependencies={ganttDependencies}
              criticalPathIds={criticalPathIds}
            />
          </div>
        )}
      </div>

      {/* AI Proposal Modal — Timeline */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {t('initiatives.timelineSection.proposedTimelinePlan')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('initiatives.timelineSection.selectWhatToApply')}
                </p>
                {(() => {
                  const n = normalizeProposal();
                  if (!n?.note) return null;
                  return (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {String(n.note)}
                    </p>
                  );
                })()}
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                aria-label={t('initiatives.timelineSection.close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(() => {
                const n = normalizeProposal();
                if (!n) {
                  return (
                    <div className="text-sm text-danger-500">
                      {t('initiatives.timelineSection.invalidProposalFormat')}
                    </div>
                  );
                }

                const checkboxCls =
                  'w-4 h-4 rounded border border-slate-300 dark:border-navy-600 text-blue-600 focus:ring-blue-500';

                return (
                  <>
                    {/* Apply toggles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={applyStartEnd}
                          onChange={(e) => setApplyStartEnd(e.target.checked)}
                        />
                        {t('initiatives.timelineSection.applyStartEndDates')}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={applyPhases}
                          onChange={(e) => setApplyPhases(e.target.checked)}
                        />
                        {t('initiatives.timelineSection.applyPhases')}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={applyMilestones}
                          onChange={(e) => setApplyMilestones(e.target.checked)}
                        />
                        {t('initiatives.timelineSection.applyMilestones')}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={applyRows}
                          onChange={(e) => setApplyRows(e.target.checked)}
                        />
                        {t('initiatives.timelineSection.applyRowsOrderDeps')}
                      </label>
                    </div>

                    {/* Summary strip */}
                    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-600">
                            {t('initiatives.timelineSection.phases')}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-white">
                            {n.phases.length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-600">
                            {t('initiatives.timelineSection.milestonesShort')}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-white">
                            {n.milestones.length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-600">
                            {t('initiatives.timelineSection.rows')}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-white">
                            {n.rows.length}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-600">
                            {t('initiatives.timelineSection.dependencies')}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-white">
                            {n.proposedDependencies.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Critical Path + Dependencies */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* Critical Path */}
                      <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200/40 dark:border-navy-700/40 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('initiatives.timelineSection.criticalPathAi')}
                          </span>
                          <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <input
                              type="checkbox"
                              className={checkboxCls}
                              checked={lockCriticalPathChain}
                              onChange={(e) => setLockCriticalPathChain(e.target.checked)}
                              disabled={!applyRows}
                            />
                            {t('initiatives.timelineSection.lockChain')}
                          </label>
                        </div>
                        <div className="max-h-[22vh] overflow-auto divide-y divide-slate-200/40 dark:divide-navy-700/40">
                          {(() => {
                            const rowsByTempId = new Map(n.rows.map((r) => [r.tempId, r]));
                            const cp = (n.criticalPath || [])
                              .map((tid) => sanitizeTempId(tid))
                              .filter((tid) => rowsByTempId.has(tid));
                            const visible = cp.filter((tid) => !!selectedRowByTempId[tid]);
                            if (visible.length === 0) {
                              return (
                                <div className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                                  {t('initiatives.timelineSection.noCriticalPath')}
                                </div>
                              );
                            }
                            return visible.map((tid, idx) => {
                              const row = rowsByTempId.get(tid);
                              if (!row) return null;
                              const keep = criticalPathKeepByTempId[tid] !== false;
                              return (
                                <div key={tid} className="px-5 py-3 flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className={checkboxCls}
                                    checked={keep}
                                    disabled={!applyRows}
                                    onChange={(e) =>
                                      setCriticalPathKeepByTempId((prev) => ({
                                        ...prev,
                                        [tid]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 font-bold">
                                        CP {idx + 1}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500">
                                        {row.type}
                                      </span>
                                      <span className="text-xs font-medium text-slate-800 dark:text-white truncate">
                                        {row.name}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                      {row.schedulingMode === 'fixed_date'
                                        ? t('initiatives.timelineSection.fixedDate', {
                                            date: row.startDate || '—',
                                          })
                                        : t('initiatives.timelineSection.startsAfterPrevious')}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Dependencies */}
                      <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200/40 dark:border-navy-700/40 flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('initiatives.timelineSection.dependenciesPrimary')}
                          </span>
                          <label className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <input
                              type="checkbox"
                              className={checkboxCls}
                              checked={applyOnlyPrimaryDependencies}
                              onChange={(e) => setApplyOnlyPrimaryDependencies(e.target.checked)}
                              disabled={!applyRows}
                            />
                            {t('initiatives.timelineSection.primaryOnly')}
                          </label>
                        </div>

                        <div className="max-h-[22vh] overflow-auto divide-y divide-slate-200/40 dark:divide-navy-700/40">
                          {(() => {
                            const rowsByTempId = new Map(n.rows.map((r) => [r.tempId, r]));
                            const candidatesByTo = buildDependencyCandidates(n);
                            const selectedTo = n.rows
                              .map((r) => r.tempId)
                              .filter(
                                (tid) => !!selectedRowByTempId[tid] && candidatesByTo.has(tid)
                              );
                            if (selectedTo.length === 0) {
                              return (
                                <div className="px-5 py-4 text-xs text-slate-500 dark:text-slate-400">
                                  {t('initiatives.timelineSection.noDependencyCandidates')}
                                </div>
                              );
                            }

                            return selectedTo.slice(0, 18).map((toTempId) => {
                              const toRow = rowsByTempId.get(toTempId);
                              if (!toRow) return null;
                              const picked = primaryDependencyByToTempId[toTempId] || null;
                              const candidates = candidatesByTo.get(toTempId) || [];
                              return (
                                <div key={toTempId} className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500">
                                      {toRow.type}
                                    </span>
                                    <span className="text-xs font-medium text-slate-800 dark:text-white truncate">
                                      {toRow.name}
                                    </span>
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                                      <input
                                        type="radio"
                                        name={`dep-${toTempId}`}
                                        checked={!picked}
                                        disabled={!applyRows}
                                        onChange={() =>
                                          setPrimaryDependencyByToTempId((prev) => ({
                                            ...prev,
                                            [toTempId]: null,
                                          }))
                                        }
                                      />
                                      {t('initiatives.timelineSection.none')}
                                    </label>
                                    {candidates.slice(0, 5).map((c) => {
                                      const fromRow = rowsByTempId.get(c.fromTempId);
                                      if (!fromRow) return null;
                                      const checked =
                                        picked?.fromTempId === c.fromTempId &&
                                        picked?.type === c.type;
                                      return (
                                        <label
                                          key={`${c.fromTempId}-${c.type}`}
                                          className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                                          title={c.rationale || ''}
                                        >
                                          <input
                                            type="radio"
                                            name={`dep-${toTempId}`}
                                            checked={checked}
                                            disabled={!applyRows}
                                            onChange={() =>
                                              setPrimaryDependencyByToTempId((prev) => ({
                                                ...prev,
                                                [toTempId]: {
                                                  fromTempId: c.fromTempId,
                                                  type: c.type,
                                                },
                                              }))
                                            }
                                          />
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-300 font-bold">
                                            {c.type}
                                          </span>
                                          <span className="truncate">{fromRow.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Warnings */}
                    {(() => {
                      const { depsForTo, keptCp } = computeDependencyPlan(n);
                      const warnings: string[] = [];

                      // Missing row selections for dependencies
                      for (const [to, dep] of depsForTo.entries()) {
                        if (!selectedRowByTempId[to]) {
                          warnings.push(
                            t('initiatives.timelineSection.depPointsToUnselected', { to })
                          );
                        }
                        if (!selectedRowByTempId[dep.fromTempId]) {
                          warnings.push(
                            t('initiatives.timelineSection.depRefsUnselected', {
                              from: dep.fromTempId,
                            })
                          );
                        }
                      }

                      const cycle = detectCycles(depsForTo);
                      if (cycle && cycle.length > 0) {
                        warnings.push(
                          t('initiatives.timelineSection.cycleDetected', {
                            cycle: cycle.join(' → '),
                          })
                        );
                      }

                      if (lockCriticalPathChain && keptCp.length > 0) {
                        // If CP exists but many steps are unchecked
                        const cpAll = (n.criticalPath || [])
                          .map((tid) => sanitizeTempId(tid))
                          .filter((tid) => !!selectedRowByTempId[tid]);
                        const unchecked = cpAll.filter(
                          (tid) => criticalPathKeepByTempId[tid] === false
                        ).length;
                        if (unchecked > 0) {
                          warnings.push(t('initiatives.timelineSection.cpStepsUnchecked'));
                        }
                      }

                      if (warnings.length === 0) return null;
                      return (
                        <div className="rounded-2xl border-l-4 border-l-amber-500 border border-amber-300/50 dark:border-amber-500/30 bg-amber-100 dark:bg-amber-500/5 p-4">
                          <div className="text-[11px] uppercase tracking-wide font-semibold text-amber-800 dark:text-amber-300 mb-2">
                            {t('initiatives.timelineSection.warnings')}
                          </div>
                          <ul className="text-xs text-amber-700 dark:text-amber-200 space-y-1 list-disc pl-5">
                            {warnings.slice(0, 8).map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Rows list */}
                    {n.rows.length > 0 && (
                      <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200/40 dark:border-navy-700/40">
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {t('initiatives.timelineSection.timelineRowsAi')}
                          </span>
                        </div>
                        <div className="max-h-[46vh] overflow-auto divide-y divide-slate-200/40 dark:divide-navy-700/40">
                          {n.rows.map((r) => {
                            const checked = !!selectedRowByTempId[r.tempId];
                            const badge =
                              r.type === 'decision'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                                : r.type === 'notification'
                                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300'
                                  : r.type === 'meeting'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                                    : r.type === 'info_event'
                                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
                                      : r.type === 'escalation'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                                        : r.type === 'pause'
                                          ? 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-300';
                            return (
                              <div key={r.tempId} className="px-5 py-3 flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className={checkboxCls}
                                  checked={checked}
                                  onChange={(e) =>
                                    setSelectedRowByTempId((prev) => ({
                                      ...prev,
                                      [r.tempId]: e.target.checked,
                                    }))
                                  }
                                  disabled={!applyRows}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-lg font-medium ${badge}`}
                                    >
                                      {r.type}
                                    </span>
                                    {r.linkedTaskId ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500">
                                        {t('initiatives.timelineSection.linkedTask')}
                                      </span>
                                    ) : null}
                                    <span className="text-xs font-medium text-slate-800 dark:text-white truncate">
                                      {r.name}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                    {r.schedulingMode === 'after_previous'
                                      ? t('initiatives.timelineSection.startsAfterPrevious')
                                      : t('initiatives.timelineSection.fixedDate', {
                                          date: r.startDate || '—',
                                        })}
                                    {typeof r.durationDays === 'number' && r.durationDays > 0
                                      ? ` · ${r.durationDays}d`
                                      : ''}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={closeAIModal}
                        className="px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
                      >
                        {t('initiatives.timelineSection.cancel')}
                      </button>
                      <button
                        onClick={applyTimelineAiProposal}
                        className="px-3 py-2 rounded-xl text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        {t('initiatives.timelineSection.apply')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Section Header (H2 + actions) ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {t('initiatives.timelineSection.timeline')}
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
                    ? 'bg-danger-500/10 text-danger-500'
                    : daysRemaining <= 14
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-blue-500/10 text-blue-500'
                }`}
              >
                {isOverdue
                  ? t('initiatives.timelineSection.daysOverdue', {
                      days: Math.abs(daysRemaining),
                    })
                  : t('initiatives.timelineSection.daysLeft', { days: daysRemaining })}
              </span>
            )}
          <button
            onClick={() => plannerRef.current?.openAddPanel()}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-c-info transition-colors"
          >
            <Plus size={12} />
            {t('initiatives.timelineSection.addItem')}
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
            dependencies={dependencies as any}
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
                  <Clock size={13} className="text-slate-600" />
                  <span className="text-xs text-slate-500">
                    {t('initiatives.timelineSection.duration')}
                  </span>
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {duration ? t('initiatives.timelineSection.daysCount', { count: duration }) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {t('initiatives.timelineSection.quarter')}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {initiative?.targetQuarter || initiative?.target_quarter || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {t('initiatives.timelineSection.milestonesShort')}
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
            dependencies={dependencies as any}
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
            {t('initiatives.timelineSection.awaitingPmoApproval')}
          </Callout>

          {/* Read-only dates */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-[10px] text-slate-600 block mb-0.5">
                  {t('initiatives.timelineSection.startDate')}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-white">
                  {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-[10px] text-slate-600 block mb-0.5">
                  {t('initiatives.timelineSection.endDate')}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-white">
                  {formatDate(plannedEnd, isPolish ? 'pl' : 'en')}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {t('initiatives.timelineSection.duration')}
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {duration ? t('initiatives.timelineSection.daysCount', { count: duration }) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/50 px-4 py-2.5">
                <span className="text-xs text-slate-500">
                  {t('initiatives.timelineSection.quarter')}
                </span>
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
                {t('initiatives.timelineSection.milestones')}
              </span>
              <div className="space-y-1.5">
                {timelineMilestones.map((ms) => (
                  <div
                    key={ms.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-navy-800/40 border border-slate-200/40 dark:border-navy-700/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-c-info/60" />
                      <span className="text-xs text-slate-700 dark:text-slate-300">{ms.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-600">
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
              {t('initiatives.timelineSection.scheduleReadiness')}
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
              {t('initiatives.timelineSection.timelineLockedBaseline', {
                version: baselineVersion ? ` v${baselineVersion}` : '',
              })}
            </Callout>
          )}

          {/* Baseline vs Actual Table */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 overflow-hidden">
            <div className="px-5 pt-4 pb-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('initiatives.timelineSection.baselineVsActual')}
              </span>
            </div>
            <table
              /* §27-exempt: sub-tabela w widoku szczegolow, nie samodzielna lista */ className="w-full text-xs"
            >
              <thead>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40 bg-slate-50/40 dark:bg-navy-800/30">
                  <th className="text-left px-5 py-2 text-slate-500 font-medium"> </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {t('initiatives.timelineSection.planned')}
                  </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {t('initiatives.timelineSection.actual')}
                  </th>
                  <th className="text-right px-5 py-2 text-slate-500 font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40">
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                    {t('initiatives.timelineSection.start')}
                  </td>
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
                            ? 'text-danger-500'
                            : startVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-600'
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
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                    {t('initiatives.timelineSection.end')}
                  </td>
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
                            ? 'text-danger-500'
                            : endVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-600'
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
                    {t('initiatives.timelineSection.duration')}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                    {duration
                      ? t('initiatives.timelineSection.daysCount', { count: duration })
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300" colSpan={2}>
                    {actualStart
                      ? (() => {
                          const endPoint = actualEnd || new Date().toISOString();
                          const d = daysBetween(actualStart, endPoint);
                          return d !== null
                            ? `${t('initiatives.timelineSection.daysCount', { count: d })}${!actualEnd ? t('initiatives.timelineSection.ongoingSuffix') : ''}`
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
                  {t('initiatives.timelineSection.timeProgress')}
                </span>
                <span
                  className={`text-xs font-medium ${isOverdue ? 'text-danger-500' : 'text-blue-500'}`}
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
                      ? 'bg-gradient-to-r from-danger-500 to-danger-400'
                      : timelineProgress > 80
                        ? 'bg-gradient-to-r from-amber-500 to-amber-500'
                        : 'bg-gradient-to-r from-blue-500 to-blue-500'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-slate-600">
                  {formatDate(plannedStart, isPolish ? 'pl' : 'en')}
                </span>
                <span className="text-[9px] text-slate-600">
                  {formatDate(plannedEnd, isPolish ? 'pl' : 'en')}
                </span>
              </div>
            </div>
          )}

          {/* Milestone Tracking */}
          {timelineMilestones.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 p-5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 block mb-3">
                {t('initiatives.timelineSection.milestoneTracking')}
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
                          className={`text-xs ${ms.status === 'completed' ? 'text-slate-600 line-through' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {ms.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-600">
                          {formatDate(ms.date, isPolish ? 'pl' : 'en')}
                        </span>
                        {ms.actualDate && (
                          <span className="text-[10px] text-slate-500">
                            → {formatDate(ms.actualDate, isPolish ? 'pl' : 'en')}
                          </span>
                        )}
                        {msVariance !== null && (
                          <span
                            className={`text-[10px] font-medium ${msVariance > 0 ? 'text-danger-500' : msVariance < 0 ? 'text-emerald-500' : 'text-slate-600'}`}
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
                {t('initiatives.timelineSection.executionSummary')}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-t border-slate-200/40 dark:border-navy-700/40 bg-slate-50/40 dark:bg-navy-800/30">
                  <th className="text-left px-5 py-2 text-slate-500 font-medium"> </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {t('initiatives.timelineSection.planned')}
                  </th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">
                    {t('initiatives.timelineSection.actual')}
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
                            ? 'text-danger-500'
                            : startVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-600'
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
                            ? 'text-danger-500'
                            : endVariance < 0
                              ? 'text-emerald-500'
                              : 'text-slate-600'
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
                {t('initiatives.timelineSection.milestonesFinal')}
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
                                ? 'bg-danger-500'
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
                        <span className="text-[10px] text-slate-600">
                          {formatDate(ms.date, isPolish ? 'pl' : 'en')}
                        </span>
                        {ms.actualDate && (
                          <>
                            <ChevronRight size={10} className="text-slate-600" />
                            <span className="text-[10px] text-slate-500">
                              {formatDate(ms.actualDate, isPolish ? 'pl' : 'en')}
                            </span>
                          </>
                        )}
                        {msVariance !== null && (
                          <span
                            className={`text-[10px] font-medium ${msVariance > 0 ? 'text-danger-500' : msVariance < 0 ? 'text-emerald-500' : 'text-slate-600'}`}
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
                    {t('initiatives.timelineSection.onTime')}
                    {endVariance < 0 &&
                      ` ${t('initiatives.timelineSection.daysEarly', {
                        days: Math.abs(endVariance),
                      })}`}
                  </p>
                </>
              ) : endVariance !== null ? (
                <>
                  <AlertTriangle size={28} className="mx-auto mb-2 text-amber-500" />
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {t('initiatives.timelineSection.delayedByDays', { days: endVariance })}
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm text-slate-500">
                    {t('initiatives.timelineSection.completed')}
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
