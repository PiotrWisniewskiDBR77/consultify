/**
 * TaskRow - Minimalist compact task row (48px height)
 * ClickUp-style design with hover actions
 */

import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Circle, Pin, Trash2, User } from 'lucide-react';
import React from 'react';

import { Task } from '../../types';
import { type RowAction, RowActionsMenu } from '../shared/RowActionsMenu';

interface TaskRowProps {
  task: Task;
  isPinned?: boolean;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onTogglePin?: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onClick: (taskId: string) => void;
}

const getPriorityColor = (priority?: string): string => {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'bg-danger-500';
    case 'high':
      return 'bg-amber-500';
    case 'medium':
      return 'bg-blue-500';
    case 'low':
      return 'bg-slate-300 dark:bg-slate-600';
    default:
      return 'bg-slate-300 dark:bg-slate-600';
  }
};

const formatDueDate = (dueDate?: string | Date): string => {
  if (!dueDate) return '';
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  // Format as "Jan 15" or "Dec 3"
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (dueDate?: string | Date): boolean => {
  if (!dueDate) return false;
  const date = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  isPinned = false,
  onToggleComplete,
  onTogglePin,
  onDelete,
  onClick,
}) => {
  const isCompleted = ['done', 'completed', 'validated'].includes(task.status?.toLowerCase() || '');
  const overdue = !isCompleted && isOverdue(task.dueDate);
  const dueDateFormatted = formatDueDate(task.dueDate);
  const assigneeName = task.assignee?.lastName || task.assignee?.firstName || '';
  const assigneeInitial = assigneeName ? assigneeName[0].toUpperCase() : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={() => onClick(task.id)}
      className={`
                group h-12 flex items-center gap-3 px-3 cursor-pointer
                border-b border-slate-200 dark:border-navy-700
                transition-colors duration-150
                ${
                  isCompleted
                    ? 'bg-slate-50/50 dark:bg-white/[0.02]'
                    : 'bg-white dark:bg-navy-900 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                }
            `}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleComplete(task.id, !isCompleted);
        }}
        className={`
                    shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                    transition-all duration-150
                    ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : 'border-2 border-slate-300 dark:border-slate-600 hover:border-green-500 dark:hover:border-green-500'
                    }
                `}
      >
        {isCompleted ? (
          <CheckCircle2 size={14} />
        ) : (
          <Circle size={14} className="opacity-0 group-hover:opacity-30" />
        )}
      </button>

      {/* Priority Indicator */}
      <div
        className={`shrink-0 w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}
        title={`Priority: ${task.priority || 'Normal'}`}
      />

      {/* Title + Initiative */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={`
                        text-sm truncate
                        ${
                          isCompleted
                            ? 'text-slate-500 dark:text-slate-400 dark:text-slate-500 line-through'
                            : 'text-slate-800 dark:text-white'
                        }
                    `}
        >
          {task.title}
        </span>

        {/* Initiative tag (small) */}
        {task.initiativeName && (
          <span className="shrink-0 hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 max-w-[100px] truncate">
            {task.initiativeName}
          </span>
        )}
      </div>

      {/* Right side: Due date, Assignee, and "⋯" menu (A3.2) */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Due Date */}
        <div
          className={`flex items-center gap-1 text-xs ${
            dueDateFormatted
              ? overdue
                ? 'text-danger-500 font-medium'
                : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'
              : 'text-slate-700 dark:text-slate-400'
          }`}
        >
          <Calendar size={12} />
          <span>{dueDateFormatted || 'No due date'}</span>
        </div>

        {/* Assignee Avatar */}
        {assigneeInitial ? (
          <div
            className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300"
            title={assigneeName}
          >
            {assigneeInitial}
          </div>
        ) : (
          <div
            className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-medium text-slate-500 dark:text-slate-400"
            title="Unassigned"
          >
            <User size={10} />
          </div>
        )}

        {/* Row Actions Menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <RowActionsMenu
            size="sm"
            sections={[
              {
                id: 'legacy',
                // #40 — pure-wiring bridge onto the sectional kebab contract; filter
                // matches the previous flat-menu semantics exactly (zero visible change).
                actions: (
                  [
                    ...(onTogglePin
                      ? [
                          {
                            id: 'pin',
                            label: isPinned ? 'Unpin' : 'Pin to top',
                            icon: Pin,
                            onClick: () => onTogglePin(task.id),
                            variant: isPinned ? ('primary' as const) : ('default' as const),
                          },
                        ]
                      : []),
                    {
                      id: 'complete',
                      label: isCompleted ? 'Reopen' : 'Complete',
                      icon: CheckCircle2,
                      onClick: () => onToggleComplete(task.id, !isCompleted),
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: Trash2,
                      onClick: () => {
                        if (confirm('Delete this task?')) {
                          onDelete(task.id);
                        }
                      },
                      variant: 'danger' as const,
                      divider: true,
                    },
                  ] as RowAction[]
                ).filter((a) => !a.disabled),
              },
            ]}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default TaskRow;
