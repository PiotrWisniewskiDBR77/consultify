/**
 * MyTasksListContent - Professional task table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit,
  Eye,
  Inbox,
  Loader2,
  Minus,
  MoreVertical,
  Pause,
  Plus,
  Settings2,
  Square,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { Modal } from '@/components/ui/primitives/Modal';
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
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { Task } from '@/types';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { BulkDatePicker, BulkPriorityPicker } from './shared/BulkEditPopovers';
import { type ColumnConfig, ColumnConfigMenu } from './shared/ColumnConfigMenu';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { SavedViewsMenu, type TaskViewPreset } from './shared/SavedViewsMenu';

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
  onBulkBarChange?: (payload: {
    selectedCount: number;
    selectAllVisible: () => void;
    clearSelection: () => void;
    complete: () => void;
    changePriority: () => void;
    changeDueDate: () => void;
    deleteSelected: () => void;
  } | null) => void;
}

const TASK_TABLE_VIEW_STORAGE_KEY = 'consultinity-tasks-table-view';
const TASK_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];

function loadTasksHiddenColumns(): string[] {
  try {
    const raw = localStorage.getItem(TASK_TABLE_VIEW_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

// Priority colors — 5-color semantic palette
const getPriorityConfig = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return {
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-500',
        dot: 'bg-red-500',
        label: 'Critical',
      };
    case 'high':
      return {
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-500',
        dot: 'bg-amber-500',
        label: 'High',
      };
    case 'medium':
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-500',
        dot: 'bg-blue-500',
        label: 'Medium',
      };
    case 'low':
      return {
        color: 'text-slate-500 dark:text-slate-400',
        bg: 'bg-slate-400',
        dot: 'bg-slate-400',
        label: 'Low',
      };
    default:
      return {
        color: 'text-slate-500 dark:text-slate-400',
        bg: 'bg-slate-400',
        dot: 'bg-slate-400',
        label: 'Normal',
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
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50/70 dark:bg-emerald-500/10',
        dot: 'bg-emerald-500',
        label: 'Done',
      };
    case 'in_progress':
    case 'in progress':
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50/70 dark:bg-blue-500/10',
        dot: 'bg-blue-500',
        label: 'In progress',
      };
    case 'pending_approval':
    case 'pending approval':
      return {
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50/70 dark:bg-amber-500/10',
        dot: 'bg-amber-500',
        label: 'Pending approval',
      };
    case 'review':
      return {
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50/70 dark:bg-amber-500/10',
        dot: 'bg-amber-500',
        label: 'In review',
      };
    case 'blocked':
      return {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-500/20',
        dot: 'bg-red-500',
        label: 'Blocked',
      };
    case 'cancelled':
    case 'canceled':
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-navy-800/60',
        dot: 'bg-slate-400 dark:bg-slate-500',
        label: 'Cancelled',
      };
    default:
      return {
        color: 'text-slate-600 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-navy-800/60',
        dot: 'bg-slate-400 dark:bg-slate-500',
        label: 'To Do',
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
    label: 'Task',
    width: 999, // flex — will stretch to fill remaining space
    minWidth: 300,
    resizable: false,
    filterable: false,
  },
  {
    id: 'status',
    label: 'Status',
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
    label: 'Priority',
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
    label: 'Due Date',
    width: 130,
    minWidth: 100,
    maxWidth: 170,
    resizable: true,
    filterable: false,
  },
  {
    id: 'assignee',
    label: 'Assignee',
    width: 160,
    minWidth: 120,
    maxWidth: 220,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

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
  { value: 'todo', label: 'To Do', dot: 'bg-slate-400' },
  { value: 'in_progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'review', label: 'Review', dot: 'bg-amber-500' },
  { value: 'blocked', label: 'Blocked', dot: 'bg-red-500' },
  { value: 'completed', label: 'Done', dot: 'bg-emerald-500' },
];

const INLINE_PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical', dot: 'bg-red-500' },
  { value: 'high', label: 'High', dot: 'bg-amber-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-blue-500' },
  { value: 'low', label: 'Low', dot: 'bg-slate-400' },
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
      className="absolute top-full left-0 mt-1 z-50 min-w-[140px] bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => {
            onSelect(opt.value);
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
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
}) => {
  const { t } = useTranslation();
  const [inlineDropdown, setInlineDropdown] = React.useState<'status' | 'priority' | 'date' | null>(
    null
  );

  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
  const overdue = isOverdue(task.dueDate, task.status);
  const priorityConfig = getPriorityConfig(task.priority);
  const statusConfig = getStatusConfig(task.status);
  const assigneeName = task.assignee?.firstName
    ? `${task.assignee.firstName} ${task.assignee.lastName || ''}`.trim()
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
        group cursor-pointer border-b border-slate-200/70 dark:border-white/[0.06]
        ${isCompleted ? 'opacity-60' : ''}
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        ${isPreviewed ? 'ring-2 ring-cyan-400/30 ring-inset bg-cyan-50/30 dark:bg-cyan-500/5' : ''}
        ${isFocused ? 'ring-2 ring-primary-500/35 ring-inset' : ''}
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
            w-5 h-5 rounded border flex items-center justify-center transition-all
            ${
              isSelected
                ? 'bg-primary-500 border-primary-500 text-white'
                : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Priority Dot */}
      <td className="w-8 px-1 py-2.5" style={{ width: columnWidths.indicator }}>
        <div
          className={`w-2.5 h-2.5 rounded-full ${priorityConfig.dot} ${overdue ? 'animate-pulse' : ''}`}
          title={priorityConfig.label}
        />
      </td>

      {/* Task Title */}
      <td className="px-3 py-2.5 w-full" style={{ minWidth: 300 }}>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-sm font-medium ${
                isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'
              } truncate`}
              title={task.title}
            >
              {task.title}
            </span>
            {focusState?.[task.id] && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                {focusState[task.id] === 'today'
                  ? '📌 Today'
                  : focusState[task.id] === 'thisWeek'
                    ? 'This Week'
                    : 'Later'}
              </span>
            )}
          </div>
          {task.projectName && (
            <span className="text-xs text-slate-500 mt-0.5 truncate" title={task.projectName}>
              {task.projectName}
            </span>
          )}
        </div>
      </td>

      {/* Status — inline editable */}
      {!hiddenCols?.has('status') && (
        <td
          className="px-3 py-2.5 relative"
          style={{ width: columnWidths.status }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'status' ? null : 'status');
          }}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none cursor-pointer hover:ring-2 hover:ring-primary-500/30 transition-all ${statusConfig.bg} ${statusConfig.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
              {statusConfig.label}
            </span>
            {(task as any).triageAction && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
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
          className="px-3 py-2.5 relative"
          style={{ width: columnWidths.priority }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'priority' ? null : 'priority');
          }}
        >
          <span
            className={`text-xs font-medium cursor-pointer hover:underline decoration-dotted ${priorityConfig.color}`}
          >
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
          className="px-3 py-2.5 relative"
          style={{ width: columnWidths.date }}
          onClick={(e) => {
            e.stopPropagation();
            setInlineDropdown(inlineDropdown === 'date' ? null : 'date');
          }}
        >
          <div
            className={`flex items-center gap-1.5 text-xs cursor-pointer hover:underline decoration-dotted ${
              !task.dueDate
                ? 'text-slate-700 dark:text-slate-300 dark:text-slate-600 italic'
                : overdue
                  ? 'text-red-700 dark:text-red-400 font-medium'
                  : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Calendar size={12} />
            <span>{formatDueDate(task.dueDate)}</span>
          </div>
          <AnimatePresence>
            {inlineDropdown === 'date' && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden p-2"
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
                  className="h-8 px-2 text-sm rounded-lg border border-slate-200 dark:border-navy-600 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </td>
      )}

      {/* Assignee */}
      {!hiddenCols?.has('assignee') && (
        <td className="px-3 py-2.5" style={{ width: columnWidths.assignee }}>
          <div className="flex items-center gap-2">
            {assigneeInitial ? (
              <div className="w-6 h-6 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-200">
                {assigneeInitial}
              </div>
            ) : (
              <User size={14} className="text-slate-700 dark:text-slate-300 dark:text-slate-600" />
            )}
            <span
              className={`text-xs truncate max-w-[120px] ${
                assigneeName === 'Unassigned'
                  ? 'text-slate-700 dark:text-slate-300 dark:text-slate-600 italic'
                  : 'text-slate-600 dark:text-slate-400'
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
            actions={
              [
                {
                  id: 'view',
                  label: t('common.view', 'View'),
                  icon: Eye,
                  onClick: () => onOpenFull(task.id, task),
                  variant: 'primary',
                },
                {
                  id: 'edit',
                  label: t('common.edit', 'Edit'),
                  icon: Edit,
                  onClick: () => onOpenFull(task.id, task),
                },
                {
                  id: 'complete',
                  label: isCompleted
                    ? t('myWork.personalTasks.reopen', 'Reopen')
                    : t('myWork.personalTasks.complete', 'Complete'),
                  icon: CheckCircle2,
                  onClick: () => onToggleComplete(task.id, !isCompleted),
                },
                {
                  id: 'status_todo',
                  label: t('myWork.personalTasks.status.todo', 'To do'),
                  icon: CheckSquare,
                  onClick: () => onSetStatus(task.id, 'todo'),
                  divider: true,
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
                        variant: 'primary' as const,
                        divider: true,
                      },
                      {
                        id: 'triage_snooze',
                        label: t('myWork.triage.snooze', 'Snooze 2 days'),
                        icon: Pause,
                        onClick: () => onTriageSnooze?.(task.id),
                      },
                      {
                        id: 'triage_archive',
                        label: t('myWork.triage.archive', 'Archive'),
                        icon: Archive,
                        onClick: () => onTriageArchive?.(task.id),
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  icon: Trash2,
                  onClick: () => onDelete(task.id),
                  variant: 'danger',
                  divider: true,
                },
              ] satisfies RowAction[]
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  // Preview — details kebab + AI zone (Inbox parity)
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Focus state: entity_id → focus column (today / thisWeek / later)
  // TODO: Wire to /api/my-work/focus/state when endpoint is available
  const [focusState, setFocusState] = useState<Record<string, string>>({});

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column widths state (for resizable columns)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

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

  const toggleColumn = useCallback((columnId: string) => {
    setHiddenColumns((prev) => {
      const next = prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId];
      localStorage.setItem(TASK_TABLE_VIEW_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const configurableColumns: ColumnConfig[] = useMemo(
    () => [
      { id: 'status', label: 'Status' },
      { id: 'priority', label: 'Priority' },
      { id: 'date', label: 'Due Date' },
      { id: 'assignee', label: 'Assignee' },
      { id: 'actions', label: 'Actions' },
    ],
    []
  );

  const hiddenSet = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);

  const [isViewSettingsOpen, setIsViewSettingsOpen] = useState(false);

  // Smart sort toggle (persisted)
  const [smartSort, setSmartSort] = useState<boolean>(() => {
    try {
      return localStorage.getItem('consultinity-smart-sort') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSmartSort = useCallback(() => {
    setSmartSort((prev) => {
      const next = !prev;
      localStorage.setItem('consultinity-smart-sort', String(next));
      trackFunnelEvent('smart_sort_toggled', { enabled: next });
      return next;
    });
  }, []);

  // Triage state (persisted in localStorage)
  const [triagedIds, setTriagedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('consultinity-triaged-task-ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markTriaged = useCallback((taskId: string) => {
    setTriagedIds((prev) => {
      const next = new Set(prev);
      next.add(taskId);
      localStorage.setItem('consultinity-triaged-task-ids', JSON.stringify([...next]));
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
      const data = await Api.getPersonalTasks();
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error(t('myWork.errors.fetchFailed', 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshTrigger]);

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
  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await Api.updatePersonalTask(taskId, { status: completed ? 'completed' : 'todo' });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, status: completed ? 'completed' : 'todo' } as Task) : t
        )
      );
      if (completed) {
        trackFunnelEvent('personal_task_completed', { source: 'table', taskId });
      }
      toast.success(completed ? 'Task completed' : 'Task reopened');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleSetStatus = async (
    taskId: string,
    status: 'todo' | 'in_progress' | 'blocked' | 'completed'
  ) => {
    try {
      await Api.updatePersonalTask(taskId, { status });
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
      await Api.updatePersonalTask(taskId, { [field]: value });
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
              className="ml-1 px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-navy-700 rounded hover:bg-slate-300 dark:hover:bg-navy-600 transition-colors"
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
      await Api.updatePersonalTask(taskId, { dueDate: isoDate, status: 'in_progress' });
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
      await Api.updatePersonalTask(taskId, { dueDate: date });
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
      await Api.updatePersonalTask(taskId, { status: 'completed' });
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
      await Api.updatePersonalTask(taskId, { dueDate: isoDate });
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
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
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
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: newWidth,
    }));
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
        Array.from(selectedIds).map((id) => Api.updatePersonalTask(id, { status: 'completed' }))
      );
      setTasks((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, status: 'completed' } as Task) : t))
      );
      toast.success(`${selectedIds.size} tasks completed`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to complete tasks');
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deletePersonalTask(id)));
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      trackFunnelEvent('task_bulk_deleted', { count });
      toast.success(`${count} tasks deleted`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete tasks');
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
      await Promise.all(ids.map((id) => Api.updatePersonalTask(id, { priority: newPriority })));
      trackFunnelEvent('bulk_edit_applied', { field: 'priority', value: newPriority, count });
      toast.success(`Priority → ${newPriority} (${count})`, {
        duration: 5000,
        icon: '🎯',
      });
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
        ids.map((id) => Api.updatePersonalTask(id, { dueDate: isRemove ? null : newDate }))
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
        Array.from(selectedIds).map((id) => Api.updatePersonalTask(id, { status: 'completed' }))
      );
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      toast.success(`${selectedIds.size} tasks completed`);
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
          await Api.updatePersonalTask(focusedTask.id, { priority });
          setTasks((prev) =>
            prev.map((t) => (t.id === focusedTask.id ? ({ ...t, priority } as Task) : t))
          );
          toast.success(`Priority set to ${priority}`);
        } catch {
          toast.error('Failed to update priority');
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

    if (smartSort) {
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
  }, [groupedTasks, tableFilters, smartSort]);

  const orderedTaskIds = useMemo(() => allFilteredTasks.map((t) => t.id), [allFilteredTasks]);

  const previewTask = useMemo(
    () => allFilteredTasks.find((t) => t.id === previewTaskId) || null,
    [allFilteredTasks, previewTaskId]
  );

  useEffect(() => {
    if (previewTaskId && !previewTask) setPreviewTaskId(null);
  }, [previewTaskId, previewTask]);

  useEffect(() => {
    setDetailsMenuOpen(false);
    setAiMenuOpen(false);
    setAiLoading(false);
    setAiError(null);
    setAiText(null);
    setDetailsLoading(false);
    setDetailsOverride(null);
  }, [previewTaskId]);

  const runTaskAi = useCallback(
    async (
      intent:
        | 'why_urgent'
        | 'plan'
        | 'who_can_help'
        | 'expand_details'
        | 'summarize_details',
      task: Task
    ) => {
      try {
        setAiLoading(true);
        setAiError(null);
        const language = isPolish ? 'pl' : 'en';
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
        setAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
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
          toast.success(isPolish ? 'Skopiowano' : 'Copied');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex-1 flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
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
          kicker={isPolish ? 'Podgląd' : 'Preview'}
          renderPreview={(task) => {
            const isCompleted = ['done', 'completed', 'validated'].includes(
              task.status?.toLowerCase() || ''
            );
            const statusCfg = getStatusConfig(task.status);
            const priCfg = getPriorityConfig(task.priority);
            const due = formatDueDate(task.dueDate as any);
            const desc = String(task.description || '').trim();
            const detailsText = detailsOverride ?? desc;

            const metaPillBase =
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';

            return (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${metaPillBase} ${statusCfg.bg} ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </span>
                      <span className={`${metaPillBase} bg-slate-500/10 text-slate-600 dark:text-slate-300`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${priCfg.dot}`} />
                        {priCfg.label}
                      </span>
                      {task.projectName ? (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                          {task.projectName}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        due === 'No due date'
                          ? 'text-slate-400 dark:text-slate-500 italic'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {due}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {task.title}
                    {isCompleted ? (
                      <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        ✓
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {isPolish ? 'Szczegóły' : 'Details'}
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsMenuOpen((v) => !v);
                        }}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                        aria-label={isPolish ? 'Opcje szczegółów' : 'Details options'}
                        title={isPolish ? 'Opcje' : 'Options'}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {detailsMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setDetailsMenuOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsMenuOpen(false);
                                void handleDetailsAction('expand', task);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            >
                              {isPolish ? 'Rozwiń' : 'Expand'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsMenuOpen(false);
                                void handleDetailsAction('summarize', task);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            >
                              {isPolish ? 'Podsumuj' : 'Summarize'}
                            </button>
                            <div className="border-t border-slate-200/70 dark:border-white/[0.08]" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsMenuOpen(false);
                                void handleDetailsAction('copy', task);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            >
                              {isPolish ? 'Kopiuj' : 'Copy'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {detailsLoading ? (
                      <span className="text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Generowanie…' : 'Generating…'}
                      </span>
                    ) : detailsText ? (
                      detailsText
                    ) : (
                      isPolish ? 'Brak opisu.' : 'No description.'
                    )}
                  </div>
                </div>
              </div>
            );
          }}
          renderPreviewFooter={(task) => {
            const footerPillBase =
              'inline-flex items-center justify-center gap-1.5 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
            const isCompleted = ['done', 'completed', 'validated'].includes(
              task.status?.toLowerCase() || ''
            );
            const hintChip =
              'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98]';

            const relations: Array<{ label: string; tone: string }> = [];
            if (task.initiativeName) relations.push({ label: task.initiativeName, tone: 'text-blue-600 dark:text-blue-300' });
            if (Array.isArray(task.dependencies) && task.dependencies.length > 0)
              relations.push({
                label: isPolish ? `Zależności: ${task.dependencies.length}` : `Dependencies: ${task.dependencies.length}`,
                tone: 'text-amber-700 dark:text-amber-300',
              });
            if (Array.isArray(task.attachments) && task.attachments.length > 0)
              relations.push({
                label: isPolish ? `Załączniki: ${task.attachments.length}` : `Attachments: ${task.attachments.length}`,
                tone: 'text-slate-700 dark:text-slate-200',
              });

            return (
              <div className="space-y-0">
                {/* AI hints */}
                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      AI
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setAiMenuOpen((v) => !v)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                        aria-label={isPolish ? 'Opcje AI' : 'AI options'}
                        title={isPolish ? 'Opcje' : 'Options'}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {aiMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                            <button
                              onClick={async () => {
                                setAiMenuOpen(false);
                                if (!aiText) return;
                                try {
                                  await navigator.clipboard.writeText(aiText);
                                  toast.success(isPolish ? 'Skopiowano' : 'Copied');
                                } catch {
                                  toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
                                }
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            >
                              {isPolish ? 'Kopiuj' : 'Copy'}
                            </button>
                            <button
                              onClick={() => {
                                setAiMenuOpen(false);
                                setAiText(null);
                                setAiError(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                            >
                              {isPolish ? 'Wyczyść' : 'Clear'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className={hintChip}
                      onClick={() => runTaskAi('why_urgent', task)}
                      disabled={aiLoading}
                    >
                      {isPolish ? 'Dlaczego pilne?' : 'Why urgent?'}
                    </button>
                    <button
                      className={hintChip}
                      onClick={() => runTaskAi('plan', task)}
                      disabled={aiLoading}
                    >
                      {isPolish ? 'Plan działania' : 'Action plan'}
                    </button>
                    <button
                      className={hintChip}
                      onClick={() => runTaskAi('who_can_help', task)}
                      disabled={aiLoading}
                    >
                      {isPolish ? 'Kto może pomóc?' : 'Who can help?'}
                    </button>
                  </div>

                  {aiLoading ? (
                    <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Analiza…' : 'Thinking…'}
                    </div>
                  ) : aiError ? (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</div>
                  ) : aiText ? (
                    <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {aiText}
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

                {/* Relations (2 rows) */}
                <div className="min-h-[4.5rem]">
                  <div className="flex flex-wrap gap-2 py-1">
                    {relations.length > 0 ? (
                      relations.map((r) => (
                        <span
                          key={r.label}
                          className={`inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent ${r.tone}`}
                          title={r.label}
                        >
                          {r.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Brak powiązań' : 'No relations'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

                {/* Actions */}
                <div className="space-y-2.5 py-1">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTriageAcceptToday(task.id)}
                      className={`${footerPillBase} flex-1 border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15`}
                    >
                      <Zap size={14} />
                      {isPolish ? 'Dziś' : 'Today'}
                    </button>
                    <button
                      onClick={() => handleTriageSnooze(task.id)}
                      className={`${footerPillBase} flex-1 border-amber-300/40 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-500/15`}
                    >
                      <Pause size={14} />
                      {isPolish ? 'Odłóż' : 'Snooze'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleComplete(task.id, !isCompleted)}
                      className={`${footerPillBase} flex-1 border-green-300/40 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-200 hover:bg-green-100/70 dark:hover:bg-green-500/15`}
                    >
                      <CheckCircle2 size={14} />
                      {isCompleted
                        ? isPolish
                          ? 'Wznów'
                          : 'Reopen'
                        : isPolish
                          ? 'Gotowe'
                          : 'Done'}
                    </button>
                    <button
                      onClick={() => onTaskClick(task.id, task)}
                      className={`${footerPillBase} flex-1 border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
                    >
                      <Eye size={14} />
                      {isPolish ? 'Otwórz' : 'Open'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }}
        >
          <div className="pl-4 pr-1.5 pt-3 pb-4">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl">
                <CheckCircle2 size={48} className="text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">
                  {t('myWork.personalTasks.empty.title', 'No tasks yet')}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {t(
                    'myWork.personalTasks.empty.description',
                    'Create your first task to get started'
                  )}
                </p>
                <button
                  onClick={onCreateTask}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Plus size={16} />
                  {t('myWork.personalTasks.create', 'Create task')}
                </button>
              </div>
            ) : (
              <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
                <table className="w-full table-fixed" style={{ minWidth: 900 }}>
                  <thead>
                    <tr className="border-b border-slate-200/70 dark:border-white/[0.06] bg-white/60 dark:bg-navy-900/60 sticky top-0 z-10">
                      {/* Select All */}
                      <th className="w-10 px-2 py-2">
                        <button
                          onClick={() => handleSelectAll(!allSelected)}
                          className={`
                          w-5 h-5 rounded border flex items-center justify-center transition-colors
                          ${
                            allSelected
                              ? 'bg-primary-500 border-primary-500 text-white'
                              : someSelected
                                ? 'bg-primary-500/50 border-primary-500 text-white'
                                : 'border-slate-300 dark:border-white/[0.10] hover:border-primary-400 text-transparent hover:text-slate-500 dark:text-slate-400'
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
                      <th className="w-8 px-1 py-2" />
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-full">
                        {isPolish ? 'Zadanie' : 'Task'}
                      </th>

                  {!hiddenSet.has('status') && (
                    <th
                      className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                      style={{ width: columnWidths.status }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={
                            (tableFilters.status as string[])?.length ? 'text-primary-500' : ''
                          }
                        >
                          Status
                        </span>
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
                        minWidth={100}
                        maxWidth={160}
                        onResize={handleColumnResize}
                      />
                    </th>
                  )}

                  {!hiddenSet.has('priority') && (
                    <th
                      className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                      style={{ width: columnWidths.priority }}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={
                            (tableFilters.priority as string[])?.length ? 'text-primary-500' : ''
                          }
                        >
                          Priority
                        </span>
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
                        minWidth={80}
                        maxWidth={130}
                        onResize={handleColumnResize}
                      />
                    </th>
                  )}

                  {!hiddenSet.has('date') && (
                    <th
                      className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                      style={{ width: columnWidths.date }}
                    >
                      <span>Due Date</span>
                      <ColumnResizer
                        columnId="date"
                        currentWidth={columnWidths.date}
                        minWidth={90}
                        maxWidth={140}
                        onResize={handleColumnResize}
                      />
                    </th>
                  )}
                  {!hiddenSet.has('assignee') && (
                    <th
                      className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                      style={{ width: columnWidths.assignee }}
                    >
                      <span>Assignee</span>
                      <ColumnResizer
                        columnId="assignee"
                        currentWidth={columnWidths.assignee}
                        minWidth={100}
                        maxWidth={180}
                        onResize={handleColumnResize}
                      />
                    </th>
                  )}
                  {!hiddenSet.has('actions') && (
                    <th
                      className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                      style={{ width: columnWidths.actions }}
                    >
                      <button
                        onClick={() => setIsViewSettingsOpen(true)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                        aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                        title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                      >
                        <Settings2 size={14} />
                      </button>
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

      {/* Table View Settings (standard) */}
      <Modal
        open={isViewSettingsOpen}
        onClose={() => setIsViewSettingsOpen(false)}
        title={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
        description={
          isPolish
            ? 'Wybierz, które kolumny są widoczne w tabeli.'
            : 'Choose which columns are visible in the table.'
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => setHiddenColumns([...TASK_TABLE_DEFAULT_HIDDEN_COLUMNS])}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Reset' : 'Reset'}
            </button>
            <button
              onClick={() => setIsViewSettingsOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Gotowe' : 'Done'}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          {TASK_COLUMNS.filter((c) => !['select', 'indicator'].includes(c.id)).map((col) => {
            const alwaysVisible = col.id === 'title' || col.id === 'actions';
            const checked = alwaysVisible ? true : !hiddenSet.has(col.id);
            return (
              <label
                key={col.id}
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 ${
                  alwaysVisible ? 'opacity-60' : 'cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={alwaysVisible}
                  onChange={() => {
                    if (alwaysVisible) return;
                    setHiddenColumns((prev) => {
                      const set = new Set(prev);
                      if (set.has(col.id)) set.delete(col.id);
                      else set.add(col.id);
                      const next = Array.from(set);
                      localStorage.setItem(TASK_TABLE_VIEW_STORAGE_KEY, JSON.stringify(next));
                      return next;
                    });
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">
                  {col.id === 'status'
                    ? isPolish
                      ? 'Status'
                      : 'Status'
                    : col.id === 'priority'
                      ? isPolish
                        ? 'Pilność'
                        : 'Priority'
                      : col.id === 'date'
                        ? isPolish
                          ? 'Termin'
                          : 'Due date'
                        : col.id === 'assignee'
                          ? isPolish
                            ? 'Właściciel'
                            : 'Assignee'
                          : col.label}
                </span>
                {alwaysVisible ? (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {isPolish ? 'Wymagane' : 'Required'}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

export default MyTasksListContent;
