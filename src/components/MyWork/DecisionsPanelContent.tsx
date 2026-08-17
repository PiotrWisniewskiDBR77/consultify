/**
 * DecisionsPanelContent - Professional decision table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 */

import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  DollarSign,
  Edit2,
  FolderKanban,
  Link2,
  Loader2,
  type LucideIcon,
  Scale,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from '@/components/shared/ModuleHub/ActiveFilters';
import { type RowActionSection } from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { ErrorState, LoadingState } from '@/components/ui/primitives';
import {
  DueChip,
  EntityStatusChip,
  MetaChip,
  PriorityChip,
  type PriorityLevel,
} from '@/components/ui/primitives/chips';
import {
  DECISION_STATUS_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
} from '@/components/ui/ResizableTable';
import i18n from '@/i18n';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { getArtifactPath } from '@/utils/artifactLinks';

import {
  type DecisionBrief,
  DecisionPreviewBody,
  type DecisionPreviewData,
  DecisionPreviewFooter,
  type DecisionPreviewMode,
  type DecisionSnoozePreset,
} from './DecisionPreviewPanel';
import { DelegationModal } from './shared/DelegationModal';

// CB-04/RB-020 — one canonical, finality-aware timing model shared by the
// Decisions table (DecisionsPanelContent) and Kanban (DecisionsKanbanBoard)
// views. Previously each view re-implemented `isOverdue`/`daysWaiting`
// independently: the table gated overdue on `status === 'PENDING'` only
// (never ESCALATED, which is also un-decided and can be overdue), and the
// "days waiting" label used `createdAt` unconditionally, so an already
// decided item kept counting days "waiting" forever instead of reporting
// how long ago it was decided.
//
// Kept local to this file (rather than a shared ./decisionTiming module) so
// it has no dependency outside this file's recovery scope.

/** A decision is final once it has an outcome recorded; PENDING/ESCALATED are still awaiting one. */
function isDecisionFinal(status: string | undefined): boolean {
  const s = status?.toUpperCase();
  return s === 'APPROVED' || s === 'REJECTED' || s === 'DEFERRED';
}

/**
 * A decision can only be "overdue" while it is still awaiting an outcome.
 * Gated on non-final status (PENDING or ESCALATED), not on PENDING alone.
 */
function isDecisionOverdue(
  dueDateStr: string | undefined,
  status: string | undefined,
  now: number = Date.now()
): boolean {
  if (!dueDateStr) return false;
  if (isDecisionFinal(status)) return false;
  const due = new Date(dueDateStr);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return due < today;
}

interface DecisionWaitDescriptor {
  /** Number of days between the reference instant and the relevant timestamp. */
  days: number;
  /** Whether this describes time waited-for-a-decision (open) or time-since-decided (final). */
  kind: 'waiting' | 'decided';
}

/**
 * Finality-aware "days" descriptor: open decisions report days waited since
 * creation; final decisions report days since `decidedAt` (falling back to
 * `createdAt` only if `decidedAt` is missing, since it must still resolve
 * to *some* value while the domain contract remains free to be filled in).
 */
function describeDecisionDays(
  decision: { status: string | undefined; createdAt: string; decidedAt?: string },
  now: number = Date.now()
): DecisionWaitDescriptor {
  if (isDecisionFinal(decision.status)) {
    const ref = decision.decidedAt || decision.createdAt;
    const refTime = new Date(ref).getTime();
    const days = Number.isNaN(refTime)
      ? 0
      : Math.max(0, Math.floor((now - refTime) / (1000 * 60 * 60 * 24)));
    return { days, kind: 'decided' };
  }
  const createdTime = new Date(decision.createdAt).getTime();
  const days = Number.isNaN(createdTime)
    ? 0
    : Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
  return { days, kind: 'waiting' };
}

type ViewMode = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface Decision {
  id: string;
  title: string;
  description?: string;
  decisionType?: string;
  type?: string;
  status: string;
  decisionOwnerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRole?: string;
  requestedById?: string;
  requestedByName?: string;
  projectId?: string;
  projectName?: string;
  priority?: string;
  createdAt: string;
  dueDate?: string;
  deadline?: string;
  daysWaiting?: number;
  daysUntilDue?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  // Response fields for decided items
  answer?: 'APPROVED' | 'REJECTED' | 'DEFERRED';
  decidedAt?: string;
  decidedByName?: string;
  rationale?: string;
  // Escalation tracking
  escalatedAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
}

interface DecisionCounts {
  total: number;
  my: number;
  awaiting: number;
}

export type DecisionsBulkBarPayload = {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  selectAllVisible: () => void;
  clearSelection: () => void;
  // Context actions (rendered in Command Row)
  approve?: () => void;
  reject?: () => void;
  deleteSelected?: () => void;
  changePriority?: () => void;
  remind?: () => void;
  escalate?: () => void;
  snoozeTomorrow?: () => void;
} | null;

interface DecisionsPanelContentProps {
  viewMode: ViewMode;
  priorityFilter?: DecisionPriorityFilter;
  searchQuery: string;
  onDecisionClick?: (id: string, decisionData?: Decision) => void;
  onCountsChange: (counts: DecisionCounts) => void;
  refreshTrigger?: number;
  /** V3-A03: bulk selection lives in MyWorkHub command row */
  onBulkBarChange?: (payload: DecisionsBulkBarPayload) => void;
}

// Priority raw → canonical PriorityChip level (dot carries the only color).
const priorityLevel = (priority?: string): PriorityLevel => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return 'urgent';
    case 'HIGH':
      return 'high';
    case 'LOW':
      return 'low';
    case 'MEDIUM':
    default:
      return 'medium';
  }
};

const priorityLabel = (priority: string | undefined, isPolish: boolean): string => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return i18n.t('myWork.decisionsPanel.critical', 'Critical');
    case 'HIGH':
      return i18n.t('myWork.decisionsPanel.high', 'High');
    case 'LOW':
      return i18n.t('myWork.decisionsPanel.low', 'Low');
    case 'MEDIUM':
    default:
      return i18n.t('myWork.decisionsPanel.medium', 'Medium');
  }
};

