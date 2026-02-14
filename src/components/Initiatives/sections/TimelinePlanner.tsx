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
  Check,
  ChevronDown,
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
  Plus,
  Rocket,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    icon: Flag,
    label: 'Milestone',
    labelPl: 'Kamień milowy',
    color: 'text-purple-500',
    bgTint: 'bg-purple-500/3',
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
    color: 'text-cyan-500',
    bgTint: 'bg-cyan-500/3',
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
    color: 'text-teal-500',
    bgTint: 'bg-teal-500/4',
    shortLabel: 'R',
  },
  pause: {
    icon: PauseCircle,
    label: 'Pause',
    labelPl: 'Pauza',
    color: 'text-slate-500',
    bgTint: 'bg-slate-500/4',
    shortLabel: 'P',
  },
  escalation: {
    icon: AlertTriangle,
    label: 'Escalation',
    labelPl: 'Eskalacja',
    color: 'text-orange-500',
    bgTint: 'bg-orange-500/3',
    shortLabel: 'E',
  },
  finish: {
    icon: Flag,
    label: 'Finish',
    labelPl: 'Koniec',
    color: 'text-red-500',
    bgTint: 'bg-red-500/5',
    shortLabel: 'F',
  },
};

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  blocked: 'bg-red-500',
  done: 'bg-emerald-500',
};

const DECISION_OUTCOME_STYLES: Record<string, { dot: string; label: string; labelPl: string }> = {
  GO: { dot: 'bg-emerald-500', label: 'GO', labelPl: 'GO' },
  NO_GO: { dot: 'bg-red-500', label: 'NO-GO', labelPl: 'NO-GO' },
  ESCALATE: { dot: 'bg-orange-500', label: 'Escalate', labelPl: 'Eskalacja' },
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

const REPORT_PLACEHOLDER_OPTIONS = [
  {
    id: 'rpt-status-monthly',
    label: 'Status Monthly Report',
    labelPl: 'Raport statusowy miesięczny',
  },
  { id: 'rpt-kpi-steering', label: 'KPI Steering Snapshot', labelPl: 'Migawka KPI dla Steering' },
  { id: 'rpt-risk-heatmap', label: 'Risk Heatmap', labelPl: 'Mapa cieplna ryzyk' },
];

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
}

