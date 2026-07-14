import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FileQuestion,
  Filter,
  Layers,
  Pin,
  Plus,
  Target,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';

import { Api } from '../../services/api';
import { PMOTaskLabel, usePMOStore } from '../../store/usePMOStore';
import { Task } from '../../types';
import { CardViewStyle, CardViewSwitcher } from '../shared/CardViewSwitcher';
import { type RowAction, type RowActionSection, RowActionsMenu } from '../shared/RowActionsMenu';
import type { GenericListItem, ListColumn, ListSection } from '../shared/ViewLayouts';
import { ClickUpListView, NotionListView } from '../shared/ViewLayouts';
import { ErrorState } from '../ui/primitives/ErrorState';

// PMO Priority Categories
type PMOCategory =
  | 'blocking_phase'
  | 'blocking_initiative'
  | 'awaiting_decision'
  | 'overdue'
  | 'other';

interface TaskInboxProps {
  onEditTask: (id: string) => void;
  onCreateTask?: () => void;
}

// Quick filter type for minimalist UI
type QuickFilter = 'all' | 'overdue' | 'urgent' | 'today';

export const TaskInbox: React.FC<TaskInboxProps> = ({ onEditTask, onCreateTask }) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [openFilter, setOpenFilter] = useState<'quick' | 'view' | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'pmo'>('pmo'); // Default to PMO view
  const [cardStyle, setCardStyle] = useState<CardViewStyle>('d');
  const [expandedCategories, setExpandedCategories] = useState<Set<PMOCategory>>(
    new Set(['blocking_phase', 'blocking_initiative', 'overdue'])
  );

  // Pinned Tasks state
  const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('pinnedTaskIds');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Legacy state - kept for compatibility but unused in new UI
  const [activePriority, setActivePriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');

  const getTaskLabel = usePMOStore((state) => state.getTaskLabel);

  const toggleFilter = (filter: 'quick' | 'view') => {
    setOpenFilter((prev) => (prev === filter ? null : filter));
  };

  // Quick filter labels
  const quickFilterLabels: Record<QuickFilter, string> = {
    all: t('myWork.taskInbox.filter.allTasks', 'All Tasks'),
    overdue: t('myWork.taskInbox.filter.overdue', 'Overdue'),
    urgent: t('myWork.taskInbox.filter.urgent', 'Urgent'),
    today: t('myWork.taskInbox.filter.dueToday', 'Due Today'),
  };

  // Toggle pin for a task
  const togglePinTask = (taskId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setPinnedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      // Save to localStorage
      localStorage.setItem('pinnedTaskIds', JSON.stringify([...next]));
      return next;
    });
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const data = await Api.getTasks();
      // Sort by priority/date? For now just date desc if available or created at
      setTasks(data || []);
    } catch (error) {
      console.error('Failed to fetch tasks', error);
      setLoadError(t('myWork.taskInbox.loadFailed', 'Failed to load tasks'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStatusChange = async (task: Task, newStatus: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      await Api.updateTask(task.id, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus as any } : t))
      );
      toast.success(t('myWork.taskInbox.toast.taskUpdated', 'Task updated'));
    } catch (error) {
      console.error('Failed to update task', error);
      toast.error(t('myWork.taskInbox.toast.updateFailed', 'Failed to update task'));
    }
  };

  const handleDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm(t('myWork.taskInbox.confirmDelete', 'Are you sure you want to delete this task?')))
      return;
    try {
      await Api.deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success(t('myWork.taskInbox.toast.taskDeleted', 'Task deleted'));
    } catch (error) {
      console.error('Failed to delete task', error);
      toast.error(t('myWork.taskInbox.toast.deleteFailed', 'Failed to delete task'));
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      case 'medium':
        return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      case 'low':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800';
    }
  };

  const filteredTasks = (tasks || []).filter((t) => {
    const isDone = ['done', 'completed', 'validated'].includes(t.status?.toLowerCase() || '');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Quick Filter Logic
    switch (quickFilter) {
      case 'overdue':
        // Show only overdue tasks (past due date and not done)
        if (isDone) return false;
        if (!t.dueDate) return false;
        return new Date(t.dueDate) < now;

      case 'urgent':
        // Show only urgent/high priority tasks
        if (isDone) return false;
        return ['urgent', 'high'].includes((t.priority || '').toLowerCase());

      case 'today': {
        // Show tasks due today
        if (isDone) return false;
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        return dueDate >= today && dueDate < tomorrow;
      }

      case 'all':
      default:
        return true;
    }
  });

  // PMO Grouping Logic - uses unpinnedTasks (pinned shown separately)
  const pmoGroupedTasks = useMemo(() => {
    const now = new Date();
    const groups: Record<PMOCategory, Task[]> = {
      blocking_phase: [],
      blocking_initiative: [],
      awaiting_decision: [],
      overdue: [],
      other: [],
    };

    // Filter out pinned tasks from PMO grouping
    const tasksToGroup = filteredTasks.filter((t) => !pinnedTaskIds.has(t.id));

    tasksToGroup.forEach((task) => {
      const isDone = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
      if (isDone) {
        groups.other.push(task);
        return;
      }

      const labels = getTaskLabel(task.id) || [];
      const labelCodes = labels.map((l) => l.code);

      // Check for blocking phase
      if (labelCodes.includes('BLOCKING_PHASE') || labelCodes.includes('GATE_BLOCKER')) {
        groups.blocking_phase.push(task);
        return;
      }

      // Check for blocking initiative
      if (labelCodes.includes('BLOCKING_INITIATIVE') || labelCodes.includes('BLOCKING_PROGRESS')) {
        groups.blocking_initiative.push(task);
        return;
      }

      // Check for awaiting decision
      if (labelCodes.includes('AWAITING_DECISION') || labelCodes.includes('DECISION_REQUIRED')) {
        groups.awaiting_decision.push(task);
        return;
      }

      // Check for overdue
      if (task.dueDate && new Date(task.dueDate) < now) {
        groups.overdue.push(task);
        return;
      }

      // Default category
      groups.other.push(task);
    });

    return groups;
  }, [filteredTasks, getTaskLabel, pinnedTaskIds]);

  // Separate pinned and unpinned tasks
  const { pinnedTasks, unpinnedTasks } = useMemo(() => {
    const pinned = filteredTasks.filter((t) => pinnedTaskIds.has(t.id));
    const unpinned = filteredTasks.filter((t) => !pinnedTaskIds.has(t.id));
    return { pinnedTasks: pinned, unpinnedTasks: unpinned };
  }, [filteredTasks, pinnedTaskIds]);

  const toggleCategory = (category: PMOCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Get validation warnings for a task
  const getTaskWarnings = (task: Task): string[] => {
    const warnings: string[] = [];
    if (!task.assignee && !task.assigneeId) warnings.push('Brak właściciela');
    if (!task.dueDate) warnings.push('Brak terminu');
    if (!task.initiativeId && !task.initiativeName) warnings.push('Brak inicjatywy');
    return warnings;
  };

  const getCardStyle = (task: Task) => {
    const priority = task.priority?.toLowerCase() || 'medium';
    const isDone = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');

    let borderClass = 'border-slate-200 dark:border-navy-700';

    if (priority === 'urgent' && !isDone) {
      borderClass =
        'border-l-4 border-l-rose-500 border-slate-200 dark:border-navy-700 bg-rose-50/20 dark:bg-rose-900/10';
    } else if (isDone) {
      borderClass =
        'border-transparent bg-transparent opacity-75 hover:bg-slate-50 dark:hover:bg-white/5';
    } else {
      borderClass =
        'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-primary-200 dark:hover:border-primary-500/30 shadow-sm dark:shadow-[0_0_15px_rgba(168,85,247,0.05)]';
    }

    return `group p-4 rounded-xl border transition-all hover:shadow-md cursor-pointer relative overflow-hidden ${borderClass}`;
  };

  // Render a single task card
  /* ─── A7.1: Notion / ClickUp view support ─── */
  const taskToGenericItem = useCallback(
    (task: Task): GenericListItem => {
      const statusLower = task.status?.toLowerCase() || '';
      const priorityLower = task.priority?.toLowerCase() || '';
      const statusVariant: GenericListItem['statusVariant'] = [
        'done',
        'completed',
        'validated',
      ].includes(statusLower)
        ? 'success'
        : ['in_progress', 'in progress'].includes(statusLower)
          ? 'info'
          : statusLower === 'blocked'
            ? 'danger'
            : 'warning';
      const priorityVariant: GenericListItem['priorityVariant'] = ['urgent', 'critical'].includes(
        priorityLower
      )
        ? 'critical'
        : priorityLower === 'high'
          ? 'high'
          : priorityLower === 'low'
            ? 'low'
            : 'medium';
      return {
        id: task.id,
        title: task.title || 'Untitled task',
        subtitle: task.description || undefined,
        status: task.status || 'todo',
        statusVariant,
        priority: task.priority || 'medium',
        priorityVariant,
        dueDate: task.dueDate
          ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : undefined,
        isOverdue: task.dueDate
          ? new Date(task.dueDate) < new Date() &&
            !['done', 'completed', 'validated'].includes(statusLower)
          : false,
        assignee: task.assignee
          ? `${task.assignee.firstName || ''} ${task.assignee.lastName || ''}`.trim()
          : undefined,
        secondaryLabel: (task as any).initiativeName || (task as any).projectName || undefined,
        isHighlighted: pinnedTaskIds.has(task.id),
        _raw: task,
      };
    },
    [pinnedTaskIds]
  );

  const taskInboxSections: ListSection[] = useMemo(() => {
    const pinnedItems: GenericListItem[] = filteredTasks
      .filter((t) => pinnedTaskIds.has(t.id))
      .map((t) => taskToGenericItem(t));
    const overdueIds = new Set<string>();
    const overdueItems: GenericListItem[] = filteredTasks
      .filter((t) => {
        if (pinnedTaskIds.has(t.id)) return false;
        const isOverdue =
          t.dueDate &&
          new Date(t.dueDate) < new Date() &&
          !['done', 'completed', 'validated'].includes(t.status?.toLowerCase() || '');
        if (isOverdue) overdueIds.add(t.id);
        return isOverdue;
      })
      .map((t) => taskToGenericItem(t));
    const restItems: GenericListItem[] = filteredTasks
      .filter((t) => !pinnedTaskIds.has(t.id) && !overdueIds.has(t.id))
      .map((t) => taskToGenericItem(t));
    const sections: ListSection[] = [];
    if (pinnedItems.length > 0)
      sections.push({
        id: 'pinned',
        label: t('myWork.taskInbox.section.pinned', 'Pinned'),
        items: pinnedItems,
        accentColor: 'text-amber-500',
      });
    if (overdueItems.length > 0)
      sections.push({
        id: 'overdue',
        label: t('myWork.taskInbox.filter.overdue', 'Overdue'),
        items: overdueItems,
        accentColor: 'text-rose-500',
      });
    if (restItems.length > 0)
      sections.push({
        id: 'tasks',
        label: t('myWork.taskInbox.filter.allTasks', 'All Tasks'),
        items: restItems,
        accentColor: 'text-blue-500',
      });
    return sections;
  }, [filteredTasks, pinnedTaskIds, taskToGenericItem, t]);

  const TASK_INBOX_COLUMNS: ListColumn[] = useMemo(
    () => [
      { key: 'title', label: t('myWork.taskInbox.columns.task', 'Task'), width: 'flex-1 min-w-0' },
      { key: 'status', label: t('myWork.taskInbox.columns.status', 'Status'), width: 'w-28' },
      { key: 'priority', label: t('myWork.taskInbox.columns.priority', 'Priority'), width: 'w-24' },
      { key: 'assignee', label: t('myWork.taskInbox.columns.assignee', 'Assignee'), width: 'w-32' },
      { key: 'dueDate', label: t('myWork.taskInbox.columns.due', 'Due'), width: 'w-24' },
    ],
    [t]
  );

  const handleGenericItemClick = useCallback(
    (item: GenericListItem) => {
      onEditTask(item.id);
    },
    [onEditTask]
  );

  const renderTaskCard = (task: Task) => {
    const isDone = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
    const warnings = getTaskWarnings(task);

    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        onClick={() => onEditTask(task.id)}
        className={getCardStyle(task)}
      >
        <div className="flex gap-4">
          {/* Checkbox / Status Icon */}
          <div className="shrink-0 mt-1">
            <button
              onClick={(e) => handleStatusChange(task, isDone ? 'todo' : 'completed', e)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                isDone
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-500 dark:bg-navy-800 dark:border-navy-700'
              }`}
            >
              {isDone ? <CheckCircle size={18} /> : <Circle size={18} />}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex flex-col gap-0.5">
                {task.initiativeName && (
                  <span className="text-[10px] bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 px-1.5 py-0.5 rounded w-fit font-medium">
                    {task.initiativeName}
                  </span>
                )}
                <h4
                  className={`text-sm font-semibold truncate ${isDone ? 'text-slate-600 line-through' : 'text-navy-900 dark:text-white'}`}
                >
                  {task.title}
                </h4>
                {/* PMO Labels */}
                <PMOTaskLabels taskId={task.id} />
                {/* Validation Warnings */}
                {warnings.length > 0 && !isDone && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {warnings.map((w, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded flex items-center gap-0.5"
                      >
                        <AlertTriangle size={8} />
                        {w}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div
                className={`flex items-center gap-1 text-[10px] whitespace-nowrap ${
                  task.dueDate
                    ? new Date(task.dueDate) < new Date() && !isDone
                      ? 'text-rose-500'
                      : 'text-slate-600 dark:text-slate-500'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Calendar size={10} />
                {task.dueDate ? (
                  new Date(task.dueDate).toLocaleDateString()
                ) : (
                  <span className="italic">{t('myWork.taskInbox.noDueDate', 'No due date')}</span>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2 line-clamp-1">
              {task.why ||
                task.description ||
                t('myWork.taskInbox.noDescription', 'No description')}
            </p>

            {/* Metadata Row */}
            <div className="flex items-center gap-3">
              {/* Priority Badge */}
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 ${getPriorityColor(task.priority)}`}
              >
                <AlertTriangle size={8} />
                <span className="capitalize">
                  {task.priority || t('myWork.taskInbox.priorityNormal', 'Normal')}
                </span>
              </span>
              {/* Assignee */}
              <div
                className={`flex items-center gap-1 text-[10px] ${
                  task.assignee
                    ? 'text-slate-500 dark:text-slate-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <User size={10} />
                <span className="truncate max-w-[80px]">
                  {task.assignee
                    ? task.assignee.lastName ||
                      task.assignee.firstName ||
                      t('myWork.taskInbox.unassigned', 'Unassigned')
                    : t('myWork.taskInbox.unassigned', 'Unassigned')}
                </span>
              </div>
            </div>
          </div>

          {/* Row Actions — "⋯" menu (A3.2: replaces overlapping inline buttons) */}
          <div className="shrink-0 flex items-center pl-2" onClick={(e) => e.stopPropagation()}>
            <RowActionsMenu
              size="sm"
              // #40 — pure-wiring bridge onto the sectional kebab contract (zero visible change).
              sections={
                [
                  {
                    id: 'legacy',
                    actions: [
                      {
                        id: 'pin',
                        label: pinnedTaskIds.has(task.id)
                          ? t('myWork.taskInbox.unpin', 'Unpin')
                          : t('myWork.taskInbox.pinToTop', 'Pin to top'),
                        icon: Pin,
                        onClick: () => togglePinTask(task.id),
                        variant: pinnedTaskIds.has(task.id) ? 'primary' : 'default',
                      },
                      {
                        id: 'delete',
                        label: t('myWork.taskInbox.delete', 'Delete'),
                        icon: Trash2,
                        onClick: () => {
                          if (confirm('Are you sure you want to delete this task?')) {
                            handleDelete(task.id, {
                              stopPropagation: () => {},
                            } as React.MouseEvent);
                          }
                        },
                        variant: 'danger',
                        divider: true,
                      },
                    ] satisfies RowAction[],
                  },
                ] satisfies RowActionSection[]
              }
            />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm h-full flex flex-col">
      {/* Header - Title Row (h-16 = 64px) */}
      <div className="h-16 p-4 flex items-center justify-between border-b border-slate-200 dark:border-navy-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-lg shadow-sm">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-navy-900 dark:text-white">
              {t('myWork.taskInbox.header.title', 'My Tasks')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.taskInbox.header.subtitle', 'Manage your action plan')}
            </p>
          </div>
        </div>
        <button
          onClick={onCreateTask}
          className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
        >
          <Plus size={14} />
          {t('myWork.taskInbox.newTask', 'New Task')}
        </button>
      </div>

      {/* Filter Row (h-12 = 48px) */}
      <div className="h-12 p-4 flex items-center justify-between border-b border-slate-200 dark:border-navy-700 shrink-0">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-600 dark:text-slate-500 text-xs">
            {t('myWork.taskInbox.showing', 'Showing:')}
          </span>

          {/* Quick Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleFilter('quick')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-navy-900 dark:text-white font-medium text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <span
                className={quickFilter !== 'all' ? 'text-primary-600 dark:text-primary-400' : ''}
              >
                {quickFilterLabels[quickFilter]}
              </span>
              <ChevronDown size={14} className="text-slate-600 dark:text-slate-500" />
            </button>

            {openFilter === 'quick' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-navy-700">
                    {t('myWork.taskInbox.quickFilters', 'Quick Filters')}
                  </div>
                  {[
                    {
                      id: 'all' as QuickFilter,
                      label: t('myWork.taskInbox.filter.allTasks', 'All Tasks'),
                      icon: '📋',
                    },
                    {
                      id: 'overdue' as QuickFilter,
                      label: t('myWork.taskInbox.filter.overdue', 'Overdue'),
                      icon: '🔴',
                      color: 'text-rose-600',
                    },
                    {
                      id: 'urgent' as QuickFilter,
                      label: t('myWork.taskInbox.filter.urgent', 'Urgent'),
                      icon: '⚡',
                      color: 'text-amber-600',
                    },
                    {
                      id: 'today' as QuickFilter,
                      label: t('myWork.taskInbox.filter.dueToday', 'Due Today'),
                      icon: '📅',
                      color: 'text-blue-600',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setQuickFilter(opt.id);
                        setOpenFilter(null);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 ${quickFilter === opt.id ? 'font-semibold bg-slate-50 dark:bg-white/5' : ''} ${opt.color || 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <span>{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <span className="text-slate-600 dark:text-white/20">•</span>
          <span className="text-slate-500 dark:text-slate-400 text-xs">
            {filteredTasks.length} tasks
          </span>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <CardViewSwitcher moduleId="tasks" value={cardStyle} onChange={setCardStyle} compact />
          <span className="text-slate-600 dark:text-slate-500 text-xs hidden sm:inline">
            {t('myWork.taskInbox.view', 'View:')}
          </span>
          <div className="relative">
            <button
              onClick={() => toggleFilter('view')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 text-navy-900 dark:text-white font-medium text-xs hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
            >
              <Layers size={12} className="text-primary-500" />
              {viewMode === 'pmo'
                ? t('myWork.taskInbox.viewMode.pmoPriority', 'PMO Priority')
                : t('myWork.taskInbox.viewMode.list', 'List')}
              <ChevronDown size={14} className="text-slate-600 dark:text-slate-500" />
            </button>

            {openFilter === 'view' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>
                <div className="absolute top-full right-0 mt-1 w-36 bg-white dark:bg-navy-800 rounded-lg shadow-xl border border-slate-200 dark:border-navy-700 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => {
                      setViewMode('pmo');
                      setOpenFilter(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 ${viewMode === 'pmo' ? 'font-semibold bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-200'}`}
                  >
                    <Layers size={12} />
                    {t('myWork.taskInbox.viewMode.pmoPriority', 'PMO Priority')}
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('list');
                      setOpenFilter(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2 ${viewMode === 'list' ? 'font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}
                  >
                    <CheckCircle2 size={12} />
                    {t('myWork.taskInbox.viewMode.listView', 'List View')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 p-3 space-y-2 min-h-0">
        {loading && (
          <div className="text-center p-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-xs text-slate-600 dark:text-slate-500">
              {t('myWork.taskInbox.syncing', 'Syncing tasks...')}
            </p>
          </div>
        )}

        {!loading && loadError && (
          <ErrorState message={loadError} retry={fetchTasks} className="h-full" />
        )}

        {!loading && !loadError && filteredTasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-600 dark:text-slate-500 opacity-50">
            <CheckCircle2 size={32} className="mb-3" />
            <p className="text-sm">{t('myWork.taskInbox.noTasksFound', 'No tasks found')}</p>
            <button onClick={onCreateTask} className="mt-2 text-xs text-blue-500 hover:underline">
              Create one?
            </button>
          </div>
        )}

        {/* N view */}
        {cardStyle === 'n' && !loading && filteredTasks.length > 0 && (
          <div className="h-full overflow-y-auto">
            <NotionListView
              sections={taskInboxSections}
              onItemClick={handleGenericItemClick}
              emptyMessage="No tasks"
            />
          </div>
        )}

        {/* C view */}
        {cardStyle === 'c' && !loading && filteredTasks.length > 0 && (
          <div className="h-full overflow-y-auto">
            <ClickUpListView
              sections={taskInboxSections}
              columns={TASK_INBOX_COLUMNS}
              onItemClick={handleGenericItemClick}
              emptyMessage="No tasks"
            />
          </div>
        )}

        {/* Pinned Tasks Section (Always rendered normally as it's small) — only in current view */}
        {cardStyle === 'd' && !loading && pinnedTasks.length > 0 && (
          <div className="mb-4 pb-3 border-b border-dashed border-slate-200 dark:border-navy-700 flex-shrink-0">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Pin size={12} className="text-primary-500" />
              <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                Pinned
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-500">
                ({pinnedTasks.length})
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {pinnedTasks.map((task) => renderTaskCard(task))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* PMO Priority View — only in current card style */}
        {cardStyle === 'd' && viewMode === 'pmo' && !loading && unpinnedTasks.length > 0 && (
          <div className="space-y-4 overflow-y-auto h-full custom-scrollbar pb-10">
            {/* PMO Category Sections */}
            {[
              {
                key: 'blocking_phase' as PMOCategory,
                label: '🔴 Blokujące Fazę',
                color: 'border-rose-500',
                bgColor: 'bg-rose-50 dark:bg-rose-900/10',
              },
              {
                key: 'blocking_initiative' as PMOCategory,
                label: '🟠 Blokujące Inicjatywy',
                color: 'border-amber-500',
                bgColor: 'bg-amber-50 dark:bg-amber-900/10',
              },
              {
                key: 'awaiting_decision' as PMOCategory,
                label: '🟡 Oczekujące na Decyzję',
                color: 'border-yellow-500',
                bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
              },
              {
                key: 'overdue' as PMOCategory,
                label: '⚫ Przeterminowane',
                color: 'border-slate-500',
                bgColor: 'bg-slate-50 dark:bg-slate-800/50',
              },
              {
                key: 'other' as PMOCategory,
                label: '✅ Pozostałe',
                color: 'border-green-500',
                bgColor: 'bg-green-50 dark:bg-green-900/10',
              },
            ].map((category) => {
              const categoryTasks = pmoGroupedTasks[category.key];
              if (categoryTasks.length === 0) return null;

              const isExpanded = expandedCategories.has(category.key);

              return (
                <div
                  key={category.key}
                  className={`rounded-xl border-l-4 ${category.color} ${category.bgColor} overflow-hidden`}
                >
                  <button
                    onClick={() => toggleCategory(category.key)}
                    className="w-full flex items-center justify-between p-3 hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-navy-900 dark:text-white">
                        {category.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-white dark:bg-navy-800 rounded-full text-slate-600 dark:text-slate-300 font-medium">
                        {categoryTasks.length}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="p-2 pt-0 space-y-2">
                      {categoryTasks.map((task) => renderTaskCard(task))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* List View - VIRTUALIZED — only in current card style */}
        {cardStyle === 'd' && viewMode === 'list' && !loading && unpinnedTasks.length > 0 && (
          <Virtuoso
            style={{ height: '100%' }}
            data={unpinnedTasks}
            itemContent={(index: number, task: Task) => (
              <div className="pb-2">{renderTaskCard(task)}</div>
            )}
          />
        )}
      </div>
    </div>
  );
};

/**
 * PMO Task Labels Component - Shows PMO-relevant labels for a task
 */
const PMOTaskLabels: React.FC<{ taskId: string }> = ({ taskId }) => {
  const getTaskLabel = usePMOStore((state) => state.getTaskLabel);
  const labels = getTaskLabel(taskId);

  if (!labels || labels.length === 0) return null;

  const getLabelStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/30';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/30';
      default:
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/30';
    }
  };

  const getLabelIcon = (code: string) => {
    switch (code) {
      case 'OVERDUE':
      case 'BLOCKING_PROGRESS':
        return <AlertCircle size={8} />;
      case 'BLOCKED':
        return <AlertTriangle size={8} />;
      case 'UNASSIGNED':
        return <User size={8} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {labels.slice(0, 2).map((label, idx) => (
        <span
          key={idx}
          className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border font-medium ${getLabelStyle(label.severity)}`}
        >
          {getLabelIcon(label.code)}
          {label.text}
        </span>
      ))}
    </div>
  );
};