/**
 * FALA 1 / „surowe identyfikatory w UI" (2026-07-27): kolumna TYPE pokazywała
 * gołe enumy bazy — `APPROVAL` (wielkie) obok `general` (małe) w tej samej
 * kolumnie. Enum to nie etykieta. Słownik odwzorowuje ten z
 * `Initiatives/sections/DecisionsSection.tsx`, a typ spoza słownika jest
 * humanizowany (`SCOPE_CHANGE` → „Scope change"), nie wypisywany surowo.
 */
const DECISION_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  APPROVAL: { en: 'Approval', pl: 'Zatwierdzenie' },
  INITIATIVE_APPROVAL: { en: 'Initiative approval', pl: 'Zatwierdzenie inicjatywy' },
  BUDGET_APPROVAL: { en: 'Budget approval', pl: 'Zatwierdzenie budżetu' },
  GO_NO_GO: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  GOVERNANCE_DECISION_MAKING: { en: 'Go/No-Go', pl: 'Go/No-Go' },
  RESOURCE_ALLOCATION: { en: 'Resource allocation', pl: 'Alokacja zasobów' },
  RESOURCE_RESPONSIBILITY: { en: 'Resources commit', pl: 'Zobowiązanie zasobów' },
  SCHEDULE_MILESTONES: { en: 'Schedule lock', pl: 'Blokada harmonogramu' },
  SCOPE_CHANGE: { en: 'Scope change', pl: 'Zmiana zakresu' },
  SCOPE: { en: 'Scope', pl: 'Zakres' },
  RISK_ACCEPTANCE: { en: 'Risk acceptance', pl: 'Akceptacja ryzyka' },
  RISK: { en: 'Risk', pl: 'Ryzyko' },
  TECH: { en: 'Technical', pl: 'Techniczna' },
  TECHNICAL: { en: 'Technical', pl: 'Techniczna' },
  GOVERNANCE: { en: 'Governance', pl: 'Nadzór' },
  BUDGET: { en: 'Budget', pl: 'Budżet' },
  PHASE_TRANSITION: { en: 'Phase transition', pl: 'Przejście fazy' },
  TASK_UNBLOCK: { en: 'Unblock task', pl: 'Odblokowanie zadania' },
  UNBLOCK: { en: 'Unblock', pl: 'Odblokowanie' },
  EXCEPTION: { en: 'Exception', pl: 'Odstępstwo' },
  STRATEGIC: { en: 'Strategic', pl: 'Strategiczna' },
  EXECUTION: { en: 'Execution', pl: 'Wykonawcza' },
  GENERAL: { en: 'General', pl: 'Ogólna' },
  OTHER: { en: 'Other', pl: 'Inna' },
};

/** Czytelna nazwa typu decyzji — nigdy surowy enum. */
const decisionTypeLabel = (
  raw: string | undefined | null,
  isPolish: boolean,
  fallback: string
): string => {
  const key = String(raw || '')
    .trim()
    .toUpperCase();
  if (!key) return fallback;
  const known = DECISION_TYPE_LABELS[key];
  if (known) return isPolish ? known.pl : known.en;
  const words = key.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Distinct icon per decision type (dot/icon carries the type signal).
const getDecisionTypeIcon = (type?: string): LucideIcon => {
  switch (type?.toUpperCase()) {
    case 'SCOPE':
      return Target;
    case 'RISK':
      return AlertTriangle;
    case 'TECH':
    case 'TECHNICAL':
      return Cpu;
    case 'APPROVAL':
      return CheckCircle2;
    case 'GOVERNANCE':
      return Shield;
    case 'BUDGET':
      return DollarSign;
    default:
      return Scale;
  }
};

const statusLabel = (status: string | undefined, t: TFunction): string => {
  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return t('myWork.decisionsPanel.approved', 'Approved');
    case 'REJECTED':
      return t('myWork.decisionsPanel.rejected', 'Rejected');
    case 'DEFERRED':
      return t('myWork.decisionsPanel.deferred', 'Deferred');
    case 'ESCALATED':
      return t('myWork.decisionsPanel.escalated', 'Escalated');
    case 'PENDING':
    default:
      return t('myWork.decisionsPanel.pending', 'Pending');
  }
};

// Date formatting
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `${diffDays}d left`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Overdue/waiting timing is derived from the shared, finality-aware
// `decisionTiming` module (isDecisionOverdue/describeDecisionDays) so this
// table view and the Kanban view can never diverge — see RB-020.