export function useTimelineRows({
  plannedStart,
  plannedEnd,
  tasks,
  milestones,
  isPolish,
}: UseTimelineRowsOptions) {
  const [extraRows, setExtraRows] = useState<TimelineRow[]>([]);
  const [manualOrder, setManualOrder] = useState<string[]>([]);

  const rawRows = useMemo<TimelineRow[]>(() => {
    const result: TimelineRow[] = [];

    // Start
    result.push({
      id: '__start__',
      type: 'start',
      name: isPolish ? 'Start inicjatywy' : 'Initiative Start',
      startDate: plannedStart,
      endDate: null,
      schedulingMode: 'fixed_date',
      order: -Infinity,
    });

    // Tasks from context
    tasks.forEach((t, idx) => {
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
      name: isPolish ? 'Koniec inicjatywy' : 'Initiative Finish',
      startDate: plannedEnd,
      endDate: null,
      schedulingMode: 'fixed_date',
      order: Infinity,
    });

    // Base sort (date/order) before optional manual ordering
    result.sort((a, b) => {
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
    const startRow = result.find((r) => r.type === 'start') || null;
    const finishRow = result.find((r) => r.type === 'finish') || null;
    const middle = result.filter((r) => r.type !== 'start' && r.type !== 'finish');

    if (middle.length === 0) return result;

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
  }, [plannedStart, plannedEnd, tasks, milestones, extraRows, isPolish, manualOrder]);

  // Apply cascade recalculation
  const rows = useMemo(() => recalculateDates(rawRows), [rawRows]);

  const addRow = useCallback((row: TimelineRow) => {
    setExtraRows((prev) => [...prev, row]);
    return row.id;
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<TimelineRow>) => {
    setExtraRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
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

  return { rows, addRow, updateRow, removeRow, duplicateRow, reorderRows, extraRows };
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
  onAdd,
  onClose,
}) => {
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

  const handleSelectType = (type: TimelineRowType) => {
    setSelectedType(type);
    setStep(2);
    setStartTriggerType('dependency');
    setEndSchedulingMode(
      type === 'task' || type === 'pause' || type === 'meeting' ? 'from_duration' : 'manual_date'
    );
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!selectedType || !name.trim()) return;
    if (selectedType === 'task' && !selectedTaskId) return;
    if (selectedType === 'decision' && !selectedDecisionId) return;
    if (selectedType === 'milestone' && !selectedMilestoneId) return;
    if (selectedType === 'info_event') {
      const hasExternal = infoAssetType === 'external_link' && !!infoAssetUrl.trim();
      const hasReportPlaceholder =
        infoAssetType === 'internal_report' && !!linkedReportPlaceholderId;
      const hasGenerated = infoAssetType === 'generated_presentation' && !!infoAssetLabel.trim();
      const hasOther = infoAssetType === 'other' && !!infoAssetLabel.trim();
      if (!(hasExternal || hasReportPlaceholder || hasGenerated || hasOther)) return;
      if (infoEventMode === 'specific_date' && !fixedDate) return;
      if (infoEventMode === 'after_event' && !infoEventReferenceEvent.trim()) return;
      if (infoEventParticipantMode === 'person' && !infoEventParticipantUserId) return;
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
      className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4">
          {/* Step 1: Select type */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Co chcesz dodać?' : 'What do you want to add?'}
                </span>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
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
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200/60 dark:border-navy-700/60 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all text-left group"
                    >
                      <Icon size={16} className={`${meta.color} mt-0.5 flex-shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {isPolish ? at.labelPl : at.label}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
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
                    className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    ← {isPolish ? 'Wróć' : 'Back'}
                  </button>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {isPolish
                      ? ROW_TYPE_META[selectedType].labelPl
                      : ROW_TYPE_META[selectedType].label}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Nazwa' : 'Name'} *
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isPolish ? 'Nazwa elementu...' : 'Item name...'}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Source selectors */}
              {selectedType === 'task' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish
                      ? 'Wybierz zadanie z listy inicjatywy'
                      : 'Select task from initiative task list'}{' '}
                    *
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">— {isPolish ? 'Wybierz zadanie' : 'Select task'} —</option>
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
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish
                      ? 'Wybierz decyzję z listy inicjatywy'
                      : 'Select decision from initiative list'}{' '}
                    *
                  </label>
                  <select
                    value={selectedDecisionId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedDecisionId(id);
                      const d = decisionOptions.find((x) => x.id === id);
                      if (d) setName(d.title);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">— {isPolish ? 'Wybierz decyzję' : 'Select decision'} —</option>
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
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Wybierz kamień milowy z listy' : 'Select milestone from list'} *
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">
                      — {isPolish ? 'Wybierz kamień milowy' : 'Select milestone'} —
                    </option>
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
                <label className="text-[10px] text-slate-500 block mb-1.5">
                  {isPolish ? 'Trigger startu' : 'Start trigger'}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setScheduling('after_previous');
                      setStartTriggerType('dependency');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'dependency'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'border-slate-200 dark:border-navy-600 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {isPolish ? 'Z dependency (system)' : 'From dependency (system)'}
                  </button>
                  <button
                    onClick={() => {
                      setScheduling('fixed_date');
                      setStartTriggerType('date');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'date'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'border-slate-200 dark:border-navy-600 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {isPolish ? 'Data ręczna' : 'Manual date'}
                  </button>
                  <button
                    onClick={() => {
                      setScheduling('fixed_date');
                      setStartTriggerType('event');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-[11px] border transition-colors ${
                      startTriggerType === 'event'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        : 'border-slate-200 dark:border-navy-600 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {isPolish ? 'Zdarzenie' : 'Event trigger'}
                  </button>
                </div>
              </div>

              {/* Dependency select (after_previous) */}
              {startTriggerType === 'dependency' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Zależy od' : 'Depends on'}
                  </label>
                  <select
                    value={dependsOnId}
                    onChange={(e) => setDependsOnId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
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
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Data' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={fixedDate}
                    onChange={(e) => setFixedDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
              {startTriggerType === 'event' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Nazwa zdarzenia' : 'Event name'}
                  </label>
                  <input
                    type="text"
                    value={startTriggerEvent}
                    onChange={(e) => setStartTriggerEvent(e.target.value)}
                    placeholder={
                      isPolish
                        ? 'np. Zatwierdzenie gate / sygnał z systemu'
                        : 'e.g. Gate approval / system signal'
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              {/* End mode */}
              {(selectedType === 'task' ||
                selectedType === 'pause' ||
                selectedType === 'meeting') && (
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block">
                    {isPolish ? 'Trigger końca' : 'End trigger'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('from_duration')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'from_duration'
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          : 'border-slate-200 dark:border-navy-600 text-slate-500'
                      }`}
                    >
                      {isPolish ? 'Z czasu trwania' : 'From duration'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('manual_date')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'manual_date'
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          : 'border-slate-200 dark:border-navy-600 text-slate-500'
                      }`}
                    >
                      {isPolish ? 'Data ręczna' : 'Manual date'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndSchedulingMode('from_successor')}
                      className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${
                        endSchedulingMode === 'from_successor'
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                          : 'border-slate-200 dark:border-navy-600 text-slate-500'
                      }`}
                    >
                      {isPolish ? 'Z sukcesora' : 'From successor'}
                    </button>
                  </div>
                  {endSchedulingMode === 'manual_date' && (
                    <input
                      type="date"
                      value={manualEndDate}
                      onChange={(e) => setManualEndDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  )}
                  {endSchedulingMode === 'from_successor' && (
                    <select
                      value={successorId}
                      onChange={(e) => setSuccessorId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">
                        — {isPolish ? 'Wybierz sukcesora' : 'Select successor'} —
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Czas trwania (dni)' : 'Duration (days)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Szacowane godziny' : 'Estimated hours'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Decision-specific */}
              {selectedType === 'decision' && (
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-slate-500">
                    {isPolish ? 'Blokuje następne zadania?' : 'Blocks next tasks?'}
                  </label>
                  <button
                    onClick={() => setDecisionBlocks(!decisionBlocks)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      decisionBlocks ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-navy-600'
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
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'Tryb wydarzenia' : 'Event mode'}
                      </label>
                      <select
                        value={infoEventMode}
                        onChange={(e) =>
                          setInfoEventMode(
                            e.target.value as 'cyclical' | 'specific_date' | 'after_event'
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="cyclical">
                          {isPolish ? 'Spotkanie cykliczne' : 'Cyclical meeting'}
                        </option>
                        <option value="specific_date">
                          {isPolish ? 'W konkretnej dacie' : 'On specific date'}
                        </option>
                        <option value="after_event">
                          {isPolish ? 'Po zdarzeniu' : 'After event'}
                        </option>
                      </select>
                    </div>
                    {infoEventMode === 'cyclical' && (
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {isPolish ? 'Cykliczność' : 'Cadence'}
                        </label>
                        <select
                          value={infoEventCadence}
                          onChange={(e) => setInfoEventCadence(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                          <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                          <option value="biweekly">
                            {isPolish ? 'Co 2 tygodnie' : 'Biweekly'}
                          </option>
                          <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                          <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
                        </select>
                      </div>
                    )}
                    {infoEventMode === 'after_event' && (
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {isPolish ? 'Po jakim zdarzeniu?' : 'After which event?'}
                        </label>
                        <input
                          type="text"
                          value={infoEventReferenceEvent}
                          onChange={(e) => setInfoEventReferenceEvent(e.target.value)}
                          placeholder={
                            isPolish ? 'np. Po akceptacji gate GO' : 'e.g. After GO gate approval'
                          }
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Odbiorcy' : 'Audience'}
                    </label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder={isPolish ? 'np. Steering Committee' : 'e.g. Steering Committee'}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'Kto powinien być?' : 'Who should attend?'}
                      </label>
                      <select
                        value={infoEventParticipantMode}
                        onChange={(e) =>
                          setInfoEventParticipantMode(e.target.value as 'person' | 'group')
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="group">{isPolish ? 'Grupa' : 'Group'}</option>
                        <option value="person">{isPolish ? 'Osoba' : 'Person'}</option>
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
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
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
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="">
                            — {isPolish ? 'Wybierz osobę' : 'Select person'} —
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
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Źródło materiału (wymagane)' : 'Material source (required)'}
                    </label>
                    <select
                      value={infoAssetType}
                      onChange={(e) => setInfoAssetType(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="internal_report">
                        {isPolish
                          ? 'Raport wewnętrzny (placeholder)'
                          : 'Internal report (placeholder)'}
                      </option>
                      <option value="generated_presentation">
                        {isPolish ? 'Prezentacja wygenerowana' : 'Generated presentation'}
                      </option>
                      <option value="external_link">
                        {isPolish ? 'Link zewnętrzny' : 'External link'}
                      </option>
                      <option value="other">{isPolish ? 'Inne' : 'Other'}</option>
                    </select>
                    {infoAssetType === 'internal_report' && (
                      <p className="mt-1 text-[10px] text-amber-500">
                        {isPolish
                          ? 'Placeholder: finalne podłączenie do modułu raportów będzie dodane później.'
                          : 'Placeholder: final Reports module binding will be added later.'}
                      </p>
                    )}
                  </div>

                  {infoAssetType === 'internal_report' && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'Wybierz raport (placeholder)' : 'Select report (placeholder)'}
                      </label>
                      <select
                        value={linkedReportPlaceholderId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setLinkedReportPlaceholderId(id);
                          const found = REPORT_PLACEHOLDER_OPTIONS.find((x) => x.id === id);
                          if (found) setInfoAssetLabel(isPolish ? found.labelPl : found.label);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">
                          — {isPolish ? 'Wybierz raport' : 'Select report'} —
                        </option>
                        {REPORT_PLACEHOLDER_OPTIONS.map((r) => (
                          <option key={r.id} value={r.id}>
                            {isPolish ? r.labelPl : r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {infoAssetType === 'external_link' && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'URL materiału' : 'Material URL'}
                      </label>
                      <input
                        type="url"
                        value={infoAssetUrl}
                        onChange={(e) => setInfoAssetUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {(infoAssetType === 'generated_presentation' || infoAssetType === 'other') && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'Nazwa materiału' : 'Material label'}
                      </label>
                      <input
                        type="text"
                        value={infoAssetLabel}
                        onChange={(e) => setInfoAssetLabel(e.target.value)}
                        placeholder={
                          isPolish ? 'np. Deck: Sprint Review' : 'e.g. Deck: Sprint Review'
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Notification: cyclical communication rules */}
              {selectedType === 'notification' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Szablony' : 'Templates'}
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
                          className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:text-primary-500 border border-slate-200/70 dark:border-navy-700/70 hover:border-primary-400/40 transition-colors"
                        >
                          {isPolish ? preset.labelPl : preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Odbiorca' : 'Recipient type'}
                    </label>
                    <select
                      value={notificationRecipientMode}
                      onChange={(e) =>
                        setNotificationRecipientMode(e.target.value as 'person' | 'group')
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="group">{isPolish ? 'Grupa' : 'Group'}</option>
                      <option value="person">{isPolish ? 'Osoba' : 'Person'}</option>
                    </select>
                  </div>
                  <div>
                    {notificationRecipientMode === 'group' ? (
                      <>
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {isPolish ? 'Wybierz grupę' : 'Select group'}
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
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
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
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {isPolish ? 'Wybierz osobę' : 'Select person'}
                        </label>
                        <select
                          value={notificationRecipientUserId}
                          onChange={(e) => setNotificationRecipientUserId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                        >
                          <option value="">
                            — {isPolish ? 'Wybierz osobę' : 'Select person'} —
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
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Tryb notyfikacji' : 'Notification mode'}
                    </label>
                    <select
                      value={notificationTriggerMode}
                      onChange={(e) =>
                        setNotificationTriggerMode(e.target.value as 'event_based' | 'cyclical')
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="event_based">
                        {isPolish ? 'Zdarzeniowa' : 'Event-based'}
                      </option>
                      <option value="cyclical">{isPolish ? 'Cykliczna' : 'Cyclical'}</option>
                    </select>
                  </div>
                  {notificationTriggerMode === 'event_based' && (
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        {isPolish ? 'Wyzwalacz zdarzenia' : 'Event trigger'}
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
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="on_start">{isPolish ? 'Przy starcie' : 'On start'}</option>
                        <option value="on_complete">
                          {isPolish ? 'Przy zakończeniu' : 'On complete'}
                        </option>
                        <option value="before_next_action">
                          {isPolish ? 'Przed kolejnym działaniem' : 'Before next action'}
                        </option>
                        <option value="manual_gate">
                          {isPolish ? 'Po ręcznym gate' : 'Manual gate event'}
                        </option>
                      </select>
                    </div>
                  )}
                  {notificationTriggerMode === 'event_based' &&
                    notificationTriggerEvent === 'before_next_action' && (
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {isPolish ? 'Wyprzedzenie (dni)' : 'Lead time (days)'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={notificationLeadDays}
                          onChange={(e) => setNotificationLeadDays(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    )}
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Cykliczność' : 'Cadence'}
                    </label>
                    <select
                      value={notificationCadence}
                      onChange={(e) => setNotificationCadence(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                      <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                      <option value="biweekly">{isPolish ? 'Co 2 tygodnie' : 'Biweekly'}</option>
                      <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                      <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Kanał' : 'Channel'}
                    </label>
                    <select
                      value={notificationChannel}
                      onChange={(e) => setNotificationChannel(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="email">Email</option>
                      <option value="slack">Slack</option>
                      <option value="meeting">{isPolish ? 'Spotkanie' : 'Meeting'}</option>
                      <option value="dashboard">Dashboard</option>
                      <option value="other">{isPolish ? 'Inny' : 'Other'}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Reguła komunikacji' : 'Communication rule'}
                    </label>
                    <input
                      type="text"
                      value={notificationRule}
                      onChange={(e) => setNotificationRule(e.target.value)}
                      placeholder={
                        isPolish
                          ? 'np. Co wtorek 09:00 do Steering Committee'
                          : 'e.g. Every Tuesday 09:00 to Steering Committee'
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Treść notyfikacji' : 'Notification content'} *
                    </label>
                    <textarea
                      value={notificationMessage}
                      onChange={(e) => setNotificationMessage(e.target.value)}
                      rows={2}
                      placeholder={
                        isPolish
                          ? 'Wpisz treść, która ma być wysłana do odbiorcy...'
                          : 'Enter message content to be sent to recipient...'
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-slate-500">
                        {isPolish
                          ? 'Automatyczna wysyłka notyfikacji przez AI'
                          : 'Automatic notification sending by AI'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setNotificationAiAutoSend(!notificationAiAutoSend)}
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          notificationAiAutoSend ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-navy-600'
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
                        placeholder={
                          isPolish
                            ? 'Instrukcja dla AI: ton, długość, wymagane elementy wiadomości...'
                            : 'AI instruction: tone, length, required message elements...'
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Recurring meeting */}
              {selectedType === 'meeting' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Cykliczność spotkania' : 'Meeting cadence'}
                    </label>
                    <select
                      value={meetingCadence}
                      onChange={(e) => setMeetingCadence(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                      <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                      <option value="biweekly">{isPolish ? 'Co 2 tygodnie' : 'Biweekly'}</option>
                      <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                      <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Forma spotkania' : 'Meeting channel'}
                    </label>
                    <select
                      value={meetingChannel}
                      onChange={(e) => setMeetingChannel(e.target.value as any)}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="online">{isPolish ? 'Online' : 'Online'}</option>
                      <option value="onsite">{isPolish ? 'Stacjonarnie' : 'Onsite'}</option>
                      <option value="hybrid">{isPolish ? 'Hybrydowo' : 'Hybrid'}</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Agenda spotkania' : 'Meeting agenda'}
                    </label>
                    <textarea
                      rows={2}
                      value={meetingAgenda}
                      onChange={(e) => setMeetingAgenda(e.target.value)}
                      placeholder={
                        isPolish
                          ? 'Krótki cel/agenda spotkania...'
                          : 'Brief meeting purpose/agenda...'
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Pause */}
              {selectedType === 'pause' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Czas trwania (dni)' : 'Duration (days)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value)}
                      placeholder="—"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1">
                      {isPolish ? 'Powód pauzy' : 'Pause reason'}
                    </label>
                    <input
                      type="text"
                      value={pauseReason}
                      onChange={(e) => setPauseReason(e.target.value)}
                      placeholder={
                        isPolish
                          ? 'np. okno wdrożeniowe / freeze'
                          : 'e.g. release freeze / maintenance'
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      {isPolish
                        ? 'Wyjaśnij przyczynę postoju. Ta informacja będzie widoczna w harmonogramie i pomoże ocenić wpływ na kolejne kroki.'
                        : 'Explain why execution is paused. This note is shown in the timeline and helps evaluate impact on next steps.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Escalation: level */}
              {selectedType === 'escalation' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Poziom eskalacji' : 'Escalation level'}
                  </label>
                  <select
                    value={escalationLevel}
                    onChange={(e) => setEscalationLevel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-600 dark:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">— {isPolish ? 'Wybierz' : 'Select'} —</option>
                    <option value="Sponsor">Sponsor</option>
                    <option value="PMO">PMO</option>
                    <option value="Board">{isPolish ? 'Zarząd' : 'Board'}</option>
                    <option value="Other">{isPolish ? 'Inny' : 'Other'}</option>
                  </select>
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                >
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!name.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 transition-colors"
                >
                  {isPolish ? 'Dodaj' : 'Add'}
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
  isPolish,
  onSave,
  onClose,
}) => {
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

  const handleSave = () => {
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
      className="overflow-hidden border-b border-cyan-500/20"
    >
      <div className="bg-white/95 dark:bg-navy-900/95 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon size={14} className={meta.color} />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Edytuj element' : 'Edit item'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-[10px] text-slate-500 block mb-1">
            {isPolish ? 'Nazwa' : 'Name'}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Source selectors */}
        {row.type === 'task' && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Zadanie źródłowe' : 'Source task'}
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
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">— {isPolish ? 'Wybierz zadanie' : 'Select task'} —</option>
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
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Decyzja źródłowa' : 'Source decision'}
            </label>
            <select
              value={selectedDecisionId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedDecisionId(id);
                const d = decisionOptions.find((x) => x.id === id);
                if (d) setName(d.title);
              }}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">— {isPolish ? 'Wybierz decyzję' : 'Select decision'} —</option>
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
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Kamień milowy źródłowy' : 'Source milestone'}
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
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">
                — {isPolish ? 'Wybierz kamień milowy' : 'Select milestone'} —
              </option>
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
          <label className="text-[10px] text-slate-500 block mb-1.5">
            {isPolish ? 'Trigger startu' : 'Start trigger'}
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setScheduling('after_previous');
                setStartTriggerType('dependency');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'dependency'
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'border-slate-200 dark:border-navy-600 text-slate-500'
              }`}
            >
              {isPolish ? 'Z dependency (system)' : 'From dependency (system)'}
            </button>
            <button
              onClick={() => {
                setScheduling('fixed_date');
                setStartTriggerType('date');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'date'
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'border-slate-200 dark:border-navy-600 text-slate-500'
              }`}
            >
              {isPolish ? 'Data ręczna' : 'Manual date'}
            </button>
            <button
              onClick={() => {
                setScheduling('fixed_date');
                setStartTriggerType('event');
              }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] border transition-colors ${
                startTriggerType === 'event'
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'border-slate-200 dark:border-navy-600 text-slate-500'
              }`}
            >
              {isPolish ? 'Zdarzenie' : 'Event trigger'}
            </button>
          </div>
        </div>

        {startTriggerType === 'dependency' && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Zależy od' : 'Depends on'}
            </label>
            <select
              value={dependsOnId}
              onChange={(e) => setDependsOnId(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
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
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Data' : 'Date'}
            </label>
            <input
              type="date"
              value={fixedDate}
              onChange={(e) => setFixedDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {startTriggerType === 'event' && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Nazwa zdarzenia' : 'Event name'}
            </label>
            <input
              type="text"
              value={startTriggerEvent}
              onChange={(e) => setStartTriggerEvent(e.target.value)}
              placeholder={
                isPolish
                  ? 'np. Zatwierdzenie gate / sygnał z systemu'
                  : 'e.g. Gate approval / system signal'
              }
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {(row.type === 'task' || row.type === 'pause' || row.type === 'meeting') && (
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-500 block">
              {isPolish ? 'Trigger końca' : 'End trigger'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEndSchedulingMode('from_duration')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'from_duration' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 dark:border-navy-600 text-slate-500'}`}
              >
                {isPolish ? 'Z czasu trwania' : 'From duration'}
              </button>
              <button
                type="button"
                onClick={() => setEndSchedulingMode('manual_date')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'manual_date' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 dark:border-navy-600 text-slate-500'}`}
              >
                {isPolish ? 'Data ręczna' : 'Manual date'}
              </button>
              <button
                type="button"
                onClick={() => setEndSchedulingMode('from_successor')}
                className={`px-2 py-1.5 rounded-lg text-[11px] border transition-colors ${endSchedulingMode === 'from_successor' ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' : 'border-slate-200 dark:border-navy-600 text-slate-500'}`}
              >
                {isPolish ? 'Z sukcesora' : 'From successor'}
              </button>
            </div>
            {endSchedulingMode === 'manual_date' && (
              <input
                type="date"
                value={manualEndDate}
                onChange={(e) => setManualEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              />
            )}
            {endSchedulingMode === 'from_successor' && (
              <select
                value={successorId}
                onChange={(e) => setSuccessorId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="">— {isPolish ? 'Wybierz sukcesora' : 'Select successor'} —</option>
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Dni' : 'Days'}
              </label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="—"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Godziny' : 'Hours'}
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="—"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Decision-specific */}
        {row.type === 'decision' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-slate-500">
                {isPolish ? 'Blokuje następne?' : 'Blocks next?'}
              </label>
              <button
                onClick={() => setDecisionBlocks(!decisionBlocks)}
                className={`relative w-9 h-5 rounded-full transition-colors ${decisionBlocks ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-navy-600'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${decisionBlocks ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Wynik decyzji' : 'Decision outcome'}
              </label>
              <div className="flex gap-1.5">
                {([null, 'GO', 'NO_GO', 'ESCALATE'] as const).map((val) => (
                  <button
                    key={val ?? 'pending'}
                    onClick={() => setDecisionOutcome(val)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${decisionOutcome === val ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600' : 'border-slate-200 dark:border-navy-600 text-slate-500'}`}
                  >
                    {val === null
                      ? isPolish
                        ? 'Oczekuje'
                        : 'Pending'
                      : val === 'GO'
                        ? 'GO'
                        : val === 'NO_GO'
                          ? 'NO-GO'
                          : isPolish
                            ? 'Eskalacja'
                            : 'Escalate'}
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
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Tryb wydarzenia' : 'Event mode'}
                </label>
                <select
                  value={infoEventMode}
                  onChange={(e) =>
                    setInfoEventMode(e.target.value as 'cyclical' | 'specific_date' | 'after_event')
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="cyclical">
                    {isPolish ? 'Spotkanie cykliczne' : 'Cyclical meeting'}
                  </option>
                  <option value="specific_date">
                    {isPolish ? 'W konkretnej dacie' : 'On specific date'}
                  </option>
                  <option value="after_event">{isPolish ? 'Po zdarzeniu' : 'After event'}</option>
                </select>
              </div>
              {infoEventMode === 'cyclical' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Cykliczność' : 'Cadence'}
                  </label>
                  <select
                    value={infoEventCadence}
                    onChange={(e) => setInfoEventCadence(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                    <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                    <option value="biweekly">{isPolish ? 'Co 2 tygodnie' : 'Biweekly'}</option>
                    <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                    <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
                  </select>
                </div>
              )}
              {infoEventMode === 'after_event' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Po jakim zdarzeniu?' : 'After which event?'}
                  </label>
                  <input
                    type="text"
                    value={infoEventReferenceEvent}
                    onChange={(e) => setInfoEventReferenceEvent(e.target.value)}
                    placeholder={
                      isPolish ? 'np. Po akceptacji gate GO' : 'e.g. After GO gate approval'
                    }
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Odbiorcy' : 'Audience'}
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder={isPolish ? 'np. Steering Committee' : 'e.g. Steering Committee'}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Kto powinien być?' : 'Who should attend?'}
                </label>
                <select
                  value={infoEventParticipantMode}
                  onChange={(e) =>
                    setInfoEventParticipantMode(e.target.value as 'person' | 'group')
                  }
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="group">{isPolish ? 'Grupa' : 'Group'}</option>
                  <option value="person">{isPolish ? 'Osoba' : 'Person'}</option>
                </select>
              </div>
              <div>
                {infoEventParticipantMode === 'group' ? (
                  <select
                    value={infoEventParticipantGroupKey}
                    onChange={(e) => setInfoEventParticipantGroupKey(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">— {isPolish ? 'Wybierz osobę' : 'Select person'} —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Źródło materiału (wymagane)' : 'Material source (required)'}
              </label>
              <select
                value={infoAssetType}
                onChange={(e) => setInfoAssetType(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="internal_report">
                  {isPolish ? 'Raport wewnętrzny (placeholder)' : 'Internal report (placeholder)'}
                </option>
                <option value="generated_presentation">
                  {isPolish ? 'Prezentacja wygenerowana' : 'Generated presentation'}
                </option>
                <option value="external_link">
                  {isPolish ? 'Link zewnętrzny' : 'External link'}
                </option>
                <option value="other">{isPolish ? 'Inne' : 'Other'}</option>
              </select>
              {infoAssetType === 'internal_report' && (
                <p className="mt-1 text-[10px] text-amber-500">
                  {isPolish
                    ? 'Placeholder: finalne podłączenie do modułu raportów będzie dodane później.'
                    : 'Placeholder: final Reports module binding will be added later.'}
                </p>
              )}
            </div>
            {infoAssetType === 'internal_report' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Wybierz raport (placeholder)' : 'Select report (placeholder)'}
                </label>
                <select
                  value={linkedReportPlaceholderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setLinkedReportPlaceholderId(id);
                    const found = REPORT_PLACEHOLDER_OPTIONS.find((x) => x.id === id);
                    if (found) setInfoAssetLabel(isPolish ? found.labelPl : found.label);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">— {isPolish ? 'Wybierz raport' : 'Select report'} —</option>
                  {REPORT_PLACEHOLDER_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {isPolish ? r.labelPl : r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {infoAssetType === 'external_link' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'URL materiału' : 'Material URL'}
                </label>
                <input
                  type="url"
                  value={infoAssetUrl}
                  onChange={(e) => setInfoAssetUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
            {(infoAssetType === 'generated_presentation' || infoAssetType === 'other') && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Nazwa materiału' : 'Material label'}
                </label>
                <input
                  type="text"
                  value={infoAssetLabel}
                  onChange={(e) => setInfoAssetLabel(e.target.value)}
                  placeholder={isPolish ? 'np. Deck: Sprint Review' : 'e.g. Deck: Sprint Review'}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {row.type === 'notification' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Szablony' : 'Templates'}
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
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-slate-500 hover:text-primary-500 border border-slate-200/70 dark:border-navy-700/70 hover:border-primary-400/40 transition-colors"
                  >
                    {isPolish ? preset.labelPl : preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Cykliczność' : 'Cadence'}
              </label>
              <select
                value={notificationCadence}
                onChange={(e) => setNotificationCadence(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                <option value="biweekly">{isPolish ? 'Co 2 tygodnie' : 'Biweekly'}</option>
                <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Odbiorca' : 'Recipient type'}
              </label>
              <select
                value={notificationRecipientMode}
                onChange={(e) => setNotificationRecipientMode(e.target.value as 'person' | 'group')}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="group">{isPolish ? 'Grupa' : 'Group'}</option>
                <option value="person">{isPolish ? 'Osoba' : 'Person'}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              {notificationRecipientMode === 'group' ? (
                <>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Wybierz grupę' : 'Select group'}
                  </label>
                  <select
                    value={notificationRecipientGroupKey}
                    onChange={(e) => setNotificationRecipientGroupKey(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
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
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Wybierz osobę' : 'Select person'}
                  </label>
                  <select
                    value={notificationRecipientUserId}
                    onChange={(e) => setNotificationRecipientUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">— {isPolish ? 'Wybierz osobę' : 'Select person'} —</option>
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
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Tryb notyfikacji' : 'Notification mode'}
              </label>
              <select
                value={notificationTriggerMode}
                onChange={(e) =>
                  setNotificationTriggerMode(e.target.value as 'event_based' | 'cyclical')
                }
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="event_based">{isPolish ? 'Zdarzeniowa' : 'Event-based'}</option>
                <option value="cyclical">{isPolish ? 'Cykliczna' : 'Cyclical'}</option>
              </select>
            </div>
            {notificationTriggerMode === 'event_based' && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">
                  {isPolish ? 'Wyzwalacz zdarzenia' : 'Event trigger'}
                </label>
                <select
                  value={notificationTriggerEvent}
                  onChange={(e) => setNotificationTriggerEvent(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="on_start">{isPolish ? 'Przy starcie' : 'On start'}</option>
                  <option value="on_complete">
                    {isPolish ? 'Przy zakończeniu' : 'On complete'}
                  </option>
                  <option value="before_next_action">
                    {isPolish ? 'Przed kolejnym działaniem' : 'Before next action'}
                  </option>
                  <option value="manual_gate">
                    {isPolish ? 'Po ręcznym gate' : 'Manual gate event'}
                  </option>
                </select>
              </div>
            )}
            {notificationTriggerMode === 'event_based' &&
              notificationTriggerEvent === 'before_next_action' && (
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {isPolish ? 'Wyprzedzenie (dni)' : 'Lead time (days)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={notificationLeadDays}
                    onChange={(e) => setNotificationLeadDays(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Kanał' : 'Channel'}
              </label>
              <select
                value={notificationChannel}
                onChange={(e) => setNotificationChannel(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="email">Email</option>
                <option value="slack">Slack</option>
                <option value="meeting">{isPolish ? 'Spotkanie' : 'Meeting'}</option>
                <option value="dashboard">Dashboard</option>
                <option value="other">{isPolish ? 'Inny' : 'Other'}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Reguła komunikacji' : 'Communication rule'}
              </label>
              <input
                type="text"
                value={notificationRule}
                onChange={(e) => setNotificationRule(e.target.value)}
                placeholder={
                  isPolish
                    ? 'np. Co wtorek 09:00 do Steering Committee'
                    : 'e.g. Every Tuesday 09:00 to Steering Committee'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Treść notyfikacji' : 'Notification content'}
              </label>
              <textarea
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
                rows={2}
                placeholder={
                  isPolish ? 'Treść, która ma zostać wysłana...' : 'Message content to send...'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-slate-500">
                  {isPolish ? 'Automatyczna wysyłka przez AI' : 'Automatic sending by AI'}
                </label>
                <button
                  type="button"
                  onClick={() => setNotificationAiAutoSend(!notificationAiAutoSend)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${notificationAiAutoSend ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-navy-600'}`}
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
                  placeholder={isPolish ? 'Instrukcja dla AI...' : 'Instruction for AI...'}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
                />
              )}
            </div>
          </div>
        )}

        {row.type === 'meeting' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Cykliczność spotkania' : 'Meeting cadence'}
              </label>
              <select
                value={meetingCadence}
                onChange={(e) => setMeetingCadence(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="daily">{isPolish ? 'Codziennie' : 'Daily'}</option>
                <option value="weekly">{isPolish ? 'Co tydzień' : 'Weekly'}</option>
                <option value="biweekly">{isPolish ? 'Co 2 tygodnie' : 'Biweekly'}</option>
                <option value="monthly">{isPolish ? 'Co miesiąc' : 'Monthly'}</option>
                <option value="custom">{isPolish ? 'Niestandardowo' : 'Custom'}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Forma spotkania' : 'Meeting channel'}
              </label>
              <select
                value={meetingChannel}
                onChange={(e) => setMeetingChannel(e.target.value as any)}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="online">{isPolish ? 'Online' : 'Online'}</option>
                <option value="onsite">{isPolish ? 'Stacjonarnie' : 'Onsite'}</option>
                <option value="hybrid">{isPolish ? 'Hybrydowo' : 'Hybrid'}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Agenda spotkania' : 'Meeting agenda'}
              </label>
              <textarea
                rows={2}
                value={meetingAgenda}
                onChange={(e) => setMeetingAgenda(e.target.value)}
                placeholder={
                  isPolish ? 'Krótki cel/agenda spotkania...' : 'Brief meeting purpose/agenda...'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {row.type === 'pause' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Dni' : 'Days'}
              </label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                placeholder="—"
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                {isPolish ? 'Powód pauzy' : 'Pause reason'}
              </label>
              <input
                type="text"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                placeholder={isPolish ? 'np. freeze wdrożeniowy' : 'e.g. deployment freeze'}
                className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {isPolish
                  ? 'Wyjaśnij przyczynę postoju. Ta informacja będzie widoczna w harmonogramie i pomoże ocenić wpływ na kolejne kroki.'
                  : 'Explain why execution is paused. This note is shown in the timeline and helps evaluate impact on next steps.'}
              </p>
            </div>
          </div>
        )}

        {/* Escalation */}
        {row.type === 'escalation' && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">
              {isPolish ? 'Poziom' : 'Level'}
            </label>
            <select
              value={escalationLevel}
              onChange={(e) => setEscalationLevel(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">—</option>
              <option value="Sponsor">Sponsor</option>
              <option value="PMO">PMO</option>
              <option value="Board">{isPolish ? 'Zarząd' : 'Board'}</option>
              <option value="Other">{isPolish ? 'Inny' : 'Other'}</option>
            </select>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
          >
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-cyan-500 hover:bg-cyan-600 transition-colors"
          >
            {isPolish ? 'Zapisz' : 'Save'}
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
  onUpdateStart,
  onUpdateEnd,
  onUpdateRow,
  onRemoveRow,
  onDuplicateRow,
  onReorderRows,
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingRowId) || null,
    [rows, editingRowId]
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
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
    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[52px_28px_1fr_82px_82px_42px_50px_70px_30px] gap-0 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40">
        <div className="px-1 py-2.5 text-center">#</div>
        <div className="px-0.5 py-2.5 text-center">{isPolish ? 'Typ' : 'Typ'}</div>
        <div className="px-2 py-2.5">{isPolish ? 'Nazwa' : 'Name'}</div>
        <div className="px-1 py-2.5 text-center">Start</div>
        <div className="px-1 py-2.5 text-center">{isPolish ? 'Koniec' : 'End'}</div>
        <div className="px-1 py-2.5 text-center">{isPolish ? 'Dni' : 'Days'}</div>
        <div className="px-1 py-2.5 text-center">h</div>
        <div className="px-1 py-2.5 text-center">{isPolish ? 'Zależy' : 'Dep'}</div>
        <div className="px-0.5 py-2.5 text-center">⋮</div>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => {
        const meta = ROW_TYPE_META[row.type];
        const Icon = meta.icon;
        const days = daysBetween(row.startDate, row.endDate);
        const isStart = row.type === 'start';
        const isFinish = row.type === 'finish';
        const isExtra = row.id.startsWith('tr-');
        const canEdit = editable && !isStart && !isFinish;
        const canRemove = editable && isExtra;
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
            className={`grid grid-cols-[52px_28px_1fr_82px_82px_42px_50px_70px_30px] gap-0 items-center border-b border-slate-200/30 dark:border-navy-700/30 group transition-colors ${
              meta.bgTint || 'hover:bg-slate-50/50 dark:hover:bg-navy-800/30'
            } ${draggingId === row.id ? 'opacity-60' : ''} ${
              dragOverId === row.id ? 'ring-1 ring-cyan-500/40' : ''
            }`}
          >
            {/* # */}
            <div className="px-1 py-2 flex items-center justify-center gap-1.5">
              {canEdit ? (
                <GripVertical
                  size={11}
                  className="text-slate-400 cursor-grab active:cursor-grabbing"
                />
              ) : (
                <span className="w-[11px]" />
              )}
              <span className="text-[10px] text-slate-400">{idx + 1}</span>
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
                  {isPolish ? 'Oczekuje' : 'Pending'}
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
                  className="flex-1 px-1.5 py-0.5 rounded bg-white dark:bg-navy-900 border border-cyan-500 text-xs text-slate-700 dark:text-slate-300 focus:outline-none"
                />
              ) : (
                <span
                  className={`text-xs truncate ${
                    isStart || isFinish
                      ? 'font-semibold text-slate-700 dark:text-slate-200'
                      : row.name
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-400 italic'
                  } ${canEdit ? 'cursor-text' : ''}`}
                  onClick={() => startNameEdit(row)}
                >
                  {row.name || (isPolish ? 'Kliknij aby nazwać...' : 'Click to name...')}
                </span>
              )}

              {/* Extra info chips */}
              {row.audience && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-600 truncate max-w-[60px]">
                  {row.audience}
                </span>
              )}
              {row.type === 'info_event' && row.infoAssetType && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-600 truncate max-w-[90px]">
                  {row.infoAssetType === 'internal_report'
                    ? isPolish
                      ? 'Raport (placeholder)'
                      : 'Report (placeholder)'
                    : row.infoAssetType === 'external_link'
                      ? isPolish
                        ? 'Link zewn.'
                        : 'External link'
                      : row.infoAssetType === 'generated_presentation'
                        ? isPolish
                          ? 'Prezentacja'
                          : 'Presentation'
                        : isPolish
                          ? 'Inne'
                          : 'Other'}
                </span>
              )}
              {row.type === 'info_event' && row.infoEventMode && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-600 truncate max-w-[80px]">
                  {row.infoEventMode === 'cyclical'
                    ? isPolish
                      ? 'Cykliczne'
                      : 'Cyclical'
                    : row.infoEventMode === 'after_event'
                      ? isPolish
                        ? 'Po zdarzeniu'
                        : 'After event'
                      : isPolish
                        ? 'W dacie'
                        : 'On date'}
                </span>
              )}
              {row.type === 'info_event' &&
                (row.infoEventParticipantUserId || row.infoEventParticipantGroupKey) && (
                  <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-600 truncate max-w-[85px]">
                    {row.infoEventParticipantMode === 'person'
                      ? users.find((u) => u.id === row.infoEventParticipantUserId)?.firstName
                        ? `${users.find((u) => u.id === row.infoEventParticipantUserId)?.firstName} ${
                            users.find((u) => u.id === row.infoEventParticipantUserId)?.lastName ||
                            ''
                          }`.trim()
                        : isPolish
                          ? 'Osoba'
                          : 'Person'
                      : row.infoEventParticipantGroupKey === 'project_team'
                        ? isPolish
                          ? 'Zespół projektu'
                          : 'Project team'
                        : row.infoEventParticipantGroupKey === 'steering_committee'
                          ? isPolish
                            ? 'Komitet'
                            : 'Steering'
                          : row.infoEventParticipantGroupKey === 'sponsor_group'
                            ? isPolish
                              ? 'Sponsorzy'
                              : 'Sponsors'
                            : row.infoEventParticipantGroupKey === 'all_stakeholders'
                              ? isPolish
                                ? 'Stakeholderzy'
                                : 'Stakeholders'
                              : isPolish
                                ? 'Grupa własna'
                                : 'Custom group'}
                  </span>
                )}
              {row.escalationLevel && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-600 truncate">
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
                        ? isPolish
                          ? 'Zespół projektu'
                          : 'Project team'
                        : row.notificationRecipientGroupKey === 'steering_committee'
                          ? isPolish
                            ? 'Komitet'
                            : 'Steering'
                          : row.notificationRecipientGroupKey === 'sponsor_group'
                            ? isPolish
                              ? 'Sponsorzy'
                              : 'Sponsors'
                            : row.notificationRecipientGroupKey === 'all_stakeholders'
                              ? isPolish
                                ? 'Stakeholderzy'
                                : 'Stakeholders'
                              : isPolish
                                ? 'Grupa własna'
                                : 'Custom group'}
                  </span>
                )}
              {row.type === 'notification' && row.notificationTriggerMode && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-600 truncate max-w-[70px]">
                  {row.notificationTriggerMode === 'cyclical'
                    ? isPolish
                      ? 'Cykliczna'
                      : 'Cyclical'
                    : isPolish
                      ? 'Zdarzeniowa'
                      : 'Event-based'}
                </span>
              )}
              {row.pauseReason && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-slate-500/10 text-slate-500 truncate max-w-[70px]">
                  {row.pauseReason}
                </span>
              )}
              {row.assigneeName && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-slate-100 dark:bg-navy-800 text-slate-500 truncate max-w-[60px]">
                  {row.assigneeName}
                </span>
              )}
            </div>

            {/* Start date */}
            <div className="px-0.5 py-1.5 text-center">
              {editable && isStart ? (
                <input
                  type="date"
                  value={toISO(row.startDate)}
                  onChange={(e) => onUpdateStart(e.target.value || null)}
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-navy-600 focus:border-cyan-500 text-slate-600 dark:text-slate-400 focus:outline-none"
                />
              ) : row.schedulingMode === 'after_previous' && row.dependsOnId ? (
                <span className="text-[10px] text-slate-400 italic">
                  {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                </span>
              ) : editable && canEdit && isExtra ? (
                <input
                  type="date"
                  value={toISO(row.startDate)}
                  onChange={(e) => onUpdateRow(row.id, { startDate: e.target.value || null })}
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-navy-600 focus:border-cyan-500 text-slate-600 dark:text-slate-400 focus:outline-none"
                />
              ) : (
                <span className="text-[10px] text-slate-500">
                  {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                </span>
              )}
            </div>

            {/* End date */}
            <div className="px-0.5 py-1.5 text-center">
              {isPointType(row.type) || isStart ? (
                <span className="text-[10px] text-slate-400">—</span>
              ) : isFinish ? (
                <span className="text-[10px] text-slate-500">
                  {fmtDate(row.startDate, isPolish ? 'pl' : 'en')}
                </span>
              ) : editable && canEdit && isExtra ? (
                <input
                  type="date"
                  value={toISO(row.endDate)}
                  onChange={(e) => onUpdateRow(row.id, { endDate: e.target.value || null })}
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-navy-600 focus:border-cyan-500 text-slate-600 dark:text-slate-400 focus:outline-none"
                />
              ) : (
                <span className="text-[10px] text-slate-500">
                  {fmtDate(row.endDate, isPolish ? 'pl' : 'en')}
                </span>
              )}
            </div>

            {/* Days */}
            <div className="px-1 py-1.5 text-center">
              {hasDuration(row.type) && editable && isExtra ? (
                <input
                  type="number"
                  min={1}
                  value={row.durationDays ?? ''}
                  onChange={(e) =>
                    onUpdateRow(row.id, {
                      durationDays: e.target.value ? parseInt(e.target.value, 10) : null,
                    })
                  }
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 focus:border-cyan-500 text-slate-500 text-center focus:outline-none"
                  placeholder="—"
                />
              ) : (
                <span className="text-[10px] text-slate-400">
                  {hasDuration(row.type) && (row.durationDays || days)
                    ? row.durationDays || days
                    : '—'}
                </span>
              )}
            </div>

            {/* Hours */}
            <div className="px-1 py-1.5 text-center">
              {row.type === 'task' && editable && isExtra ? (
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
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 focus:border-cyan-500 text-slate-500 text-center focus:outline-none"
                  placeholder="—"
                />
              ) : (
                <span className="text-[10px] text-slate-400">
                  {row.estimatedHours ? `${row.estimatedHours}h` : '—'}
                </span>
              )}
            </div>

            {/* Dependency */}
            <div className="px-0.5 py-1.5 text-center">
              {canEdit && isExtra ? (
                <select
                  value={row.dependsOnId || ''}
                  onChange={(e) =>
                    onUpdateRow(row.id, {
                      dependsOnId: e.target.value || null,
                      schedulingMode: e.target.value ? 'after_previous' : 'fixed_date',
                    })
                  }
                  className="w-full px-0.5 py-0.5 rounded text-[10px] bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-navy-600 focus:border-cyan-500 text-slate-500 focus:outline-none appearance-none"
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
                <span className="text-[10px] text-slate-400">{depLabel || '—'}</span>
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
                    onClick={() => setMenuOpenId((curr) => (curr === row.id ? null : row.id))}
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                    aria-label={isPolish ? 'Opcje wiersza' : 'Row options'}
                  >
                    <MoreVertical size={13} />
                  </button>
                  {menuOpenId === row.id && (
                    <div className="absolute right-1 top-8 z-20 min-w-[126px] rounded-lg border border-slate-200 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setEditingRowId(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Pencil size={12} />
                        {isPolish ? 'Edytuj' : 'Edit'}
                      </button>
                      <button
                        onClick={() => {
                          onDuplicateRow(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                      >
                        <Copy size={12} />
                        {isPolish ? 'Kopiuj' : 'Copy'}
                      </button>
                      <button
                        onClick={() => {
                          onRemoveRow(row.id);
                          setMenuOpenId(null);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-red-500 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 size={12} />
                        {isPolish ? 'Usuń' : 'Delete'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[10px] text-slate-300">—</span>
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
            className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 shadow-xl overflow-hidden">
              <EditRowPanel
                row={editingRow}
                rows={rows}
                tasks={tasks}
                decisions={decisions}
                milestones={milestones}
                users={users}
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
    finish: 'bg-red-500',
    milestone: 'bg-purple-500',
    decision: 'bg-amber-500',
    info_event: 'bg-cyan-500',
    notification: 'bg-indigo-500',
    meeting: 'bg-teal-500',
    pause: 'bg-slate-500',
    escalation: 'bg-orange-500',
    task: 'bg-blue-500',
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70 overflow-hidden">
      <div className="flex">
        {/* Left: labels */}
        <div className="flex-shrink-0 w-[180px] border-r border-slate-200/40 dark:border-navy-700/40">
          <div className="h-7 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40 flex items-center px-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              {isPolish ? 'Nazwa' : 'Name'}
            </span>
          </div>
          {rows.map((row) => {
            const meta = ROW_TYPE_META[row.type];
            const Icon = meta.icon;
            return (
              <div
                key={row.id}
                className="h-9 flex items-center gap-1.5 px-2 border-b border-slate-200/20 dark:border-navy-700/20"
              >
                <Icon size={11} className={meta.color} />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                  {row.name || '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: bars */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="h-7 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/60 dark:bg-navy-800/40 relative">
            {months.map((m) => (
              <div
                key={m.label}
                className="absolute top-0 h-full flex items-end pb-0.5"
                style={{ left: `${m.pct}%` }}
              >
                <div className="w-px h-full bg-slate-200/40 dark:bg-navy-700/40" />
                <span className="text-[8px] text-slate-400 pl-1 whitespace-nowrap">{m.label}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {months.map((m) => (
              <div
                key={`g-${m.label}`}
                className="absolute top-0 bottom-0 w-px bg-slate-200/20 dark:bg-navy-700/20"
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
                      stroke="currentColor"
                      className="text-purple-400/50 dark:text-purple-500/40"
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
                          className={`w-4 h-4 ${row.decisionOutcome === 'GO' ? 'bg-emerald-500' : row.decisionOutcome === 'NO_GO' ? 'bg-red-500' : 'bg-amber-500'} rounded-sm rotate-45 border-2 border-white dark:border-navy-900`}
                        />
                      ) : isEsc ? (
                        <AlertTriangle size={14} className="text-orange-500 fill-orange-500/20" />
                      ) : isNotification ? (
                        <Bell size={12} className="text-indigo-500" />
                      ) : isInfo ? (
                        <Megaphone size={12} className="text-cyan-500" />
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
                    ? 'bg-teal-500/55'
                    : row.status === 'done'
                      ? 'bg-emerald-500/70'
                      : row.status === 'in_progress'
                        ? 'bg-blue-500/70'
                        : row.status === 'blocked'
                          ? 'bg-red-500/70'
                          : 'bg-cyan-500/50';

              return (
                <div key={row.id} className="h-9 flex items-center relative">
                  <div
                    className={`absolute h-5 rounded-lg ${barColor} transition-all`}
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
  handleRef,
}) => {
  const [view, setView] = useState<PlannerView>('table');
  const [showAddPanel, setShowAddPanel] = useState(false);

  const { rows, addRow, updateRow, removeRow, duplicateRow, reorderRows } = useTimelineRows({
    plannedStart,
    plannedEnd,
    tasks,
    milestones,
    isPolish,
  });

  // Expose openAddPanel to parent via ref
  useEffect(() => {
    if (handleRef) {
      handleRef.current = {
        openAddPanel: () => setShowAddPanel(true),
      };
    }
  }, [handleRef]);

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
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-navy-800/60 w-fit">
        <button
          onClick={() => setView('table')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            view === 'table'
              ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Table2 size={13} />
          {isPolish ? 'Tabela' : 'Table'}
        </button>
        <button
          onClick={() => setView('gantt')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            view === 'gantt'
              ? 'bg-white dark:bg-navy-700 text-slate-700 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Play size={10} className="text-blue-500" />
          {stats.tasks} {isPolish ? 'zadań' : 'tasks'}
        </span>
        {stats.milestones > 0 && (
          <span className="flex items-center gap-1">
            <Flag size={10} className="text-purple-500" />
            {stats.milestones} {isPolish ? 'kamieni' : 'milestones'}
          </span>
        )}
        {stats.decisions > 0 && (
          <span className="flex items-center gap-1">
            <Gavel size={10} className="text-amber-500" />
            {stats.decisions} {isPolish ? 'decyzji' : 'decisions'}
          </span>
        )}
        {stats.events > 0 && (
          <span className="flex items-center gap-1">
            <Megaphone size={10} className="text-cyan-500" />
            {stats.events} {isPolish ? 'zdarzeń' : 'events'}
          </span>
        )}
        {stats.notifications > 0 && (
          <span className="flex items-center gap-1">
            <Bell size={10} className="text-indigo-500" />
            {stats.notifications} {isPolish ? 'notyfikacji' : 'notifications'}
          </span>
        )}
        {stats.pauses > 0 && (
          <span className="flex items-center gap-1">
            <PauseCircle size={10} className="text-slate-500" />
            {stats.pauses} {isPolish ? 'pauz' : 'pauses'}
          </span>
        )}
        {stats.totalHours > 0 && (
          <span className="flex items-center gap-1">
            <Clock size={10} className="text-slate-400" />
            {stats.totalHours}h {isPolish ? 'planowane' : 'planned'}
          </span>
        )}
        {stats.totalDays !== null && (
          <span>
            {stats.totalDays} {isPolish ? 'dni łącznie' : 'total days'}
          </span>
        )}
      </div>
    </div>
  );
};
