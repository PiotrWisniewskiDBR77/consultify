/**
 * MyTasksListContent - Professional task table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 *
 * Scope: personal tasks — renders the current user's personal tasks served by the
 * canonical `/my-work/personal-tasks` endpoint (org + assignee scoped). By default
 * the terminal statuses `done/completed/validated` are de-prioritised (sorted to the
 * bottom) but remain available in "All" so a completed transition has a cold-readback
 * surface instead of disappearing immediately after success.
 */

import { AnimatePresence, motion } from 'framer-motion';
import i18n from 'i18next';
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Clock,
  Edit,
  Eye,
  Inbox,
  Link2,
  Loader2,
  Minus,
  Pause,
  Plus,
  Sparkles,
  Square,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type TableSettingsColumn,
  TableSettingsPopover,
} from '@/components/shared/ModuleHub/TableSettingsPopover';
import {
  type ActionRow,
  type ExtraCopyFormat,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import {
  type RowAction,
  type RowActionSection,
  RowActionsMenu,
} from '@/components/shared/RowActionsMenu';
import {
  FOCUSED_ROW_CLASS,
  PREVIEW_SELECTED_ROW_CLASS,
  SELECTED_ROW_CLASS,
} from '@/components/shared/selectionTokens';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { ErrorState } from '@/components/ui/primitives';
import { deriveDueRisk, DueChip } from '@/components/ui/primitives/chips/DueChip';
import {
  EntityStatusChip,
  statusChipTone,
} from '@/components/ui/primitives/chips/EntityStatusChip';
import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  createTaskBulkActions,
  PRIORITY_FILTER_OPTIONS,
  type TableFilters,
  TASK_STATUS_FILTER_OPTIONS,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import { Api, type DataContextSummary } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { Task } from '@/types';
import { getArtifactPath } from '@/utils/artifactLinks';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';
import { isM03TasksStandardTableEnabled } from '@/utils/m03TasksStandardTableFlag';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { BulkDatePicker, BulkPriorityPicker } from './shared/BulkEditPopovers';
import { type ColumnConfig, ColumnConfigMenu } from './shared/ColumnConfigMenu';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { SavedViewsMenu, type TaskViewPreset } from './shared/SavedViewsMenu';
import { usePersistedColumnWidths } from './shared/usePersistedColumnWidths';

// duplicateIdentity — CB-04/RB-019/RV-029.
//
// Shared "semantic duplicate" grouping for Personal Tasks and Inbox: neither
// list had ANY business-identity concept beyond the raw row id, so two rows
// with the exact same title, urgency, status, section, and source rendered
// as indistinguishable independent items with no grouping and no warning —
// a user could not tell a genuine duplicate assignment from two
// legitimately distinct pieces of work that just happen to share a title.
//
// This does NOT collapse or hide rows (every row still renders — hiding
// data a user might need to act on is worse than a cluttered list). It only
// computes, per item, how many OTHER items share the same identity key, so
// callers can render a visible "possible duplicate" grouping/warning.
//
// Kept local to this file (rather than a shared ./duplicateIdentity module)
// so it has no dependency outside this file's recovery scope.

/** Lowercases, trims, and collapses whitespace so trivial formatting
 * differences ("Fix bug" vs "fix   bug") don't defeat grouping. */
function normalizeIdentityTitle(title: string | null | undefined): string {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Joins a normalized title with additional disambiguating context (e.g.
 * project id, source, section) into one identity key. Two items are only
 * flagged as semantic duplicates when BOTH the title AND the context match —
 * matching title alone over-flags legitimately distinct same-named items in
 * different projects/sources. */
function buildDuplicateIdentityKey(
  title: string | null | undefined,
  ...context: Array<string | null | undefined>
): string {
  const normalizedContext = context
    .map((c) =>
      String(c || '')
        .trim()
        .toLowerCase()
    )
    .join('::');
  return `${normalizeIdentityTitle(title)}::${normalizedContext}`;
}

interface DuplicateGroupCounts {
  /** identityKey -> how many items share it. */
  counts: Map<string, number>;
  /** identityKey -> the ids of every item sharing it (for "N duplicates" UI). */
  idsByKey: Map<string, string[]>;
}

function computeDuplicateGroups(
  items: Array<{ id: string; identityKey: string }>
): DuplicateGroupCounts {
  const idsByKey = new Map<string, string[]>();
  for (const item of items) {
    const existing = idsByKey.get(item.identityKey);
    if (existing) existing.push(item.id);
    else idsByKey.set(item.identityKey, [item.id]);
  }
  const counts = new Map<string, number>();
  for (const [key, ids] of idsByKey) counts.set(key, ids.length);
  return { counts, idsByKey };
}

type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent' | 'new';
type TaskTimeGroup = 'all' | 'overdue' | 'today' | 'week' | 'later' | 'no-date';

interface TaskCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  urgent: number;
  newUntriaged: number;
}

interface MyTasksListContentProps {
  activeFilter: TaskFilter;
  searchQuery: string;
  onTaskClick: (taskId: string, taskData?: Task) => void;
  onCreateTask: () => void;
  onCountsChange: (counts: TaskCounts) => void;
  refreshTrigger?: number;
  /** V3-A03: command row override mode (bulk selection) */
  onBulkBarChange?: (
    payload: {
      selectedCount: number;
      selectAllVisible: () => void;
      clearSelection: () => void;
      complete: () => void;
      changePriority: () => void;
      changeDueDate: () => void;
      deleteSelected: () => void;
    } | null
  ) => void;
}

const TASK_TABLE_VIEW_STORAGE_KEY = 'consultify-tasks-table-view';
const TASK_TABLE_ROW_DESCRIPTION_STORAGE_KEY = 'consultify-tasks-show-row-description';
const TASK_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];
const TASK_SELECTED_ROW_CLASS = SELECTED_ROW_CLASS;
const TASK_PREVIEW_ROW_CLASS = PREVIEW_SELECTED_ROW_CLASS;

function loadTasksHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(TASK_TABLE_VIEW_STORAGE_KEY);
    if (!raw) return [...TASK_TABLE_DEFAULT_HIDDEN_COLUMNS];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [...TASK_TABLE_DEFAULT_HIDDEN_COLUMNS];
  }
}

function loadTasksRowDescriptionSetting(): boolean {
  try {
    const raw = localStorage.getItem(TASK_TABLE_ROW_DESCRIPTION_STORAGE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function saveTasksRowDescriptionSetting(showDescription: boolean) {
  try {
    localStorage.setItem(TASK_TABLE_ROW_DESCRIPTION_STORAGE_KEY, String(showDescription));
  } catch {
    // ignore
  }
}

// Priority stays neutral; only the dot carries semantic signal.
const getPriorityConfig = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'critical':
      // Cichy chip (decyzja Piotra 2026-07-04): kropka + tonowany tekst niesie
      // semantykę — bez wypełnionej czerwonej pigułki z ramką (ściana alarmów).
      return {
        color: 'text-danger-700 dark:text-danger-300',
        badgeClass: '',
        bg: 'bg-danger-50',
        dot: 'bg-danger-500',
        label: i18n.t('myWork.tasksList.priorityBadge.critical', 'Critical'),
      };
    case 'high':
      return {
        color: 'text-c-text-secondary',
        badgeClass: '',
        bg: 'bg-amber-500',
        dot: 'bg-amber-500',
        label: i18n.t('myWork.tasksList.priorityBadge.high', 'High'),
      };
    case 'medium':
      return {
        color: 'text-c-text-secondary',
        badgeClass: '',
        bg: 'bg-blue-500',
        dot: 'bg-blue-500',
        label: i18n.t('myWork.tasksList.priorityBadge.medium', 'Medium'),
      };
    case 'low':
      return {
        color: 'text-c-text-muted',
        badgeClass: '',
        bg: 'bg-slate-400',
        dot: 'bg-slate-400',
        label: i18n.t('myWork.tasksList.priorityBadge.low', 'Low'),
      };
    default:
      return {
        color: 'text-c-text-muted',
        badgeClass: '',
        bg: 'bg-slate-400',
        dot: 'bg-slate-400',
        label: i18n.t('myWork.tasksList.priorityBadge.normal', 'Normal'),
      };
  }
};

// Status config — subtle/ghost badges, alarm only for blocked/rejected
const getStatusConfig = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'done':
    case 'completed':
    case 'validated':
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/10',
        dot: 'bg-emerald-500',
        label: i18n.t('myWork.tasksList.status.done', 'Done'),
      };
    case 'in_progress':
    case 'in progress':
      return {
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-500/10',
        dot: 'bg-blue-500',
        label: i18n.t('myWork.tasksList.status.inProgress', 'In progress'),
      };
    case 'pending_approval':
    case 'pending approval':
      return {
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/10',
        dot: 'bg-amber-500',
        label: i18n.t('myWork.tasksList.status.pendingApproval', 'Pending approval'),
      };
    case 'review':
      return {
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/10',
        dot: 'bg-amber-500',
        label: i18n.t('myWork.tasksList.status.inReview', 'In review'),
      };
    case 'blocked':
      return {
        color: 'text-danger-700 dark:text-danger-300',
        bg: 'bg-danger-100 dark:bg-danger-500/20',
        dot: 'bg-danger-500',
        label: i18n.t('myWork.tasksList.status.blocked', 'Blocked'),
      };
    case 'cancelled':
    case 'canceled':
      return {
        color: 'text-c-text-secondary',
        bg: 'bg-c-surface-raised',
        dot: 'bg-slate-400 dark:bg-slate-500',
        label: i18n.t('myWork.tasksList.status.cancelled', 'Cancelled'),
      };
    default:
      return {
        color: 'text-c-text-secondary',
        bg: 'bg-c-surface-raised',
        dot: 'bg-slate-500 dark:bg-slate-500',
        label: i18n.t('myWork.tasksList.status.todo', 'To Do'),
      };
  }
};

// Date formatting
const formatDueDate = (dueDate?: string | Date): string => {
  if (!dueDate) return 'No due date';
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dueDate?: string | Date, status?: string): boolean => {
  if (!dueDate) return false;
  const isCompleted = ['done', 'completed', 'validated'].includes(status?.toLowerCase() || '');
  if (isCompleted) return false;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

// Categorize task by time
const categorizeTask = (task: Task): TaskTimeGroup => {
  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
  if (isCompleted) return 'later';

  if (!task.dueDate) return 'no-date';

  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) return 'overdue';
  if (dueDate.getTime() === today.getTime()) return 'today';
  if (dueDate < endOfWeek) return 'week';
  return 'later';
};

