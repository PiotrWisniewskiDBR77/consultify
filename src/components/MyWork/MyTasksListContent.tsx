/**
 * MyTasksListContent - Professional task table for MyWorkHub
 * Interview-style design with hover animations and resizable columns
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  BarChart3,
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
  TrendingUp,
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

// Priority colors
const getPriorityConfig = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
    case 'critical':
      return { color: 'text-red-400', bg: 'bg-red-500', dot: 'bg-red-500', label: 'Critical' };
    case 'high':
      return { color: 'text-orange-400', bg: 'bg-orange-500', dot: 'bg-orange-500', label: 'High' };
    case 'medium':
      return { color: 'text-blue-400', bg: 'bg-blue-500', dot: 'bg-blue-500', label: 'Medium' };
    case 'low':
      return { color: 'text-slate-400', bg: 'bg-slate-500', dot: 'bg-slate-500', label: 'Low' };
    default:
      return { color: 'text-slate-400', bg: 'bg-slate-500', dot: 'bg-slate-500', label: 'Normal' };
  }
};

// Status config
const getStatusConfig = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'done':
    case 'completed':
    case 'validated':
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-100 dark:bg-emerald-500/20',
        dot: 'bg-emerald-500',
        label: 'Done',
      };
    case 'in_progress':
    case 'in progress':
      return {
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-500/20',
        dot: 'bg-blue-500',
        label: 'In progress',
      };
    case 'pending_approval':
    case 'pending approval':
      return {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-500/20',
        dot: 'bg-purple-500',
        label: 'Pending approval',
      };
    case 'review':
      return {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-500/20',
        dot: 'bg-purple-500',
        label: 'Pending approval',
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
        color: 'text-slate-700 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-500/20',
        dot: 'bg-slate-500',
        label: 'Cancelled',
      };
    default:
      return {
        color: 'text-slate-700 dark:text-slate-400',
        bg: 'bg-slate-100 dark:bg-slate-500/20',
        dot: 'bg-slate-500',
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
    width: 300,
    minWidth: 200,
    resizable: false,
    filterable: false,
  },
  {
    id: 'status',
    label: 'Status',
    width: 120,
    minWidth: 100,
    maxWidth: 160,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: TASK_STATUS_FILTER_OPTIONS,
  },
  {
    id: 'priority',
    label: 'Priority',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: PRIORITY_FILTER_OPTIONS,
  },
  {
    id: 'date',
    label: 'Due Date',
    width: 110,
    minWidth: 90,
    maxWidth: 140,
    resizable: true,
    filterable: false,
  },
  {
    id: 'assignee',
    label: 'Assignee',
    width: 130,
    minWidth: 100,
    maxWidth: 180,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
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
  onDelete: (taskId: string) => void;
  onClick: (taskId: string, taskData?: Task) => void;
  columnWidths: ColumnWidths;
}> = ({
  task,
  isSelected,
  isFocused,
  onSelect,
  onToggleComplete,
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
      {/* Task Title */}
      <td className="px-3 py-2.5" style={{ minWidth: 200 }}>
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
              ? 'text-slate-300 dark:text-slate-600 italic'
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
            <User size={14} className="text-slate-300 dark:text-slate-600" />
          )}
          <span
            className={`text-xs truncate max-w-[80px] ${
              assigneeName === 'Unassigned'
                ? 'text-slate-300 dark:text-slate-600 italic'
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
                  ? t('myWork.tasks.reopen', 'Reopen')
                  : t('myWork.tasks.complete', 'Complete'),
                icon: CheckCircle2,
                onClick: () => onToggleComplete(task.id, !isCompleted),
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
      const data = await Api.getTasks();
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

  // Calculate task statistics (PMO standards) - BEFORE early returns
  const taskStats = useMemo(() => {
    const allTasks = groupedTasks.all;
    const total = allTasks.length;
    const completed = allTasks.filter((t) =>
      ['done', 'completed', 'validated'].includes(t.status?.toLowerCase() || '')
    ).length;
    const inProgress = allTasks.filter((t) =>
      ['in_progress', 'in progress', 'review'].includes(t.status?.toLowerCase() || '')
    ).length;
    const blocked = allTasks.filter((t) => t.status?.toLowerCase() === 'blocked').length;
    const todo = allTasks.filter((t) =>
      ['todo', 'to do'].includes(t.status?.toLowerCase() || '')
    ).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdue = groupedTasks.overdue.length;
    const critical = allTasks.filter((t) =>
      ['critical', 'urgent'].includes(t.priority?.toLowerCase() || '')
    ).length;

    return {
      total,
      completed,
      inProgress,
      blocked,
      todo,
      overdue,
      critical,
      completionRate,
    };
  }, [groupedTasks]);

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
      await Api.updateTask(taskId, { status: completed ? 'completed' : 'todo' });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, status: completed ? 'completed' : 'todo' } as Task) : t
        )
      );
      toast.success(completed ? 'Task completed' : 'Task reopened');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await Api.deleteTask(taskId);
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
        Array.from(selectedIds).map((id) => Api.updateTask(id, { status: 'completed' }))
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
      await Promise.all(Array.from(selectedIds).map((id) => Api.deleteTask(id)));
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
          Api.updateTask(id, { priority: newPriority.toLowerCase() })
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
        Array.from(selectedIds).map((id) => Api.updateTask(id, { dueDate: newDate }))
      );
      setTasks((prev) =>
        prev.map((t) => (selectedIds.has(t.id) ? ({ ...t, dueDate: newDate } as Task) : t))
      );
      toast.success(`Due date updated for ${selectedIds.size} tasks`);
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to update due date'));
    }
  };

  const handleBulkArchive = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => Api.updateTask(id, { status: 'archived' }))
      );
      setTasks((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      toast.success(`${selectedIds.size} tasks archived`);
      setSelectedIds(new Set());
    } catch {
      toast.error(t('myWork.errors.updateFailed', 'Failed to archive tasks'));
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
          await Api.updateTask(focusedTask.id, { priority });
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
          {/* Task Statistics Panel - PMO Standards - Always visible */}
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Show loading state for stats */}
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4 animate-pulse"
              >
                <div className="h-4 bg-slate-200 dark:bg-navy-700 rounded w-16 mb-2"></div>
                <div className="h-8 bg-slate-200 dark:bg-navy-700 rounded w-12"></div>
              </div>
            ))}
          </div>
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
        {/* Task Statistics Panel - PMO Standards - Always visible */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Total Tasks */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t('myWork.stats.total', 'Total')}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {taskStats.total}
            </div>
          </div>

          {/* Completed */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t('myWork.stats.completed', 'Completed')}
              </span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {taskStats.completed}
            </div>
          </div>

          {/* In Progress */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-blue-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t('myWork.stats.inProgress', 'In Progress')}
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {taskStats.inProgress}
            </div>
          </div>

          {/* Blocked */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t('myWork.stats.blocked', 'Blocked')}
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {taskStats.blocked}
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white dark:bg-navy-900 border border-red-200 dark:border-red-900/30 rounded-lg p-4 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">
                {t('myWork.stats.overdue', 'Overdue')}
              </span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {taskStats.overdue}
            </div>
          </div>

          {/* Critical */}
          <div className="bg-white dark:bg-navy-900 border border-orange-200 dark:border-orange-900/30 rounded-lg p-4 bg-orange-50/50 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase">
                {t('myWork.stats.critical', 'Critical')}
              </span>
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {taskStats.critical}
            </div>
          </div>

          {/* Status Summary */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 size={16} className="text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                {t('myWork.stats.statusSummary', 'Status')}
              </span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
              {taskStats.todo > 0 && (
                <div>
                  <span className="font-medium">{taskStats.todo}</span> todo
                </div>
              )}
              {taskStats.inProgress > 0 && (
                <div>
                  <span className="font-medium">{taskStats.inProgress}</span> in progress
                </div>
              )}
              {taskStats.blocked > 0 && (
                <div>
                  <span className="font-medium">{taskStats.blocked}</span> blocked
                </div>
              )}
              {taskStats.overdue > 0 && (
                <div>
                  <span className="font-medium">{taskStats.overdue}</span> overdue
                </div>
              )}
              {taskStats.critical > 0 && (
                <div>
                  <span className="font-medium">{taskStats.critical}</span> critical
                </div>
              )}
              {taskStats.completed > 0 && (
                <div>
                  <span className="font-medium">{taskStats.completed}</span> done
                </div>
              )}
              {taskStats.todo === 0 &&
                taskStats.inProgress === 0 &&
                taskStats.blocked === 0 &&
                taskStats.overdue === 0 &&
                taskStats.critical === 0 &&
                taskStats.completed === 0 && (
                  <div className="text-slate-400 dark:text-slate-500">No tasks</div>
                )}
            </div>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
            <CheckCircle2 size={48} className="text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-400 mb-2">No tasks yet</h3>
            <p className="text-sm text-slate-500 mb-4">Create your first task to get started</p>
            <button
              onClick={onCreateTask}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/10 transition-colors"
            >
              <Plus size={16} />
              Create Task
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
            <table className="w-full" style={{ minWidth: 900 }}>
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
                            : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
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
