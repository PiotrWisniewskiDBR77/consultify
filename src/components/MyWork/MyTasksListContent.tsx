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
  Pause,
  Plus,
  Square,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
  BulkActionBar,
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
  hover: {
    y: -2,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transition: { duration: 0.2 },
  },
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
  isNew?: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onSetStatus: (taskId: string, status: 'todo' | 'in_progress' | 'blocked' | 'completed') => void;
  onDelete: (taskId: string) => void;
  onClick: (taskId: string, taskData?: Task) => void;
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
  isNew,
  onSelect,
  onToggleComplete,
  onSetStatus,
  onDelete,
  onClick,
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
      whileHover="hover"
      onClick={() => onClick(task.id, task)}
      className={`
        group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
        ${isCompleted ? 'opacity-60' : ''}
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : ''}
        ${isFocused ? 'ring-2 ring-primary-500/50 ring-inset bg-primary-50/50 dark:bg-primary-500/5' : ''}
        transition-colors duration-150
        hover:bg-slate-50 dark:hover:bg-navy-800/50
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
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-medium ${
                isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'
              }`}
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
            <span className="text-xs text-slate-500 mt-0.5">{task.projectName}</span>
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
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[10px] font-medium text-white">
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
                  onClick: () => onClick(task.id, task),
                  variant: 'primary',
                },
                {
                  id: 'edit',
                  label: t('common.edit', 'Edit'),
                  icon: Edit,
                  onClick: () => onClick(task.id, task),
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
}) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

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
    try {
      const saved = localStorage.getItem('consultinity-hidden-columns');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleColumn = useCallback((columnId: string) => {
    setHiddenColumns((prev) => {
      const next = prev.includes(columnId)
        ? prev.filter((c) => c !== columnId)
        : [...prev, columnId];
      localStorage.setItem('consultinity-hidden-columns', JSON.stringify(next));
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

  // Flat list of all visible tasks for keyboard navigation
  const flatTaskList = useMemo(() => {
    return groupedTasks.all;
  }, [groupedTasks]);

  // Get focused task
  const focusedTask =
    focusedIndex >= 0 && focusedIndex < flatTaskList.length ? flatTaskList[focusedIndex] : null;

  // Keyboard shortcuts
  const { showHelp, setShowHelp } = useKeyboardShortcuts({
    enabled: !loading,
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
      <div className="flex-1 overflow-y-auto p-4">
        {/* Quick add */}
        <div className="mb-3">
          <input
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return;
              const title = quickAddTitle.trim();
              if (!title || quickAdding) return;
              try {
                setQuickAdding(true);
                const created = await Api.createPersonalTask({ title });
                setTasks((prev) => [created as Task, ...prev]);
                setQuickAddTitle('');
                trackFunnelEvent('personal_task_created', {
                  source: 'quick_add',
                  taskId: (created as any)?.id,
                });
                toast.success(t('myWork.personalTasks.created', 'Task created'));
              } catch (err) {
                console.error('Quick add failed', err);
                toast.error(t('myWork.errors.createFailed', 'Failed to create task'));
              } finally {
                setQuickAdding(false);
              }
            }}
            placeholder={t(
              'myWork.personalTasks.quickAddPlaceholder',
              'Quick add a task and hit Enter…'
            )}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-60"
            disabled={quickAdding}
          />
        </div>

        {/* Toolbar: Smart sort + Saved Views */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={toggleSmartSort}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
              ${
                smartSort
                  ? 'bg-primary-100 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/30'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:bg-slate-200 dark:hover:bg-navy-700'
              }
            `}
            title={t(
              'myWork.personalTasks.smartSortTooltip',
              'Smart sort: Overdue → Today → High priority → by due date'
            )}
          >
            <ArrowUpDown size={12} />
            {t('myWork.personalTasks.smartSort', 'Smart sort')}
          </button>

          <ColumnConfigMenu
            columns={configurableColumns}
            hiddenColumns={hiddenColumns}
            onToggleColumn={toggleColumn}
          />

          <SavedViewsMenu
            currentState={{
              columnWidths,
              activeFilter,
              tableFilters: tableFilters as Record<string, string[] | undefined>,
              smartSort,
              hiddenColumns: hiddenColumns ?? [],
            }}
            onApplyPreset={(preset: TaskViewPreset) => {
              if (preset.columnWidths) setColumnWidths(preset.columnWidths as ColumnWidths);
              if (preset.tableFilters) setTableFilters(preset.tableFilters as TableFilters);
              if (typeof preset.smartSort === 'boolean') {
                setSmartSort(preset.smartSort);
                localStorage.setItem('consultinity-smart-sort', String(preset.smartSort));
              }
              if (preset.hiddenColumns) setHiddenColumns(preset.hiddenColumns);
            }}
          />
        </div>

        {/* Triage info strip */}
        {activeFilter === 'new' && newUntriagedCount > 0 && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <Inbox size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-700 dark:text-emerald-300">
              {t(
                'myWork.triage.infoStrip',
                `${newUntriagedCount} new task(s) to triage. Use row actions to Accept, Schedule, Snooze, or Archive.`
              )}
            </span>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
            <CheckCircle2 size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t('myWork.personalTasks.empty.title', 'No tasks yet')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t('myWork.personalTasks.empty.description', 'Create your first task to get started')}
            </p>
            <button
              onClick={onCreateTask}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/10 transition-colors"
            >
              <Plus size={16} />
              {t('myWork.personalTasks.create', 'Create task')}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <table className="w-full table-fixed" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
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
                            : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-500 dark:text-slate-400'
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
                  <th className="w-8 px-1 py-2"></th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-full">
                    Task
                  </th>

                  {!hiddenSet.has('status') && (
                    <th
                      className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
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
                      className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
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
                      className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
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
                      className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header"
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
                      className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                      style={{ width: columnWidths.actions }}
                    >
                      Actions
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
                      onClick={onTaskClick}
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

      {/* Bulk Action Bar + Popovers */}
      {tasks.length > 0 && (
        <div className="relative">
          <BulkActionBar
            selectedCount={selectedIds.size}
            onClearSelection={handleClearSelection}
            actions={bulkActions}
          />
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
      )}

      {/* Confirm Dialog */}
      {confirmDialog}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default MyTasksListContent;
