/**
 * MyTasksList - ClickUp-style compact task list with time-based grouping
 * Groups: Overdue, Today, This Week, Later, No Date
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Clock,
  Pin,
  Plus,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { Task } from '../../types';
import { TaskRow } from './TaskRow';
import { TaskTimeGroup } from './WorkSidebar';

interface TaskCounts {
  total: number;
  overdue: number;
  today: number;
  week: number;
  later: number;
  noDate: number;
}

interface MyTasksListProps {
  activeTimeGroup: TaskTimeGroup;
  onCountsChange: (counts: TaskCounts) => void;
  onTaskClick: (taskId: string) => void;
  onCreateTask: () => void;
}

interface TimeGroupConfig {
  key: TaskTimeGroup;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const getTimeGroupConfigs = (t: (key: string, fallback: string) => string): TimeGroupConfig[] => [
  {
    key: 'overdue',
    label: t('myWork.timeGroup.overdue', 'Overdue'),
    icon: AlertCircle,
    color: 'text-danger-600 dark:text-danger-400',
    bgColor: 'bg-danger-50 dark:bg-danger-900/20',
    borderColor: 'border-danger-200 dark:border-danger-800/30',
  },
  {
    key: 'today',
    label: t('myWork.timeGroup.today', 'Today'),
    icon: Calendar,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800/30',
  },
  {
    key: 'week',
    label: t('myWork.timeGroup.thisWeek', 'This Week'),
    icon: CalendarDays,
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
    borderColor: 'border-slate-200 dark:border-slate-700/30',
  },
  {
    key: 'later',
    label: t('myWork.timeGroup.later', 'Later'),
    icon: Clock,
    color: 'text-slate-500 dark:text-slate-400',
    bgColor: 'bg-white dark:bg-navy-900',
    borderColor: 'border-slate-200 dark:border-navy-700',
  },
  {
    key: 'no-date',
    label: t('myWork.timeGroup.noDate', 'No Date'),
    icon: CircleDashed,
    color: 'text-slate-600 dark:text-slate-500',
    bgColor: 'bg-white dark:bg-navy-900',
    borderColor: 'border-slate-200 dark:border-navy-700',
  },
];

const categorizeTask = (task: Task): TaskTimeGroup => {
  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');

  if (isCompleted) return 'later'; // Put completed tasks in "later" group

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

export const MyTasksList: React.FC<MyTasksListProps> = ({
  activeTimeGroup,
  onCountsChange,
  onTaskClick,
  onCreateTask,
}) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<TaskTimeGroup>>(
    new Set(['overdue', 'today', 'week', 'later', 'no-date'])
  );
  const [pinnedTaskIds, setPinnedTaskIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('pinnedTaskIds');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const timeGroupConfigs = useMemo(() => getTimeGroupConfigs(t), [t]);

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

  // Group tasks by time category
  const groupedTasks = useMemo(() => {
    const groups: Record<TaskTimeGroup, Task[]> = {
      all: [],
      overdue: [],
      today: [],
      week: [],
      later: [],
      'no-date': [],
    };

    tasks.forEach((task) => {
      const category = categorizeTask(task);
      groups[category].push(task);
      groups.all.push(task);
    });

    // Sort each group by priority then due date
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    Object.keys(groups).forEach((key) => {
      groups[key as TaskTimeGroup].sort((a, b) => {
        // Pinned tasks first
        const aPinned = pinnedTaskIds.has(a.id) ? 0 : 1;
        const bPinned = pinnedTaskIds.has(b.id) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;

        // Then by priority
        const aPriority = priorityOrder[a.priority?.toLowerCase() || 'medium'] ?? 2;
        const bPriority = priorityOrder[b.priority?.toLowerCase() || 'medium'] ?? 2;
        if (aPriority !== bPriority) return aPriority - bPriority;

        // Then by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });
    });

    return groups;
  }, [tasks, pinnedTaskIds]);

  // Calculate counts and notify parent
  useEffect(() => {
    const counts: TaskCounts = {
      total: groupedTasks.all.length,
      overdue: groupedTasks.overdue.length,
      today: groupedTasks.today.length,
      week: groupedTasks.week.length,
      later: groupedTasks.later.length,
      noDate: groupedTasks['no-date'].length,
    };
    onCountsChange(counts);
  }, [groupedTasks, onCountsChange]);

  // Get tasks to display based on filter
  const displayTasks = useMemo(() => {
    if (activeTimeGroup === 'all') {
      return groupedTasks;
    }
    // Return only the selected group
    return {
      ...groupedTasks,
      // Clear other groups
      overdue: activeTimeGroup === 'overdue' ? groupedTasks.overdue : [],
      today: activeTimeGroup === 'today' ? groupedTasks.today : [],
      week: activeTimeGroup === 'week' ? groupedTasks.week : [],
      later: activeTimeGroup === 'later' ? groupedTasks.later : [],
      'no-date': activeTimeGroup === 'no-date' ? groupedTasks['no-date'] : [],
    };
  }, [activeTimeGroup, groupedTasks]);

  // Handlers
  const toggleGroup = (group: TaskTimeGroup) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    try {
      await Api.updateTask(taskId, {
        status: completed ? 'completed' : 'todo',
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? ({ ...t, status: completed ? 'completed' : 'todo' } as unknown as Task)
            : t
        )
      );
      toast.success(
        completed
          ? t('myWork.taskCompleted', 'Task completed')
          : t('myWork.taskReopened', 'Task reopened')
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      toast.error(t('myWork.errors.updateFailed', 'Failed to update task'));
    }
  };

  const handleTogglePin = (taskId: string) => {
    setPinnedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      localStorage.setItem('pinnedTaskIds', JSON.stringify([...next]));
      return next;
    });
  };

  const handleDelete = async (taskId: string) => {
    try {
      await Api.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success(t('myWork.taskDeleted', 'Task deleted'));
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error(t('myWork.errors.deleteFailed', 'Failed to delete task'));
    }
  };

  // Separate pinned tasks
  const pinnedTasks = useMemo(() => {
    return tasks.filter((t) => pinnedTaskIds.has(t.id));
  }, [tasks, pinnedTaskIds]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  const hasAnyTasks = tasks.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-900">
      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {!hasAnyTasks ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <CheckCircle2 size={48} className="text-slate-600 dark:text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t('myWork.emptyState.title', 'No tasks yet')}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-500 mb-4">
              {t('myWork.emptyState.description', 'Create your first task to get started')}
            </p>
            <button
              onClick={onCreateTask}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Plus size={16} />
              {t('myWork.createFirstTask', 'Create Task')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-white/[0.03]">
            {/* Pinned Tasks Section */}
            {pinnedTasks.length > 0 && activeTimeGroup === 'all' && (
              <div className="pb-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800/30">
                  <Pin size={14} className="text-primary-500" />
                  <span className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                    {t('myWork.pinned', 'Pinned')}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-300">
                    {pinnedTasks.length}
                  </span>
                </div>
                <AnimatePresence>
                  {pinnedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isPinned={true}
                      onToggleComplete={handleToggleComplete}
                      onTogglePin={handleTogglePin}
                      onDelete={handleDelete}
                      onClick={onTaskClick}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Time Groups */}
            {timeGroupConfigs.map((config) => {
              const groupTasks = displayTasks[config.key].filter(
                (t) => !pinnedTaskIds.has(t.id) || activeTimeGroup !== 'all'
              );

              if (groupTasks.length === 0) return null;

              const isExpanded = expandedGroups.has(config.key);

              return (
                <div key={config.key}>
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(config.key)}
                    className={`w-full flex items-center gap-2 px-4 py-2 ${config.bgColor} border-b ${config.borderColor} transition-colors hover:opacity-90`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronRight size={14} className="text-slate-600 dark:text-slate-500" />
                    )}
                    <config.icon size={14} className={config.color} />
                    <span className={`text-xs font-medium uppercase tracking-wide ${config.color}`}>
                      {config.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        config.key === 'overdue'
                          ? 'bg-danger-100 dark:bg-danger-800/50 text-danger-600 dark:text-danger-300'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {groupTasks.length}
                    </span>
                  </button>

                  {/* Group Tasks */}
                  {isExpanded && (
                    <AnimatePresence>
                      {groupTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          isPinned={pinnedTaskIds.has(task.id)}
                          onToggleComplete={handleToggleComplete}
                          onTogglePin={handleTogglePin}
                          onDelete={handleDelete}
                          onClick={onTaskClick}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTasksList;
