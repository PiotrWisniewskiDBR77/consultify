/**
 * TimelinePlanner — Full planning tool for Initiative Timeline.
 *
 * Row types: Start → Tasks / Decisions / Info / Escalation / Milestones → Finish
 * Two views: Table (editable) and Gantt (visual).
 * Cascade date recalculation on start date or dependency changes.
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  Copy,
  Flag,
  Gavel,
  GripVertical,
  Megaphone,
  MoreVertical,
  PauseCircle,
  Pencil,
  Play,
  Rocket,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import type {
  Decision,
  DecisionOutcome,
  SchedulingMode,
  TaskItem,
  TimelineMilestone,
  TimelineRow,
  TimelineRowType,
  UserInfo,
} from './types';

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function toISO(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toISOString().split('T')[0];
  } catch {
    return '';
  }
}

function fmtDate(d: string | null | undefined, locale = 'en'): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return d;
  }
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.ceil((db - da) / (1000 * 60 * 60 * 24));
}

function addDays(d: string, days: number): string {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split('T')[0];
}

function genId(): string {
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// ════════════════════════════════════════════════════════════════
// ROW TYPE CONFIG
// ════════════════════════════════════════════════════════════════

type RowMeta = {
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  labelPl: string;
  color: string;
  bgTint: string;
  shortLabel: string;
};

const ROW_TYPE_META: Record<TimelineRowType, RowMeta> = {
  start: {
    icon: Rocket,
    label: 'Start',
    labelPl: 'Start',
    color: 'text-emerald-500',
    bgTint: 'bg-emerald-500/5',
    shortLabel: 'S',
  },
  task: {
    icon: Play,
    label: 'Task',
    labelPl: 'Zadanie',
    color: 'text-blue-500',
    bgTint: '',
    shortLabel: 'T',
  },
  milestone: {
    // Typ kategoryczny → paleta danych c-tag-* (§15.1). NIGDY crimson jako dana
    // (było text-primary-500 = crimson-leak). c-tag-3 = violet (odróżnia od blue task/info).
    // bgTint pusty: c-tag-* to var() bez <alpha-value>, modyfikator /3 nie działa (jak `task`).
    icon: Flag,
    label: 'Milestone',
    labelPl: 'Kamień milowy',
    color: 'text-c-tag-3',
    bgTint: '',
    shortLabel: 'M',
  },
  decision: {
    icon: Gavel,
    label: 'Decision',
    labelPl: 'Decyzja',
    color: 'text-amber-500',
    bgTint: 'bg-amber-500/3',
    shortLabel: 'D',
  },
  info_event: {
    icon: Megaphone,
    label: 'Info Event',
    labelPl: 'Zdarzenie info',
    color: 'text-blue-500',
    bgTint: 'bg-blue-500/3',
    shortLabel: 'I',
  },
  notification: {
    icon: Bell,
    label: 'Notification',
    labelPl: 'Notyfikacja',
    color: 'text-indigo-500',
    bgTint: 'bg-indigo-500/3',
    shortLabel: 'N',
  },
  meeting: {
    icon: CalendarDays,
    label: 'Recurring Meeting',
    labelPl: 'Spotkanie cykliczne',
    color: 'text-blue-500',
    bgTint: 'bg-blue-500/4',
    shortLabel: 'R',
  },
  pause: {
    icon: PauseCircle,
    label: 'Pause',
    labelPl: 'Pauza',
    color: 'text-c-text-muted',
    bgTint: 'bg-slate-500/4',
    shortLabel: 'P',
  },
  escalation: {
    icon: AlertTriangle,
    label: 'Escalation',
    labelPl: 'Eskalacja',
    color: 'text-amber-500',
    bgTint: 'bg-amber-500/3',
    shortLabel: 'E',
  },
  finish: {
    icon: Flag,
    label: 'Finish',
    labelPl: 'Koniec',
    color: 'text-danger-500',
    bgTint: 'bg-danger-500/5',
    shortLabel: 'F',
  },
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-sky-500',
  blocked: 'bg-danger-500',
  done: 'bg-emerald-500',
};

const DECISION_OUTCOME_STYLES: Record<string, { dot: string; label: string; labelPl: string }> = {
  GO: { dot: 'bg-emerald-500', label: 'GO', labelPl: 'GO' },
  NO_GO: { dot: 'bg-danger-500', label: 'NO-GO', labelPl: 'NO-GO' },
  ESCALATE: { dot: 'bg-amber-500', label: 'Escalate', labelPl: 'Eskalacja' },
};

/** Which types the user can add via "+ Add Item" */
const ADDABLE_TYPES: {
  type: TimelineRowType;
  icon: React.FC<{ size?: number; className?: string }>;
  label: string;
  labelPl: string;
  desc: string;
  descPl: string;
}[] = [
  {
    type: 'task',
    icon: Play,
    label: 'Task',
    labelPl: 'Zadanie',
    desc: 'Work item with duration',
    descPl: 'Element pracy z czasem trwania',
  },
  {
    type: 'milestone',
    icon: Flag,
    label: 'Milestone',
    labelPl: 'Kamień milowy',
    desc: 'Point-in-time marker',
    descPl: 'Znacznik w czasie',
  },
  {
    type: 'decision',
    icon: Gavel,
    label: 'Decision',
    labelPl: 'Decyzja',
    desc: 'Go / No-Go checkpoint',
    descPl: 'Punkt decyzyjny Go / No-Go',
  },
  {
    type: 'info_event',
    icon: Megaphone,
    label: 'Info Event',
    labelPl: 'Zdarzenie info',
    desc: 'Report, presentation, status update',
    descPl: 'Raport, prezentacja, status update',
  },
  {
    type: 'notification',
    icon: Bell,
    label: 'Notification',
    labelPl: 'Notyfikacja',
    desc: 'Recurring communication rule',
    descPl: 'Reguła cyklicznej komunikacji',
  },
  {
    type: 'meeting',
    icon: CalendarDays,
    label: 'Recurring meeting',
    labelPl: 'Spotkanie cykliczne',
    desc: 'Planned cyclical meeting event',
    descPl: 'Planowane cykliczne spotkanie',
  },
  {
    type: 'pause',
    icon: PauseCircle,
    label: 'Pause',
    labelPl: 'Pauza',
    desc: 'Planned pause in execution flow',
    descPl: 'Planowana pauza w realizacji',
  },
];

type NotificationPreset = {
  id: string;
  label: string;
  labelPl: string;
  cadence: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  channel: 'email' | 'slack' | 'meeting' | 'dashboard' | 'other';
  rule: string;
  rulePl: string;
};

const NOTIFICATION_PRESETS: NotificationPreset[] = [
  {
    id: 'weekly-steering',
    label: 'Weekly steering update',
    labelPl: 'Cotygodniowy update Steering',
    cadence: 'weekly',
    channel: 'meeting',
    rule: 'Every Tuesday 09:00 — Steering Committee status update',
    rulePl: 'Każdy wtorek 09:00 — aktualizacja statusu dla Steering Committee',
  },
  {
    id: 'daily-team',
    label: 'Daily team sync',
    labelPl: 'Codzienny sync zespołu',
    cadence: 'daily',
    channel: 'meeting',
    rule: 'Every business day 09:15 — team sync and blockers',
    rulePl: 'Każdy dzień roboczy 09:15 — sync zespołu i blokery',
  },
  {
    id: 'biweekly-sponsor',
    label: 'Biweekly sponsor summary',
    labelPl: 'Dwutygodniowe podsumowanie sponsora',
    cadence: 'biweekly',
    channel: 'email',
    rule: 'Every second Friday 14:00 — sponsor progress summary',
    rulePl: 'Co drugi piątek 14:00 — podsumowanie postępu dla sponsora',
  },
  {
    id: 'monthly-board',
    label: 'Monthly board checkpoint',
    labelPl: 'Miesięczny checkpoint zarządu',
    cadence: 'monthly',
    channel: 'dashboard',
    rule: 'First Monday of each month — board KPI/checkpoint review',
    rulePl: 'Pierwszy poniedziałek miesiąca — przegląd KPI/checkpointów przez zarząd',
  },
];

type ReportOption = { id: string; title: string };

const NOTIFICATION_GROUP_OPTIONS = [
  { key: 'project_team', label: 'Project team', labelPl: 'Zespół projektu' },
  { key: 'steering_committee', label: 'Steering committee', labelPl: 'Komitet sterujący' },
  { key: 'sponsor_group', label: 'Sponsors', labelPl: 'Sponsorzy' },
  { key: 'all_stakeholders', label: 'All stakeholders', labelPl: 'Wszyscy interesariusze' },
  { key: 'custom_group', label: 'Custom group', labelPl: 'Grupa niestandardowa' },
] as const;

// ════════════════════════════════════════════════════════════════
// CASCADE DATE RECALCULATION
// ════════════════════════════════════════════════════════════════

/**
 * Recalculate dates for rows using after_previous scheduling.
 * Returns a new array with updated start/end dates. Mutates nothing.
 */
function recalculateDates(rows: TimelineRow[]): TimelineRow[] {
  const byId = new Map(rows.map((r) => [r.id, { ...r }]));
  const result = rows.map((r) => ({ ...r }));

  // Process in order (already sorted: start first, finish last)
  for (const row of result) {
    if (row.type === 'start' || row.type === 'finish') continue;

    if (row.schedulingMode === 'after_previous' && row.dependsOnId) {
      const dep = byId.get(row.dependsOnId);
      if (dep) {
        const depEnd = dep.endDate || dep.startDate;
        if (depEnd) {
          row.startDate = depEnd;
        }
      }
    }

    // Auto-compute endDate from durationDays for tasks
    if (
      (row.type === 'task' || row.type === 'pause' || row.type === 'meeting') &&
      row.endSchedulingMode !== 'manual_date' &&
      row.endSchedulingMode !== 'from_successor' &&
      row.startDate &&
      row.durationDays &&
      row.durationDays > 0
    ) {
      row.endDate = addDays(row.startDate, row.durationDays);
    }

    // End date can be driven by successor start date
    if (row.endSchedulingMode === 'from_successor' && row.successorId) {
      const successor = byId.get(row.successorId);
      if (successor?.startDate) {
        row.endDate = successor.startDate;
      }
    }

    // Update the map so downstream deps see the updated dates
    byId.set(row.id, row);
  }

  // Compute finish date = max of all end/start dates
  const finishRow = result.find((r) => r.type === 'finish');
  if (finishRow) {
    let maxDate = '';
    for (const r of result) {
      if (r.type === 'finish') continue;
      const d = r.endDate || r.startDate;
      if (d && d > maxDate) maxDate = d;
    }
    if (maxDate) finishRow.startDate = maxDate;
  }

  return result;
}

// ════════════════════════════════════════════════════════════════
// HOOK: useTimelineRows
// ════════════════════════════════════════════════════════════════

export interface UseTimelineRowsOptions {
  plannedStart: string | null;
  plannedEnd: string | null;
  tasks: TaskItem[];
  milestones: TimelineMilestone[];
  isPolish: boolean;
  /** task_dependencies (org-persisted) → derives task rows' dependsOnId so the
   *  Gantt draws dependency connectors without manual per-row editing. */
  dependencies?: Array<{ sourceTaskId?: string; taskId?: string; direction?: string }>;
}