// Task table column definitions
const TASK_COLUMNS: ColumnDef[] = [
  {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  {
    id: 'indicator',
    label: '',
    width: 32,
    minWidth: 32,
    maxWidth: 32,
    resizable: false,
    filterable: false,
  },
  {
    id: 'title',
    label: i18n.t('myWork.tasksList.columns.task', 'Task'),
    width: 560,
    minWidth: 360,
    maxWidth: 900,
    resizable: true,
    filterable: false,
  },
  {
    id: 'status',
    label: i18n.t('myWork.tasksList.columns.status', 'Status'),
    width: 140,
    minWidth: 110,
    maxWidth: 200,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: TASK_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'priority',
    label: i18n.t('myWork.tasksList.columns.priority', 'Priority'),
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: PRIORITY_FILTER_OPTIONS,
  },
  {
    id: 'date',
    label: i18n.t('myWork.tasksList.columns.dueDate', 'Due Date'),
    width: 130,
    minWidth: 100,
    maxWidth: 170,
    resizable: true,
    filterable: false,
  },
  {
    id: 'assignee',
    label: i18n.t('myWork.tasksList.columns.assignee', 'Assignee'),
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: i18n.t('myWork.tasksList.columns.actions', 'Actions'),
    width: 56,
    minWidth: 56,
    maxWidth: 72,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

type TaskResizableColumn = 'title' | 'status' | 'priority' | 'date' | 'assignee';

const TASK_RESIZE_BOUNDS: Record<TaskResizableColumn, { min: number; max: number }> = {
  title: { min: 360, max: 900 },
  status: { min: 110, max: 200 },
  priority: { min: 90, max: 160 },
  date: { min: 100, max: 170 },
  assignee: { min: 120, max: 220 },
};

// Per-column sort (canon §5/§27.O) — sortable fields + deterministic ordinals.
type TaskSortField = 'title' | 'status' | 'priority' | 'date' | 'assignee';

const TASK_STATUS_SORT_ORDER: Record<string, number> = {
  blocked: 0,
  in_progress: 1,
  'in progress': 1,
  review: 2,
  pending_approval: 3,
  todo: 4,
  done: 5,
  completed: 5,
  validated: 5,
  cancelled: 6,
  canceled: 6,
};

const TASK_PRIORITY_SORT_ORDER: Record<string, number> = {
  critical: 0,
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const taskAssigneeName = (task: Task): string =>
  task.assignee?.firstName || task.assignee?.lastName
    ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim()
    : task.assigneeId
      ? 'You'
      : '';

function compareTasks(a: Task, b: Task, field: TaskSortField): number {
  switch (field) {
    case 'title':
      return (a.title || '').localeCompare(b.title || '');
    case 'status':
      return (
        (TASK_STATUS_SORT_ORDER[a.status?.toLowerCase() || 'todo'] ?? 99) -
        (TASK_STATUS_SORT_ORDER[b.status?.toLowerCase() || 'todo'] ?? 99)
      );
    case 'priority':
      return (
        (TASK_PRIORITY_SORT_ORDER[a.priority?.toLowerCase() || 'medium'] ?? 2) -
        (TASK_PRIORITY_SORT_ORDER[b.priority?.toLowerCase() || 'medium'] ?? 2)
      );
    case 'date': {
      const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return at - bt;
    }
    case 'assignee':
      return taskAssigneeName(a).localeCompare(taskAssigneeName(b));
    default:
      return 0;
  }
}

const TaskSortIcon: React.FC<{
  field: TaskSortField;
  sortConfig: { field: TaskSortField; direction: 'asc' | 'desc' } | null;
}> = ({ field, sortConfig }) => {
  if (sortConfig?.field !== field)
    return <ChevronsUpDown size={12} className="text-slate-300 dark:text-slate-600" />;
  return sortConfig.direction === 'asc' ? (
    <ChevronUp size={12} className="text-c-text-secondary" />
  ) : (
    <ChevronDown size={12} className="text-c-text-secondary" />
  );
};

// Default column widths
const getDefaultColumnWidths = (): ColumnWidths =>
  TASK_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// Row hover animation variants
const rowVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -10 },
};

// Inline cell dropdown for status/priority editing
const INLINE_STATUS_OPTIONS = [
  { value: 'todo', label: i18n.t('myWork.tasksList.status.todo', 'To Do'), dot: 'bg-slate-400' },
  {
    value: 'in_progress',
    label: i18n.t('myWork.tasksList.status.inProgressShort', 'In Progress'),
    dot: 'bg-blue-500',
  },
  {
    value: 'review',
    label: i18n.t('myWork.tasksList.status.review', 'Review'),
    dot: 'bg-amber-500',
  },
  {
    value: 'blocked',
    label: i18n.t('myWork.tasksList.status.blocked', 'Blocked'),
    dot: 'bg-danger-500',
  },
  {
    value: 'completed',
    label: i18n.t('myWork.tasksList.status.done', 'Done'),
    dot: 'bg-emerald-500',
  },
];

const INLINE_PRIORITY_OPTIONS = [
  {
    value: 'critical',
    label: i18n.t('myWork.tasksList.priorityBadge.critical', 'Critical'),
    dot: 'bg-danger-500',
  },
  {
    value: 'high',
    label: i18n.t('myWork.tasksList.priorityBadge.high', 'High'),
    dot: 'bg-amber-500',
  },
  {
    value: 'medium',
    label: i18n.t('myWork.tasksList.priorityBadge.medium', 'Medium'),
    dot: 'bg-blue-500',
  },
  { value: 'low', label: i18n.t('myWork.tasksList.priorityBadge.low', 'Low'), dot: 'bg-slate-400' },
];

const InlineCellDropdown: React.FC<{
  options: Array<{ value: string; label: string; dot: string }>;
  onSelect: (value: string) => void;
  onClose: () => void;
}> = ({ options, onSelect, onClose }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute top-full left-0 mt-1 z-50 min-w-[140px] bg-c-surface-raised border border-c-border rounded-lg shadow-xl overflow-hidden"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            onSelect(opt.value);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-c-text-secondary transition-colors"
        >
          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
};

// ── StandardTable kebab (kanon TRIADA §27, decyzja Piotra #5) ───────────────
// Plain function (not a hook) — StandardTable calls `rowActions(row)` directly,
// same pattern as `buildDecisionKebabSections` in DecisionsPanelContent.tsx.
// Sections 1:1 z legacy `TaskTableRow`'s "Actions" kebab (§6.4 5-grup: open+stan /
// manipulacja / relacje-wyjście / AI / destrukcyjne) — no redesign of grouping.
interface TaskRowHandlers {
  onPreview: (taskId: string, taskData?: Task) => void;
  onOpenFull: (taskId: string, taskData?: Task) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onSetStatus: (taskId: string, status: 'todo' | 'in_progress' | 'blocked' | 'completed') => void;
  onInlineEdit?: (taskId: string, field: string, value: string) => void;
  onTriageAccept?: (taskId: string) => void;
  onTriageSnooze?: (taskId: string) => void;
  onTriageArchive?: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

const buildTaskKebabSections = (
  task: Task,
  isNew: boolean,
  h: TaskRowHandlers,
  t: (key: string, defaultValue: string) => string,
  isPolish: boolean
): RowActionSection[] => {
  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
  return [
    // ── §6.4 grupa 1: NAWIGACJA (Otwórz/Podgląd) + akcje stanu ────────
    {
      id: 'open',
      kind: 'open',
      actions: [
        {
          id: 'open-preview',
          label: t('myWork.tasksList.label', 'Open preview'),
          icon: ChevronRight,
          onClick: () => h.onPreview(task.id, task),
        },
        {
          id: 'view',
          label: t('common.view', 'View'),
          icon: Eye,
          onClick: () => h.onOpenFull(task.id, task),
        },
        {
          id: 'complete',
          label: isCompleted
            ? t('myWork.personalTasks.reopen', 'Reopen')
            : t('myWork.personalTasks.complete', 'Complete'),
          icon: CheckCircle2,
          onClick: () => h.onToggleComplete(task.id, !isCompleted),
          divider: true,
        },
        {
          id: 'status_todo',
          label: t('myWork.personalTasks.status.todo', 'To do'),
          icon: CheckSquare,
          onClick: () => h.onSetStatus(task.id, 'todo'),
        },
        {
          id: 'status_in_progress',
          label: t('myWork.personalTasks.status.inProgress', 'In progress'),
          icon: Clock,
          onClick: () => h.onSetStatus(task.id, 'in_progress'),
        },
        {
          id: 'status_blocked',
          label: t('myWork.personalTasks.status.blocked', 'Blocked'),
          icon: AlertCircle,
          onClick: () => h.onSetStatus(task.id, 'blocked'),
        },
        ...(isNew && h.onTriageAccept
          ? [
              {
                id: 'triage_accept',
                label: t('myWork.triage.acceptToday', 'Accept (Today)'),
                icon: Zap,
                onClick: () => h.onTriageAccept?.(task.id),
                divider: true,
              },
              {
                id: 'triage_snooze',
                label: t('myWork.triage.snooze', 'Snooze 2 days'),
                icon: Pause,
                onClick: () => h.onTriageSnooze?.(task.id),
              },
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 2: MANIPULACJA (Edytuj) ────────────────────────────
    {
      id: 'manage',
      kind: 'manage',
      actions: [
        {
          id: 'edit',
          label: t('common.edit', 'Edit'),
          icon: Edit,
          onClick: () => h.onOpenFull(task.id, task),
        },
      ],
    },
    // ── §6.4 grupa 3: RELACJE/WYJŚCIE (Kopiuj link · Odłóż termin) ─────
    {
      id: 'output',
      kind: 'output',
      actions: [
        {
          id: 'copy-link',
          label: t('myWork.tasksList.label2', 'Copy link'),
          icon: Link2,
          onClick: () => {
            try {
              const url = `${window.location.origin}${getArtifactPath('task', task.id)}`;
              void navigator.clipboard?.writeText(url);
              toast.success(t('myWork.tasksList.toastSuccess', 'Link copied'));
            } catch {
              /* clipboard unavailable */
            }
          },
        },
        // Delay ▸ — tasks have a due date, so the slot is present.
        ...(h.onInlineEdit
          ? [
              {
                id: 'delay',
                label: t('myWork.tasksList.label3', 'Delay'),
                icon: Clock,
                onClick: () => {},
                submenu: [1, 3, 7].map((d) => ({
                  id: `delay-${d}`,
                  label: isPolish ? `+${d} ${d === 1 ? 'dzień' : 'dni'}` : `+${d}d`,
                  icon: Clock,
                  onClick: () => {
                    const base =
                      task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime())
                        ? new Date(task.dueDate)
                        : new Date();
                    base.setDate(base.getDate() + d);
                    h.onInlineEdit?.(task.id, 'dueDate', base.toISOString().split('T')[0]);
                  },
                })),
              } satisfies RowAction,
            ]
          : []),
      ],
    },
    // ── §6.4 grupa 4: AI ──────────────────────────────────────────────
    {
      id: 'ai',
      kind: 'ai',
      actions: [
        {
          id: 'ai-open',
          label: t('myWork.tasksList.label4', '✨ AI: open & fill'),
          icon: Sparkles,
          onClick: () => h.onOpenFull(task.id, task),
        },
      ],
    },
    // ── §6.4 grupa 5: DESTRUKCYJNE (Archiwizuj · Usuń — danger, ostatni) ─
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'archive',
          label: t('myWork.triage.archive', 'Archive'),
          icon: Archive,
          disabled: !h.onTriageArchive,
          description: h.onTriageArchive
            ? undefined
            : t('myWork.tasksList.comingSoonBackend', 'Coming soon (backend)'),
          onClick: () => h.onTriageArchive?.(task.id),
        },
        {
          id: 'delete',
          label: t('common.delete', 'Delete'),
          icon: Trash2,
          onClick: () => h.onDelete(task.id),
          variant: 'danger',
        },
      ],
    },
  ] satisfies RowActionSection[];
};

// Task Row Component with inline editing
const TaskTableRow: React.FC<{
  task: Task;
  isSelected: boolean;
  isFocused: boolean;
  isPreviewed: boolean;
  isNew?: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onSetStatus: (taskId: string, status: 'todo' | 'in_progress' | 'blocked' | 'completed') => void;
  onDelete: (taskId: string) => void;
  onPreview: (taskId: string, taskData?: Task) => void;
  onOpenFull: (taskId: string, taskData?: Task) => void;
  onInlineEdit?: (taskId: string, field: string, value: string) => void;
  onTriageAccept?: (taskId: string) => void;
  onTriageSnooze?: (taskId: string) => void;
  onTriageArchive?: (taskId: string) => void;
  columnWidths: ColumnWidths;
  hiddenColumns?: Set<string>;
  focusState?: Record<string, string>;
  showRowDescription: boolean;
  /** CB-04/RB-019: >1 when another visible task shares this one's business
   * identity (title + project). Rows are never hidden/merged — this only
   * adds a visible warning so the user can tell a real duplicate from
   * coincidence. */
  duplicateCount?: number;
}> = ({
  task,
  isSelected,
  isFocused,
  isPreviewed,
  isNew,
  onSelect,
  onToggleComplete,
  onSetStatus,
  onDelete,
  onPreview,
  onOpenFull,
  onInlineEdit,
  onTriageAccept,
  onTriageSnooze,
  onTriageArchive,
  columnWidths,
  hiddenColumns: hiddenCols,
  focusState,
  showRowDescription,
  duplicateCount = 1,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const [inlineDropdown, setInlineDropdown] = React.useState<'status' | 'priority' | 'date' | null>(
    null
  );

  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
  const overdue = isOverdue(task.dueDate, task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const assigneeName =
    task.assignee?.firstName || task.assignee?.lastName
      ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim()
      : task.assigneeId
        ? t('myWork.tasksList.you', 'You')
        : 'Unassigned';
  const assigneeInitial = assigneeName !== 'Unassigned' ? assigneeName[0].toUpperCase() : '';

  return (
    <motion.tr
      variants={rowVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      onClick={() => onPreview(task.id, task)}
      onDoubleClick={() => onOpenFull(task.id, task)}
      className={`
        group cursor-pointer border-b border-slate-200/60 dark:border-white/[0.03]
        ${isCompleted ? 'opacity-60' : ''}
        ${isSelected ? TASK_SELECTED_ROW_CLASS : ''}
        ${isPreviewed ? TASK_PREVIEW_ROW_CLASS : ''}
        ${isFocused && !isPreviewed && !isSelected ? FOCUSED_ROW_CLASS : ''}
        transition-colors duration-150
        hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
      `}
    >
      {/* Select Checkbox */}
      <td className="w-10 px-2 py-2.5" style={{ width: columnWidths.select }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(task.id);
          }}
          className={`
            h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center transition-all
            ${
              isSelected
                ? 'bg-c-text border-c-text text-c-surface opacity-100'
                : 'border-c-border-strong bg-white/80 text-transparent opacity-0 hover:border-c-border-strong group-hover:opacity-100 group-hover:border-c-border dark:group-hover:border-white/[0.22] group-hover:bg-white/90 dark:group-hover:bg-white/[0.08] group-focus-within:opacity-100 group-focus-within:border-c-focus-solid group-focus-within:bg-white/90 dark:group-focus-within:bg-white/[0.08] focus:opacity-100 dark:border-white/[0.14] dark:bg-white/[0.035]'
            }
          `}
          aria-label={t('myWork.tasksList.ariaLabel', 'Select task')}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Task Title */}
      <td className="px-3 py-3" style={{ width: columnWidths.title }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-sm font-semibold ${
                isCompleted ? 'line-through text-c-text-muted' : 'text-c-text'
              } truncate`}
              title={task.title}
            >
              {task.title}
            </span>
            {focusState?.[task.id] && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full border border-c-border bg-c-surface-raised text-c-text-secondary">
                {focusState[task.id] === 'today'
                  ? '📌 Today'
                  : focusState[task.id] === 'thisWeek'
                    ? 'This Week'
                    : 'Later'}
              </span>
            )}
            {/* CB-04/RB-019: visible semantic-duplicate warning — never
                hides the row, just flags it. */}
            {duplicateCount > 1 && (
              <span
                className="ml-1.5 shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                title={t(
                  'myWork.tasksList.possibleDuplicateHint',
                  'Another task with the same title and project exists — check it is not a duplicate.'
                )}
              >
                {t('myWork.tasksList.possibleDuplicate', 'Possible duplicate ({{count}})', {
                  count: duplicateCount,
                })}
              </span>
            )}
          </div>
          {showRowDescription && (task.description || task.projectName) ? (
            <span
              className="mt-0.5 truncate text-[11px] leading-4 text-c-text-muted"
              title={task.description || task.projectName}
            >
              {task.description || task.projectName}
            </span>
          ) : null}
        </div>
      </td>

      {/* Status — inline editable */}
      {!hiddenCols?.has('status') && (
        <td
          className="px-3 py-2.5 text-left relative"
          style={{ width: columnWidths.status }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'status' ? null : 'status');
          }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <EntityStatusChip
              status={task.status}
              label={statusConfig.label}
              className="cursor-pointer hover:ring-2 hover:ring-c-focus transition-all"
            />
            {(task as any).triageAction && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-medium rounded-full border border-c-border bg-c-surface-raised text-c-text-secondary"
                title={
                  (task as any).triaged_at
                    ? `Triaged ${new Date((task as any).triaged_at).toLocaleDateString()}`
                    : 'Triaged'
                }
              >
                ✓ Triaged
              </span>
            )}
          </div>
          <AnimatePresence>
            {inlineDropdown === 'status' && (
              <InlineCellDropdown
                options={INLINE_STATUS_OPTIONS}
                onSelect={(val) =>
                  onInlineEdit
                    ? onInlineEdit(task.id, 'status', val)
                    : onSetStatus(task.id, val as any)
                }
                onClose={() => setInlineDropdown(null)}
              />
            )}
          </AnimatePresence>
        </td>
      )}

      {/* Priority — inline editable */}
      {!hiddenCols?.has('priority') && (
        <td
          className="px-3 py-2.5 text-left relative"
          style={{ width: columnWidths.priority }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'priority' ? null : 'priority');
          }}
        >
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${priorityConfig.badgeClass ? '' : 'hover:underline decoration-dotted'} ${priorityConfig.color} ${priorityConfig.badgeClass}`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${priorityConfig.dot} ${overdue ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            {priorityConfig.label}
          </span>
          <AnimatePresence>
            {inlineDropdown === 'priority' && (
              <InlineCellDropdown
                options={INLINE_PRIORITY_OPTIONS}
                onSelect={(val) =>
                  onInlineEdit ? onInlineEdit(task.id, 'priority', val) : undefined
                }
                onClose={() => setInlineDropdown(null)}
              />
            )}
          </AnimatePresence>
        </td>
      )}

      {/* Due Date — inline editable */}
      {!hiddenCols?.has('date') && (
        <td
          className="px-3 py-2.5 text-left relative"
          style={{ width: columnWidths.date }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'date' ? null : 'date');
          }}
        >
          {!task.dueDate ? (
            <span className="text-xs italic text-c-text-muted cursor-pointer hover:underline decoration-dotted">
              {formatDueDate(task.dueDate)}
            </span>
          ) : (
            <DueChip
              label={formatDueDate(task.dueDate)}
              risk={overdue ? 'overdue' : deriveDueRisk(task.dueDate)}
              showIcon
              className="cursor-pointer hover:ring-2 hover:ring-c-focus transition-all"
            />
          )}
          <AnimatePresence>
            {inlineDropdown === 'date' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 bg-c-surface-raised border border-c-border rounded-lg shadow-xl overflow-hidden p-2"
              >
                <input
                  type="date"
                  autoFocus
                  defaultValue={
                    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
                  }
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (onInlineEdit && e.target.value) {
                      onInlineEdit(task.id, 'dueDate', e.target.value);
                      setInlineDropdown(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setInlineDropdown(null);
                  }}
                  className="h-8 px-2 text-sm rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      )}

      {/* Assignee */}
      {!hiddenCols?.has('assignee') && (
        <td className="px-3 py-2.5 text-left" style={{ width: columnWidths.assignee }}>
          <div className="flex items-center gap-2">
            {assigneeInitial ? (
              <div className="w-6 h-6 rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised flex items-center justify-center text-[10px] font-semibold text-c-text-secondary">
                {assigneeInitial}
              </div>
            ) : (
              <User size={14} className="text-c-text-muted" />
            )}
            <span
              className={`text-xs truncate max-w-[120px] ${
                assigneeName === 'Unassigned' ? 'text-c-text-muted italic' : 'text-c-text-secondary'
              }`}
            >
              {assigneeName}
            </span>
          </div>
        </td>
      )}

      {/* Actions — "..." menu */}
      {!hiddenCols?.has('actions') && (
        <td
          className="px-3 py-2.5 text-right"
          style={{ width: columnWidths.actions }}
          onClick={(e) => e.stopPropagation()}
        >
          <RowActionsMenu
            size="sm"
            className="opacity-40 transition-opacity group-hover:opacity-100"
            sections={
              [
                // ── §6.4 grupa 1: NAWIGACJA (Otwórz/Podgląd) + akcje stanu ────────
                {
                  id: 'open',
                  kind: 'open',
                  actions: [
                    {
                      id: 'open-preview',
                      label: t('myWork.tasksList.label', 'Open preview'),
                      icon: ChevronRight,
                      onClick: () => onPreview(task.id, task),
                    },
                    {
                      id: 'view',
                      label: t('common.view', 'View'),
                      icon: Eye,
                      onClick: () => onOpenFull(task.id, task),
                    },
                    {
                      id: 'complete',
                      label: isCompleted
                        ? t('myWork.personalTasks.reopen', 'Reopen')
                        : t('myWork.personalTasks.complete', 'Complete'),
                      icon: CheckCircle2,
                      onClick: () => onToggleComplete(task.id, !isCompleted),
                      divider: true,
                    },
                    {
                      id: 'status_todo',
                      label: t('myWork.personalTasks.status.todo', 'To do'),
                      icon: CheckSquare,
                      onClick: () => onSetStatus(task.id, 'todo'),
                    },
                    {
                      id: 'status_in_progress',
                      label: t('myWork.personalTasks.status.inProgress', 'In progress'),
                      icon: Clock,
                      onClick: () => onSetStatus(task.id, 'in_progress'),
                    },
                    {
                      id: 'status_blocked',
                      label: t('myWork.personalTasks.status.blocked', 'Blocked'),
                      icon: AlertCircle,
                      onClick: () => onSetStatus(task.id, 'blocked'),
                    },
                    ...(isNew && onTriageAccept
                      ? [
                          {
                            id: 'triage_accept',
                            label: t('myWork.triage.acceptToday', 'Accept (Today)'),
                            icon: Zap,
                            onClick: () => onTriageAccept(task.id),
                            divider: true,
                          },
                          {
                            id: 'triage_snooze',
                            label: t('myWork.triage.snooze', 'Snooze 2 days'),
                            icon: Pause,
                            onClick: () => onTriageSnooze?.(task.id),
                          },
                        ]
                      : []),
                  ],
                },
                // ── §6.4 grupa 2: MANIPULACJA (Edytuj) ────────────────────────────
                {
                  id: 'manage',
                  kind: 'manage',
                  actions: [
                    {
                      id: 'edit',
                      label: t('common.edit', 'Edit'),
                      icon: Edit,
                      onClick: () => onOpenFull(task.id, task),
                    },
                  ],
                },
                // ── §6.4 grupa 3: RELACJE/WYJŚCIE (Kopiuj link · Odłóż termin) ─────
                {
                  id: 'output',
                  kind: 'output',
                  actions: [
                    {
                      id: 'copy-link',
                      label: t('myWork.tasksList.label2', 'Copy link'),
                      icon: Link2,
                      onClick: () => {
                        try {
                          const url = `${window.location.origin}${getArtifactPath('task', task.id)}`;
                          void navigator.clipboard?.writeText(url);
                          toast.success(t('myWork.tasksList.toastSuccess', 'Link copied'));
                        } catch {
                          /* clipboard unavailable */
                        }
                      },
                    },
                    // Delay ▸ — tasks have a due date, so the slot is present.
                    ...(onInlineEdit
                      ? [
                          {
                            id: 'delay',
                            label: t('myWork.tasksList.label3', 'Delay'),
                            icon: Clock,
                            onClick: () => {},
                            submenu: [1, 3, 7].map((d) => ({
                              id: `delay-${d}`,
                              label: isPolish ? `+${d} ${d === 1 ? 'dzień' : 'dni'}` : `+${d}d`,
                              icon: Clock,
                              onClick: () => {
                                const base =
                                  task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime())
                                    ? new Date(task.dueDate)
                                    : new Date();
                                base.setDate(base.getDate() + d);
                                onInlineEdit(task.id, 'dueDate', base.toISOString().split('T')[0]);
                              },
                            })),
                          } satisfies RowAction,
                        ]
                      : []),
                  ],
                },
                // ── §6.4 grupa 4: AI ──────────────────────────────────────────────
                {
                  id: 'ai',
                  kind: 'ai',
                  actions: [
                    {
                      id: 'ai-open',
                      label: t('myWork.tasksList.label4', '✨ AI: open & fill'),
                      icon: Sparkles,
                      onClick: () => onOpenFull(task.id, task),
                    },
                  ],
                },
                // ── §6.4 grupa 5: DESTRUKCYJNE (Archiwizuj · Usuń — danger, ostatni) ─
                {
                  id: 'danger',
                  kind: 'danger',
                  actions: [
                    {
                      id: 'archive',
                      label: t('myWork.triage.archive', 'Archive'),
                      icon: Archive,
                      disabled: !onTriageArchive,
                      description: onTriageArchive
                        ? undefined
                        : t('myWork.tasksList.comingSoonBackend', 'Coming soon (backend)'),
                      onClick: () => onTriageArchive?.(task.id),
                    },
                    {
                      id: 'delete',
                      label: t('common.delete', 'Delete'),
                      icon: Trash2,
                      onClick: () => onDelete(task.id),
                      variant: 'danger',
                    },
                  ],
                },
              ] satisfies RowActionSection[]
            }
          />
        </td>
      )}
    </motion.tr>
  );
};

export const MyTasksListContent: React.FC<MyTasksListContentProps> = ({
  activeFilter,
  searchQuery,
  onTaskClick,
  onCreateTask,
  onCountsChange,
  refreshTrigger,
  onBulkBarChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  // kanon TRIADA §27 (decyzja Piotra #5) — ZA FLAGĄ, default OFF. Gdy ON,
  // renderuje StandardTable zamiast bespoke <table> poniżej (patrz `useStandardTable`
  // branch przy końcu pliku); dane/filtrowanie/sort NIE zmieniają się.
  const useStandardTable = isM03TasksStandardTableEnabled();
  // Inline-editable cell (status/priority/date) otwarty w widoku StandardTable —
  // odpowiednik lokalnego `inlineDropdown` z legacy `TaskTableRow`, tu na
  // poziomie tabeli (StandardTable renderuje kolumny jako render(row), nie
  // per-wiersz komponent z własnym stanem).
  const [openInlineCell, setOpenInlineCell] = useState<{
    taskId: string;
    field: 'status' | 'priority' | 'date';
  } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [dataContext, setDataContext] = useState<DataContextSummary | null>(null);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  // Preview — details kebab + AI zone (Inbox parity)
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Focus state: entity_id → focus column (today / thisWeek / later)
  const [focusState, setFocusState] = useState<Record<string, string>>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column widths state (for resizable columns)
  const [columnWidths, setColumnWidths] = usePersistedColumnWidths(
    'mywork:tasks:column-widths',
    getDefaultColumnWidths
  ); // M03 L-10

  // Filter state (session only)
  const [tableFilters, setTableFilters] = useState<TableFilters>({});

  // Open filter dropdown state
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);

  // Hidden columns (persisted)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => {
    return loadTasksHiddenColumns();
  });
  const [showRowDescription, setShowRowDescription] = useState(loadTasksRowDescriptionSetting);

  const toggleColumn = useCallback((columnId: string) => {
    setHiddenColumns((prev) => {
      const next = prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId];
      localStorage.setItem(TASK_TABLE_VIEW_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateRowDescriptionSetting = useCallback((next: boolean) => {
    setShowRowDescription(next);
    saveTasksRowDescriptionSetting(next);
  }, []);

  const configurableColumns: ColumnConfig[] = useMemo(
    () => [
      { id: 'status', label: t('myWork.tasksList.columns.status', 'Status') },
      { id: 'priority', label: t('myWork.tasksList.columns.priority', 'Priority') },
      { id: 'date', label: t('myWork.tasksList.columns.dueDate', 'Due Date') },
      { id: 'assignee', label: t('myWork.tasksList.columns.assignee', 'Assignee') },
      { id: 'actions', label: t('myWork.tasksList.columns.actions', 'Actions') },
    ],
    [t]
  );

  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const isColumnVisible = useCallback((columnId: string) => !hiddenSet.has(columnId), [hiddenSet]);
  const visibleResizableColumns = useMemo((): TaskResizableColumn[] => {
    return TASK_COLUMNS.filter(
      (column): column is ColumnDef & { id: TaskResizableColumn } =>
        column.id in TASK_RESIZE_BOUNDS && isColumnVisible(column.id)
    ).map((column) => column.id);
  }, [isColumnVisible]);
  const tableMinWidth = useMemo(() => {
    const visibleWidth = TASK_COLUMNS.reduce((sum, column) => {
      if (column.id !== 'select' && column.id !== 'indicator' && hiddenSet.has(column.id)) {
        return sum;
      }
      return sum + (columnWidths[column.id] || column.width);
    }, 0);

    return Math.max(980, visibleWidth);
  }, [columnWidths, hiddenSet]);

  // Per-column sort (canon §5/§27.O) — client-side; overrides smartSort when active.
  const [sortConfig, setSortConfig] = useState<{
    field: TaskSortField;
    direction: 'asc' | 'desc';
  } | null>(null);

  const handleSort = useCallback((field: TaskSortField) => {
    setSortConfig((prev) => {
      if (prev?.field !== field) return { field, direction: 'asc' };
      if (prev.direction === 'asc') return { field, direction: 'desc' };
      return null; // asc → desc → none
    });
  }, []);

  // Smart sort toggle (persisted)
  const [smartSort, setSmartSort] = useState<boolean>(() => {
    try {
      return localStorage.getItem('consultify-smart-sort') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSmartSort = useCallback(() => {
    setSmartSort((prev) => {
      const next = !prev;
      localStorage.setItem('consultify-smart-sort', String(next));
      trackFunnelEvent('smart_sort_toggled', { enabled: next });
      return next;
    });
  }, []);

  // Triage state (persisted in localStorage)
  const [triagedIds, setTriagedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('consultify-triaged-task-ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markTriaged = useCallback((taskId: string) => {
    setTriagedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      localStorage.setItem('consultify-triaged-task-ids', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isNewTask = useCallback(
    (task: Task) => {
      if (triagedIds.has(task.id)) return false;
      const isCompleted = ['done', 'completed', 'validated'].includes(
        task.status?.toLowerCase() || ''
      );
      if (isCompleted) return false;
      if (!task.createdAt) return false;
      const created = new Date(task.createdAt);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return created > threeDaysAgo;
    },
    [triagedIds]
  );

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await Api.getPersonalTasks({ includeDone: true });
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setLoadError(true);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

  useEffect(() => {
    Api.getDataContext()
      .then((context) => setDataContext(context))
      .catch(() => setDataContext(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    Api.get('/my-work/focus/state')
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray((response as any)?.data?.items)
          ? (response as any).data.items
          : [];
        const next: Record<string, string> = {};
        for (const item of items) {
          const itemKey = String(item?.itemKey || '');
          const column = String(item?.column || '');
          if (!itemKey.startsWith('task:')) continue;
          if (!['today', 'thisWeek', 'later'].includes(column)) continue;
          const taskId = itemKey.slice('task:'.length).trim();
          if (!taskId) continue;
          next[taskId] = column;
        }
        setFocusState(next);
      })
      .catch(() => {
        if (!cancelled) setFocusState({});
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskTimeGroup, Task[]> = {
      all: [],
      overdue: [],
      today: [],
      week: [],
      later: [],
      'no-date': [],
    };

    let filteredTasks = tasks;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredTasks = tasks.filter(
        (task) =>
          task.title?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      );
    }

    if (activeFilter === 'urgent') {
      filteredTasks = filteredTasks.filter((task) => {
        const p = task.priority?.toLowerCase();
        return p === 'urgent' || p === 'critical' || p === 'high';
      });
    }

    if (activeFilter === 'new') {
      filteredTasks = filteredTasks.filter(isNewTask);
    }

    filteredTasks.forEach((task) => {
      const category = categorizeTask(task);
      groups[category].push(task);
      groups.all.push(task);
    });

    // Sort each group by priority then due date
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    Object.keys(groups).forEach((key) => {
      groups[key as TaskTimeGroup].sort((a, b) => {
        const ap = priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 2;
        const bp = priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 2;
        if (ap !== bp) return ap - bp;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });
    });

    return groups;
  }, [tasks, searchQuery, activeFilter, isNewTask]);

  const urgentCount = useMemo(() => {
    return tasks.filter((task) => {
      const p = task.priority?.toLowerCase();
      return p === 'urgent' || p === 'critical' || p === 'high';
    }).length;
  }, [tasks]);

  const newUntriagedCount = useMemo(() => tasks.filter(isNewTask).length, [tasks, isNewTask]);

  useEffect(() => {
    const counts: TaskCounts = {
      total: groupedTasks.all.length,
      overdue: groupedTasks.overdue.length,
      today: groupedTasks.today.length,
      week: groupedTasks.week.length,
      urgent: urgentCount,
      newUntriaged: newUntriagedCount,
    };
    onCountsChange(counts);
  }, [groupedTasks, urgentCount, newUntriagedCount, onCountsChange]);

  // Handlers
  const persistPersonalTask = async (taskId: string, updates: Record<string, unknown>) => {
    const current = tasks.find((task) => task.id === taskId) as
      | (Task & { versionToken?: string })
      | undefined;
    const updated = await Api.updatePersonalTask(taskId, {
      ...updates,
      expectedVersionToken: String(current?.versionToken || ''),
    });
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? ({ ...task, ...updated } as Task) : task))
    );
    return updated;
  };

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await persistPersonalTask(taskId, { status: completed ? 'completed' : 'todo' });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, status: completed ? 'completed' : 'todo' } as Task) : t
        )
      );
      if (completed) {
        trackFunnelEvent('personal_task_completed', { source: 'table', taskId });
      }
      toast.success(
        completed
          ? t('myWork.tasksList.toast.taskCompleted', 'Task completed')
          : t('myWork.tasksList.toast.taskReopened', 'Task reopened')
      );
    } catch (error) {
      toast.error(t('myWork.tasksList.toast.updateTaskFailed', 'Failed to update task'));
    }
  };

  const handleSetStatus = async (
    taskId: string,
    status: 'todo' | 'in_progress' | 'blocked' | 'completed'
  ) => {
    try {
      await persistPersonalTask(taskId, { status });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? ({ ...t, status } as Task) : t)));
      if (status === 'completed') {
        trackFunnelEvent('personal_task_completed', { source: 'table_status', taskId });
      }
      toast.success(t('myWork.personalTasks.statusUpdated', 'Status updated'));
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  // Inline edit handler with optimistic update + undo
  const handleInlineEdit = async (taskId: string, field: string, value: string) => {
    const prevTask = tasks.find((t) => t.id === taskId);
    if (!prevTask) return;
    const prevValue = (prevTask as any)[field];
    if (prevValue === value) return;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? ({ ...t, [field]: value } as Task) : t)));

    try {
      await persistPersonalTask(taskId, { [field]: value });
      trackFunnelEvent('inline_edit_used', { field, taskId });

      toast.success(
        (toastInstance) => (
          <span className="flex items-center gap-2 text-sm">
            <span>{field} updated</span>
            <button
              onClick={() => {
                toast.dismiss(toastInstance.id);
                trackFunnelEvent('undo_used', { field, taskId });
                handleInlineEdit(taskId, field, prevValue);
              }}
              className="ml-1 px-2 py-0.5 text-xs font-medium bg-c-surface-raised rounded hover:bg-c-border-subtle transition-colors"
            >
              Undo
            </button>
          </span>
        ),
        { duration: 5000 }
      );
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? ({ ...t, [field]: prevValue } as Task) : t))
      );
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  // Triage actions
  const handleTriageAcceptToday = async (taskId: string) => {
    const today = new Date();
    const isoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    try {
      await persistPersonalTask(taskId, { dueDate: isoDate, status: 'in_progress' });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, dueDate: isoDate, status: 'in_progress' } as Task) : t
        )
      );
      markTriaged(taskId);
      trackFunnelEvent('triage_action_used', { action: 'accept_today', taskId });
      toast.success(t('myWork.triage.acceptedToday', 'Accepted for today'));
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  const handleTriageSchedule = async (taskId: string, date: string) => {
    try {
      await persistPersonalTask(taskId, { dueDate: date });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? ({ ...t, dueDate: date } as Task) : t))
      );
      markTriaged(taskId);
      trackFunnelEvent('triage_action_used', { action: 'schedule', taskId });
      toast.success(t('myWork.triage.scheduled', 'Scheduled'));
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  const handleTriageArchive = async (taskId: string) => {
    try {
      await persistPersonalTask(taskId, { status: 'completed' });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? ({ ...t, status: 'completed' } as Task) : t))
      );
      markTriaged(taskId);
      trackFunnelEvent('triage_action_used', { action: 'archive', taskId });
      toast.success(t('myWork.triage.archived', 'Archived'));
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  const handleTriageSnooze = async (taskId: string) => {
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const isoDate = `${inTwoDays.getFullYear()}-${String(inTwoDays.getMonth() + 1).padStart(2, '0')}-${String(inTwoDays.getDate()).padStart(2, '0')}`;
    try {
      await persistPersonalTask(taskId, { dueDate: isoDate });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? ({ ...t, dueDate: isoDate } as Task) : t))
      );
      markTriaged(taskId);
      trackFunnelEvent('triage_action_used', { action: 'snooze', taskId });
      toast.success(t('myWork.triage.snoozed', 'Snoozed for 2 days'));
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update'));
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await Api.deletePersonalTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      trackFunnelEvent('task_deleted', { taskId, source: 'single' });
      toast.success(t('myWork.tasksList.toast.taskDeleted', 'Task deleted'));
    } catch (error) {
      toast.error(t('myWork.tasksList.toast.deleteTaskFailed', 'Failed to delete task'));
    }
  };

  // Calculate total visible tasks for select all
  const allVisibleTaskIds = useMemo(() => {
    return new Set(groupedTasks.all.map((task) => task.id));
  }, [groupedTasks]);

  // Selection helpers
  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleTaskIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleTaskIds.size;

  // Selection handlers
  const handleSelectTask = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(allVisibleTaskIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Column resize handler
  const handleColumnResize = (columnId: string, newWidth: number) => {
    const currentColumn = columnId as TaskResizableColumn;
    const currentBounds = TASK_RESIZE_BOUNDS[currentColumn];
    if (!currentBounds) {
      setColumnWidths((prev) => ({
        ...prev,
        [columnId]: newWidth,
      }));
      return;
    }

    setColumnWidths((prev) => {
      const currentWidth = prev[currentColumn];
      const nextColumn =
        visibleResizableColumns[visibleResizableColumns.indexOf(currentColumn) + 1];
      const clampedWidth = Math.max(currentBounds.min, Math.min(currentBounds.max, newWidth));

      if (!nextColumn) {
        return { ...prev, [currentColumn]: clampedWidth };
      }

      const nextBounds = TASK_RESIZE_BOUNDS[nextColumn];
      const nextWidth = prev[nextColumn];
      const requestedDelta = clampedWidth - currentWidth;
      const requestedNextWidth = nextWidth - requestedDelta;
      const clampedNextWidth = Math.max(
        nextBounds.min,
        Math.min(nextBounds.max, requestedNextWidth)
      );
      const appliedDelta = nextWidth - clampedNextWidth;

      return {
        ...prev,
        [currentColumn]: currentWidth + appliedDelta,
        [nextColumn]: clampedNextWidth,
      };
    });
  };

  // Filter handler
  const handleFilterChange = (columnId: string, values: string[]) => {
    setTableFilters((prev) => ({
      ...prev,
      [columnId]: values.length > 0 ? values : undefined,
    }));
  };

  // Bulk actions
  const handleBulkComplete = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => persistPersonalTask(id, { status: 'completed' }))
      );
      setTasks((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, status: 'completed' } as Task) : t))
      );
      toast.success(
        t('myWork.tasksList.toast.tasksCompletedCount', '{{count}} tasks completed', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(t('myWork.tasksList.toast.completeTasksFailed', 'Failed to complete tasks'));
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deletePersonalTask(id)));
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      trackFunnelEvent('task_bulk_deleted', { count });
      toast.success(
        t('myWork.tasksList.toast.tasksDeletedCount', '{{count}} tasks deleted', { count })
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(t('myWork.tasksList.toast.deleteTasksFailed', 'Failed to delete tasks'));
    }
  };

  // Bulk edit popover state
  const [bulkPriorityOpen, setBulkPriorityOpen] = useState(false);
  const [bulkDateOpen, setBulkDateOpen] = useState(false);

  // Confirm dialog hook
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();

  const handleBulkChangePriority = async (newPriority: string) => {
    const prevTasks = tasks;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    try {
      setTasks((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, priority: newPriority } as Task) : t))
      );
      setSelectedIds(new Set());
      await Promise.all(ids.map((id) => persistPersonalTask(id, { priority: newPriority })));
      trackFunnelEvent('bulk_edit_applied', { field: 'priority', value: newPriority, count });
      toast.success(
        t('myWork.tasksList.toast.priorityBulkUpdated', 'Priority → {{priority}} ({{count}})', {
          priority: newPriority,
          count,
        }),
        {
          duration: 5000,
          icon: '🎯',
        }
      );
    } catch {
      setTasks(prevTasks);
      toast.error(t('myWork.errors.updateFailed', 'Failed to update priority'));
    }
  };

  const handleBulkChangeDate = async (newDate: string) => {
    const prevTasks = tasks;
    const count = selectedIds.size;
    const ids = Array.from(selectedIds);
    const isRemove = !newDate;
    try {
      setTasks((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id) ? ({ ...t, dueDate: isRemove ? null : newDate } as Task) : t
        )
      );
      setSelectedIds(new Set());
      await Promise.all(
        ids.map((id) => persistPersonalTask(id, { dueDate: isRemove ? null : newDate }))
      );
      trackFunnelEvent('personal_task_due_date_set', { source: 'bulk', count });
      toast.success(isRemove ? `Due date removed (${count})` : `Due date → ${newDate} (${count})`, {
        duration: 5000,
        icon: '📅',
      });
    } catch {
      setTasks(prevTasks);
      toast.error(t('myWork.errors.updateFailed', 'Failed to update due date'));
    }
  };

  const handleBulkArchive = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => persistPersonalTask(id, { status: 'completed' }))
      );
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      toast.success(
        t('myWork.tasksList.toast.tasksCompletedCount', '{{count}} tasks completed', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to complete tasks'));
    }
  };

  const bulkActions = createTaskBulkActions({
    onComplete: handleBulkComplete,
    onDelete: async () => {
      const confirmed = await showConfirm({
        title: t('myWork.personalTasks.bulkDeleteTitle', 'Delete selected tasks?'),
        description: t(
          'myWork.personalTasks.bulkDeleteDesc',
          `${selectedIds.size} task(s) will be permanently deleted. This cannot be undone.`
        ),
        confirmLabel: t('common.delete', 'Delete'),
        cancelLabel: t('common.cancel', 'Cancel'),
        variant: 'danger',
      });
      if (confirmed) await handleBulkDelete();
    },
    onChangePriority: () => {
      trackFunnelEvent('bulk_edit_opened', { field: 'priority' });
      setBulkPriorityOpen(true);
    },
    onChangeDate: () => {
      trackFunnelEvent('bulk_edit_opened', { field: 'dueDate' });
      setBulkDateOpen(true);
    },
    onArchive: handleBulkArchive,
  });

  // V3-A03: bulk selection lives as a mode of the single command row (parent)
  useEffect(() => {
    if (!onBulkBarChange) return;
    if (selectedIds.size === 0) {
      onBulkBarChange(null);
      return;
    }

    onBulkBarChange({
      selectedCount: selectedIds.size,
      selectAllVisible: () => handleSelectAll(true),
      clearSelection: handleClearSelection,
      complete: handleBulkComplete,
      changePriority: () => setBulkPriorityOpen(true),
      changeDueDate: () => setBulkDateOpen(true),
      deleteSelected: () => {
        // Reuse existing confirmation flow
        void (async () => {
          const confirmed = await showConfirm({
            title: t('myWork.personalTasks.bulkDeleteTitle', 'Delete selected tasks?'),
            description: `${selectedIds.size} task(s) will be permanently deleted.`,
            confirmLabel: t('common.delete', 'Delete'),
            variant: 'danger',
          });
          if (confirmed) await handleBulkDelete();
        })();
      },
    });
  }, [
    onBulkBarChange,
    selectedIds.size,
    handleSelectAll,
    handleClearSelection,
    handleBulkComplete,
    handleBulkDelete,
    showConfirm,
    t,
  ]);

  // Flat list of all visible tasks for keyboard navigation
  const flatTaskList = useMemo(() => {
    return groupedTasks.all;
  }, [groupedTasks]);

  // Get focused task
  const focusedTask =
    focusedIndex >= 0 && focusedIndex < flatTaskList.length ? flatTaskList[focusedIndex] : null;

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    enabled: !loading && !previewTaskId,
    onNavigateUp: () => {
      setFocusedIndex((prev) => Math.max(0, prev - 1));
    },
    onNavigateDown: () => {
      setFocusedIndex((prev) => Math.min(flatTaskList.length - 1, prev + 1));
    },
    onNavigateFirst: () => setFocusedIndex(0),
    onNavigateLast: () => setFocusedIndex(flatTaskList.length - 1),
    onNew: onCreateTask,
    onEdit: () => {
      if (focusedTask) {
        onTaskClick(focusedTask.id, focusedTask);
      }
    },
    onOpen: () => {
      if (focusedTask) {
        onTaskClick(focusedTask.id, focusedTask);
      }
    },
    onDelete: async () => {
      if (selectedIds.size > 0) {
        const confirmed = await showConfirm({
          title: t('myWork.personalTasks.bulkDeleteTitle', 'Delete selected tasks?'),
          description: `${selectedIds.size} task(s) will be permanently deleted.`,
          confirmLabel: t('common.delete', 'Delete'),
          variant: 'danger',
        });
        if (confirmed) await handleBulkDelete();
      } else if (focusedTask) {
        const confirmed = await showConfirm({
          title: t('myWork.personalTasks.deleteTitle', 'Delete task?'),
          description: focusedTask.title,
          confirmLabel: t('common.delete', 'Delete'),
          variant: 'danger',
        });
        if (confirmed) await handleDelete(focusedTask.id);
      }
    },
    onToggleComplete: async () => {
      if (focusedTask) {
        const isCompleted = ['done', 'completed', 'validated'].includes(
          focusedTask.status?.toLowerCase() || ''
        );
        await handleToggleComplete(focusedTask.id, !isCompleted);
      }
    },
    onSetPriority: async (priority) => {
      if (focusedTask) {
        try {
          await persistPersonalTask(focusedTask.id, { priority });
          setTasks((prev) =>
            prev.map((t) => (t.id === focusedTask.id ? ({ ...t, priority } as Task) : t))
          );
          toast.success(
            t('myWork.tasksList.toast.prioritySetTo', 'Priority set to {{priority}}', { priority })
          );
        } catch {
          toast.error(
            t('myWork.tasksList.toast.updatePriorityFailed', 'Failed to update priority')
          );
        }
      }
    },
    onSelectAll: () => handleSelectAll(true),
    onClearSelection: handleClearSelection,
    onToggleSelection: () => {
      if (focusedTask) {
        handleSelectTask(focusedTask.id);
      }
    },
    onSearch: () => searchInputRef?.focus(),
    onCancel: () => {
      if (selectedIds.size > 0) {
        handleClearSelection();
      } else {
        setFocusedIndex(-1);
      }
    },
  });

  const allFilteredTasks = useMemo(() => {
    let result: Task[] = [...groupedTasks.all];

    const statusFilter = tableFilters.status as string[] | undefined;
    const priorityFilter = tableFilters.priority as string[] | undefined;

    if (statusFilter?.length) {
      result = result.filter((task) => statusFilter.includes(task.status?.toLowerCase() || ''));
    }
    if (priorityFilter?.length) {
      result = result.filter((task) => priorityFilter.includes(task.priority?.toLowerCase() || ''));
    }

    // Explicit per-column sort takes precedence over smartSort heuristics.
    if (sortConfig) {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => compareTasks(a, b, sortConfig.field) * dir);
    } else if (smartSort) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const priorityWeight: Record<string, number> = {
        critical: 0,
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      result.sort((a, b) => {
        const aOverdue = isOverdue(a.dueDate, a.status) ? 0 : 1;
        const bOverdue = isOverdue(b.dueDate, b.status) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;

        const aToday =
          a.dueDate && new Date(a.dueDate) >= now && new Date(a.dueDate) <= endOfDay ? 0 : 1;
        const bToday =
          b.dueDate && new Date(b.dueDate) >= now && new Date(b.dueDate) <= endOfDay ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;

        const aPri = priorityWeight[a.priority?.toLowerCase() || 'medium'] ?? 2;
        const bPri = priorityWeight[b.priority?.toLowerCase() || 'medium'] ?? 2;
        if (aPri !== bPri) return aPri - bPri;

        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return 0;
      });
    }

    return result;
  }, [groupedTasks, tableFilters, smartSort, sortConfig]);

  // CB-04/RB-019: same-title tasks had NO semantic-duplicate grouping or
  // warning — two rows with identical titles rendered as indistinguishable
  // independent items. Identity = title + project (source context), so
  // legitimately distinct same-named tasks in different projects are never
  // over-flagged — only genuinely repeated business identity is.
  const taskDuplicateGroups = useMemo(
    () =>
      computeDuplicateGroups(
        allFilteredTasks.map((task) => ({
          id: task.id,
          identityKey: buildDuplicateIdentityKey(task.title, task.projectName),
        }))
      ),
    [allFilteredTasks]
  );

  const orderedTaskIds = useMemo(() => allFilteredTasks.map((t) => t.id), [allFilteredTasks]);

  const previewTask = useMemo(
    () => allFilteredTasks.find((t) => t.id === previewTaskId) || null,
    [allFilteredTasks, previewTaskId]
  );

  useEffect(() => {
    if (previewTaskId && !previewTask) setPreviewTaskId(null);
  }, [previewTaskId, previewTask]);

  useEffect(() => {
    setAiLoading(false);
    setAiError(null);
    setAiText(null);
    setDetailsLoading(false);
    setDetailsOverride(null);
  }, [previewTaskId]);

  const runTaskAi = useCallback(
    async (
      intent: 'why_urgent' | 'plan' | 'who_can_help' | 'expand_details' | 'summarize_details',
      task: Task
    ) => {
      try {
        setAiLoading(true);
        setAiError(null);
        const language = t('myWork.tasksList.en', 'en');
        const resp = await Api.post('/my-work/tasks/ai-text', {
          language,
          intent,
          task: {
            title: task.title,
            description: task.description || '',
            status: task.status || '',
            priority: task.priority || '',
            dueDate: task.dueDate || '',
            projectName: task.projectName || '',
            initiativeName: task.initiativeName || '',
          },
        });
        const text = String((resp as any)?.result?.text || '').trim();
        if (!text) throw new Error('empty');
        setAiText(text);
        return text;
      } catch (e: any) {
        setAiError(t('myWork.tasksList.setAiError', 'AI unavailable'));
        return null;
      } finally {
        setAiLoading(false);
      }
    },
    [isPolish]
  );

  const handleDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy', task: Task) => {
      const base = String(detailsOverride ?? task.description ?? '').trim();
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(base || task.title);
          toast.success(t('myWork.tasksList.toastSuccess2', 'Copied'));
        } catch {
          toast.error(t('myWork.tasksList.toastError', 'Copy failed'));
        }
        return;
      }

      try {
        setDetailsLoading(true);
        const intent = action === 'expand' ? 'expand_details' : 'summarize_details';
        const text = await runTaskAi(intent, task);
        if (text) setDetailsOverride(text);
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsOverride, isPolish, runTaskAi]
  );

  // ── StandardTable columns (kanon TRIADA §27, decyzja Piotra #5) ──────────
  // Cell markup 1:1 z legacy `TaskTableRow` (title/status/priority/date/
  // assignee); status/priority/date inline-edit dropdowns keyed via
  // `openInlineCell` (table-level, patrz wyżej) zamiast per-row local state.
  // statusFilter/priorityFilter = syntetyczne lowercase mirrory (jak w
  // DecisionsPanelContent) tak, by FilterableTable's `row[column.id]` filter
  // matching zgadzał się z lowercase TASK_STATUS_FILTER_OPTIONS/PRIORITY_FILTER_OPTIONS.
  const taskStandardColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'title',
        label: t('myWork.tasksList.columns.task', 'Task'),
        width: '360px',
        sortable: true,
        render: (row: TableRow) => {
          const task = row as unknown as Task;
          const isCompleted = ['done', 'completed', 'validated'].includes(
            task.status?.toLowerCase() || ''
          );
          return (
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-sm font-semibold ${
                  isCompleted ? 'line-through text-c-text-muted' : 'text-c-text'
                } truncate`}
                title={task.title}
              >
                {task.title}
              </span>
              {focusState[task.id] && (
                <span className="ml-1.5 shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full border border-c-border bg-c-surface-raised text-c-text-secondary">
                  {focusState[task.id] === 'today'
                    ? '📌 Today'
                    : focusState[task.id] === 'thisWeek'
                      ? 'This Week'
                      : 'Later'}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'statusFilter',
        label: t('myWork.tasksList.columns.status', 'Status'),
        width: '150px',
        filterable: true,
        filterOptions: TASK_STATUS_FILTER_OPTIONS,
        sortable: true,
        sortAccessor: (row: any) => TASK_STATUS_SORT_ORDER[row.statusFilter as string] ?? 99,
        render: (row: TableRow) => {
          const task = row as unknown as Task;
          const statusConfig = getStatusConfig(task.status);
          const isOpen = openInlineCell?.taskId === task.id && openInlineCell?.field === 'status';
          return (
            <div
              className="relative inline-block"
              onClick={(e) => {
                e.stopPropagation();
                setOpenInlineCell(isOpen ? null : { taskId: task.id, field: 'status' });
              }}
            >
              <EntityStatusChip
                status={task.status}
                label={statusConfig.label}
                className="cursor-pointer hover:ring-2 hover:ring-c-focus transition-all"
              />
              <AnimatePresence>
                {isOpen && (
                  <InlineCellDropdown
                    options={INLINE_STATUS_OPTIONS}
                    onSelect={(val) => handleInlineEdit(task.id, 'status', val)}
                    onClose={() => setOpenInlineCell(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        },
      },
      {
        id: 'priorityFilter',
        label: t('myWork.tasksList.columns.priority', 'Priority'),
        width: '130px',
        filterable: true,
        filterOptions: PRIORITY_FILTER_OPTIONS,
        sortable: true,
        sortAccessor: (row: any) => TASK_PRIORITY_SORT_ORDER[row.priorityFilter as string] ?? 2,
        render: (row: TableRow) => {
          const task = row as unknown as Task;
          const priorityConfig = getPriorityConfig(task.priority);
          const overdue = isOverdue(task.dueDate, task.status);
          const isOpen = openInlineCell?.taskId === task.id && openInlineCell?.field === 'priority';
          return (
            <div
              className="relative inline-block"
              onClick={(e) => {
                e.stopPropagation();
                setOpenInlineCell(isOpen ? null : { taskId: task.id, field: 'priority' });
              }}
            >
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${priorityConfig.badgeClass ? '' : 'hover:underline decoration-dotted'} ${priorityConfig.color} ${priorityConfig.badgeClass}`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${priorityConfig.dot} ${overdue ? 'animate-pulse' : ''}`}
                  aria-hidden="true"
                />
                {priorityConfig.label}
              </span>
              <AnimatePresence>
                {isOpen && (
                  <InlineCellDropdown
                    options={INLINE_PRIORITY_OPTIONS}
                    onSelect={(val) => handleInlineEdit(task.id, 'priority', val)}
                    onClose={() => setOpenInlineCell(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        },
      },
      {
        id: 'date',
        label: t('myWork.tasksList.columns.dueDate', 'Due Date'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: any) => (row.dueDate ? new Date(row.dueDate).getTime() : Infinity),
        render: (row: TableRow) => {
          const task = row as unknown as Task;
          const overdue = isOverdue(task.dueDate, task.status);
          const isOpen = openInlineCell?.taskId === task.id && openInlineCell?.field === 'date';
          return (
            <div
              className="relative inline-block"
              onClick={(e) => {
                e.stopPropagation();
                setOpenInlineCell(isOpen ? null : { taskId: task.id, field: 'date' });
              }}
            >
              {!task.dueDate ? (
                <span className="text-xs italic text-c-text-muted cursor-pointer hover:underline decoration-dotted">
                  {formatDueDate(task.dueDate)}
                </span>
              ) : (
                <DueChip
                  label={formatDueDate(task.dueDate)}
                  risk={overdue ? 'overdue' : deriveDueRisk(task.dueDate)}
                  showIcon
                  className="cursor-pointer hover:ring-2 hover:ring-c-focus transition-all"
                />
              )}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 mt-1 z-50 bg-c-surface-raised border border-c-border rounded-lg shadow-xl overflow-hidden p-2"
                  >
                    <input
                      type="date"
                      autoFocus
                      defaultValue={
                        task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
                      }
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleInlineEdit(task.id, 'dueDate', e.target.value);
                          setOpenInlineCell(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setOpenInlineCell(null);
                      }}
                      className="h-8 px-2 text-sm rounded-lg border border-c-border-subtle bg-c-surface text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        },
      },
      {
        id: 'assignee',
        label: t('myWork.tasksList.columns.assignee', 'Assignee'),
        width: '160px',
        sortable: true,
        sortAccessor: (row: any) => taskAssigneeName(row as unknown as Task),
        render: (row: TableRow) => {
          const task = row as unknown as Task;
          const assigneeName = taskAssigneeName(task) || 'Unassigned';
          const assigneeInitial =
            assigneeName !== 'Unassigned' ? assigneeName[0].toUpperCase() : '';
          return (
            <div className="flex items-center gap-2">
              {assigneeInitial ? (
                <div className="w-6 h-6 rounded-full border border-c-border-subtle bg-c-surface-raised flex items-center justify-center text-[10px] font-semibold text-c-text-secondary">
                  {assigneeInitial}
                </div>
              ) : (
                <User size={14} className="text-c-text-muted" />
              )}
              <span
                className={`text-xs truncate max-w-[120px] ${
                  assigneeName === 'Unassigned'
                    ? 'text-c-text-muted italic'
                    : 'text-c-text-secondary'
                }`}
              >
                {assigneeName}
              </span>
            </div>
          );
        },
      },
    ],
    [t, focusState, openInlineCell, handleInlineEdit]
  );

  // StandardTable `data` — allFilteredTasks (SAME pipeline: legacy tableFilters
  // + smartSort/sortConfig już zaaplikowane) plus syntetyczne lowercase
  // statusFilter/priorityFilter (patrz komentarz kolumn wyżej).
  const taskStandardRows = useMemo<TableRow[]>(
    () =>
      allFilteredTasks.map((task) => ({
        ...task,
        statusFilter: (task.status || 'todo').toLowerCase(),
        priorityFilter: (task.priority || 'medium').toLowerCase(),
      })) as unknown as TableRow[],
    [allFilteredTasks]
  );

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex-1 flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <ErrorState
            message={t('myWork.errors.fetchFailed', 'Failed to load tasks')}
            retry={() => void fetchTasks()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <div className="flex-1 min-h-0">
        <TableWithPreviewLayout<Task>
          selectedId={previewTaskId}
          selectedItem={previewTask}
          onSelect={setPreviewTaskId}
          previewOpen={Boolean(previewTaskId)}
          autoOpenPreview={false}
          onOpenFull={(id) => {
            const full = tasks.find((x) => x.id === id);
            onTaskClick(id, full);
          }}
          itemIds={orderedTaskIds}
          getItemById={(id) => tasks.find((t) => t.id === id) ?? null}
          renderPreview={(task) => {
            const isCompleted = ['done', 'completed', 'validated'].includes(
              task.status?.toLowerCase() || ''
            );
            const statusCfg = getStatusConfig(task.status);
            const priCfg = getPriorityConfig(task.priority);
            const due = formatDueDate(task.dueDate as any);
            const desc = String(task.description || '').trim();
            const detailsText = detailsOverride ?? desc;

            // canon §4.1 — status na neutralnej powłoce, kolor tylko jako sygnał (statusChipTone);
            // §4.0 — priorytet niesie ton tylko gdy warto (critical→danger, high→warning).
            const priRaw = String(task.priority || '').toLowerCase();
            const priTone: MetaPill['tone'] =
              priRaw === 'critical' || priRaw === 'urgent'
                ? 'danger'
                : priRaw === 'high'
                  ? 'warning'
                  : 'neutral';
            const pills: MetaPill[] = [
              {
                label: statusCfg.label,
                tone: statusChipTone(task.status),
              },
              { label: priCfg.label, tone: priTone },
              ...(task.projectName
                ? [
                    {
                      label: task.projectName,
                      className: 'text-c-text-muted truncate max-w-[120px]',
                    },
                  ]
                : []),
            ];

            const trailing = (
              <span
                className={`text-[11px] font-semibold ${
                  due === 'No due date' ? 'text-c-text-muted italic' : 'text-c-text-secondary'
                }`}
              >
                {due}
              </span>
            );

            const taskCopyFormats: ExtraCopyFormat[] = [
              {
                label: t('myWork.tasksList.label5', 'Copy as Markdown'),
                onClick: () =>
                  void copyAsMarkdown(
                    { title: task.title, status: statusCfg.label, description: desc },
                    isPolish ? 'pl' : 'en'
                  ),
              },
              {
                label: t('myWork.tasksList.label6', 'Copy for Slack'),
                onClick: () =>
                  void copyForSlack(
                    { title: task.title, status: statusCfg.label, description: desc },
                    isPolish ? 'pl' : 'en'
                  ),
              },
            ];

            return (
              <div className="space-y-4">
                {/* canon §7.3 — tytul zyje WYLACZNIE w naglowku preview; META to stan, nie tresc. */}
                <PreviewMetaCard pills={pills} trailing={trailing} />

                <PreviewDetailsSection
                  text={detailsText}
                  loading={detailsLoading}
                  onExpand={() => void handleDetailsAction('expand', task)}
                  onSummarize={() => void handleDetailsAction('summarize', task)}
                  onCopy={() => void handleDetailsAction('copy', task)}
                  extraCopyFormats={taskCopyFormats}
                />
              </div>
            );
          }}
          renderPreviewFooter={(task) => {
            const isCompleted = ['done', 'completed', 'validated'].includes(
              task.status?.toLowerCase() || ''
            );

            const hints = [
              t('myWork.tasksList.whyUrgent', 'Why urgent?'),
              t('myWork.tasksList.actionPlan', 'Action plan'),
              t('myWork.tasksList.whoCanHelp', 'Who can help?'),
            ];
            const hintToIntent: Record<string, 'why_urgent' | 'plan' | 'who_can_help'> = {
              [t('myWork.tasksList.whyUrgent2', 'Why urgent?')]: 'why_urgent',
              [t('myWork.tasksList.actionPlan2', 'Action plan')]: 'plan',
              [t('myWork.tasksList.whoCanHelp2', 'Who can help?')]: 'who_can_help',
            };

            const relationItems: RelationItem[] = [];
            if (task.initiativeName)
              relationItems.push({
                label: task.initiativeName,
                tone: 'text-blue-600 dark:text-blue-300',
              });
            if (Array.isArray(task.dependencies) && task.dependencies.length > 0)
              relationItems.push({
                label: isPolish
                  ? `Zależności: ${task.dependencies.length}`
                  : `Dependencies: ${task.dependencies.length}`,
                tone: 'text-amber-700 dark:text-amber-300',
              });
            if (Array.isArray(task.attachments) && task.attachments.length > 0)
              relationItems.push({
                label: isPolish
                  ? `Załączniki: ${task.attachments.length}`
                  : `Attachments: ${task.attachments.length}`,
                tone: 'text-c-text-secondary',
              });

            const actionRows: ActionRow[] = [
              {
                buttons: [
                  {
                    label: t('myWork.tasksList.label7', 'Today'),
                    icon: Zap,
                    onClick: () => handleTriageAcceptToday(task.id),
                    colorScheme: 'neutral',
                    flex: true,
                    shortcut: 'T',
                  },
                  {
                    label: t('myWork.tasksList.label8', 'Snooze'),
                    icon: Pause,
                    onClick: () => handleTriageSnooze(task.id),
                    colorScheme: 'neutral',
                    flex: true,
                    shortcut: 'Z',
                  },
                ],
              },
              {
                buttons: [
                  {
                    label: isCompleted
                      ? t('myWork.tasksList.reopen', 'Reopen')
                      : t('myWork.tasksList.done', 'Done'),
                    icon: CheckCircle2,
                    onClick: () => handleToggleComplete(task.id, !isCompleted),
                    colorScheme: 'emerald',
                    flex: true,
                    shortcut: 'D',
                  },
                ],
              },
            ];

            return (
              // canon §7.3 — footer cards stacked with space-y-2.5, NO dividers between framed cards.
              <div className="space-y-2.5">
                <div className="rounded-xl border border-c-border-subtle bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
                  <PreviewAIHintStrip
                    hints={hints}
                    loading={aiLoading}
                    result={aiLoading ? 'Thinking…' : aiText}
                    error={aiError}
                    onRunHint={(hint) => {
                      const intent = hintToIntent[hint];
                      if (intent) runTaskAi(intent, task);
                    }}
                    onCopy={async () => {
                      if (!aiText) return;
                      try {
                        await navigator.clipboard.writeText(aiText);
                        toast.success(t('myWork.tasksList.toastSuccess3', 'Copied'));
                      } catch {
                        toast.error(t('myWork.tasksList.toastError2', 'Copy failed'));
                      }
                    }}
                    onClear={() => {
                      setAiText(null);
                      setAiError(null);
                    }}
                  />
                </div>

                <PreviewRelations
                  items={relationItems}
                  emptyLabel={t('myWork.tasksList.emptyLabel', 'No relations')}
                />

                <PreviewActionBar rows={actionRows} />
              </div>
            );
          }}
        >
          <div className="pl-4 pr-1.5 pt-3 pb-4">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
                <CheckCircle2 size={48} className="text-c-text-muted mb-4" />
                <h3 className="text-lg font-medium text-c-text-secondary mb-2">
                  {t('myWork.personalTasks.empty.title', 'No personal tasks in the current scope')}
                </h3>
                <p className="text-sm text-c-text-muted mb-4">
                  {t(
                    'myWork.personalTasks.empty.description',
                    'This view shows only personal tasks assigned in the active organization.'
                  )}
                </p>
                <button
                  onClick={onCreateTask}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-c-border-subtle bg-c-surface text-c-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Plus size={16} />
                  {t('myWork.personalTasks.create', 'Create task')}
                </button>
              </div>
            ) : useStandardTable ? (
              // kanon TRIADA §27 (decyzja Piotra #5) — ZA FLAGĄ ff_m03TasksStandardTable,
              // default OFF. StandardTable zastępuje CAŁY bespoke <table> poniżej
              // (legacy branch zostaje nietknięty jako default render).
              <StandardTable
                columns={taskStandardColumns}
                data={taskStandardRows}
                onRowClick={(row) => setPreviewTaskId(String(row.id))}
                onRowDoubleClick={(row) => {
                  const full = tasks.find((x) => x.id === row.id);
                  onTaskClick(String(row.id), full);
                }}
                rowActions={(row) => {
                  const task = row as unknown as Task;
                  const handlers: TaskRowHandlers = {
                    onPreview: (id, data) => setPreviewTaskId(id),
                    onOpenFull: (id, data) => onTaskClick(id, data),
                    onToggleComplete: handleToggleComplete,
                    onSetStatus: handleSetStatus,
                    onInlineEdit: handleInlineEdit,
                    onTriageAccept: handleTriageAcceptToday,
                    onTriageSnooze: handleTriageSnooze,
                    onTriageArchive: handleTriageArchive,
                    onDelete: async (id) => {
                      const confirmed = await showConfirm({
                        title: t('myWork.personalTasks.deleteTitle', 'Delete task?'),
                        description: t(
                          'myWork.personalTasks.deleteDesc',
                          'This task will be permanently deleted.'
                        ),
                        confirmLabel: t('common.delete', 'Delete'),
                        variant: 'danger',
                      });
                      if (confirmed) handleDelete(id);
                    },
                  };
                  return buildTaskKebabSections(task, isNewTask(task), handlers, t, !!isPolish);
                }}
                rowDescription={(row) => {
                  const task = row as unknown as Task;
                  return task.description || task.projectName || null;
                }}
                // Ta gałąź to powód dla którego StandardTable dostał `rowClassName`
                // (decyzja Piotra #5): bulk-select/preview/focus/completed to TU
                // 4 niezależne stany warstwowane na jednym wierszu — StandardTable
                // sam obsługuje tylko `selectedRowId` (pojedynczy stan), więc reszta
                // (SELECTED/PREVIEW/FOCUSED tokens z selectionTokens.ts + opacity
                // dla completed) idzie przez rowClassName, 1:1 z legacy TaskTableRow.
                rowClassName={(row) => {
                  const task = row as unknown as Task;
                  const isCompleted = ['done', 'completed', 'validated'].includes(
                    task.status?.toLowerCase() || ''
                  );
                  const isSelected = selectedIds.has(task.id);
                  const isPreviewed = previewTaskId === task.id;
                  const isFocused = focusedTask?.id === task.id;
                  return [
                    isCompleted ? 'opacity-60' : '',
                    isSelected ? SELECTED_ROW_CLASS : '',
                    isPreviewed ? PREVIEW_SELECTED_ROW_CLASS : '',
                    isFocused && !isPreviewed && !isSelected ? FOCUSED_ROW_CLASS : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                }}
                selection={{ selectedIds, onChange: setSelectedIds }}
                empty={{
                  title: t(
                    'myWork.personalTasks.empty.title',
                    'No personal tasks in the current scope'
                  ),
                  description: t(
                    'myWork.personalTasks.empty.description',
                    'This view shows only personal tasks assigned in the active organization.'
                  ),
                  actionLabel: t('myWork.personalTasks.create', 'Create task'),
                  onAction: onCreateTask,
                }}
                persistKey="mywork.tasks.list"
              />
            ) : (
              <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl">
                <table
                  /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full table-fixed"
                  style={{ minWidth: tableMinWidth }}
                >
                  <thead>
                    <tr className="border-b border-c-border-subtle bg-c-surface sticky top-0 z-10">
                      {/* Select All */}
                      <th className="px-2 py-2" style={{ width: columnWidths.select }}>
                        <button
                          onClick={() => handleSelectAll(!allSelected)}
                          className={`
                          h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center transition-colors
                          ${
                            allSelected
                              ? 'bg-c-text border-c-text text-c-surface'
                              : someSelected
                                ? 'bg-c-text/60 border-c-text text-c-surface'
                                : 'border-c-border hover:border-c-border-strong text-transparent hover:text-c-text-muted'
                          }
                        `}
                        >
                          {allSelected ? (
                            <CheckSquare size={14} />
                          ) : someSelected ? (
                            <Minus size={14} />
                          ) : (
                            <Square size={14} />
                          )}
                        </button>
                      </th>
                      <th
                        className="relative px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider"
                        style={{ width: columnWidths.title }}
                      >
                        <button
                          type="button"
                          onClick={() => handleSort('title')}
                          className="inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary"
                        >
                          {t('myWork.tasksList.task', 'Task')}
                          <TaskSortIcon field="title" sortConfig={sortConfig} />
                        </button>
                        <ColumnResizer
                          columnId="title"
                          currentWidth={columnWidths.title}
                          minWidth={TASK_RESIZE_BOUNDS.title.min}
                          maxWidth={TASK_RESIZE_BOUNDS.title.max}
                          onResize={handleColumnResize}
                        />
                      </th>

                      {!hiddenSet.has('status') && (
                        <th
                          className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                          style={{ width: columnWidths.status }}
                        >
                          <div className="flex items-center justify-start gap-1">
                            <button
                              type="button"
                              onClick={() => handleSort('status')}
                              className={`inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary ${
                                (tableFilters.status as string[])?.length
                                  ? 'text-c-text-secondary'
                                  : ''
                              }`}
                            >
                              Status
                              <TaskSortIcon field="status" sortConfig={sortConfig} />
                            </button>
                            <FilterDropdown
                              column={TASK_COLUMNS.find((c) => c.id === 'status')!}
                              value={tableFilters.status as string[]}
                              onChange={(val) => handleFilterChange('status', val as string[])}
                              isOpen={openFilterId === 'status'}
                              onToggle={() =>
                                setOpenFilterId(openFilterId === 'status' ? null : 'status')
                              }
                              onClose={() => setOpenFilterId(null)}
                            />
                          </div>
                          <ColumnResizer
                            columnId="status"
                            currentWidth={columnWidths.status}
                            minWidth={TASK_RESIZE_BOUNDS.status.min}
                            maxWidth={TASK_RESIZE_BOUNDS.status.max}
                            onResize={handleColumnResize}
                          />
                        </th>
                      )}

                      {!hiddenSet.has('priority') && (
                        <th
                          className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                          style={{ width: columnWidths.priority }}
                        >
                          <div className="flex items-center justify-start gap-1">
                            <button
                              type="button"
                              onClick={() => handleSort('priority')}
                              className={`inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary ${
                                (tableFilters.priority as string[])?.length
                                  ? 'text-c-text-secondary'
                                  : ''
                              }`}
                            >
                              Priority
                              <TaskSortIcon field="priority" sortConfig={sortConfig} />
                            </button>
                            <FilterDropdown
                              column={TASK_COLUMNS.find((c) => c.id === 'priority')!}
                              value={tableFilters.priority as string[]}
                              onChange={(val) => handleFilterChange('priority', val as string[])}
                              isOpen={openFilterId === 'priority'}
                              onToggle={() =>
                                setOpenFilterId(openFilterId === 'priority' ? null : 'priority')
                              }
                              onClose={() => setOpenFilterId(null)}
                            />
                          </div>
                          <ColumnResizer
                            columnId="priority"
                            currentWidth={columnWidths.priority}
                            minWidth={TASK_RESIZE_BOUNDS.priority.min}
                            maxWidth={TASK_RESIZE_BOUNDS.priority.max}
                            onResize={handleColumnResize}
                          />
                        </th>
                      )}

                      {!hiddenSet.has('date') && (
                        <th
                          className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                          style={{ width: columnWidths.date }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort('date')}
                            className="inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary"
                          >
                            {t('myWork.tasksList.dueDate', 'Due Date')}
                            <TaskSortIcon field="date" sortConfig={sortConfig} />
                          </button>
                          <ColumnResizer
                            columnId="date"
                            currentWidth={columnWidths.date}
                            minWidth={TASK_RESIZE_BOUNDS.date.min}
                            maxWidth={TASK_RESIZE_BOUNDS.date.max}
                            onResize={handleColumnResize}
                          />
                        </th>
                      )}
                      {!hiddenSet.has('assignee') && (
                        <th
                          className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                          style={{ width: columnWidths.assignee }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSort('assignee')}
                            className="inline-flex items-center gap-1 transition-colors hover:text-c-text-secondary"
                          >
                            {t('myWork.tasksList.assignee', 'Assignee')}
                            <TaskSortIcon field="assignee" sortConfig={sortConfig} />
                          </button>
                          <ColumnResizer
                            columnId="assignee"
                            currentWidth={columnWidths.assignee}
                            minWidth={TASK_RESIZE_BOUNDS.assignee.min}
                            maxWidth={TASK_RESIZE_BOUNDS.assignee.max}
                            onResize={handleColumnResize}
                          />
                        </th>
                      )}
                      {!hiddenSet.has('actions') && (
                        <th
                          className="relative px-3 py-2 text-right text-[11px] font-semibold text-c-text-muted uppercase tracking-wider"
                          style={{ width: columnWidths.actions }}
                        >
                          <div className="flex items-center justify-end normal-case tracking-normal">
                            <TableSettingsPopover
                              columns={TASK_COLUMNS.filter(
                                (c) => !['select', 'indicator'].includes(c.id)
                              ).map((col): TableSettingsColumn => {
                                const required = col.id === 'title' || col.id === 'actions';
                                const label =
                                  col.id === 'status'
                                    ? 'Status'
                                    : col.id === 'priority'
                                      ? t('myWork.tasksList.priority', 'Priority')
                                      : col.id === 'date'
                                        ? t('myWork.tasksList.dueDate2', 'Due date')
                                        : col.id === 'assignee'
                                          ? t('myWork.tasksList.assignee2', 'Assignee')
                                          : col.id === 'title'
                                            ? t('myWork.tasksList.task2', 'Task')
                                            : col.id === 'actions'
                                              ? t('myWork.tasksList.actions', 'Actions')
                                              : col.label;
                                return {
                                  id: col.id,
                                  label,
                                  required,
                                  visible: required ? true : !hiddenSet.has(col.id),
                                };
                              })}
                              onToggle={(columnId, visible) =>
                                setHiddenColumns((prev) => {
                                  const set = new Set(prev);
                                  if (visible) set.delete(columnId);
                                  else set.add(columnId);
                                  const next = Array.from(set);
                                  localStorage.setItem(
                                    TASK_TABLE_VIEW_STORAGE_KEY,
                                    JSON.stringify(next)
                                  );
                                  return next;
                                })
                              }
                              showDescription={showRowDescription}
                              onToggleDescription={updateRowDescriptionSetting}
                              label={t('myWork.tasksList.label9', 'View settings')}
                              columnsHeading={t(
                                'myWork.tasksList.columnsHeading',
                                'Visible columns'
                              )}
                              descriptionLabel={t(
                                'myWork.tasksList.showRowDescription',
                                'Show row description'
                              )}
                            />
                          </div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {allFilteredTasks.map((task) => (
                        <TaskTableRow
                          key={task.id}
                          task={task}
                          isSelected={selectedIds.has(task.id)}
                          isFocused={focusedTask?.id === task.id}
                          isPreviewed={previewTaskId === task.id}
                          isNew={isNewTask(task)}
                          duplicateCount={
                            taskDuplicateGroups.counts.get(
                              buildDuplicateIdentityKey(task.title, task.projectName)
                            ) ?? 1
                          }
                          onSelect={handleSelectTask}
                          onToggleComplete={handleToggleComplete}
                          onSetStatus={handleSetStatus}
                          onDelete={async (taskId: string) => {
                            const confirmed = await showConfirm({
                              title: t('myWork.personalTasks.deleteTitle', 'Delete task?'),
                              description: t(
                                'myWork.personalTasks.deleteDesc',
                                'This task will be permanently deleted.'
                              ),
                              confirmLabel: t('common.delete', 'Delete'),
                              variant: 'danger',
                            });
                            if (confirmed) handleDelete(taskId);
                          }}
                          onPreview={(id, data) => setPreviewTaskId(id)}
                          onOpenFull={(id, data) => onTaskClick(id, data)}
                          onInlineEdit={handleInlineEdit}
                          onTriageAccept={handleTriageAcceptToday}
                          onTriageSnooze={handleTriageSnooze}
                          onTriageArchive={handleTriageArchive}
                          columnWidths={columnWidths}
                          hiddenColumns={hiddenSet}
                          focusState={focusState}
                          showRowDescription={showRowDescription}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TableWithPreviewLayout>
      </div>

      {/* Bulk edit popovers (triggered from Command Row bulk mode) */}
      {tasks.length > 0 ? (
        <div className="relative">
          <BulkPriorityPicker
            isOpen={bulkPriorityOpen}
            onClose={() => setBulkPriorityOpen(false)}
            onSelect={handleBulkChangePriority}
            selectedCount={selectedIds.size}
          />
          <BulkDatePicker
            isOpen={bulkDateOpen}
            onClose={() => setBulkDateOpen(false)}
            onSelect={handleBulkChangeDate}
            selectedCount={selectedIds.size}
          />
        </div>
      ) : null}

      {/* Confirm Dialog */}
      {confirmDialog}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default MyTasksListContent;