const getInitials = (name?: string) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// canon TRIADA §27 — StandardTable columns. `statusFilter`/`priorityFilter`
// ids are synthetic lowercase mirrors of `status`/`priority` (added to each
// row alongside the real Decision fields — see `toTableRow` below) so
// FilterableTable's `row[column.id]` filter matching lines up with the
// lowercase DECISION_STATUS_FILTER_OPTIONS/PRIORITY_FILTER_OPTIONS values;
// the badge itself still renders from the real (case-preserved) field.
// Kebab (actions) and select checkbox are auto-appended by StandardTable.
const buildDecisionColumns = (
  t: TFunction,
  isPolish: boolean,
  viewMode: ViewMode
): TableColumn[] => [
  {
    id: 'title',
    label: t('myWork.decisionsPanel.columns.decision', 'Decision'),
    width: '560px',
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      return <span className="text-sm font-semibold text-c-text">{d.title}</span>;
    },
  },
  {
    // VISUAL_STANDARD.md §5.3 / VIS-008 — badges are never truncated:
    // column wide enough for full type labels (APPROVAL, STRATEGIC, …).
    id: 'type',
    label: t('myWork.decisionsPanel.columns.type', 'Type'),
    width: '130px',
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      const typeText = decisionTypeLabel(
        d.decisionType || d.type,
        isPolish,
        t('myWork.decisionsPanel.general', 'General')
      );
      return (
        <MetaChip
          icon={getDecisionTypeIcon(d.decisionType || d.type)}
          label={typeText}
          title={typeText}
        />
      );
    },
  },
  {
    id: 'statusFilter',
    label: t('myWork.decisionsPanel.columns.status', 'Status'),
    width: '130px',
    filterable: true,
    filterOptions: DECISION_STATUS_FILTER_OPTIONS,
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      return <EntityStatusChip status={d.status} label={statusLabel(d.status, t)} />;
    },
  },
  {
    id: 'priorityFilter',
    label: t('myWork.decisionsPanel.columns.priority', 'Priority'),
    width: '120px',
    filterable: true,
    filterOptions: PRIORITY_FILTER_OPTIONS,
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      return (
        <PriorityChip
          level={priorityLevel(d.priority)}
          label={priorityLabel(d.priority, isPolish)}
        />
      );
    },
  },
  {
    id: 'date',
    label: t('myWork.decisionsPanel.columns.dueDate', 'Due Date'),
    width: '130px',
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      const dueDate = d.dueDate || d.deadline;
      const overdue = isDecisionOverdue(dueDate, d.status);
      const daysDescriptor = describeDecisionDays(d);
      return dueDate ? (
        <DueChip label={formatDate(dueDate)} risk={overdue ? 'overdue' : 'none'} showIcon />
      ) : (
        <MetaChip
          icon={Clock}
          label={t(
            daysDescriptor.kind === 'decided'
              ? 'myWork.decisionsPanel.daysSinceDecided'
              : 'myWork.decisionsPanel.daysWaiting',
            { days: daysDescriptor.days }
          )}
        />
      );
    },
  },
  {
    id: 'project',
    label:
      viewMode === 'awaiting'
        ? t('myWork.decisionsPanel.owner', 'Owner')
        : t('myWork.decisionsPanel.project', 'Project'),
    width: '160px',
    render: (row: TableRow) => {
      const d = row as unknown as Decision;
      if (viewMode === 'awaiting') {
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised flex items-center justify-center text-xs font-medium text-c-text-secondary">
              {getInitials(d.ownerName)}
            </div>
            <div className="flex min-w-0 flex-col text-left">
              <span className="text-xs text-c-text truncate">
                {d.ownerName || (
                  <span className="italic text-c-text-muted">
                    {t('myWork.decisionsPanel.unassigned', 'Unassigned')}
                  </span>
                )}
              </span>
              {d.ownerRole && (
                <span className="text-[10px] text-c-text-muted truncate">{d.ownerRole}</span>
              )}
            </div>
          </div>
        );
      }
      return d.projectName ? (
        <div className="flex items-center gap-1.5 text-xs text-c-text-secondary">
          <FolderKanban size={12} />
          <span className="truncate max-w-[120px]">{d.projectName}</span>
        </div>
      ) : (
        <span className="text-xs text-c-text-muted">—</span>
      );
    },
  },
];

interface DecisionRowHandlers {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRemind: (id: string) => void;
  onEscalate: (id: string) => void;
  onClick?: (id: string, decisionData?: Decision) => void;
  onOpenFull?: (id: string, decisionData?: Decision) => void;
  onOpenPreview: (id: string) => void;
  onDelete: (id: string) => void;
}