export function useTimelineRows({
  plannedStart,
  plannedEnd,
  tasks,
  milestones,
  isPolish,
  dependencies = [],
}: UseTimelineRowsOptions) {
  const { t } = useTranslation();
  const [extraRows, setExtraRows] = useState<TimelineRow[]>([]);
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<TimelineRow>>>({});
  const [manualOrder, setManualOrder] = useState<string[]>([]);

  // task_dependencies → predecessor per successor task. The endpoint returns both
  // directions; the 'successor' rows carry {sourceTaskId: predecessor, taskId: successor}.
  const predBySuccessor = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of dependencies || []) {
      if (d?.direction && d.direction !== 'successor') continue;
      const succ = d?.taskId != null ? String(d.taskId) : '';
      const pred = d?.sourceTaskId != null ? String(d.sourceTaskId) : '';
      if (succ && pred && succ !== pred && !m.has(succ)) m.set(succ, pred);
    }
    return m;
  }, [dependencies]);

  const rawRows = useMemo<TimelineRow[]>(() => {
    const result: TimelineRow[] = [];

    // Start
    result.push({
      id: '__start__',
      type: 'start',
      name: t('initiatives.timelinePlanner.initiativeStart'),
      startDate: plannedStart,
      endDate: null,
      schedulingMode: 'fixed_date',
      order: -Infinity,
    });

    // Tasks from context
    tasks.forEach((t, idx) => {
      const predId = predBySuccessor.get(String(t.id));
      result.push({
        id: `task-${t.id}`,
        type: 'task',
        name: t.title,
        startDate: t.dueDate || null,
        endDate: t.dueDate || null,
        status: t.status,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        linkedTaskId: t.id,
        estimatedHours: t.estimatedHours ?? null,
        // Derived from task_dependencies; a manual rowOverride (below) still wins.
        dependsOnId: predId ? `task-${predId}` : null,
        schedulingMode: 'fixed_date',
        order: 100 + idx,
      });
    });

    // Milestones from context
    milestones.forEach((m, idx) => {
      result.push({
        id: `ms-${m.id}`,
        type: 'milestone',
        name: m.name,
        startDate: m.date,
        endDate: null,
        linkedMilestoneId: m.id,
        schedulingMode: 'fixed_date',
        order: 200 + idx,
      });
    });

    // Extra rows
    result.push(...extraRows);

    // Finish
    result.push({
      id: '__finish__',
      type: 'finish',
      name: t('initiatives.timelinePlanner.initiativeFinish'),
      startDate: plannedEnd,
      endDate: null,
      schedulingMode: 'fixed_date',
      order: Infinity,
    });

    // Apply in-table edits for source rows (tasks/milestones) and extra rows.
    const withOverrides = result.map((r) =>
      rowOverrides[r.id] ? { ...r, ...rowOverrides[r.id] } : r
    );

    // Base sort (date/order) before optional manual ordering
    withOverrides.sort((a, b) => {
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      if (a.type === 'finish') return 1;
      if (b.type === 'finish') return -1;
      const da = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const db = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      if (da !== db) return da - db;
      return a.order - b.order;
    });

    // Keep Start first and Finish last; middle rows can be manually reordered.
    const startRow = withOverrides.find((r) => r.type === 'start') || null;
    const finishRow = withOverrides.find((r) => r.type === 'finish') || null;
    const middle = withOverrides.filter((r) => r.type !== 'start' && r.type !== 'finish');

    if (middle.length === 0) return withOverrides;

    const middleIds = middle.map((r) => r.id);
    const kept = manualOrder.filter((id) => middleIds.includes(id));
    const newOnes = middleIds.filter((id) => !kept.includes(id));
    const effectiveOrder = [...kept, ...newOnes];
    const indexMap = new Map(effectiveOrder.map((id, i) => [id, i]));
    middle.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));

    const ordered: TimelineRow[] = [];
    if (startRow) ordered.push(startRow);
    ordered.push(...middle);
    if (finishRow) ordered.push(finishRow);
    return ordered;
  }, [
    plannedStart,
    plannedEnd,
    tasks,
    milestones,
    extraRows,
    t,
    manualOrder,
    rowOverrides,
    predBySuccessor,
  ]);

  // Apply cascade recalculation
  const rows = useMemo(() => recalculateDates(rawRows), [rawRows]);

  const addRow = useCallback((row: TimelineRow) => {
    setExtraRows((prev) => [...prev, row]);
    return row.id;
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<TimelineRow>) => {
    if (id.startsWith('tr-')) {
      setExtraRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } else {
      setRowOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    }
  }, []);

  const replaceExtraRows = useCallback((next: TimelineRow[]) => {
    setExtraRows(Array.isArray(next) ? next : []);
  }, []);

  const clearRowOverrides = useCallback(() => {
    setRowOverrides({});
  }, []);

  const replaceManualOrder = useCallback((next: string[]) => {
    setManualOrder(Array.isArray(next) ? next.filter(Boolean) : []);
  }, []);

  const removeRow = useCallback((id: string) => {
    setExtraRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const duplicateRow = useCallback((id: string) => {
    setExtraRows((prev) => {
      const src = prev.find((r) => r.id === id);
      if (!src) return prev;
      const copy: TimelineRow = {
        ...src,
        id: genId(),
        name: `${src.name} (copy)`,
        order: src.order + 1,
      };
      const idx = prev.findIndex((r) => r.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const reorderRows = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      setManualOrder((prev) => {
        const movableIds = rawRows
          .filter((r) => r.type !== 'start' && r.type !== 'finish')
          .map((r) => r.id);
        const kept = prev.filter((id) => movableIds.includes(id));
        const newOnes = movableIds.filter((id) => !kept.includes(id));
        const effective = [...kept, ...newOnes];

        const srcIdx = effective.indexOf(sourceId);
        const tgtIdx = effective.indexOf(targetId);
        if (srcIdx < 0 || tgtIdx < 0) return effective;

        const next = [...effective];
        const [moved] = next.splice(srcIdx, 1);
        next.splice(tgtIdx, 0, moved);
        return next;
      });
    },
    [rawRows]
  );

  return {
    rows,
    addRow,
    updateRow,
    removeRow,
    duplicateRow,
    reorderRows,
    extraRows,
    replaceExtraRows,
    clearRowOverrides,
    replaceManualOrder,
  };
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENT: AddTimelineItemPanel
// ════════════════════════════════════════════════════════════════

interface AddItemPanelProps {
  isPolish: boolean;
  rows: TimelineRow[];
  tasks: TaskItem[];
  decisions: Decision[];
  milestones: TimelineMilestone[];
  users: UserInfo[];
  availableReports: ReportOption[];
  onAdd: (row: TimelineRow) => void;
  onClose: () => void;
}

const AddTimelineItemPanel: React.FC<AddItemPanelProps> = ({
  isPolish,
  rows,
  tasks,
  decisions,
  milestones,
  users,
  availableReports,
  onAdd,
  onClose,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<TimelineRowType | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [scheduling, setScheduling] = useState<SchedulingMode>('after_previous');
  const [fixedDate, setFixedDate] = useState('');
  const [startTriggerType, setStartTriggerType] = useState<'date' | 'event' | 'dependency'>(
    'dependency'
  );
  const [startTriggerEvent, setStartTriggerEvent] = useState('');
  const [endSchedulingMode, setEndSchedulingMode] = useState<
    'from_duration' | 'manual_date' | 'from_successor'
  >('from_duration');
  const [manualEndDate, setManualEndDate] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [dependsOnId, setDependsOnId] = useState<string>('');
  const [durationDays, setDurationDays] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [decisionBlocks, setDecisionBlocks] = useState(true);
  const [audience, setAudience] = useState('');
  const [notificationCadence, setNotificationCadence] = useState<
    'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  >('weekly');
  const [notificationChannel, setNotificationChannel] = useState<
    'email' | 'slack' | 'meeting' | 'dashboard' | 'other'
  >('email');
  const [notificationRule, setNotificationRule] = useState('');
  const [notificationRecipientMode, setNotificationRecipientMode] = useState<'person' | 'group'>(
    'group'
  );
  const [notificationRecipientUserId, setNotificationRecipientUserId] = useState('');
  const [notificationRecipientGroupKey, setNotificationRecipientGroupKey] = useState<
    'project_team' | 'steering_committee' | 'sponsor_group' | 'all_stakeholders' | 'custom_group'
  >('project_team');
  const [notificationTriggerMode, setNotificationTriggerMode] = useState<
    'event_based' | 'cyclical'
  >('cyclical');
  const [notificationTriggerEvent, setNotificationTriggerEvent] = useState<
    'on_start' | 'on_complete' | 'before_next_action' | 'manual_gate'
  >('before_next_action');
  const [notificationLeadDays, setNotificationLeadDays] = useState('1');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationAiAutoSend, setNotificationAiAutoSend] = useState(false);
  const [notificationAiInstruction, setNotificationAiInstruction] = useState('');
  const [meetingCadence, setMeetingCadence] = useState<
    'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  >('weekly');
  const [meetingChannel, setMeetingChannel] = useState<'online' | 'onsite' | 'hybrid'>('online');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [escalationLevel, setEscalationLevel] = useState('');
  const [infoAssetType, setInfoAssetType] = useState<
    'external_link' | 'internal_report' | 'generated_presentation' | 'other'
  >('internal_report');
  const [infoAssetLabel, setInfoAssetLabel] = useState('');
  const [infoAssetUrl, setInfoAssetUrl] = useState('');
  const [linkedReportPlaceholderId, setLinkedReportPlaceholderId] = useState('');
  const [infoEventMode, setInfoEventMode] = useState<'cyclical' | 'specific_date' | 'after_event'>(
    'specific_date'
  );
  const [infoEventCadence, setInfoEventCadence] = useState<
    'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  >('weekly');
  const [infoEventReferenceEvent, setInfoEventReferenceEvent] = useState('');
  const [infoEventParticipantMode, setInfoEventParticipantMode] = useState<'person' | 'group'>(
    'group'
  );
  const [infoEventParticipantUserId, setInfoEventParticipantUserId] = useState('');
  const [infoEventParticipantGroupKey, setInfoEventParticipantGroupKey] = useState<
    'project_team' | 'steering_committee' | 'sponsor_group' | 'all_stakeholders' | 'custom_group'
  >('project_team');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [selectedDecisionId, setSelectedDecisionId] = useState('');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-set dependsOnId to the last non-finish row
  useEffect(() => {
    const candidates = rows.filter((r) => r.type !== 'finish');
    if (candidates.length > 0) {
      setDependsOnId(candidates[candidates.length - 1].id);
    }
  }, [rows]);

  const depOptions = useMemo(
    () =>
      rows
        .filter((r) => r.type !== 'finish')
        .map((r, idx) => ({ id: r.id, label: `#${idx + 1} ${r.name}`.slice(0, 50) })),
    [rows]
  );
  const successorOptions = useMemo(
    () =>
      rows
        .filter((r) => r.type !== 'start')
        .map((r, idx) => ({ id: r.id, label: `#${idx + 1} ${r.name}`.slice(0, 50) })),
    [rows]
  );

  const taskOptions = useMemo(() => tasks.filter((t) => !t.isMilestone), [tasks]);
  const decisionOptions = useMemo(() => decisions, [decisions]);
  const milestoneOptions = useMemo(() => milestones, [milestones]);
  const infoEventMaterialValid =
    (infoAssetType === 'external_link' && !!infoAssetUrl.trim()) ||
    (infoAssetType === 'internal_report' && !!linkedReportPlaceholderId) ||
    (infoAssetType === 'generated_presentation' && !!infoAssetLabel.trim()) ||
    (infoAssetType === 'other' && !!infoAssetLabel.trim());
  const infoEventDateModeValid = infoEventMode !== 'specific_date' || !!fixedDate;
  const infoEventReferenceEventValid =
    infoEventMode !== 'after_event' || !!infoEventReferenceEvent.trim();
  const infoEventParticipantValid =
    infoEventParticipantMode === 'group' || !!infoEventParticipantUserId;

  const handleSelectType = (type: TimelineRowType) => {
    setSelectedType(type);
    setStep(2);
    setStartTriggerType('dependency');
    setEndSchedulingMode(
      type === 'task' || type === 'pause' || type === 'meeting' ? 'from_duration' : 'manual_date'
    );
    setSubmitAttempted(false);
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!selectedType || !name.trim()) return;
    if (selectedType === 'task' && !selectedTaskId) return;
    if (selectedType === 'decision' && !selectedDecisionId) return;
    if (selectedType === 'milestone' && !selectedMilestoneId) return;
    if (selectedType === 'info_event') {
      if (!infoEventMaterialValid) return;
      if (!infoEventDateModeValid) return;
      if (!infoEventReferenceEventValid) return;
      if (!infoEventParticipantValid) return;
    }
    if (selectedType === 'notification') {
      const hasRecipient =
        notificationRecipientMode === 'group'
          ? !!notificationRecipientGroupKey
          : !!notificationRecipientUserId;
      if (!hasRecipient) return;
      if (!notificationMessage.trim()) return;
      if (
        notificationTriggerMode === 'event_based' &&
        notificationTriggerEvent === 'before_next_action' &&
        !notificationLeadDays
      ) {
        return;
      }
    }
    if (startTriggerType === 'date' && !fixedDate) return;
    if (startTriggerType === 'event' && !startTriggerEvent.trim()) return;
    if (startTriggerType === 'dependency' && !dependsOnId) return;
    if (endSchedulingMode === 'manual_date' && !manualEndDate) return;
    if (endSchedulingMode === 'from_successor' && !successorId) return;

    const hasDuration = selectedType === 'task';
    const dur = hasDuration && durationDays ? parseInt(durationDays, 10) : null;

    const computedSchedulingMode: SchedulingMode =
      startTriggerType === 'dependency' ? 'after_previous' : 'fixed_date';
    const computedStartDate =
      startTriggerType === 'date' && fixedDate
        ? fixedDate
        : startTriggerType === 'event'
          ? null
          : scheduling === 'fixed_date' && fixedDate
            ? fixedDate
            : null;
    const computedEndDate = endSchedulingMode === 'manual_date' ? manualEndDate || null : null;

    const newRow: TimelineRow = {
      id: genId(),
      type: selectedType,
      name: name.trim(),
      startDate: computedStartDate,
      endDate: computedEndDate,
      durationDays: dur,
      schedulingMode: computedSchedulingMode,
      startTriggerType,
      startTriggerEvent: startTriggerType === 'event' ? startTriggerEvent || undefined : undefined,
      dependsOnId: computedSchedulingMode === 'after_previous' ? dependsOnId || null : null,
      endSchedulingMode,
      successorId: endSchedulingMode === 'from_successor' ? successorId || null : null,
      dependencyType: 'FS',
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      decisionBlocksNext: selectedType === 'decision' ? decisionBlocks : undefined,
      decisionOutcome: selectedType === 'decision' ? null : undefined,
      audience: selectedType === 'info_event' ? audience || undefined : undefined,
      infoAssetType: selectedType === 'info_event' ? infoAssetType : undefined,
      infoAssetLabel: selectedType === 'info_event' ? infoAssetLabel || undefined : undefined,
      infoAssetUrl: selectedType === 'info_event' ? infoAssetUrl || undefined : undefined,
      linkedReportPlaceholderId:
        selectedType === 'info_event' && infoAssetType === 'internal_report'
          ? linkedReportPlaceholderId || undefined
          : undefined,
      infoEventMode: selectedType === 'info_event' ? infoEventMode : undefined,
      infoEventCadence:
        selectedType === 'info_event' && infoEventMode === 'cyclical'
          ? infoEventCadence
          : undefined,
      infoEventReferenceEvent:
        selectedType === 'info_event' && infoEventMode === 'after_event'
          ? infoEventReferenceEvent || undefined
          : undefined,
      infoEventParticipantMode:
        selectedType === 'info_event' ? infoEventParticipantMode : undefined,
      infoEventParticipantUserId:
        selectedType === 'info_event' && infoEventParticipantMode === 'person'
          ? infoEventParticipantUserId || undefined
          : undefined,
      infoEventParticipantGroupKey:
        selectedType === 'info_event' && infoEventParticipantMode === 'group'
          ? infoEventParticipantGroupKey
          : undefined,
      notificationCadence: selectedType === 'notification' ? notificationCadence : undefined,
      notificationChannel: selectedType === 'notification' ? notificationChannel : undefined,
      notificationRule: selectedType === 'notification' ? notificationRule || undefined : undefined,
      notificationRecipientMode:
        selectedType === 'notification' ? notificationRecipientMode : undefined,
      notificationRecipientUserId:
        selectedType === 'notification' && notificationRecipientMode === 'person'
          ? notificationRecipientUserId || undefined
          : undefined,
      notificationRecipientUserName:
        selectedType === 'notification' && notificationRecipientMode === 'person'
          ? users.find((u) => u.id === notificationRecipientUserId)?.firstName
            ? `${users.find((u) => u.id === notificationRecipientUserId)?.firstName} ${
                users.find((u) => u.id === notificationRecipientUserId)?.lastName || ''
              }`.trim()
            : undefined
          : undefined,
      notificationRecipientGroupKey:
        selectedType === 'notification' && notificationRecipientMode === 'group'
          ? notificationRecipientGroupKey
          : undefined,
      notificationTriggerMode:
        selectedType === 'notification' ? notificationTriggerMode : undefined,
      notificationTriggerEvent:
        selectedType === 'notification' && notificationTriggerMode === 'event_based'
          ? notificationTriggerEvent
          : undefined,
      notificationLeadDays:
        selectedType === 'notification' &&
        notificationTriggerMode === 'event_based' &&
        notificationTriggerEvent === 'before_next_action'
          ? notificationLeadDays
            ? parseInt(notificationLeadDays, 10)
            : null
          : undefined,
      notificationMessage:
        selectedType === 'notification' ? notificationMessage || undefined : undefined,
      notificationAiAutoSend: selectedType === 'notification' ? notificationAiAutoSend : undefined,
      notificationAiInstruction:
        selectedType === 'notification' && notificationAiAutoSend
          ? notificationAiInstruction || undefined
          : undefined,
      meetingCadence: selectedType === 'meeting' ? meetingCadence : undefined,
      meetingChannel: selectedType === 'meeting' ? meetingChannel : undefined,
      meetingAgenda: selectedType === 'meeting' ? meetingAgenda || undefined : undefined,
      pauseReason: selectedType === 'pause' ? pauseReason || undefined : undefined,
      escalationLevel: selectedType === 'escalation' ? escalationLevel || undefined : undefined,
      linkedTaskId: selectedType === 'task' ? selectedTaskId : undefined,
      linkedDecisionId: selectedType === 'decision' ? selectedDecisionId : undefined,
      linkedMilestoneId: selectedType === 'milestone' ? selectedMilestoneId : undefined,
      order: 300 + rows.length,
    };

    onAdd(newRow);
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-2xl rounded-2xl border border-c-border-subtle bg-c-surface shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4">
          {/* Step 1: Select type */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-c-text-secondary">
                  {t('initiatives.timelinePlanner.whatToAdd')}
                </span>
                <button
                  onClick={onClose}
                  className="text-c-text-secondary hover:text-c-text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ADDABLE_TYPES.map((at) => {
                  const Icon = at.icon;
                  const meta = ROW_TYPE_META[at.type];
                  return (
                    <button
                      key={at.type}
                      onClick={() => handleSelectType(at.type)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-c-border-subtle hover:border-c-border-strong hover:bg-c-surface-raised transition-all text-left group"
                    >
                      <Icon size={16} className={`${meta.color} mt-0.5 flex-shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-c-text-secondary">
                          {isPolish ? at.labelPl : at.label}
                        </div>
                        <div className="text-[9px] text-c-text-secondary mt-0.5">
                          {isPolish ? at.descPl : at.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Form */}
          {step === 2 && selectedType && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="text-[10px] text-c-text-secondary hover:text-c-text-secondary transition-colors"
                  >
                    ← {t('initiatives.timelinePlanner.back')}
                  </button>
                  <span className="text-xs font-medium text-c-text-secondary">
                    {isPolish
                      ? ROW_TYPE_META[selectedType].labelPl
                      : ROW_TYPE_META[selectedType].label}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-c-text-secondary hover:text-c-text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.name')} *
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('initiatives.timelinePlanner.itemNamePlaceholder')}
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Source selectors */}
              {selectedType === 'task' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.selectTaskFromList')} *
                  </label>
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedTaskId(id);
                      const t = taskOptions.find((x) => x.id === id);
                      if (t) {
                        setName(t.title);
                        if (t.estimatedHours != null) setEstimatedHours(String(t.estimatedHours));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.selectTask')} —</option>
                    {taskOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedType === 'decision' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.selectDecisionFromList')} *
                  </label>
                  <select
                    value={selectedDecisionId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDecisionId(id);
                      const d = decisionOptions.find((x) => x.id === id);
                      if (d) setName(d.title);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.selectDecision')} —</option>
                    {decisionOptions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedType === 'milestone' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.selectMilestoneFromList')} *
                  </label>
                  <select
                    value={selectedMilestoneId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMilestoneId(id);
                      const m = milestoneOptions.find((x) => x.id === id);
                      if (m) {
                        setName(m.name);
                        if (!fixedDate) setFixedDate(toISO(m.date));
                      }
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.selectMilestone')} —</option>
                    {milestoneOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Scheduling mode */}
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1.5">
                  {t('initiatives.timelinePlanner.startTrigger')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setScheduling('after_previous');
                      setStartTriggerType('dependency');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'dependency'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-c-border-subtle text-c-text-muted hover:border-c-border-subtle'
                    }`}
                  >
                    {t('initiatives.timelinePlanner.fromDependencySystem')}
                  </button>
                  <button
                    onClick={() => {
                      setScheduling('fixed_date');
                      setStartTriggerType('date');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'date'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-c-border-subtle text-c-text-muted hover:border-c-border-subtle'
                    }`}
                  >
                    {t('initiatives.timelinePlanner.manualDate')}
                  </button>
                  <button
                    onClick={() => {
                      setScheduling('fixed_date');
                      setStartTriggerType('event');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'event'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-c-border-subtle text-c-text-muted hover:border-c-border-subtle'
                    }`}
                  >
                    {t('initiatives.timelinePlanner.eventTrigger')}
                  </button>
                </div>
              </div>

              {/* Dependency select (after_previous) */}
              {startTriggerType === 'dependency' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.dependsOn')}
                  </label>
                  <select
                    value={dependsOnId}
                    onChange={(e) => setDependsOnId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                  >
                    {depOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fixed date picker */}
              {startTriggerType === 'date' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.date')}
                  </label>
                  <input
                    type="date"
                    value={fixedDate}
                    onChange={(e) => setFixedDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
              {startTriggerType === 'event' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.eventName')}
                  </label>
                  <input
                    type="text"
                    value={startTriggerEvent}
                    onChange={(e) => setStartTriggerEvent(e.target.value)}
                    placeholder={t('initiatives.timelinePlanner.placeholderGateApproval')}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {/* End mode */}
              {(selectedType === 'task' ||
                selectedType === 'pause' ||
                selectedType === 'meeting') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-c-text-muted block">
                    {t('initiatives.timelinePlanner.endTrigger')}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('from_duration')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'from_duration'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      {t('initiatives.timelinePlanner.fromDuration')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('manual_date')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'manual_date'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      {t('initiatives.timelinePlanner.manualDate')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('from_successor')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'from_successor'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      {t('initiatives.timelinePlanner.fromSuccessor')}
                    </button>
                  </div>
                  {endSchedulingMode === 'manual_date' && (
                    <input
                      type="date"
                      value={manualEndDate}
                      onChange={(e) => setManualEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                    />
                  )}
                  {endSchedulingMode === 'from_successor' && (
                    <select
                      value={successorId}
                      onChange={(e) => setSuccessorId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">
                        — {t('initiatives.timelinePlanner.selectSuccessor')} —
                      </option>
                      {successorOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Task-specific: duration + hours */}
              {selectedType === 'task' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.calendarWindowDays')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        placeholder="—"
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.teamEffortHours')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(e.target.value)}
                        placeholder="—"
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-c-text-secondary">
                    {t('initiatives.timelinePlanner.calendarWindowHelp')}
                  </p>
                </div>
              )}

              {/* Decision-specific */}
              {selectedType === 'decision' && (
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-c-text-muted">
                    {t('initiatives.timelinePlanner.blocksNextTasks')}
                  </label>
                  <button
                    onClick={() => setDecisionBlocks(!decisionBlocks)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      decisionBlocks ? 'bg-blue-500' : 'bg-c-border-strong '
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        decisionBlocks ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Info event: audience */}
              {selectedType === 'info_event' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.eventMode')}
                      </label>
                      <select
                        value={infoEventMode}
                        onChange={(e) =>
                          setInfoEventMode(
                            e.target.value as 'cyclical' | 'specific_date' | 'after_event'
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                      >
                        <option value="cyclical">
                          {t('initiatives.timelinePlanner.cyclicalMeeting')}
                        </option>
                        <option value="specific_date">
                          {t('initiatives.timelinePlanner.onSpecificDate')}
                        </option>
                        <option value="after_event">
                          {t('initiatives.timelinePlanner.afterEvent')}
                        </option>
                      </select>
                    </div>
                    {infoEventMode === 'cyclical' && (
                      <div>
                        <label className="text-[10px] text-c-text-muted block mb-1">
                          {t('initiatives.timelinePlanner.cadence')}
                        </label>
                        <select
                          value={infoEventCadence}
                          onChange={(e) => setInfoEventCadence(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                        >
                          <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                          <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                          <option value="biweekly">
                            {t('initiatives.timelinePlanner.biweekly')}
                          </option>
                          <option value="monthly">
                            {t('initiatives.timelinePlanner.monthly')}
                          </option>
                          <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
                        </select>
                      </div>
                    )}
                    {infoEventMode === 'after_event' && (
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-c-text-muted block mb-1">
                          {t('initiatives.timelinePlanner.afterWhichEvent')}
                        </label>
                        <input
                          type="text"
                          value={infoEventReferenceEvent}
                          onChange={(e) => setInfoEventReferenceEvent(e.target.value)}
                          placeholder={t('initiatives.timelinePlanner.placeholderAfterGoGate')}
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                        />
                        {submitAttempted && !infoEventReferenceEventValid && (
                          <p className="mt-1 text-[10px] text-danger-500">
                            {t('initiatives.timelinePlanner.validationReferenceEvent')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {submitAttempted && !infoEventDateModeValid && (
                    <p className="text-[10px] text-danger-500">
                      {t('initiatives.timelinePlanner.validationSpecificDate')}
                    </p>
                  )}
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.audience')}
                    </label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder={t('initiatives.timelinePlanner.placeholderSteeringCommittee')}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.whoShouldAttend')}
                      </label>
                      <select
                        value={infoEventParticipantMode}
                        onChange={(e) =>
                          setInfoEventParticipantMode(e.target.value as 'person' | 'group')
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                      >
                        <option value="group">{t('initiatives.timelinePlanner.group')}</option>
                        <option value="person">{t('initiatives.timelinePlanner.person')}</option>
                      </select>
                    </div>
                    <div>
                      {infoEventParticipantMode === 'group' ? (
                        <select
                          value={infoEventParticipantGroupKey}
                          onChange={(e) =>
                            setInfoEventParticipantGroupKey(
                              e.target.value as
                                | 'project_team'
                                | 'steering_committee'
                                | 'sponsor_group'
                                | 'all_stakeholders'
                                | 'custom_group'
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                        >
                          {NOTIFICATION_GROUP_OPTIONS.map((g) => (
                            <option key={g.key} value={g.key}>
                              {isPolish ? g.labelPl : g.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={infoEventParticipantUserId}
                          onChange={(e) => setInfoEventParticipantUserId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">
                            — {t('initiatives.timelinePlanner.selectPerson')} —
                          </option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {[u.firstName, u.lastName].filter(Boolean).join(' ') ||
                                u.email ||
                                u.id}
                            </option>
                          ))}
                        </select>
                      )}
                      {submitAttempted && !infoEventParticipantValid && (
                        <p className="mt-1 text-[10px] text-danger-500">
                          {t('initiatives.timelinePlanner.validationParticipant')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.materialSourceRequired')}
                    </label>
                    <select
                      value={infoAssetType}
                      onChange={(e) => setInfoAssetType(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="internal_report">
                        {t('initiatives.timelinePlanner.internalReport')}
                      </option>
                      <option value="generated_presentation">
                        {t('initiatives.timelinePlanner.generatedPresentation')}
                      </option>
                      <option value="external_link">
                        {t('initiatives.timelinePlanner.externalLink')}
                      </option>
                      <option value="other">{t('initiatives.timelinePlanner.otherNeut')}</option>
                    </select>
                    {infoAssetType === 'internal_report' && availableReports.length === 0 && (
                      <p className="mt-1 text-[10px] text-amber-500">
                        {t('initiatives.timelinePlanner.noReportsInLibrary')}
                      </p>
                    )}
                    {submitAttempted && !infoEventMaterialValid && (
                      <p className="mt-1 text-[10px] text-danger-500">
                        {t('initiatives.timelinePlanner.validationMaterialSource')}
                      </p>
                    )}
                  </div>

                  {infoAssetType === 'internal_report' && (
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.selectReport')}
                      </label>
                      <select
                        value={linkedReportPlaceholderId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setLinkedReportPlaceholderId(id);
                          const found = availableReports.find((x) => x.id === id);
                          if (found) setInfoAssetLabel(found.title);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">
                          — {t('initiatives.timelinePlanner.selectReport')} —
                        </option>
                        {availableReports.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {infoAssetType === 'external_link' && (
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.materialUrl')}
                      </label>
                      <input
                        type="url"
                        value={infoAssetUrl}
                        onChange={(e) => setInfoAssetUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {(infoAssetType === 'generated_presentation' || infoAssetType === 'other') && (
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.materialLabel')}
                      </label>
                      <input
                        type="text"
                        value={infoAssetLabel}
                        onChange={(e) => setInfoAssetLabel(e.target.value)}
                        placeholder={t('initiatives.timelinePlanner.placeholderDeckSprintReview')}
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notification: cyclical communication rules */}
              {selectedType === 'notification' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.templates')}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {NOTIFICATION_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setNotificationCadence(preset.cadence);
                            setNotificationChannel(preset.channel);
                            setNotificationRule(isPolish ? preset.rulePl : preset.rule);
                            if (!name.trim()) {
                              setName(isPolish ? preset.labelPl : preset.label);
                            }
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium text-c-text-muted hover:text-c-text border border-c-border-subtle hover:border-c-border-strong transition-colors"
                        >
                          {isPolish ? preset.labelPl : preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.recipientType')}
                    </label>
                    <select
                      value={notificationRecipientMode}
                      onChange={(e) =>
                        setNotificationRecipientMode(e.target.value as 'person' | 'group')
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="group">{t('initiatives.timelinePlanner.group')}</option>
                      <option value="person">{t('initiatives.timelinePlanner.person')}</option>
                    </select>
                  </div>
                  <div>
                    {notificationRecipientMode === 'group' ? (
                      <>
                        <label className="text-[10px] text-c-text-muted block mb-1">
                          {t('initiatives.timelinePlanner.selectGroup')}
                        </label>
                        <select
                          value={notificationRecipientGroupKey}
                          onChange={(e) =>
                            setNotificationRecipientGroupKey(
                              e.target.value as
                                | 'project_team'
                                | 'steering_committee'
                                | 'sponsor_group'
                                | 'all_stakeholders'
                                | 'custom_group'
                            )
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                        >
                          {NOTIFICATION_GROUP_OPTIONS.map((g) => (
                            <option key={g.key} value={g.key}>
                              {isPolish ? g.labelPl : g.label}
                            </option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="text-[10px] text-c-text-muted block mb-1">
                          {t('initiatives.timelinePlanner.selectPerson')}
                        </label>
                        <select
                          value={notificationRecipientUserId}
                          onChange={(e) => setNotificationRecipientUserId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">
                            — {t('initiatives.timelinePlanner.selectPerson')} —
                          </option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {[u.firstName, u.lastName].filter(Boolean).join(' ') ||
                                u.email ||
                                u.id}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.notificationMode')}
                    </label>
                    <select
                      value={notificationTriggerMode}
                      onChange={(e) =>
                        setNotificationTriggerMode(e.target.value as 'event_based' | 'cyclical')
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="event_based">
                        {t('initiatives.timelinePlanner.eventBased')}
                      </option>
                      <option value="cyclical">{t('initiatives.timelinePlanner.cyclical')}</option>
                    </select>
                  </div>
                  {notificationTriggerMode === 'event_based' && (
                    <div>
                      <label className="text-[10px] text-c-text-muted block mb-1">
                        {t('initiatives.timelinePlanner.eventTriggerLabel')}
                      </label>
                      <select
                        value={notificationTriggerEvent}
                        onChange={(e) =>
                          setNotificationTriggerEvent(
                            e.target.value as
                              | 'on_start'
                              | 'on_complete'
                              | 'before_next_action'
                              | 'manual_gate'
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                      >
                        <option value="on_start">{t('initiatives.timelinePlanner.onStart')}</option>
                        <option value="on_complete">
                          {t('initiatives.timelinePlanner.onComplete')}
                        </option>
                        <option value="before_next_action">
                          {t('initiatives.timelinePlanner.beforeNextAction')}
                        </option>
                        <option value="manual_gate">
                          {t('initiatives.timelinePlanner.manualGateEvent')}
                        </option>
                      </select>
                    </div>
                  )}
                  {notificationTriggerMode === 'event_based' &&
                    notificationTriggerEvent === 'before_next_action' && (
                      <div>
                        <label className="text-[10px] text-c-text-muted block mb-1">
                          {t('initiatives.timelinePlanner.leadTimeDays')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={notificationLeadDays}
                          onChange={(e) => setNotificationLeadDays(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    )}
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.cadence')}
                    </label>
                    <select
                      value={notificationCadence}
                      onChange={(e) => setNotificationCadence(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                      <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                      <option value="biweekly">{t('initiatives.timelinePlanner.biweekly')}</option>
                      <option value="monthly">{t('initiatives.timelinePlanner.monthly')}</option>
                      <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.channel')}
                    </label>
                    <select
                      value={notificationChannel}
                      onChange={(e) => setNotificationChannel(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="email">Email</option>
                      <option value="slack">Slack</option>
                      <option value="meeting">{t('initiatives.timelinePlanner.meeting')}</option>
                      <option value="dashboard">Dashboard</option>
                      <option value="other">{t('initiatives.timelinePlanner.otherMasc')}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.communicationRule')}
                    </label>
                    <input
                      type="text"
                      value={notificationRule}
                      onChange={(e) => setNotificationRule(e.target.value)}
                      placeholder={t('initiatives.timelinePlanner.placeholderCommunicationRule')}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.notificationContent')} *
                    </label>
                    <textarea
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      rows={2}
                      placeholder={t('initiatives.timelinePlanner.placeholderNotificationContent')}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-c-text-muted">
                        {t('initiatives.timelinePlanner.aiAutoSendNotification')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setNotificationAiAutoSend(!notificationAiAutoSend)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          notificationAiAutoSend ? 'bg-blue-500' : 'bg-c-border-strong '
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            notificationAiAutoSend ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    {notificationAiAutoSend && (
                      <textarea
                        value={notificationAiInstruction}
                        onChange={(e) => setNotificationAiInstruction(e.target.value)}
                        rows={2}
                        placeholder={t('initiatives.timelinePlanner.placeholderAiInstruction')}
                        className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Recurring meeting */}
              {selectedType === 'meeting' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.meetingCadence')}
                    </label>
                    <select
                      value={meetingCadence}
                      onChange={(e) => setMeetingCadence(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                      <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                      <option value="biweekly">{t('initiatives.timelinePlanner.biweekly')}</option>
                      <option value="monthly">{t('initiatives.timelinePlanner.monthly')}</option>
                      <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.meetingChannel')}
                    </label>
                    <select
                      value={meetingChannel}
                      onChange={(e) => setMeetingChannel(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="online">Online</option>
                      <option value="onsite">{t('initiatives.timelinePlanner.onsite')}</option>
                      <option value="hybrid">{t('initiatives.timelinePlanner.hybrid')}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.meetingAgenda')}
                    </label>
                    <textarea
                      rows={2}
                      value={meetingAgenda}
                      onChange={(e) => setMeetingAgenda(e.target.value)}
                      placeholder={t('initiatives.timelinePlanner.placeholderMeetingAgenda')}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Pause */}
              {selectedType === 'pause' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.calendarWindowDays')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-c-text-muted block mb-1">
                      {t('initiatives.timelinePlanner.pauseReason')}
                    </label>
                    <input
                      type="text"
                      value={pauseReason}
                      onChange={(e) => setPauseReason(e.target.value)}
                      placeholder={t('initiatives.timelinePlanner.placeholderPauseReason')}
                      className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-c-text-secondary">
                      {t('initiatives.timelinePlanner.pauseHelp')}
                    </p>
                  </div>
                </div>
              )}

              {/* Escalation: level */}
              {selectedType === 'escalation' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.escalationLevel')}
                  </label>
                  <select
                    value={escalationLevel}
                    onChange={(e) => setEscalationLevel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm text-c-text-muted focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.select')} —</option>
                    <option value="Sponsor">Sponsor</option>
                    <option value="PMO">PMO</option>
                    <option value="Board">{t('initiatives.timelinePlanner.board')}</option>
                    <option value="Other">{t('initiatives.timelinePlanner.otherMasc')}</option>
                  </select>
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs text-c-text-muted hover:bg-c-surface-raised transition-colors"
                >
                  {t('initiatives.timelinePlanner.cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 transition-colors"
                >
                  {t('initiatives.timelinePlanner.add')}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENT: TimelineTable
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENT: EditRowPanel (inline edit modal)
// ════════════════════════════════════════════════════════════════

interface EditRowPanelProps {
  row: TimelineRow;
  rows: TimelineRow[];
  tasks: TaskItem[];
  decisions: Decision[];
  milestones: TimelineMilestone[];
  users: UserInfo[];
  availableReports: ReportOption[];
  isPolish: boolean;
  onSave: (id: string, patch: Partial<TimelineRow>) => void;
  onClose: () => void;
}

const EditRowPanel: React.FC<EditRowPanelProps> = ({
  row,
  rows,
  tasks,
  decisions,
  milestones,
  users,
  availableReports,
  isPolish,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(row.name);
  const [scheduling, setScheduling] = useState<SchedulingMode>(row.schedulingMode);
  const [fixedDate, setFixedDate] = useState(toISO(row.startDate));
  const [startTriggerType, setStartTriggerType] = useState<'date' | 'event' | 'dependency'>(
    row.startTriggerType || (row.schedulingMode === 'after_previous' ? 'dependency' : 'date')
  );
  const [startTriggerEvent, setStartTriggerEvent] = useState(row.startTriggerEvent || '');
  const [endSchedulingMode, setEndSchedulingMode] = useState<
    'from_duration' | 'manual_date' | 'from_successor'
  >(row.endSchedulingMode || 'from_duration');
  const [manualEndDate, setManualEndDate] = useState(toISO(row.endDate));
  const [successorId, setSuccessorId] = useState(row.successorId || '');
  const [dependsOnId, setDependsOnId] = useState(row.dependsOnId || '');
  const [durationDays, setDurationDays] = useState(row.durationDays?.toString() || '');
  const [estimatedHours, setEstimatedHours] = useState(row.estimatedHours?.toString() || '');
  const [decisionBlocks, setDecisionBlocks] = useState(row.decisionBlocksNext ?? true);
  const [audience, setAudience] = useState(row.audience || '');
  const [notificationCadence, setNotificationCadence] = useState(
    row.notificationCadence || 'weekly'
  );
  const [notificationChannel, setNotificationChannel] = useState(
    row.notificationChannel || 'email'
  );
  const [notificationRule, setNotificationRule] = useState(row.notificationRule || '');
  const [notificationRecipientMode, setNotificationRecipientMode] = useState<'person' | 'group'>(
    row.notificationRecipientMode || 'group'
  );
  const [notificationRecipientUserId, setNotificationRecipientUserId] = useState(
    row.notificationRecipientUserId || ''
  );
  const [notificationRecipientGroupKey, setNotificationRecipientGroupKey] = useState<
    'project_team' | 'steering_committee' | 'sponsor_group' | 'all_stakeholders' | 'custom_group'
  >(row.notificationRecipientGroupKey || 'project_team');
  const [notificationTriggerMode, setNotificationTriggerMode] = useState<
    'event_based' | 'cyclical'
  >(row.notificationTriggerMode || 'cyclical');
  const [notificationTriggerEvent, setNotificationTriggerEvent] = useState<
    'on_start' | 'on_complete' | 'before_next_action' | 'manual_gate'
  >(row.notificationTriggerEvent || 'before_next_action');
  const [notificationLeadDays, setNotificationLeadDays] = useState(
    row.notificationLeadDays != null ? String(row.notificationLeadDays) : '1'
  );
  const [notificationMessage, setNotificationMessage] = useState(row.notificationMessage || '');
  const [notificationAiAutoSend, setNotificationAiAutoSend] = useState(
    !!row.notificationAiAutoSend
  );
  const [notificationAiInstruction, setNotificationAiInstruction] = useState(
    row.notificationAiInstruction || ''
  );
  const [meetingCadence, setMeetingCadence] = useState(row.meetingCadence || 'weekly');
  const [meetingChannel, setMeetingChannel] = useState(row.meetingChannel || 'online');
  const [meetingAgenda, setMeetingAgenda] = useState(row.meetingAgenda || '');
  const [pauseReason, setPauseReason] = useState(row.pauseReason || '');
  const [infoAssetType, setInfoAssetType] = useState<
    'external_link' | 'internal_report' | 'generated_presentation' | 'other'
  >(row.infoAssetType || 'internal_report');
  const [infoAssetLabel, setInfoAssetLabel] = useState(row.infoAssetLabel || '');
  const [infoAssetUrl, setInfoAssetUrl] = useState(row.infoAssetUrl || '');
  const [linkedReportPlaceholderId, setLinkedReportPlaceholderId] = useState(
    row.linkedReportPlaceholderId || ''
  );
  const [infoEventMode, setInfoEventMode] = useState<'cyclical' | 'specific_date' | 'after_event'>(
    row.infoEventMode || 'specific_date'
  );
  const [infoEventCadence, setInfoEventCadence] = useState<
    'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
  >(row.infoEventCadence || 'weekly');
  const [infoEventReferenceEvent, setInfoEventReferenceEvent] = useState(
    row.infoEventReferenceEvent || ''
  );
  const [infoEventParticipantMode, setInfoEventParticipantMode] = useState<'person' | 'group'>(
    row.infoEventParticipantMode || 'group'
  );
  const [infoEventParticipantUserId, setInfoEventParticipantUserId] = useState(
    row.infoEventParticipantUserId || ''
  );
  const [infoEventParticipantGroupKey, setInfoEventParticipantGroupKey] = useState<
    'project_team' | 'steering_committee' | 'sponsor_group' | 'all_stakeholders' | 'custom_group'
  >(row.infoEventParticipantGroupKey || 'project_team');
  const [escalationLevel, setEscalationLevel] = useState(row.escalationLevel || '');
  const [decisionOutcome, setDecisionOutcome] = useState<DecisionOutcome>(
    row.decisionOutcome ?? null
  );
  const [selectedTaskId, setSelectedTaskId] = useState(row.linkedTaskId || '');
  const [selectedDecisionId, setSelectedDecisionId] = useState(row.linkedDecisionId || '');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(row.linkedMilestoneId || '');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const depOptions = useMemo(
    () =>
      rows
        .filter((r) => r.type !== 'finish' && r.id !== row.id)
        .map((r, idx) => ({ id: r.id, label: `#${idx + 1} ${r.name}`.slice(0, 50) })),
    [rows, row.id]
  );
  const successorOptions = useMemo(
    () =>
      rows
        .filter((r) => r.type !== 'start' && r.id !== row.id)
        .map((r, idx) => ({ id: r.id, label: `#${idx + 1} ${r.name}`.slice(0, 50) })),
    [rows, row.id]
  );
  const taskOptions = useMemo(() => tasks.filter((t) => !t.isMilestone), [tasks]);
  const decisionOptions = useMemo(() => decisions, [decisions]);
  const milestoneOptions = useMemo(() => milestones, [milestones]);
  const infoEventMaterialValid =
    (infoAssetType === 'external_link' && !!infoAssetUrl.trim()) ||
    (infoAssetType === 'internal_report' && !!linkedReportPlaceholderId) ||
    (infoAssetType === 'generated_presentation' && !!infoAssetLabel.trim()) ||
    (infoAssetType === 'other' && !!infoAssetLabel.trim());
  const infoEventDateModeValid = infoEventMode !== 'specific_date' || !!fixedDate;
  const infoEventReferenceEventValid =
    infoEventMode !== 'after_event' || !!infoEventReferenceEvent.trim();
  const infoEventParticipantValid =
    infoEventParticipantMode === 'group' || !!infoEventParticipantUserId;

  const handleSave = () => {
    setSubmitAttempted(true);
    if (row.type === 'info_event') {
      if (!infoEventMaterialValid) return;
      if (!infoEventDateModeValid) return;
      if (!infoEventReferenceEventValid) return;
      if (!infoEventParticipantValid) return;
    }
    const dur = durationDays ? parseInt(durationDays, 10) : null;
    const computedSchedulingMode: SchedulingMode =
      startTriggerType === 'dependency' ? 'after_previous' : 'fixed_date';
    onSave(row.id, {
      name: name.trim() || row.name,
      schedulingMode: computedSchedulingMode,
      startTriggerType,
      startTriggerEvent: startTriggerType === 'event' ? startTriggerEvent || undefined : undefined,
      startDate:
        startTriggerType === 'date'
          ? fixedDate || null
          : startTriggerType === 'event'
            ? null
            : row.startDate,
      dependsOnId: startTriggerType === 'dependency' ? dependsOnId || null : null,
      endSchedulingMode,
      successorId: endSchedulingMode === 'from_successor' ? successorId || null : null,
      endDate:
        endSchedulingMode === 'manual_date'
          ? manualEndDate || null
          : endSchedulingMode === 'from_duration'
            ? row.endDate
            : row.endDate,
      durationDays: dur,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      decisionBlocksNext: row.type === 'decision' ? decisionBlocks : undefined,
      decisionOutcome: row.type === 'decision' ? decisionOutcome : undefined,
      audience: row.type === 'info_event' ? audience || undefined : undefined,
      infoAssetType: row.type === 'info_event' ? infoAssetType : undefined,
      infoAssetLabel: row.type === 'info_event' ? infoAssetLabel || undefined : undefined,
      infoAssetUrl: row.type === 'info_event' ? infoAssetUrl || undefined : undefined,
      linkedReportPlaceholderId:
        row.type === 'info_event' && infoAssetType === 'internal_report'
          ? linkedReportPlaceholderId || undefined
          : undefined,
      infoEventMode: row.type === 'info_event' ? infoEventMode : undefined,
      infoEventCadence:
        row.type === 'info_event' && infoEventMode === 'cyclical' ? infoEventCadence : undefined,
      infoEventReferenceEvent:
        row.type === 'info_event' && infoEventMode === 'after_event'
          ? infoEventReferenceEvent || undefined
          : undefined,
      infoEventParticipantMode: row.type === 'info_event' ? infoEventParticipantMode : undefined,
      infoEventParticipantUserId:
        row.type === 'info_event' && infoEventParticipantMode === 'person'
          ? infoEventParticipantUserId || undefined
          : undefined,
      infoEventParticipantGroupKey:
        row.type === 'info_event' && infoEventParticipantMode === 'group'
          ? infoEventParticipantGroupKey
          : undefined,
      notificationCadence: row.type === 'notification' ? notificationCadence : undefined,
      notificationChannel: row.type === 'notification' ? notificationChannel : undefined,
      notificationRule: row.type === 'notification' ? notificationRule || undefined : undefined,
      notificationRecipientMode:
        row.type === 'notification' ? notificationRecipientMode : undefined,
      notificationRecipientUserId:
        row.type === 'notification' && notificationRecipientMode === 'person'
          ? notificationRecipientUserId || undefined
          : undefined,
      notificationRecipientUserName:
        row.type === 'notification' && notificationRecipientMode === 'person'
          ? users.find((u) => u.id === notificationRecipientUserId)?.firstName
            ? `${users.find((u) => u.id === notificationRecipientUserId)?.firstName} ${
                users.find((u) => u.id === notificationRecipientUserId)?.lastName || ''
              }`.trim()
            : undefined
          : undefined,
      notificationRecipientGroupKey:
        row.type === 'notification' && notificationRecipientMode === 'group'
          ? notificationRecipientGroupKey
          : undefined,
      notificationTriggerMode: row.type === 'notification' ? notificationTriggerMode : undefined,
      notificationTriggerEvent:
        row.type === 'notification' && notificationTriggerMode === 'event_based'
          ? notificationTriggerEvent
          : undefined,
      notificationLeadDays:
        row.type === 'notification' &&
        notificationTriggerMode === 'event_based' &&
        notificationTriggerEvent === 'before_next_action'
          ? notificationLeadDays
            ? parseInt(notificationLeadDays, 10)
            : null
          : undefined,
      notificationMessage:
        row.type === 'notification' ? notificationMessage || undefined : undefined,
      notificationAiAutoSend: row.type === 'notification' ? notificationAiAutoSend : undefined,
      notificationAiInstruction:
        row.type === 'notification' && notificationAiAutoSend
          ? notificationAiInstruction || undefined
          : undefined,
      meetingCadence: row.type === 'meeting' ? meetingCadence : undefined,
      meetingChannel: row.type === 'meeting' ? meetingChannel : undefined,
      meetingAgenda: row.type === 'meeting' ? meetingAgenda || undefined : undefined,
      pauseReason: row.type === 'pause' ? pauseReason || undefined : undefined,
      escalationLevel: row.type === 'escalation' ? escalationLevel || undefined : undefined,
      linkedTaskId: row.type === 'task' ? selectedTaskId || undefined : undefined,
      linkedDecisionId: row.type === 'decision' ? selectedDecisionId || undefined : undefined,
      linkedMilestoneId: row.type === 'milestone' ? selectedMilestoneId || undefined : undefined,
    });
    onClose();
  };

  const meta = ROW_TYPE_META[row.type];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden border-b border-blue-500/20"
    >
      <div className="bg-c-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={14} className={meta.color} />
            <span className="text-xs font-medium text-c-text-secondary">
              {t('initiatives.timelinePlanner.editItem')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-c-text-secondary hover:text-c-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] text-c-text-muted block mb-1">
            {t('initiatives.timelinePlanner.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Source selectors */}
        {row.type === 'task' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.sourceTask')}
            </label>
            <select
              value={selectedTaskId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTaskId(id);
                const t = taskOptions.find((x) => x.id === id);
                if (t) {
                  setName(t.title);
                  if (t.estimatedHours != null) setEstimatedHours(String(t.estimatedHours));
                }
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">— {t('initiatives.timelinePlanner.selectTask')} —</option>
              {taskOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {row.type === 'decision' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.sourceDecision')}
            </label>
            <select
              value={selectedDecisionId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedDecisionId(id);
                const d = decisionOptions.find((x) => x.id === id);
                if (d) setName(d.title);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">— {t('initiatives.timelinePlanner.selectDecision')} —</option>
              {decisionOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {row.type === 'milestone' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.sourceMilestone')}
            </label>
            <select
              value={selectedMilestoneId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedMilestoneId(id);
                const m = milestoneOptions.find((x) => x.id === id);
                if (m) {
                  setName(m.name);
                  setFixedDate(toISO(m.date));
                }
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">— {t('initiatives.timelinePlanner.selectMilestone')} —</option>
              {milestoneOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Start trigger */}
        <div>
          <label className="text-[10px] text-c-text-muted block mb-1.5">
            {t('initiatives.timelinePlanner.startTrigger')}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setScheduling('after_previous');
                setStartTriggerType('dependency');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'dependency'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-c-border-subtle text-c-text-muted'
              }`}
            >
              {t('initiatives.timelinePlanner.fromDependencySystem')}
            </button>
            <button
              onClick={() => {
                setScheduling('fixed_date');
                setStartTriggerType('date');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'date'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-c-border-subtle text-c-text-muted'
              }`}
            >
              {t('initiatives.timelinePlanner.manualDate')}
            </button>
            <button
              onClick={() => {
                setScheduling('fixed_date');
                setStartTriggerType('event');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'event'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-c-border-subtle text-c-text-muted'
              }`}
            >
              {t('initiatives.timelinePlanner.eventTrigger')}
            </button>
          </div>
        </div>

        {startTriggerType === 'dependency' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.dependsOn')}
            </label>
            <select
              value={dependsOnId}
              onChange={(e) => setDependsOnId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              {depOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {startTriggerType === 'date' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.date')}
            </label>
            <input
              type="date"
              value={fixedDate}
              onChange={(e) => setFixedDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {startTriggerType === 'event' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.eventName')}
            </label>
            <input
              type="text"
              value={startTriggerEvent}
              onChange={(e) => setStartTriggerEvent(e.target.value)}
              placeholder={t('initiatives.timelinePlanner.placeholderGateApproval')}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {(row.type === 'task' || row.type === 'pause' || row.type === 'meeting') && (
          <div className="space-y-1.5">
            <label className="text-[10px] text-c-text-muted block">
              {t('initiatives.timelinePlanner.endTrigger')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEndSchedulingMode('from_duration')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'from_duration' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-c-border-subtle text-c-text-muted'}`}
              >
                {t('initiatives.timelinePlanner.fromDuration')}
              </button>
              <button
                type="button"
                onClick={() => setEndSchedulingMode('manual_date')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'manual_date' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-c-border-subtle text-c-text-muted'}`}
              >
                {t('initiatives.timelinePlanner.manualDate')}
              </button>
              <button
                type="button"
                onClick={() => setEndSchedulingMode('from_successor')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'from_successor' ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-c-border-subtle text-c-text-muted'}`}
              >
                {t('initiatives.timelinePlanner.fromSuccessor')}
              </button>
            </div>
            {endSchedulingMode === 'manual_date' && (
              <input
                type="date"
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              />
            )}
            {endSchedulingMode === 'from_successor' && (
              <select
                value={successorId}
                onChange={(e) => setSuccessorId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">— {t('initiatives.timelinePlanner.selectSuccessor')} —</option>
                {successorOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Task-specific */}
        {row.type === 'task' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.windowDays')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">Effort (h)</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                  placeholder="—"
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[10px] text-c-text-secondary">
              {t('initiatives.timelinePlanner.calendarWindowHelp')}
            </p>
          </div>
        )}

        {/* Decision-specific */}
        {row.type === 'decision' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-c-text-muted">
                {t('initiatives.timelinePlanner.blocksNext')}
              </label>
              <button
                onClick={() => setDecisionBlocks(!decisionBlocks)}
                className={`relative w-9 h-5 rounded-full transition-colors ${decisionBlocks ? 'bg-blue-500' : 'bg-c-border-strong '}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${decisionBlocks ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.decisionOutcome')}
              </label>
              <div className="flex gap-1.5">
                {([null, 'GO', 'NO_GO', 'ESCALATE'] as const).map((val) => (
                  <button
                    key={val ?? 'pending'}
                    onClick={() => setDecisionOutcome(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${decisionOutcome === val ? 'border-blue-500 bg-blue-500/10 text-blue-600' : 'border-c-border-subtle text-c-text-muted'}`}
                  >
                    {val === null
                      ? t('initiatives.timelinePlanner.pending')
                      : val === 'GO'
                        ? 'GO'
                        : val === 'NO_GO'
                          ? 'NO-GO'
                          : t('initiatives.timelinePlanner.escalate')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info event */}
        {row.type === 'info_event' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.eventMode')}
                </label>
                <select
                  value={infoEventMode}
                  onChange={(e) =>
                    setInfoEventMode(e.target.value as 'cyclical' | 'specific_date' | 'after_event')
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="cyclical">
                    {t('initiatives.timelinePlanner.cyclicalMeeting')}
                  </option>
                  <option value="specific_date">
                    {t('initiatives.timelinePlanner.onSpecificDate')}
                  </option>
                  <option value="after_event">{t('initiatives.timelinePlanner.afterEvent')}</option>
                </select>
              </div>
              {infoEventMode === 'cyclical' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.cadence')}
                  </label>
                  <select
                    value={infoEventCadence}
                    onChange={(e) => setInfoEventCadence(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                    <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                    <option value="biweekly">{t('initiatives.timelinePlanner.biweekly')}</option>
                    <option value="monthly">{t('initiatives.timelinePlanner.monthly')}</option>
                    <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
                  </select>
                </div>
              )}
              {infoEventMode === 'after_event' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.afterWhichEvent')}
                  </label>
                  <input
                    type="text"
                    value={infoEventReferenceEvent}
                    onChange={(e) => setInfoEventReferenceEvent(e.target.value)}
                    placeholder={t('initiatives.timelinePlanner.placeholderAfterGoGate')}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                  />
                  {submitAttempted && !infoEventReferenceEventValid && (
                    <p className="mt-1 text-[10px] text-danger-500">
                      {t('initiatives.timelinePlanner.validationReferenceEvent')}
                    </p>
                  )}
                </div>
              )}
            </div>
            {submitAttempted && !infoEventDateModeValid && (
              <p className="text-[10px] text-danger-500">
                {t('initiatives.timelinePlanner.validationSpecificDate')}
              </p>
            )}
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.audience')}
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={t('initiatives.timelinePlanner.placeholderSteeringCommittee')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.whoShouldAttend')}
                </label>
                <select
                  value={infoEventParticipantMode}
                  onChange={(e) =>
                    setInfoEventParticipantMode(e.target.value as 'person' | 'group')
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="group">{t('initiatives.timelinePlanner.group')}</option>
                  <option value="person">{t('initiatives.timelinePlanner.person')}</option>
                </select>
              </div>
              <div>
                {infoEventParticipantMode === 'group' ? (
                  <select
                    value={infoEventParticipantGroupKey}
                    onChange={(e) => setInfoEventParticipantGroupKey(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {NOTIFICATION_GROUP_OPTIONS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {isPolish ? g.labelPl : g.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={infoEventParticipantUserId}
                    onChange={(e) => setInfoEventParticipantUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.selectPerson')} —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}
                      </option>
                    ))}
                  </select>
                )}
                {submitAttempted && !infoEventParticipantValid && (
                  <p className="mt-1 text-[10px] text-danger-500">
                    {t('initiatives.timelinePlanner.validationParticipant')}
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.materialSourceRequired')}
              </label>
              <select
                value={infoAssetType}
                onChange={(e) => setInfoAssetType(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="internal_report">
                  {t('initiatives.timelinePlanner.internalReport')}
                </option>
                <option value="generated_presentation">
                  {t('initiatives.timelinePlanner.generatedPresentation')}
                </option>
                <option value="external_link">
                  {t('initiatives.timelinePlanner.externalLink')}
                </option>
                <option value="other">{t('initiatives.timelinePlanner.otherNeut')}</option>
              </select>
              {infoAssetType === 'internal_report' && availableReports.length === 0 && (
                <p className="mt-1 text-[10px] text-amber-500">
                  {t('initiatives.timelinePlanner.noReportsInLibrary')}
                </p>
              )}
              {submitAttempted && !infoEventMaterialValid && (
                <p className="mt-1 text-[10px] text-danger-500">
                  {t('initiatives.timelinePlanner.validationMaterialSource')}
                </p>
              )}
            </div>
            {infoAssetType === 'internal_report' && (
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.selectReport')}
                </label>
                <select
                  value={linkedReportPlaceholderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLinkedReportPlaceholderId(id);
                    const found = availableReports.find((x) => x.id === id);
                    if (found) setInfoAssetLabel(found.title);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— {t('initiatives.timelinePlanner.selectReport')} —</option>
                  {availableReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {infoAssetType === 'external_link' && (
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.materialUrl')}
                </label>
                <input
                  type="url"
                  value={infoAssetUrl}
                  onChange={(e) => setInfoAssetUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
            {(infoAssetType === 'generated_presentation' || infoAssetType === 'other') && (
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.materialLabel')}
                </label>
                <input
                  type="text"
                  value={infoAssetLabel}
                  onChange={(e) => setInfoAssetLabel(e.target.value)}
                  placeholder={t('initiatives.timelinePlanner.placeholderDeckSprintReview')}
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {row.type === 'notification' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.templates')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {NOTIFICATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setNotificationCadence(preset.cadence);
                      setNotificationChannel(preset.channel);
                      setNotificationRule(isPolish ? preset.rulePl : preset.rule);
                      if (!name.trim() || name === row.name) {
                        setName(isPolish ? preset.labelPl : preset.label);
                      }
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-c-text-muted hover:text-c-text border border-c-border-subtle hover:border-c-border-strong transition-colors"
                  >
                    {isPolish ? preset.labelPl : preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.cadence')}
              </label>
              <select
                value={notificationCadence}
                onChange={(e) => setNotificationCadence(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                <option value="biweekly">{t('initiatives.timelinePlanner.biweekly')}</option>
                <option value="monthly">{t('initiatives.timelinePlanner.monthly')}</option>
                <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.recipientType')}
              </label>
              <select
                value={notificationRecipientMode}
                onChange={(e) => setNotificationRecipientMode(e.target.value as 'person' | 'group')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="group">{t('initiatives.timelinePlanner.group')}</option>
                <option value="person">{t('initiatives.timelinePlanner.person')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              {notificationRecipientMode === 'group' ? (
                <>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.selectGroup')}
                  </label>
                  <select
                    value={notificationRecipientGroupKey}
                    onChange={(e) => setNotificationRecipientGroupKey(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {NOTIFICATION_GROUP_OPTIONS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {isPolish ? g.labelPl : g.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.selectPerson')}
                  </label>
                  <select
                    value={notificationRecipientUserId}
                    onChange={(e) => setNotificationRecipientUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— {t('initiatives.timelinePlanner.selectPerson')} —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.notificationMode')}
              </label>
              <select
                value={notificationTriggerMode}
                onChange={(e) =>
                  setNotificationTriggerMode(e.target.value as 'event_based' | 'cyclical')
                }
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="event_based">{t('initiatives.timelinePlanner.eventBased')}</option>
                <option value="cyclical">{t('initiatives.timelinePlanner.cyclical')}</option>
              </select>
            </div>
            {notificationTriggerMode === 'event_based' && (
              <div>
                <label className="text-[10px] text-c-text-muted block mb-1">
                  {t('initiatives.timelinePlanner.eventTriggerLabel')}
                </label>
                <select
                  value={notificationTriggerEvent}
                  onChange={(e) => setNotificationTriggerEvent(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="on_start">{t('initiatives.timelinePlanner.onStart')}</option>
                  <option value="on_complete">{t('initiatives.timelinePlanner.onComplete')}</option>
                  <option value="before_next_action">
                    {t('initiatives.timelinePlanner.beforeNextAction')}
                  </option>
                  <option value="manual_gate">
                    {t('initiatives.timelinePlanner.manualGateEvent')}
                  </option>
                </select>
              </div>
            )}
            {notificationTriggerMode === 'event_based' &&
              notificationTriggerEvent === 'before_next_action' && (
                <div>
                  <label className="text-[10px] text-c-text-muted block mb-1">
                    {t('initiatives.timelinePlanner.leadTimeDays')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={notificationLeadDays}
                    onChange={(e) => setNotificationLeadDays(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.channel')}
              </label>
              <select
                value={notificationChannel}
                onChange={(e) => setNotificationChannel(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="meeting">{t('initiatives.timelinePlanner.meeting')}</option>
                <option value="dashboard">Dashboard</option>
                <option value="other">{t('initiatives.timelinePlanner.otherMasc')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.communicationRule')}
              </label>
              <input
                type="text"
                value={notificationRule}
                onChange={(e) => setNotificationRule(e.target.value)}
                placeholder={t('initiatives.timelinePlanner.placeholderCommunicationRule')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.notificationContent')}
              </label>
              <textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={2}
                placeholder={t('initiatives.timelinePlanner.placeholderMessageContentShort')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-c-text-muted">
                  {t('initiatives.timelinePlanner.aiAutoSend')}
                </label>
                <button
                  type="button"
                  onClick={() => setNotificationAiAutoSend(!notificationAiAutoSend)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${notificationAiAutoSend ? 'bg-blue-500' : 'bg-c-border-strong '}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notificationAiAutoSend ? 'translate-x-4' : 'translate-x-0.5'}`}
                  />
                </button>
              </div>
              {notificationAiAutoSend && (
                <textarea
                  value={notificationAiInstruction}
                  onChange={(e) => setNotificationAiInstruction(e.target.value)}
                  rows={2}
                  placeholder={t('initiatives.timelinePlanner.placeholderAiInstructionShort')}
                  className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                />
              )}
            </div>
          </div>
        )}

        {row.type === 'meeting' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.meetingCadence')}
              </label>
              <select
                value={meetingCadence}
                onChange={(e) => setMeetingCadence(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="daily">{t('initiatives.timelinePlanner.daily')}</option>
                <option value="weekly">{t('initiatives.timelinePlanner.weekly')}</option>
                <option value="biweekly">{t('initiatives.timelinePlanner.biweekly')}</option>
                <option value="monthly">{t('initiatives.timelinePlanner.monthly')}</option>
                <option value="custom">{t('initiatives.timelinePlanner.custom')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.meetingChannel')}
              </label>
              <select
                value={meetingChannel}
                onChange={(e) => setMeetingChannel(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="online">Online</option>
                <option value="onsite">{t('initiatives.timelinePlanner.onsite')}</option>
                <option value="hybrid">{t('initiatives.timelinePlanner.hybrid')}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.meetingAgenda')}
              </label>
              <textarea
                rows={2}
                value={meetingAgenda}
                onChange={(e) => setMeetingAgenda(e.target.value)}
                placeholder={t('initiatives.timelinePlanner.placeholderMeetingAgenda')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {row.type === 'pause' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.days')}
              </label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="—"
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-c-text-muted block mb-1">
                {t('initiatives.timelinePlanner.pauseReason')}
              </label>
              <input
                type="text"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder={t('initiatives.timelinePlanner.placeholderPauseReasonShort')}
                className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-c-text-secondary">
                {t('initiatives.timelinePlanner.pauseHelp')}
              </p>
            </div>
          </div>
        )}

        {/* Escalation */}
        {row.type === 'escalation' && (
          <div>
            <label className="text-[10px] text-c-text-muted block mb-1">
              {t('initiatives.timelinePlanner.level')}
            </label>
            <select
              value={escalationLevel}
              onChange={(e) => setEscalationLevel(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-c-surface border border-c-border-subtle text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">—</option>
              <option value="Sponsor">Sponsor</option>
              <option value="PMO">PMO</option>
              <option value="Board">{t('initiatives.timelinePlanner.board')}</option>
              <option value="Other">{t('initiatives.timelinePlanner.otherMasc')}</option>
            </select>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-c-text-muted hover:bg-c-surface-raised transition-colors"
          >
            {t('initiatives.timelinePlanner.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
          >
            {t('initiatives.timelinePlanner.save')}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENT: TimelineTable
// ════════════════════════════════════════════════════════════════

interface TimelineTableProps {
  rows: TimelineRow[];
  isPolish: boolean;
  editable: boolean;
  tasks: TaskItem[];
  decisions: Decision[];
  milestones: TimelineMilestone[];
  users: UserInfo[];
  availableReports: ReportOption[];
  onUpdateStart: (date: string | null) => void;
  onUpdateEnd: (date: string | null) => void;
  onUpdateRow: (id: string, patch: Partial<TimelineRow>) => void;
  onRemoveRow: (id: string) => void;
  onDuplicateRow: (id: string) => void;
  onReorderRows: (sourceId: string, targetId: string) => void;
}

const TimelineTable: React.FC<TimelineTableProps> = ({
  rows,
  isPolish,
  editable,
  tasks,
  decisions,
  milestones,
  users,
  availableReports,
  onUpdateStart,
  onUpdateEnd,
  onUpdateRow,
  onRemoveRow,
  onDuplicateRow,
  onReorderRows,
}) => {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [startMenuOpenId, setStartMenuOpenId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const startMenuRef = useRef<HTMLDivElement>(null);
  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingRowId) || null,
    [rows, editingRowId]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
      if (startMenuRef.current && !startMenuRef.current.contains(e.target as Node)) {
        setStartMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const startNameEdit = (row: TimelineRow) => {
    if (!editable || row.type === 'start' || row.type === 'finish') return;
    setEditingName(row.id);
    setEditNameValue(row.name);
    setTimeout(() => nameInputRef.current?.focus(), 30);
  };

  const commitNameEdit = (id: string) => {
    if (editNameValue.trim()) {
      onUpdateRow(id, { name: editNameValue.trim() });
    }
    setEditingName(null);
  };

  const depOptions = useMemo(
    () =>
      rows
        .filter((r) => r.type !== 'finish')
        .map((r, idx) => ({ id: r.id, label: `#${idx + 1} ${r.name}`.slice(0, 40) })),
    [rows]
  );

  const getRowIndex = (id: string) => rows.findIndex((r) => r.id === id) + 1;

  const hasDuration = (type: TimelineRowType) =>
    type === 'task' || type === 'pause' || type === 'meeting';
  const isPointType = (type: TimelineRowType) =>
    type === 'milestone' ||
    type === 'decision' ||
    type === 'info_event' ||
    type === 'notification' ||
    type === 'escalation';

  return (
    <div className="rounded-2xl border border-c-border-subtle bg-c-surface overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[52px_28px_1fr_82px_82px_42px_50px_70px_30px] gap-0 text-[10px] uppercase tracking-wide text-c-text-muted border-b border-c-border-subtle bg-c-surface-raised">
        <div className="px-1 py-2.5 text-center">#</div>
        <div className="px-0.5 py-2.5 text-center">Typ</div>
        <div className="px-2 py-2.5">{t('initiatives.timelinePlanner.name')}</div>
        <div className="px-1 py-2.5 text-center">Start</div>
        <div className="px-1 py-2.5 text-center">{t('initiatives.timelinePlanner.end')}</div>
        <div className="px-1 py-2.5 text-center">{t('initiatives.timelinePlanner.window')}</div>
        <div className="px-1 py-2.5 text-center">Effort h</div>
        <div className="px-1 py-2.5 text-center">{t('initiatives.timelinePlanner.dep')}</div>
        <div className="px-0.5 py-2.5 text-center">⋮</div>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => {
        const meta = ROW_TYPE_META[row.type];
        const Icon = meta.icon;
        const days = daysBetween(row.startDate, row.endDate);
        const isStart = row.type === 'start';
        const isFinish = row.type === 'finish';
        const canEdit = editable && !isStart && !isFinish;
        const depLabel = row.dependsOnId ? `#${getRowIndex(row.dependsOnId)}` : '';

        // Decision outcome display
        const outcomeStyle =
          row.type === 'decision' && row.decisionOutcome
            ? DECISION_OUTCOME_STYLES[row.decisionOutcome]
            : null;

        return (
          <div
            key={row.id}
            draggable={canEdit}
            onDragStart={() => {
              if (!canEdit) return;
              setDraggingId(row.id);
              setMenuOpenId(null);
            }}
            onDragEnd={() => {
              setDraggingId(null);
              setDragOverId(null);
            }}
            onDragOver={(e) => {
              if (!draggingId || draggingId === row.id || !canEdit) return;
              e.preventDefault();
              setDragOverId(row.id);
            }}
            onDrop={(e) => {
              if (!draggingId || draggingId === row.id || !canEdit) return;
              e.preventDefault();
              onReorderRows(draggingId, row.id);
              setDraggingId(null);
              setDragOverId(null);
            }}
            className={`grid grid-cols-[52px_28px_1fr_82px_82px_42px_50px_70px_30px] gap-0 items-center border-b border-c-border-subtle group transition-colors ${
              meta.bgTint || 'hover:bg-c-surface-raised'
            } ${draggingId === row.id ? 'opacity-60' : ''} ${
              dragOverId === row.id ? 'ring-1 ring-blue-500/40' : ''
            } ${row.isCriticalPath ? 'border-l-2 border-fuchsia-400/80 bg-fuchsia-500/5' : ''}`}
          >
            {/* # */}
            <div className="px-1 py-2 flex items-center justify-center gap-1.5">
              {canEdit ? (
                <GripVertical
                  size={11}
                  className="text-c-text-secondary cursor-grab active:cursor-grabbing"
                />
              ) : (
                <span className="w-[11px]" />
              )}
              <span className="text-[10px] text-c-text-secondary">{idx + 1}</span>
            </div>

            {/* Type icon */}
            <div
              className="px-0.5 py-2 flex items-center justify-center"
              title={isPolish ? meta.labelPl : meta.label}
            >
              <Icon size={13} className={meta.color} />
            </div>

            {/* Name */}
            <div className="px-2 py-2 min-w-0 flex items-center gap-1.5">
              {row.isCriticalPath && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-300 font-bold">
                  CP
                </span>
              )}
              {/* Status dot for tasks */}
              {row.type === 'task' && row.status && (
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_COLORS[row.status.toLowerCase()] || 'bg-slate-400'}`}
                />
              )}

              {/* Decision outcome badge */}
              {outcomeStyle && (
                <span
                  className={`text-[8px] px-1 py-0.5 rounded font-bold text-white ${outcomeStyle.dot}`}
                >
                  {isPolish ? outcomeStyle.labelPl : outcomeStyle.label}
                </span>
              )}
              {row.type === 'decision' && !row.decisionOutcome && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-600 font-medium">
                  {t('initiatives.timelinePlanner.pending')}
                </span>
              )}

              {editingName === row.id ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onBlur={() => commitNameEdit(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitNameEdit(row.id);
                    if (e.key === 'Escape') setEditingName(null);
                  }}
                  className="flex-1 px-1.5 py-0.5 rounded bg-c-surface border border-blue-500 text-xs text-c-text-secondary focus:outline-none"
                />
              ) : (
                <span
                  className={`text-xs truncate ${
                    isStart || isFinish
                      ? 'font-semibold text-c-text'
                      : row.name
                        ? 'text-c-text-secondary'
                        : 'text-c-text-secondary italic'
                  } ${canEdit ? 'cursor-text' : ''}`}
                  onClick={() => startNameEdit(row)}
                >
                  {row.name || t('initiatives.timelinePlanner.clickToName')}
                </span>
              )}

              {/* Extra info chips */}
              {row.audience && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 truncate max-w-[60px]">
                  {row.audience}
                </span>
              )}
              {row.type === 'info_event' && row.infoAssetType && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 truncate max-w-[90px]">
                  {row.infoAssetType === 'internal_report'
                    ? t('initiatives.timelinePlanner.chipReport')
                    : row.infoAssetType === 'external_link'
                      ? t('initiatives.timelinePlanner.chipExternalLink')
                      : row.infoAssetType === 'generated_presentation'
                        ? t('initiatives.timelinePlanner.chipPresentation')
                        : t('initiatives.timelinePlanner.otherNeut')}
                </span>
              )}
              {row.type === 'info_event' && row.infoEventMode && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 truncate max-w-[80px]">
                  {row.infoEventMode === 'cyclical'
                    ? t('initiatives.timelinePlanner.chipCyclical')
                    : row.infoEventMode === 'after_event'
                      ? t('initiatives.timelinePlanner.afterEvent')
                      : t('initiatives.timelinePlanner.chipOnDate')}
                </span>
              )}
              {row.type === 'info_event' &&
                (row.infoEventParticipantUserId || row.infoEventParticipantGroupKey) && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 truncate max-w-[85px]">
                    {row.infoEventParticipantMode === 'person'
                      ? users.find((u) => u.id === row.infoEventParticipantUserId)?.firstName
                        ? `${users.find((u) => u.id === row.infoEventParticipantUserId)?.firstName} ${
                            users.find((u) => u.id === row.infoEventParticipantUserId)?.lastName ||
                            ''
                          }`.trim()
                        : t('initiatives.timelinePlanner.person')
                      : row.infoEventParticipantGroupKey === 'project_team'
                        ? t('initiatives.timelinePlanner.chipProjectTeam')
                        : row.infoEventParticipantGroupKey === 'steering_committee'
                          ? t('initiatives.timelinePlanner.chipSteering')
                          : row.infoEventParticipantGroupKey === 'sponsor_group'
                            ? t('initiatives.timelinePlanner.chipSponsors')
                            : row.infoEventParticipantGroupKey === 'all_stakeholders'
                              ? t('initiatives.timelinePlanner.chipStakeholders')
                              : t('initiatives.timelinePlanner.chipCustomGroup')}
                  </span>
                )}
              {row.escalationLevel && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 truncate">
                  {row.escalationLevel}
                </span>
              )}
              {row.notificationRule && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-600 truncate max-w-[80px]">
                  {row.notificationRule}
                </span>
              )}
              {row.type === 'notification' &&
                (row.notificationRecipientUserName || row.notificationRecipientGroupKey) && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-600 truncate max-w-[80px]">
                    {row.notificationRecipientMode === 'person'
                      ? row.notificationRecipientUserName
                      : row.notificationRecipientGroupKey === 'project_team'
                        ? t('initiatives.timelinePlanner.chipProjectTeam')
                        : row.notificationRecipientGroupKey === 'steering_committee'
                          ? t('initiatives.timelinePlanner.chipSteering')
                          : row.notificationRecipientGroupKey === 'sponsor_group'
                            ? t('initiatives.timelinePlanner.chipSponsors')
                            : row.notificationRecipientGroupKey === 'all_stakeholders'
                              ? t('initiatives.timelinePlanner.chipStakeholders')
                              : t('initiatives.timelinePlanner.chipCustomGroup')}
                  </span>
                )}
              {row.type === 'notification' && row.notificationTriggerMode && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-600 truncate max-w-[70px]">
                  {row.notificationTriggerMode === 'cyclical'
                    ? t('initiatives.timelinePlanner.cyclical')
                    : t('initiatives.timelinePlanner.eventBased')}
                </span>
              )}
              {row.pauseReason && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-slate-500/10 text-c-text-muted truncate max-w-[70px]">
                  {row.pauseReason}
                </span>
              )}
              {row.assigneeName && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-c-surface-raised text-c-text-muted truncate max-w-[60px]">
                  {row.assigneeName}
                </span>
              )}
            </div>

            {/* Start date */}
            <div
              className="px-0.5 py-1.5 text-center relative"
              ref={startMenuOpenId === row.id ? startMenuRef : undefined}
            >
              <div className="flex items-center justify-center gap-0.5">
                {(() => {
                  const mode =
                    row.startTriggerType === 'event'
                      ? 'event'
                      : row.startTriggerType === 'date'
                        ? 'date'
                        : row.schedulingMode === 'after_previous'
                          ? 'dependency'
                          : 'date';
                  const label = mode === 'dependency' ? 'DEP' : mode === 'event' ? 'EVENT' : 'DATE';
                  const tone =
                    mode === 'dependency'
                      ? 'bg-blue-500/10 text-blue-600'
                      : mode === 'event'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-slate-500/10 text-c-text-muted';
                  return (
                    <span
                      className={`inline-flex items-center rounded px-1 py-0.5 text-[8px] font-medium ${tone}`}
                      title={
                        mode === 'dependency'
                          ? t('initiatives.timelinePlanner.startFromDependency')
                          : mode === 'event'
                            ? t('initiatives.timelinePlanner.startOnEvent')
                            : t('initiatives.timelinePlanner.startFromDate')
                      }
                    >
                      {label}
                    </span>
                  );
                })()}
                {editable && isStart ? (
                  <input
                    type="date"
                    value={toISO(row.startDate)}
                    onChange={(e) => onUpdateStart(e.target.value || null)}
                    className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted focus:outline-none"
                  />
                ) : row.schedulingMode === 'after_previous' && row.dependsOnId ? (
                  <span className="text-[10px] text-c-text-secondary italic">
                    {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                  </span>
                ) : editable && canEdit ? (
                  <input
                    type="date"
                    value={toISO(row.startDate)}
                    onChange={(e) => onUpdateRow(row.id, { startDate: e.target.value || null })}
                    className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted focus:outline-none"
                  />
                ) : (
                  <span className="text-[10px] text-c-text-muted">
                    {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                  </span>
                )}
                {canEdit && (
                  <button
                    onClick={() => {
                      setMenuOpenId(null);
                      setStartMenuOpenId((curr) => (curr === row.id ? null : row.id));
                    }}
                    className="inline-flex items-center justify-center w-4 h-4 rounded text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                    aria-label={t('initiatives.timelinePlanner.startSettings')}
                  >
                    <MoreVertical size={10} />
                  </button>
                )}
              </div>
              {canEdit && startMenuOpenId === row.id && (
                <div className="absolute left-1 top-6 z-20 w-[200px] rounded-lg border border-c-border-subtle bg-c-surface shadow-lg p-2 space-y-2 text-left">
                  <div className="text-[10px] text-c-text-muted">
                    {t('initiatives.timelinePlanner.howToDetermineStart')}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRow(row.id, {
                          startTriggerType: 'dependency',
                          schedulingMode: 'after_previous',
                          startDate: null,
                          startTriggerEvent: undefined,
                          dependsOnId: row.dependsOnId || null,
                        })
                      }
                      className={`px-1 py-1 rounded text-[9px] border transition-colors ${
                        row.startTriggerType === 'dependency' ||
                        row.schedulingMode === 'after_previous'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      Dependency
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRow(row.id, {
                          startTriggerType: 'date',
                          schedulingMode: 'fixed_date',
                          dependsOnId: null,
                          startTriggerEvent: undefined,
                        })
                      }
                      className={`px-1 py-1 rounded text-[9px] border transition-colors ${
                        row.startTriggerType === 'date'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      {t('initiatives.timelinePlanner.date')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateRow(row.id, {
                          startTriggerType: 'event',
                          schedulingMode: 'fixed_date',
                          startDate: null,
                          dependsOnId: null,
                        })
                      }
                      className={`px-1 py-1 rounded text-[9px] border transition-colors ${
                        row.startTriggerType === 'event'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                          : 'border-c-border-subtle text-c-text-muted'
                      }`}
                    >
                      {t('initiatives.timelinePlanner.event')}
                    </button>
                  </div>
                  {(row.startTriggerType === 'dependency' ||
                    row.schedulingMode === 'after_previous') && (
                    <select
                      value={row.dependsOnId || ''}
                      onChange={(e) =>
                        onUpdateRow(row.id, {
                          dependsOnId: e.target.value || null,
                          startTriggerType: 'dependency',
                          schedulingMode: 'after_previous',
                        })
                      }
                      className="w-full px-2 py-1 rounded text-[10px] bg-transparent border border-c-border-subtle text-c-text-muted focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">
                        — {t('initiatives.timelinePlanner.selectDependency')} —
                      </option>
                      {depOptions
                        .filter((o) => o.id !== row.id)
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                    </select>
                  )}
                  {row.startTriggerType === 'event' && (
                    <input
                      type="text"
                      value={row.startTriggerEvent || ''}
                      onChange={(e) =>
                        onUpdateRow(row.id, {
                          startTriggerType: 'event',
                          schedulingMode: 'fixed_date',
                          startTriggerEvent: e.target.value,
                        })
                      }
                      placeholder={t('initiatives.timelinePlanner.eventNamePlaceholder')}
                      className="w-full px-2 py-1 rounded text-[10px] bg-transparent border border-c-border-subtle text-c-text-muted placeholder:text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  )}
                  {row.startTriggerType === 'date' && (
                    <input
                      type="date"
                      value={toISO(row.startDate)}
                      onChange={(e) =>
                        onUpdateRow(row.id, {
                          startDate: e.target.value || null,
                          startTriggerType: 'date',
                          schedulingMode: 'fixed_date',
                        })
                      }
                      className="w-full px-2 py-1 rounded text-[10px] bg-transparent border border-c-border-subtle text-c-text-muted focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>

            {/* End date */}
            <div className="px-0.5 py-1.5 text-center">
              {isPointType(row.type) || isStart ? (
                <span className="text-[10px] text-c-text-secondary">—</span>
              ) : isFinish ? (
                <span className="text-[10px] text-c-text-muted">
                  {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                </span>
              ) : editable && canEdit ? (
                <input
                  type="date"
                  value={toISO(row.endDate)}
                  onChange={(e) => onUpdateRow(row.id, { endDate: e.target.value || null })}
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted focus:outline-none"
                />
              ) : (
                <span className="text-[10px] text-c-text-muted">
                  {fmtDate(row.endDate, isPolish ? 'pl' : 'en')}
                </span>
              )}
            </div>

            {/* Days */}
            <div className="px-1 py-1.5 text-center">
              {hasDuration(row.type) && editable && canEdit ? (
                <input
                  type="number"
                  min={1}
                  value={row.durationDays ?? ''}
                  onChange={(e) =>
                    onUpdateRow(row.id, {
                      durationDays: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted text-center focus:outline-none"
                  placeholder="—"
                />
              ) : (
                <span className="text-[10px] text-c-text-secondary">
                  {hasDuration(row.type) && (row.durationDays || days)
                    ? row.durationDays || days
                    : '—'}
                </span>
              )}
            </div>

            {/* Hours */}
            <div className="px-1 py-1.5 text-center">
              {row.type === 'task' && editable && canEdit ? (
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={row.estimatedHours ?? ''}
                  onChange={(e) =>
                    onUpdateRow(row.id, {
                      estimatedHours: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted text-center focus:outline-none"
                  placeholder="—"
                />
              ) : (
                <span className="text-[10px] text-c-text-secondary">
                  {row.estimatedHours ? `${row.estimatedHours}h` : '—'}
                </span>
              )}
            </div>

            {/* Dependency */}
            <div className="px-0.5 py-1.5 text-center">
              {canEdit ? (
                <select
                  value={row.dependsOnId || ''}
                  onChange={(e) =>
                    onUpdateRow(row.id, {
                      dependsOnId: e.target.value || null,
                      schedulingMode: e.target.value ? 'after_previous' : 'fixed_date',
                    })
                  }
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-c-border-subtle dark:hover:border-c-border-subtle focus:border-blue-500 text-c-text-muted focus:outline-none appearance-none"
                >
                  <option value="">—</option>
                  {depOptions
                    .filter((o) => o.id !== row.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </select>
              ) : (
                <span className="text-[10px] text-c-text-secondary">{depLabel || '—'}</span>
              )}
            </div>

            {/* Row actions menu */}
            <div
              className="px-0.5 py-1.5 text-center relative"
              ref={menuOpenId === row.id ? menuRef : undefined}
            >
              {canEdit ? (
                <>
                  <button
                    onClick={() => {
                      setStartMenuOpenId(null);
                      setMenuOpenId((curr) => (curr === row.id ? null : row.id));
                    }}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-c-text-secondary hover:text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                    aria-label={t('initiatives.timelinePlanner.rowOptions')}
                  >
                    <MoreVertical size={13} />
                  </button>
                  {menuOpenId === row.id && (
                    <div className="absolute right-1 top-8 z-20 min-w-[126px] rounded-lg border border-c-border-subtle bg-c-surface shadow-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setEditingRowId(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                      >
                        <Pencil size={12} />
                        {t('initiatives.timelinePlanner.edit')}
                      </button>
                      <button
                        onClick={() => {
                          onDuplicateRow(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                      >
                        <Copy size={12} />
                        {t('initiatives.timelinePlanner.copy')}
                      </button>
                      <button
                        onClick={() => {
                          onRemoveRow(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-danger-500 hover:bg-danger-500/5 transition-colors"
                      >
                        <Trash2 size={12} />
                        {t('initiatives.timelinePlanner.delete')}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-c-text-secondary">—</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Edit modal */}
      <AnimatePresence>
        {editingRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-xl rounded-2xl border border-c-border-subtle bg-c-surface shadow-xl overflow-hidden">
              <EditRowPanel
                row={editingRow}
                rows={rows}
                tasks={tasks}
                decisions={decisions}
                milestones={milestones}
                users={users}
                availableReports={availableReports}
                isPolish={isPolish}
                onSave={onUpdateRow}
                onClose={() => setEditingRowId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENT: TimelineGanttView
// ════════════════════════════════════════════════════════════════

interface TimelineGanttViewProps {
  rows: TimelineRow[];
  isPolish: boolean;
  plannedStart: string | null;
  plannedEnd: string | null;
}

const TimelineGanttView: React.FC<TimelineGanttViewProps> = ({
  rows,
  isPolish,
  plannedStart,
  plannedEnd,
}) => {
  const { t } = useTranslation();
  const startMs = plannedStart ? new Date(plannedStart).getTime() : Date.now();
  const endMs = plannedEnd ? new Date(plannedEnd).getTime() : startMs + 180 * 24 * 60 * 60 * 1000;
  const rangeMs = Math.max(endMs - startMs, 1);

  const toPercent = (d: string | null) => {
    if (!d) return 0;
    const ms = new Date(d).getTime();
    return Math.max(0, Math.min(100, ((ms - startMs) / rangeMs) * 100));
  };

  const months = useMemo(() => {
    const result: { label: string; pct: number }[] = [];
    const c = new Date(startMs);
    c.setDate(1);
    if (c.getTime() < startMs) c.setMonth(c.getMonth() + 1);
    while (c.getTime() < endMs) {
      const pct = ((c.getTime() - startMs) / rangeMs) * 100;
      if (pct >= 0 && pct <= 100) {
        result.push({
          label: c.toLocaleDateString(isPolish ? 'pl-PL' : 'en-GB', {
            month: 'short',
            year: '2-digit',
          }),
          pct,
        });
      }
      c.setMonth(c.getMonth() + 1);
    }
    return result;
  }, [startMs, endMs, rangeMs, isPolish]);

  const rowYCenter = (idx: number) => idx * 36 + 18;

  // Shape colors per type
  const shapeColor: Record<TimelineRowType, string> = {
    start: 'bg-emerald-500',
    finish: 'bg-danger-500',
    milestone: 'bg-c-surface',
    decision: 'bg-amber-500',
    info_event: 'bg-blue-500',
    notification: 'bg-indigo-500',
    meeting: 'bg-blue-500',
    pause: 'bg-slate-500',
    escalation: 'bg-amber-500',
    task: 'bg-blue-500',
  };

  return (
    <div className="rounded-2xl border border-c-border-subtle bg-c-surface overflow-hidden">
      <div className="flex">
        {/* Left: labels */}
        <div className="flex-shrink-0 w-[180px] border-r border-c-border-subtle">
          <div className="h-7 border-b border-c-border-subtle bg-c-surface-raised flex items-center px-2">
            <span className="text-[10px] uppercase tracking-wide text-c-text-muted">
              {t('initiatives.timelinePlanner.name')}
            </span>
          </div>
          {rows.map((row) => {
            const meta = ROW_TYPE_META[row.type];
            const Icon = meta.icon;
            return (
              <div
                key={row.id}
                className="h-9 flex items-center gap-1.5 px-2 border-b border-c-border-subtle"
              >
                <Icon size={11} className={meta.color} />
                <span className="text-[10px] text-c-text-muted truncate">
                  {row.name || '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: bars */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-7 border-b border-c-border-subtle bg-c-surface-raised relative">
            {months.map((m) => (
              <div
                key={m.label}
                className="absolute top-0 h-full flex items-end pb-0.5"
                style={{ left: `${m.pct}%` }}
              >
                <div className="w-px h-full bg-c-border-subtle" />
                <span className="text-[8px] text-c-text-secondary pl-1 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {months.map((m) => (
              <div
                key={`g-${m.label}`}
                className="absolute top-0 bottom-0 w-px bg-c-border-subtle"
                style={{ left: `${m.pct}%` }}
              />
            ))}

            {/* Dependency lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: '100%', height: rows.length * 36 }}
            >
              {rows.map((row, idx) => {
                if (!row.dependsOnId) return null;
                const srcIdx = rows.findIndex((r) => r.id === row.dependsOnId);
                if (srcIdx < 0) return null;
                const srcRow = rows[srcIdx];
                const srcX = toPercent(srcRow.endDate || srcRow.startDate);
                const srcY = rowYCenter(srcIdx);
                const tgtX = toPercent(row.startDate);
                const tgtY = rowYCenter(idx);
                return (
                  <g key={`dep-${row.id}`}>
                    <path
                      d={`M ${srcX}% ${srcY} C ${srcX + 3}% ${srcY}, ${tgtX - 3}% ${tgtY}, ${tgtX}% ${tgtY}`}
                      fill="none"
                      stroke="var(--c-border-strong)"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Row shapes */}
            {rows.map((row) => {
              const isTaskLike =
                row.type === 'task' || row.type === 'pause' || row.type === 'meeting';
              const isPoint = !isTaskLike; // everything else is a point marker

              if (isPoint) {
                const pct = toPercent(row.startDate);
                const color = shapeColor[row.type];
                const isDecision = row.type === 'decision';
                const isEsc = row.type === 'escalation';
                const isInfo = row.type === 'info_event';
                const isNotification = row.type === 'notification';
                return (
                  <div key={row.id} className="h-9 flex items-center relative">
                    <div
                      className="absolute flex items-center justify-center"
                      style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
                    >
                      {isDecision ? (
                        <div
                          className={`w-4 h-4 ${row.decisionOutcome === 'GO' ? 'bg-emerald-500' : row.decisionOutcome === 'NO_GO' ? 'bg-danger-500' : 'bg-amber-500'} rounded-sm rotate-45 border-2 border-white`}
                        />
                      ) : isEsc ? (
                        <AlertTriangle size={14} className="text-amber-500 fill-amber-500/20" />
                      ) : isNotification ? (
                        <Bell size={12} className="text-indigo-500" />
                      ) : isInfo ? (
                        <Megaphone size={12} className="text-blue-500" />
                      ) : (
                        <div className={`w-3 h-3 ${color} rounded-sm rotate-45`} />
                      )}
                    </div>
                  </div>
                );
              }

              // Task bar
              const left = toPercent(row.startDate);
              const right = toPercent(row.endDate);
              const width = Math.max(right - left, 1);
              const barColor =
                row.type === 'pause'
                  ? 'bg-slate-500/55'
                  : row.type === 'meeting'
                    ? 'bg-blue-500/55'
                    : row.status === 'done'
                      ? 'bg-emerald-500/70'
                      : row.status === 'in_progress'
                        ? 'bg-blue-500/70'
                        : row.status === 'blocked'
                          ? 'bg-danger-500/70'
                          : 'bg-blue-500/50';

              return (
                <div key={row.id} className="h-9 flex items-center relative">
                  <div
                    className={`absolute h-5 rounded-lg ${barColor} transition-all ${
                      row.isCriticalPath ? 'ring-2 ring-fuchsia-300/70' : ''
                    }`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '4px' }}
                    title={`${row.name}: ${fmtDate(row.startDate)} → ${fmtDate(row.endDate)}`}
                  >
                    {width > 8 && (
                      <span className="absolute inset-0 flex items-center px-1.5 text-[8px] text-white font-medium truncate">
                        {row.name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MAIN EXPORT: TimelinePlanner
// ════════════════════════════════════════════════════════════════

export type PlannerView = 'table' | 'gantt';

export interface TimelinePlannerHandle {
  openAddPanel: () => void;
  applyAiPlan: (plan: {
    extraRows: TimelineRow[];
    rowPatches: Array<{ id: string; patch: Partial<TimelineRow> }>;
    manualOrder: string[];
  }) => void;
}

export interface TimelinePlannerProps {
  plannedStart: string | null;
  plannedEnd: string | null;
  tasks: TaskItem[];
  decisions: Decision[];
  milestones: TimelineMilestone[];
  users: UserInfo[];
  isPolish: boolean;
  editable: boolean;
  onUpdateStart: (date: string | null) => void;
  onUpdateEnd: (date: string | null) => void;
  /** task_dependencies → Gantt dependency connectors (derives row.dependsOnId). */
  dependencies?: Array<{ sourceTaskId?: string; taskId?: string; direction?: string }>;
  /** Ref to expose openAddPanel to parent */
  handleRef?: React.MutableRefObject<TimelinePlannerHandle | null>;
}

export const TimelinePlanner: React.FC<TimelinePlannerProps> = ({
  plannedStart,
  plannedEnd,
  tasks,
  decisions,
  milestones,
  users,
  isPolish,
  editable,
  onUpdateStart,
  onUpdateEnd,
  dependencies = [],
  handleRef,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<PlannerView>('table');
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [availableReports, setAvailableReports] = useState<ReportOption[]>([]);

  useEffect(() => {
    Api.get('/report-builder')
      .then((r: any) =>
        setAvailableReports(
          (r?.reports || []).map((x: any) => ({ id: x.id, title: x.title || x.id }))
        )
      )
      .catch(() => setAvailableReports([]));
  }, []);

  const {
    rows,
    addRow,
    updateRow,
    removeRow,
    duplicateRow,
    reorderRows,
    replaceExtraRows,
    clearRowOverrides,
    replaceManualOrder,
  } = useTimelineRows({
    plannedStart,
    plannedEnd,
    tasks,
    milestones,
    isPolish,
    dependencies,
  });

  // Expose openAddPanel to parent via ref
  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        openAddPanel: () => setShowAddPanel(true),
        applyAiPlan: (plan) => {
          const extra = Array.isArray(plan?.extraRows) ? plan.extraRows : [];
          const patches = Array.isArray(plan?.rowPatches) ? plan.rowPatches : [];
          const order = Array.isArray(plan?.manualOrder) ? plan.manualOrder : [];

          clearRowOverrides();
          replaceExtraRows(extra);
          replaceManualOrder(order);

          for (const p of patches) {
            if (!p?.id || !p?.patch) continue;
            updateRow(String(p.id), p.patch);
          }

          setView('table');
        },
      };
    }
  }, [clearRowOverrides, handleRef, replaceExtraRows, replaceManualOrder, updateRow]);

  // Summary stats
  const stats = useMemo(() => {
    const taskRows = rows.filter((r) => r.type === 'task');
    const totalHours = taskRows.reduce((sum, r) => sum + (r.estimatedHours || 0), 0);
    return {
      tasks: taskRows.length,
      milestones: rows.filter((r) => r.type === 'milestone').length,
      decisions: rows.filter((r) => r.type === 'decision').length,
      notifications: rows.filter((r) => r.type === 'notification').length,
      pauses: rows.filter((r) => r.type === 'pause').length,
      events: rows.filter(
        (r) => r.type === 'info_event' || r.type === 'notification' || r.type === 'escalation'
      ).length,
      totalHours,
      totalDays: daysBetween(plannedStart, plannedEnd),
    };
  }, [rows, plannedStart, plannedEnd]);

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-c-surface-raised w-fit">
        <button
          onClick={() => setView('table')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            view === 'table'
              ? 'bg-white  text-c-text-secondary dark:text-white shadow-sm'
              : 'text-c-text-muted hover:text-c-text-secondary '
          }`}
        >
          <Table2 size={13} />
          {t('initiatives.timelinePlanner.table')}
        </button>
        <button
          onClick={() => setView('gantt')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            view === 'gantt'
              ? 'bg-white  text-c-text-secondary dark:text-white shadow-sm'
              : 'text-c-text-muted hover:text-c-text-secondary '
          }`}
        >
          <BarChart3 size={13} />
          Gantt
        </button>
      </div>

      {/* Add Item Panel */}
      <AnimatePresence>
        {showAddPanel && editable && (
          <AddTimelineItemPanel
            isPolish={isPolish}
            rows={rows}
            tasks={tasks}
            decisions={decisions}
            milestones={milestones}
            users={users}
            availableReports={availableReports}
            onAdd={(newRow) => addRow(newRow)}
            onClose={() => setShowAddPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* Views */}
      <AnimatePresence mode="wait">
        {view === 'table' ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <TimelineTable
              rows={rows}
              isPolish={isPolish}
              editable={editable}
              tasks={tasks}
              decisions={decisions}
              milestones={milestones}
              users={users}
              availableReports={availableReports}
              onUpdateStart={onUpdateStart}
              onUpdateEnd={onUpdateEnd}
              onUpdateRow={updateRow}
              onRemoveRow={removeRow}
              onDuplicateRow={duplicateRow}
              onReorderRows={reorderRows}
            />
          </motion.div>
        ) : (
          <motion.div
            key="gantt"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <TimelineGanttView
              rows={rows}
              isPolish={isPolish}
              plannedStart={plannedStart}
              plannedEnd={plannedEnd}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget summary bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[10px] text-c-text-secondary">
        <span className="flex items-center gap-1">
          <Play size={10} className="text-blue-500" />
          {stats.tasks} {t('initiatives.timelinePlanner.tasksLabel')}
        </span>
        {stats.milestones > 0 && (
          <span className="flex items-center gap-1">
            <Flag size={10} className="text-c-tag-3" />
            {stats.milestones} {t('initiatives.timelinePlanner.milestonesLabel')}
          </span>
        )}
        {stats.decisions > 0 && (
          <span className="flex items-center gap-1">
            <Gavel size={10} className="text-amber-500" />
            {stats.decisions} {t('initiatives.timelinePlanner.decisionsLabel')}
          </span>
        )}
        {stats.events > 0 && (
          <span className="flex items-center gap-1">
            <Megaphone size={10} className="text-blue-500" />
            {stats.events} {t('initiatives.timelinePlanner.eventsLabel')}
          </span>
        )}
        {stats.notifications > 0 && (
          <span className="flex items-center gap-1">
            <Bell size={10} className="text-indigo-500" />
            {stats.notifications} {t('initiatives.timelinePlanner.notificationsLabel')}
          </span>
        )}
        {stats.pauses > 0 && (
          <span className="flex items-center gap-1">
            <PauseCircle size={10} className="text-c-text-muted" />
            {stats.pauses} {t('initiatives.timelinePlanner.pausesLabel')}
          </span>
        )}
        {stats.totalHours > 0 && (
          <span className="flex items-center gap-1">
            <Clock size={10} className="text-c-text-secondary" />
            {stats.totalHours}h {t('initiatives.timelinePlanner.planned')}
          </span>
        )}
        {stats.totalDays !== null && (
          <span>
            {stats.totalDays} {t('initiatives.timelinePlanner.totalDays')}
          </span>
        )}
      </div>
    </div>
  );
};
