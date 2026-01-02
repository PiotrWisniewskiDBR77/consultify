/**
 * TaskRow - Minimalist compact task row (48px height)
 * ClickUp-style design with hover actions
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Circle,
    CheckCircle2,
    Pin,
    Trash2,
    Calendar,
    User
} from 'lucide-react';
import { Task } from '../../types';

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
            return 'bg-red-500';
        case 'high':
            return 'bg-orange-500';
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
    onClick
}) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const isCompleted = ['done', 'completed', 'validated'].includes(
        task.status?.toLowerCase() || ''
    );
    const overdue = !isCompleted && isOverdue(task.dueDate);
    const dueDateFormatted = formatDueDate(task.dueDate);
    const assigneeName = task.assignee?.lastName || task.assignee?.firstName || '';
    const assigneeInitial = assigneeName ? assigneeName[0].toUpperCase() : '';

    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -10 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onClick(task.id)}
            className={`
                group h-12 flex items-center gap-3 px-3 cursor-pointer
                border-b border-slate-100 dark:border-white/5
                transition-colors duration-150
                ${isCompleted 
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
                    ${isCompleted
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
                        ${isCompleted
                            ? 'text-slate-400 dark:text-slate-500 line-through'
                            : 'text-slate-800 dark:text-white'
                        }
                    `}
                >
                    {task.title}
                </span>
                
                {/* Initiative tag (small) */}
                {task.initiativeName && (
                    <span className="shrink-0 hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 max-w-[100px] truncate">
                        {task.initiativeName}
                    </span>
                )}
            </div>

            {/* Right side: Due date, Assignee, or Hover Actions */}
            <div className="shrink-0 flex items-center gap-2">
                {/* Hover Actions */}
                {isHovered ? (
                    <div className="flex items-center gap-1">
                        {onTogglePin && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(task.id);
                                }}
                                className={`
                                    p-1.5 rounded transition-colors
                                    ${isPinned
                                        ? 'text-purple-500 bg-purple-50 dark:bg-purple-900/30'
                                        : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                                    }
                                `}
                                title={isPinned ? 'Unpin' : 'Pin to top'}
                            >
                                <Pin size={14} />
                            </button>
                        )}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this task?')) {
                                    onDelete(task.id);
                                }
                            }}
                            className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Due Date */}
                        {dueDateFormatted && (
                            <div
                                className={`
                                    flex items-center gap-1 text-xs
                                    ${overdue
                                        ? 'text-red-500 font-medium'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }
                                `}
                            >
                                <Calendar size={12} />
                                <span>{dueDateFormatted}</span>
                            </div>
                        )}

                        {/* Assignee Avatar */}
                        {assigneeInitial && (
                            <div
                                className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-medium text-slate-600 dark:text-slate-300"
                                title={assigneeName}
                            >
                                {assigneeInitial}
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default TaskRow;