// Kebab sections — §6.4 5-group anatomy (nawigacja+stan / manipulacja /
// relacje-wyjście / AI / destrukcyjne). Two variants (My decisions vs
// Awaiting others) differ only in group 1's status actions
// (Approve/Reject vs Remind/Escalate) — same shape as the previous
// DecisionTableRow/AwaitingDecisionTableRow `kebabSections` useMemo. Plain
// functions (not hooks) since StandardTable calls `rowActions(row)` directly.
const buildDecisionKebabSections = (
  decision: Decision,
  h: DecisionRowHandlers,
  t: TFunction,
  isPolish: boolean
): RowActionSection[] => {
  const dueDate = decision.dueDate || decision.deadline;
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  return [
    // ── §6.4 grupa 1: NAWIGACJA (Otwórz/Podgląd) + akcje stanu (Approve/Reject) ──
    {
      id: 'open',
      kind: 'open',
      actions: [
        {
          id: 'open',
          label: t('myWork.decisionsPanel.label', 'Open preview'),
          icon: ChevronRight,
          onClick: () => h.onOpenPreview(decision.id),
        },
        ...(isPending
          ? [
              {
                id: 'approve',
                label: t('myWork.decisionsPanel.label2', 'Approve'),
                icon: Check,
                onClick: () => h.onApprove(decision.id),
              },
              {
                id: 'reject',
                label: t('myWork.decisionsPanel.label3', 'Reject'),
                icon: X,
                variant: 'danger' as const,
                onClick: () => h.onReject(decision.id),
              },
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 2: MANIPULACJA (Edytuj) ─────────────────────────────────────
    {
      id: 'manage',
      kind: 'manage',
      actions: [
        {
          id: 'edit',
          label: t('myWork.decisionsPanel.label4', 'Edit'),
          icon: Edit2,
          onClick: () =>
            h.onOpenFull?.(decision.id, decision) ?? h.onClick?.(decision.id, decision),
        },
      ],
    },
    // ── §6.4 grupa 3: RELACJE/WYJŚCIE (Kopiuj link · Odłóż termin) ─────────────
    {
      id: 'output',
      kind: 'output',
      actions: [
        {
          id: 'copy-link',
          label: t('myWork.decisionsPanel.label5', 'Copy link'),
          icon: Link2,
          onClick: () => {
            try {
              const url = `${window.location.origin}${getArtifactPath('decision', decision.id)}`;
              void navigator.clipboard?.writeText(url);
              toast.success(t('myWork.decisionsPanel.toastSuccess', 'Link copied'));
            } catch {
              /* clipboard unavailable */
            }
          },
        },
        ...(dueDate
          ? [
              {
                id: 'delay',
                label: t('myWork.decisionsPanel.label6', 'Delay'),
                icon: Clock,
                onClick: () => {},
                submenu: [1, 3, 7].map((d) => ({
                  id: `delay-${d}`,
                  label: t('myWork.decisionsPanel.delayDays', { count: d }),
                  icon: Clock,
                  disabled: true,
                  description: t('myWork.decisionsPanel.description', 'Coming soon (backend)'),
                  onClick: () => {},
                })),
              },
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 4: AI ──────────────────────────────────────────────────────
    {
      id: 'ai',
      kind: 'ai',
      actions: [
        {
          id: 'ai-open',
          label: t('myWork.decisionsPanel.label7', '✨ AI: open & fill'),
          icon: Sparkles,
          onClick: () =>
            h.onOpenFull?.(decision.id, decision) ?? h.onClick?.(decision.id, decision),
        },
      ],
    },
    // ── §6.4 grupa 5: DESTRUKCYJNE (Archiwizuj · Usuń — danger, ostatni) ───────
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'archive',
          label: t('myWork.decisionsPanel.label8', 'Archive'),
          icon: Archive,
          disabled: true,
          description: t('myWork.decisionsPanel.description2', 'Coming soon (backend)'),
          onClick: () => {},
        },
        {
          id: 'delete',
          label: t('myWork.decisionsPanel.label9', 'Delete'),
          icon: Trash2,
          variant: 'danger',
          onClick: () => h.onDelete(decision.id),
        },
      ],
    },
  ];
};

const buildAwaitingKebabSections = (
  decision: Decision,
  h: DecisionRowHandlers,
  t: TFunction,
  isPolish: boolean
): RowActionSection[] => {
  const dueDate = decision.dueDate || decision.deadline;
  const isPending = decision.status?.toUpperCase() === 'PENDING';
  const overdue = isDecisionOverdue(dueDate, decision.status);
  return [
    // ── §6.4 grupa 1: NAWIGACJA (Otwórz/Podgląd) + akcje stanu (Remind/Escalate) ──
    {
      id: 'open',
      kind: 'open',
      actions: [
        {
          id: 'open',
          label: t('myWork.decisionsPanel.label10', 'Open preview'),
          icon: ChevronRight,
          onClick: () => h.onOpenPreview(decision.id),
        },
        ...(isPending
          ? [
              {
                id: 'remind',
                label: t('myWork.decisionsPanel.label11', 'Send reminder'),
                icon: Bell,
                onClick: () => h.onRemind(decision.id),
              },
              {
                id: 'escalate',
                label: overdue
                  ? t('myWork.decisionsPanel.escalateUrgent')
                  : t('myWork.decisionsPanel.escalate'),
                icon: TrendingUp,
                variant: (overdue ? 'danger' : 'default') as 'danger' | 'default',
                onClick: () => h.onEscalate(decision.id),
              },
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 2: MANIPULACJA (Edytuj) ────────────────────────────────────
    {
      id: 'manage',
      kind: 'manage',
      actions: [
        {
          id: 'edit',
          label: t('myWork.decisionsPanel.label12', 'Edit'),
          icon: Edit2,
          onClick: () =>
            h.onOpenFull?.(decision.id, decision) ?? h.onClick?.(decision.id, decision),
        },
      ],
    },
    // ── §6.4 grupa 3: RELACJE/WYJŚCIE (Kopiuj link · Odłóż termin) ─────────────
    {
      id: 'output',
      kind: 'output',
      actions: [
        {
          id: 'copy-link',
          label: t('myWork.decisionsPanel.label13', 'Copy link'),
          icon: Link2,
          onClick: () => {
            try {
              const url = `${window.location.origin}${getArtifactPath('decision', decision.id)}`;
              void navigator.clipboard?.writeText(url);
              toast.success(t('myWork.decisionsPanel.toastSuccess2', 'Link copied'));
            } catch {
              /* clipboard unavailable */
            }
          },
        },
        ...(dueDate
          ? [
              {
                id: 'delay',
                label: t('myWork.decisionsPanel.label14', 'Delay'),
                icon: Clock,
                onClick: () => {},
                submenu: [1, 3, 7].map((d) => ({
                  id: `delay-${d}`,
                  label: t('myWork.decisionsPanel.delayDays', { count: d }),
                  icon: Clock,
                  disabled: true,
                  description: t('myWork.decisionsPanel.description3', 'Coming soon (backend)'),
                  onClick: () => {},
                })),
              },
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 4: AI ──────────────────────────────────────────────────────
    {
      id: 'ai',
      kind: 'ai',
      actions: [
        {
          id: 'ai-open',
          label: t('myWork.decisionsPanel.label15', '✨ AI: open & fill'),
          icon: Sparkles,
          onClick: () =>
            h.onOpenFull?.(decision.id, decision) ?? h.onClick?.(decision.id, decision),
        },
      ],
    },
    // ── §6.4 grupa 5: DESTRUKCYJNE (Archiwizuj · Usuń — danger, ostatni) ───────
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'archive',
          label: t('myWork.decisionsPanel.label16', 'Archive'),
          icon: Archive,
          disabled: true,
          description: t('myWork.decisionsPanel.description4', 'Coming soon (backend)'),
          onClick: () => {},
        },
        {
          id: 'delete',
          label: t('myWork.decisionsPanel.label17', 'Delete'),
          icon: Trash2,
          variant: 'danger',
          onClick: () => h.onDelete(decision.id),
        },
      ],
    },
  ];
};

export const DecisionsPanelContent: React.FC<DecisionsPanelContentProps> = ({
  viewMode,
  priorityFilter = 'all',
  searchQuery,
  onDecisionClick,
  onCountsChange,
  refreshTrigger,
  onBulkBarChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const { currentUser } = useAppStore();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewDecisionId, setPreviewDecisionId] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // canon TRIADA §27 — column widths/visibility/order + row-description
  // toggle are now owned by StandardTable itself (persistKey below); the
  // bespoke columnWidths/hiddenColumns/showRowDescription state + portal
  // ViewSettings popover this screen hand-rolled are gone. Column filters
  // (status/priority) stay CONTROLLED here (not left to StandardTable's own
  // uncontrolled state) so `displayedDecisions`/`orderedDecisionIds` — which
  // drive J/K keyboard nav and "select all visible" in the bulk bar — reflect
  // exactly what's on screen after a column filter is applied.
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  // Preview data (full details + brief)
  const [previewDecision, setPreviewDecision] = useState<DecisionPreviewData | null>(null);
  const [previewBrief, setPreviewBrief] = useState<DecisionBrief | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Preview — details kebab + AI strip (Inbox parity)
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const [delegationOpen, setDelegationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email?: string; avatar?: string }>
  >([]);

  // Fetch decisions
  const fetchDecisions = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getDecisions();
      setDecisions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
      const message = t(
        'myWork.decisionsPanel.toast.loadFailed',
        'Failed to load decisions'
      );
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions, refreshTrigger]);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await Api.getUsers();
      const mapped = (Array.isArray(users) ? users : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatar: u.avatar_url || u.avatarUrl || undefined,
      }));
      setAvailableUsers(mapped);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  const fetchPreview = useCallback(async (id: string) => {
    setPreviewLoading(true);
    try {
      const d = (await Api.getDecision(id)) as any;
      const normalized: DecisionPreviewData = {
        ...d,
        id: String(d?.id || id),
        title: String(d?.title || 'Decision'),
      };
      setPreviewDecision(normalized);
      try {
        const b = (await Api.get(`/my-work/decisions/${id}/brief`)) as any;
        setPreviewBrief(b && typeof b?.summary === 'string' ? (b as DecisionBrief) : null);
      } catch {
        setPreviewBrief(null);
      }
    } catch {
      setPreviewDecision(null);
      setPreviewBrief(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    setDetailsMenuOpen(false);
    setAiMenuOpen(false);
    setAiLoading(false);
    setAiError(null);
    setAiText(null);
    setDetailsLoading(false);
    setDetailsOverride(null);
    setSnoozeOpen(false);
    setDelegationOpen(false);

    if (!previewDecisionId) {
      setPreviewDecision(null);
      setPreviewBrief(null);
      return;
    }
    fetchPreview(previewDecisionId);
  }, [previewDecisionId, fetchPreview]);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    let result = decisions;
    const userId = currentUser?.id;

    const isMineToDecide = (d: Decision) => Boolean(userId) && d.decisionOwnerId === userId;
    const isMyRequest = (d: Decision) =>
      Boolean(userId) && d.requestedById === userId && d.decisionOwnerId !== userId;
    const isRelevantToMe = (d: Decision) => isMineToDecide(d) || isMyRequest(d);

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title?.toLowerCase().includes(query) || d.description?.toLowerCase().includes(query)
      );
    }

    // Filter by view mode
    if (viewMode === 'my') {
      result = result.filter(isMineToDecide);
    } else if (viewMode === 'awaiting') {
      result = result.filter(isMyRequest);
    } else {
      // "All" in My Work means "relevant to me" (union), not org-wide.
      result = result.filter(isRelevantToMe);
    }

    // Filter by priority (topbar filter)
    if (priorityFilter !== 'all') {
      result = result.filter(
        (d) => String(d.priority || 'MEDIUM').toUpperCase() === String(priorityFilter).toUpperCase()
      );
    }

    // Sort by priority and due date
    const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    result.sort((a, b) => {
      // Pending first
      const aP = a.status?.toUpperCase() === 'PENDING' ? 0 : 1;
      const bP = b.status?.toUpperCase() === 'PENDING' ? 0 : 1;
      if (aP !== bP) return aP - bP;

      // Then by priority
      const ap = priorityOrder[a.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
      const bp = priorityOrder[b.priority?.toUpperCase() || 'MEDIUM'] ?? 2;
      if (ap !== bp) return ap - bp;

      // Then by due date
      const ad = a.dueDate || a.deadline;
      const bd = b.dueDate || b.deadline;
      if (ad && bd) return new Date(ad).getTime() - new Date(bd).getTime();
      return 0;
    });

    return result;
  }, [decisions, searchQuery, viewMode, priorityFilter, currentUser?.id]);

  // Calculate counts
  useEffect(() => {
    const userId = currentUser?.id;
    const isOpen = (d: Decision) =>
      ['PENDING', 'ESCALATED'].includes(String(d.status || '').toUpperCase());
    const myCount = decisions.filter(
      (d) => userId && d.decisionOwnerId === userId && isOpen(d)
    ).length;
    const awaitingCount = decisions.filter(
      (d) => userId && d.requestedById === userId && d.decisionOwnerId !== userId && isOpen(d)
    ).length;
    onCountsChange({
      total: myCount + awaitingCount,
      my: myCount,
      awaiting: awaitingCount,
    });
  }, [decisions, currentUser?.id, onCountsChange]);

  // Handlers
  const openPreview = (decisionId: string) => setPreviewDecisionId(decisionId);

  const handleApprove = async (id: string) => {
    try {
      await Api.decideDecision(id, 'approved');
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'APPROVED' } : d)));
      toast.success(t('myWork.decisionsPanel.toast.approved', 'Decision approved'));
    } catch (error) {
      toast.error(t('myWork.decisionsPanel.toast.approveFailed', 'Failed to approve decision'));
    }
  };

  const handleDeleteDecision = async (id: string) => {
    const confirmMsg = t(
      'myWork.decisionsPanel.deleteThisDecisionThis',
      'Delete this decision? This cannot be undone.'
    );
    if (!window.confirm(confirmMsg)) return;
    try {
      await Api.delete(`/decisions/${id}`);
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      if (previewDecisionId === id) setPreviewDecisionId(null);
      toast.success(t('myWork.decisionsPanel.toastSuccess3', 'Decision deleted'));
    } catch {
      toast.error(t('myWork.decisionsPanel.toastError', 'Failed to delete decision'));
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.decideDecision(id, 'rejected');
      setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'REJECTED' } : d)));
      toast.success(t('myWork.decisionsPanel.toast.rejected', 'Decision rejected'));
    } catch (error) {
      toast.error(t('myWork.decisionsPanel.toast.rejectFailed', 'Failed to reject decision'));
    }
  };

  // Handler for sending reminder (Awaiting Others view)
  const handleRemind = async (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;

    try {
      await Api.remindDecision(id);

      // Update reminder count locally
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                reminderCount: (d.reminderCount || 0) + 1,
                lastReminderAt: new Date().toISOString(),
              }
            : d
        )
      );

      toast.success(
        t('myWork.decisionsPanel.toast.reminderSent', 'Reminder sent to {{owner}}', {
          owner:
            decision.ownerName || t('myWork.decisionsPanel.toast.decisionOwner', 'decision owner'),
        })
      );
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error(t('myWork.decisionsPanel.toast.reminderFailed', 'Failed to send reminder'));
    }
  };

  // Handler for escalating decision (Awaiting Others view)
  const handleEscalate = async (id: string) => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;

    try {
      // Update decision status to ESCALATED
      await Api.escalateDecision(id, 'Manual escalation from decisions panel');

      // Create an escalation notification
      await Api.post('/api/notifications', {
        type: 'DECISION_ESCALATION',
        title: `Escalation: ${decision.title}`,
        message: `Decision "${decision.title}" has been escalated by ${currentUser?.displayName || currentUser?.firstName || 'a team member'}. Immediate attention required.`,
        severity: 'CRITICAL',
        userId: decision.decisionOwnerId,
        relatedObjectType: 'DECISION',
        relatedObjectId: id,
      });

      // Update local state
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: 'ESCALATED',
                escalatedAt: new Date().toISOString(),
              }
            : d
        )
      );

      toast.success(
        t(
          'myWork.decisionsPanel.toast.escalated',
          'Decision escalated - {{owner}} has been notified',
          { owner: decision.ownerName || t('myWork.decisionsPanel.toast.owner', 'owner') }
        )
      );
    } catch (error) {
      console.error('Failed to escalate decision:', error);
      toast.error(t('myWork.decisionsPanel.toast.escalateFailed', 'Failed to escalate decision'));
    }
  };

  const handlePreviewDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy') => {
      const d = previewDecision;
      if (!d) return;
      const base = String(detailsOverride ?? d.description ?? '').trim();
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(base || d.title || '');
          toast.success(t('myWork.decisionsPanel.toastSuccess4', 'Copied'));
        } catch {
          toast.error(t('myWork.decisionsPanel.toastError2', 'Copy failed'));
        } finally {
          setDetailsMenuOpen(false);
        }
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsMenuOpen(false);
        const language = t('myWork.decisionsPanel.en', 'en');
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only the provided decision text/context.`,
          `Return plain text only (no markdown).`,
        ].join('\n');

        const mode = action === 'expand' ? 'expand' : 'shorten';
        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: base || d.title,
          mode,
          systemInstruction,
          fieldLabel: 'Decision details (preview)',
          artifactContext: {
            id: d.id,
            title: d.title,
            type: 'decision',
            status: d.status || 'pending',
            priority: d.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (text) setDetailsOverride(text);
      } catch {
        toast.error(t('myWork.decisionsPanel.toastError3', 'AI unavailable'));
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsOverride, isPolish, previewDecision]
  );

  type DecisionAiIntent = 'summarize_context' | 'propose_options' | 'assess_risk';
  const lastAiIntentRef = React.useRef<DecisionAiIntent>('summarize_context');

  const runPreviewAi = useCallback(
    async (intent: DecisionAiIntent) => {
      const d = previewDecision;
      if (!d) return;
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const language = t('myWork.decisionsPanel.en2', 'en');
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only provided decision fields.`,
          `Return plain text. No markdown.`,
          `Keep it concise (3–6 short sentences or bullets).`,
          `Intent: ${intent}`,
        ].join('\n');
        const seed = [
          `[GENERATE FROM SCRATCH]`,
          `Decision: ${d.title || 'Decision'}`,
          `Type: ${d.decisionType || d.type || ''}`,
          `Project: ${d.projectName || ''}`,
          `Status: ${d.status || ''}`,
          `Priority: ${d.priority || ''}`,
          `Due date: ${d.dueDate || ''}`,
          `Description: ${String(d.description || '').trim()}`,
        ]
          .filter(Boolean)
          .join('\n');

        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: seed,
          mode: 'generate',
          systemInstruction,
          fieldLabel: 'Decision preview AI',
          artifactContext: {
            id: d.id,
            title: d.title,
            type: 'decision',
            status: d.status || 'pending',
            priority: d.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(t('myWork.decisionsPanel.setAiError', 'AI unavailable'));
      } finally {
        setAiLoading(false);
      }
    },
    [isPolish, previewDecision]
  );

  const handleCopyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      toast.success(t('myWork.decisionsPanel.toastSuccess5', 'Copied'));
    } catch {
      toast.error(t('myWork.decisionsPanel.toastError4', 'Copy failed'));
    } finally {
      setAiMenuOpen(false);
    }
  }, [aiText, isPolish]);

  const handleClearAi = useCallback(() => {
    setAiText(null);
    setAiError(null);
    setAiMenuOpen(false);
  }, []);

  const handleRegenerateAi = useCallback(() => {
    setAiMenuOpen(false);
    void runPreviewAi(lastAiIntentRef.current || 'summarize_context');
  }, [runPreviewAi]);

  const handlePreviewSnooze = useCallback(
    async (preset: DecisionSnoozePreset) => {
      const id = previewDecisionId;
      if (!id) return;
      try {
        await Api.snoozeDecision(id, { preset });
        toast.success(t('myWork.decisionsPanel.toastSuccess6', 'Snoozed'));
        setPreviewDecisionId(null);
        fetchDecisions();
      } catch {
        toast.error(t('myWork.decisionsPanel.toastError5', 'Failed to snooze'));
      }
    },
    [fetchDecisions, isPolish, previewDecisionId]
  );

  // Selection handlers
  const handleSelectDecision = (decisionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(decisionId)) {
        next.delete(decisionId);
      } else {
        next.add(decisionId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(allVisibleDecisionIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Column resize handler
  // Bulk actions
  const handleBulkApprove = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.decideDecision(id, 'approved')));
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, status: 'APPROVED' } : d))
      );
      toast.success(
        t('myWork.decisionsPanel.toast.bulkApproved', '{{count}} decisions approved', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(
        t('myWork.decisionsPanel.toast.bulkApproveFailed', 'Failed to approve decisions')
      );
    }
  };

  const handleBulkReject = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.decideDecision(id, 'rejected')));
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, status: 'REJECTED' } : d))
      );
      toast.success(
        t('myWork.decisionsPanel.toast.bulkRejected', '{{count}} decisions rejected', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.decisionsPanel.toast.bulkRejectFailed', 'Failed to reject decisions'));
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.delete(`/decisions/${id}`)));
      setDecisions((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      toast.success(
        t('myWork.decisionsPanel.toast.bulkDeleted', '{{count}} decisions deleted', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(t('myWork.decisionsPanel.toast.bulkDeleteFailed', 'Failed to delete decisions'));
    }
  };

  const handleBulkRemind = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.remindDecision(id)));
      toast.success(
        t('myWork.decisionsPanel.toast.bulkRemindersSent', '{{count}} reminders sent', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.decisionsPanel.toast.bulkRemindersFailed', 'Failed to send reminders'));
    }
  };

  const handleBulkEscalate = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.escalateDecision(id, 'Bulk escalation from decisions list')
        )
      );
      toast.success(
        t('myWork.decisionsPanel.toast.bulkEscalated', '{{count}} decisions escalated', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
      fetchDecisions();
    } catch {
      toast.error(
        t('myWork.decisionsPanel.toast.bulkEscalateFailed', 'Failed to escalate decisions')
      );
    }
  };

  const handleBulkSnoozeTomorrow = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => Api.snoozeDecision(id, { preset: 'tomorrow' }))
      );
      toast.success(
        t('myWork.decisionsPanel.toast.bulkSnoozed', '{{count}} decisions snoozed', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
      fetchDecisions();
    } catch {
      toast.error(t('myWork.decisionsPanel.toast.bulkSnoozeFailed', 'Failed to snooze decisions'));
    }
  };

  // Create bulk action configuration
  const handleBulkChangePriority = async () => {
    const newPriority = prompt(
      t(
        'myWork.decisionsPanel.toast.bulkPriorityPrompt',
        'Set priority for selected decisions (LOW / MEDIUM / HIGH / CRITICAL):'
      )
    );
    if (!newPriority || !['low', 'medium', 'high', 'critical'].includes(newPriority.toLowerCase()))
      return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.updateDecision(id, { priority: newPriority.toUpperCase() })
        )
      );
      setDecisions((prev) =>
        prev.map((d) => (selectedIds.has(d.id) ? { ...d, priority: newPriority.toUpperCase() } : d))
      );
      toast.success(
        t(
          'myWork.decisionsPanel.toast.bulkPrioritySet',
          'Priority set to {{priority}} for {{count}} decisions',
          {
            priority: newPriority.toUpperCase(),
            count: selectedIds.size,
          }
        )
      );
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.decisionsPanel.toast.bulkPriorityFailed', 'Failed to update priority'));
    }
  };

  // Apply the StandardTable column filters (status/priority — controlled via
  // `activeFilters`, kanon TRIADA §27) to decisions. `statusFilter`/
  // `priorityFilter` are the synthetic lowercase column ids from
  // `buildDecisionColumns` (see `toTableRow` below) — map back to the real
  // `status`/`priority` fields here.
  const displayedDecisions = useMemo(() => {
    if (!activeFilters.length) return filteredDecisions;
    const byColumn = activeFilters.reduce<Record<string, string[]>>((acc, f) => {
      (acc[f.column] ||= []).push(f.value);
      return acc;
    }, {});
    return filteredDecisions.filter((d) =>
      Object.entries(byColumn).every(([column, values]) => {
        if (column === 'statusFilter') return values.includes(d.status?.toLowerCase() || '');
        if (column === 'priorityFilter')
          return values.includes(d.priority?.toLowerCase() || 'medium');
        return true;
      })
    );
  }, [filteredDecisions, activeFilters]);

  // StandardTable `data` — decisions plus the synthetic lowercase filter
  // fields the `statusFilter`/`priorityFilter` columns key off.
  const tableRows = useMemo<TableRow[]>(
    () =>
      displayedDecisions.map((d) => ({
        ...d,
        statusFilter: (d.status || '').toLowerCase(),
        priorityFilter: (d.priority || 'MEDIUM').toLowerCase(),
      })) as unknown as TableRow[],
    [displayedDecisions]
  );

  const decisionColumns = useMemo(
    () => buildDecisionColumns(t, !!isPolish, viewMode),
    [t, isPolish, viewMode]
  );

  const orderedDecisionIds = useMemo(
    () => displayedDecisions.map((d) => d.id),
    [displayedDecisions]
  );

  const allVisibleDecisionIds = useMemo(() => new Set(orderedDecisionIds), [orderedDecisionIds]);
  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleDecisionIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleDecisionIds.size;

  // V3-A03: bulk selection lives as a mode of the single command row (parent)
  useEffect(() => {
    if (!onBulkBarChange) return;
    if (selectedIds.size === 0) {
      onBulkBarChange(null);
      return;
    }

    const base = {
      selectedCount: selectedIds.size,
      allSelected,
      someSelected,
      selectAllVisible: () => handleSelectAll(true),
      clearSelection: handleClearSelection,
    } as const;

    if (viewMode === 'awaiting') {
      onBulkBarChange({
        ...base,
        remind: handleBulkRemind,
        escalate: handleBulkEscalate,
        snoozeTomorrow: handleBulkSnoozeTomorrow,
      });
      return;
    }

    onBulkBarChange({
      ...base,
      approve: handleBulkApprove,
      reject: handleBulkReject,
      deleteSelected: handleBulkDelete,
      changePriority: handleBulkChangePriority,
    });
  }, [
    onBulkBarChange,
    selectedIds.size,
    allSelected,
    someSelected,
    viewMode,
    handleSelectAll,
    handleClearSelection,
    handleBulkApprove,
    handleBulkReject,
    handleBulkDelete,
    handleBulkChangePriority,
    handleBulkRemind,
    handleBulkEscalate,
    handleBulkSnoozeTomorrow,
  ]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <ErrorState
          title={loadError}
          message={t(
            'myWork.decisionsPanel.loadErrorHint',
            'Check your connection and try again.'
          )}
          retry={() => void fetchDecisions()}
          className="h-full"
        />
      </div>
    );
  }

  if (displayedDecisions.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 />}
        title={
          viewMode === 'my'
            ? 'No decisions awaiting your action'
            : viewMode === 'awaiting'
              ? 'No requests pending'
              : 'No decisions'
        }
        description="All caught up!"
        className="h-full"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <div className="flex-1 min-h-0">
        <TableWithPreviewLayout<Decision>
          selectedId={previewDecisionId}
          selectedItem={
            previewDecisionId
              ? displayedDecisions.find((d) => d.id === previewDecisionId) || null
              : null
          }
          onSelect={setPreviewDecisionId}
          previewOpen={Boolean(previewDecisionId)}
          autoOpenPreview={false}
          onOpenFull={(id) => {
            const full = decisions.find((d) => d.id === id);
            onDecisionClick?.(id, full);
            setPreviewDecisionId(null);
          }}
          itemIds={orderedDecisionIds}
          getItemById={(id) => displayedDecisions.find((x) => x.id === id) ?? null}
          renderPreview={(item) => {
            const decisionData = (previewDecision || (item as any)) as DecisionPreviewData;
            if (previewLoading) {
              return (
                <div className="flex items-center gap-2 text-sm text-c-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('myWork.decisionsPanel.loading', 'Loading…')}</span>
                </div>
              );
            }
            return (
              <DecisionPreviewBody
                decision={decisionData}
                brief={previewBrief}
                isPolish={isPolish}
                detailsOverride={detailsOverride}
                detailsLoading={detailsLoading}
                detailsMenuOpen={detailsMenuOpen}
                onToggleDetailsMenu={() => setDetailsMenuOpen((v) => !v)}
                onCloseDetailsMenu={() => setDetailsMenuOpen(false)}
                onDetailsAction={(a) => void handlePreviewDetailsAction(a)}
              />
            );
          }}
          renderPreviewFooter={(item) => {
            const decisionData = (previewDecision || (item as any)) as DecisionPreviewData;
            const mode: DecisionPreviewMode =
              viewMode === 'awaiting' ? 'requests_pending' : viewMode === 'my' ? 'my' : 'all';
            const meId = currentUser?.id ? String(currentUser.id) : null;
            const ownerId = decisionData?.decisionOwnerId
              ? String(decisionData.decisionOwnerId)
              : null;
            const canAct =
              mode !== 'requests_pending' && Boolean(meId && ownerId && meId === ownerId);
            return (
              <DecisionPreviewFooter
                decision={decisionData}
                mode={mode}
                canAct={canAct}
                isPolish={isPolish}
                aiText={aiText}
                aiError={aiError}
                aiLoading={aiLoading}
                aiMenuOpen={aiMenuOpen}
                onToggleAiMenu={() => setAiMenuOpen((v) => !v)}
                onCloseAiMenu={() => setAiMenuOpen(false)}
                onRunAi={(intent) => void runPreviewAi(intent as any)}
                onCopyAi={() => void handleCopyAi()}
                onClearAi={handleClearAi}
                onRegenerateAi={handleRegenerateAi}
                onApprove={async () => {
                  if (!previewDecisionId) return;
                  await handleApprove(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onReject={async () => {
                  if (!previewDecisionId) return;
                  await handleReject(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onDelegate={async () => {
                  await fetchUsers();
                  setDelegationOpen(true);
                }}
                onRemind={async () => {
                  if (!previewDecisionId) return;
                  await handleRemind(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                onEscalate={async () => {
                  if (!previewDecisionId) return;
                  await handleEscalate(previewDecisionId);
                  await fetchPreview(previewDecisionId);
                }}
                snoozeOpen={snoozeOpen}
                onToggleSnooze={() => setSnoozeOpen((v) => !v)}
                onCloseSnooze={() => setSnoozeOpen(false)}
                onSnooze={(preset) => {
                  setSnoozeOpen(false);
                  void handlePreviewSnooze(preset);
                }}
                onOpenLinkedDecision={(linkedId) => {
                  onDecisionClick?.(
                    linkedId,
                    decisions.find((d) => d.id === linkedId)
                  );
                  setPreviewDecisionId(null);
                }}
              />
            );
          }}
        >
          <div className="p-4 pt-3">
            <StandardTable
              columns={decisionColumns}
              data={tableRows}
              selectedRowId={previewDecisionId}
              onRowClick={(row) => openPreview(String(row.id))}
              onRowDoubleClick={(row) => {
                const full = decisions.find((d) => d.id === row.id);
                onDecisionClick?.(String(row.id), full);
                setPreviewDecisionId(null);
              }}
              rowActions={(row) => {
                const decision = row as unknown as Decision;
                const handlers: DecisionRowHandlers = {
                  onApprove: handleApprove,
                  onReject: handleReject,
                  onRemind: handleRemind,
                  onEscalate: handleEscalate,
                  onClick: (id, data) => openPreview(id),
                  onOpenFull: (id, data) => {
                    onDecisionClick?.(id, data);
                    setPreviewDecisionId(null);
                  },
                  onOpenPreview: (id) => openPreview(id),
                  onDelete: (id) => void handleDeleteDecision(id),
                };
                return viewMode === 'awaiting'
                  ? buildAwaitingKebabSections(decision, handlers, t, !!isPolish)
                  : buildDecisionKebabSections(decision, handlers, t, !!isPolish);
              }}
              rowDescription={(row) => (row as unknown as Decision).description}
              selection={{ selectedIds, onChange: setSelectedIds }}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              persistKey="mywork.decisions.list"
            />
          </div>
        </TableWithPreviewLayout>
      </div>

      {/* Delegation modal (preview action) */}
      {previewDecisionId && previewDecision ? (
        <DelegationModal
          isOpen={delegationOpen}
          onClose={() => setDelegationOpen(false)}
          decisionId={previewDecisionId}
          decisionTitle={String(previewDecision?.title || '')}
          availableUsers={availableUsers}
          currentDeciderId={String(
            (previewDecision as any)?.deciderId || previewDecision.decisionOwnerId || ''
          )}
          onDelegated={() => {
            fetchDecisions();
            void fetchPreview(previewDecisionId);
          }}
        />
      ) : null}
    </div>
  );
};

export default DecisionsPanelContent;
