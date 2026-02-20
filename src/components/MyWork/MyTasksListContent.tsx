/**
 * MyTasksListContent - Professional task table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit,
  Eye,
  Loader2,
  Minus,
  Plus,
  Square,
  Trash2,
  User,
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
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';

type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type TaskTimeGroup = 'all' | 'overdue' | 'today' | 'week' | 'later' | 'no-date';

interface TaskCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  urgent: number;
}

interface MyTasksListContentProps {
  activeFilter: TaskFilter;
  searchQuery: string;
  onTaskClick: (taskId: string, taskData?: Task) => void;
  onCreateTask: () => void;
  onCountsChange: (counts: TaskCounts) => void;
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

// Task Row Component
const TaskTableRow: React.FC<{
  task: Task;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: (taskId: string) => void;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onSetStatus: (taskId: string, status: 'todo' | 'in_progress' | 'blocked' | 'completed') => void;
  onDelete: (taskId: string) => void;
  onClick: (taskId: string, taskData?: Task) => void;
  columnWidths: ColumnWidths;
}> = ({
  task,
  isSelected,
  isFocused,
  onSelect,
  onToggleComplete,
  onSetStatus,
  onDelete,
  onClick,
  columnWidths,
}) => {
  const { t } = useTranslation();

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
          <span
            className={`text-sm font-medium ${
              isCompleted ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'
            }`}
          >
            {task.title}
          </span>
          {task.projectName && (
            <span className="text-xs text-slate-500 mt-0.5">{task.projectName}</span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.status }}>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap leading-none ${statusConfig.bg} ${statusConfig.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.priority }}>
        <span className={`text-xs font-medium ${priorityConfig.color}`}>
          {priorityConfig.label}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.date }}>
        <div
          className={`flex items-center gap-1.5 text-xs ${
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
      </td>

      {/* Assignee */}
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

      {/* Actions — "⋯" menu (A3.2: replaces overlapping inline buttons) */}
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
              {
                id: 'delete',
                label: t('common.delete', 'Delete'),
                icon: Trash2,
                onClick: () => {
                  if (confirm('Delete this task?')) {
                    onDelete(task.id);
                  }
                },
                variant: 'danger',
                divider: true,
              },
            ] satisfies RowAction[]
          }
        />
      </td>
    </motion.tr>
  );
};

export const MyTasksListContent: React.FC<MyTasksListContentProps> = ({
  activeFilter,
  searchQuery,
  onTaskClick,
  onCreateTask,
  onCountsChange,
}) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

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
  }, [fetchTasks]);

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

    // Filter by priority if urgent filter
    if (activeFilter === 'urgent') {
      filteredTasks = filteredTasks.filter((task) => {
        const p = task.priority?.toLowerCase();
        return p === 'urgent' || p === 'critical' || p === 'high';
      });
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
  }, [tasks, searchQuery, activeFilter]);

  // Calculate counts
  const urgentCount = useMemo(() => {
    return tasks.filter((task) => {
      const p = task.priority?.toLowerCase();
      return p === 'urgent' || p === 'critical' || p === 'high';
    }).length;
  }, [tasks]);

  useEffect(() => {
    const counts: TaskCounts = {
      total: groupedTasks.all.length,
      overdue: groupedTasks.overdue.length,
      today: groupedTasks.today.length,
      week: groupedTasks.week.length,
      urgent: urgentCount,
    };
    onCountsChange(counts);
  }, [groupedTasks, urgentCount, onCountsChange]);

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

  const handleDelete = async (taskId: string) => {
    try {
      await Api.deletePersonalTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
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
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deletePersonalTask(id)));
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      toast.success(`${selectedIds.size} tasks deleted`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete tasks');
    }
  };

  // Create bulk action configuration
  const handleBulkChangePriority = async () => {
    const newPriority = prompt('Set priority for selected tasks (low / medium / high / critical):');
    if (
      !newPriority ||
      !['low', 'medium', 'high', 'critical', 'urgent'].includes(newPriority.toLowerCase())
    )
      return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          Api.updatePersonalTask(id, { priority: newPriority.toLowerCase() })
        )
      );
      setTasks((prev) =>
        prev.map((t) =>
          selectedIds.has(t.id) ? ({ ...t, priority: newPriority.toLowerCase() } as Task) : t
        )
      );
      toast.success(`Priority set to ${newPriority} for ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update priority'));
    }
  };

  const handleBulkChangeDate = async () => {
    const newDate = prompt('Set due date (YYYY-MM-DD):');
    if (!newDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      if (newDate) toast.error('Invalid date format. Use YYYY-MM-DD');
      return;
    }
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => Api.updatePersonalTask(id, { dueDate: newDate }))
      );
      setTasks((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, dueDate: newDate } as Task) : t))
      );
      trackFunnelEvent('personal_task_due_date_set', { source: 'bulk', count: selectedIds.size });
      toast.success(`Due date updated for ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
    } catch {
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
    onDelete: handleBulkDelete,
    onChangePriority: handleBulkChangePriority,
    onChangeDate: handleBulkChangeDate,
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
        if (confirm(`Delete ${selectedIds.size} task(s)?`)) {
          await handleBulkDelete();
        }
      } else if (focusedTask) {
        if (confirm('Delete this task?')) {
          await handleDelete(focusedTask.id);
        }
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

  // Flat list of all tasks (no grouping) - must be before early returns
  const allFilteredTasks = useMemo(() => {
    let result: Task[] = [...groupedTasks.all];

    // Apply table filters
    const statusFilter = tableFilters.status as string[] | undefined;
    const priorityFilter = tableFilters.priority as string[] | undefined;

    if (statusFilter?.length) {
      result = result.filter((task) => statusFilter.includes(task.status?.toLowerCase() || ''));
    }
    if (priorityFilter?.length) {
      result = result.filter((task) => priorityFilter.includes(task.priority?.toLowerCase() || ''));
    }

    return result;
  }, [groupedTasks, tableFilters]);

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
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
            <CheckCircle2 size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-500 dark:text-slate-400 mb-2">
              {t('myWork.personalTasks.empty.title', 'No tasks yet')}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              {t(
                'myWork.personalTasks.empty.description',
                'Create your first task to get started'
              )}
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

                  {/* Status with Filter */}
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

                  {/* Priority with Filter */}
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
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                    style={{ width: columnWidths.actions }}
                  >
                    Actions
                  </th>
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
                      onSelect={handleSelectTask}
                      onToggleComplete={handleToggleComplete}
                      onSetStatus={handleSetStatus}
                      onDelete={handleDelete}
                      onClick={onTaskClick}
                      columnWidths={columnWidths}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Action Bar - Only show when tasks exist */}
      {tasks.length > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClearSelection={handleClearSelection}
          actions={bulkActions}
        />
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
};

export default MyTasksListContent;
