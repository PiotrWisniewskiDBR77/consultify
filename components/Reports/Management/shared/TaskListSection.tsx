/**
 * Task List Section Component
 * Reusable list for tasks, blockers, decisions
 */

import React from 'react';
import { 
    CheckCircle2, 
    Clock, 
    AlertTriangle, 
    Circle,
    User,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { RAGIndicator } from './RAGIndicator';
import { RAGStatus } from '../../../../types';

interface TaskItem {
    id: string;
    title: string;
    type?: string;
    status?: RAGStatus;
    assignee?: string;
    dueDate?: string;
    daysInfo?: string;
    projectName?: string;
    severity?: string;
    meta?: string;
}

interface TaskListSectionProps {
    title: string;
    icon?: React.ReactNode;
    items: TaskItem[];
    variant?: 'default' | 'completed' | 'blocked' | 'pending';
    emptyMessage?: string;
    maxItems?: number;
    showViewAll?: boolean;
    onViewAll?: () => void;
    className?: string;
}

const variantStyles = {
    default: {
        container: 'bg-white dark:bg-navy-900',
        itemBorder: 'border-slate-100 dark:border-white/5',
        icon: <Circle size={16} className="text-slate-400" />
    },
    completed: {
        container: 'bg-emerald-50/50 dark:bg-emerald-900/10',
        itemBorder: 'border-emerald-100 dark:border-emerald-500/10',
        icon: <CheckCircle2 size={16} className="text-emerald-500" />
    },
    blocked: {
        container: 'bg-red-50/50 dark:bg-red-900/10',
        itemBorder: 'border-red-100 dark:border-red-500/10',
        icon: <AlertTriangle size={16} className="text-red-500" />
    },
    pending: {
        container: 'bg-amber-50/50 dark:bg-amber-900/10',
        itemBorder: 'border-amber-100 dark:border-amber-500/10',
        icon: <Clock size={16} className="text-amber-500" />
    }
};

export const TaskListSection: React.FC<TaskListSectionProps> = ({
    title,
    icon,
    items,
    variant = 'default',
    emptyMessage = 'No items to display.',
    maxItems = 10,
    showViewAll = false,
    onViewAll,
    className = ''
}) => {
    const styles = variantStyles[variant];
    const displayItems = items.slice(0, maxItems);
    const hasMore = items.length > maxItems;

    return (
        <div className={`rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden ${className}`}>
            {/* Header */}
            <div className={`px-4 py-3 ${styles.container} border-b ${styles.itemBorder}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {icon || styles.icon}
                        <h3 className="font-semibold text-navy-900 dark:text-white">{title}</h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {items.length}
                        </span>
                    </div>
                    {(showViewAll || hasMore) && onViewAll && (
                        <button
                            onClick={onViewAll}
                            className="text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
                        >
                            View all
                            <ChevronRight size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-100 dark:divide-white/5">
                {displayItems.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                        {emptyMessage}
                    </div>
                ) : (
                    displayItems.map((item) => (
                        <div
                            key={item.id}
                            className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        {item.status && <RAGIndicator status={item.status} size="sm" />}
                                        <span className="font-medium text-navy-900 dark:text-white truncate">
                                            {item.title}
                                        </span>
                                        {item.severity && (
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                item.severity === 'CRITICAL' || item.severity === 'HIGH'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    : item.severity === 'MEDIUM'
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {item.severity}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                        {item.projectName && (
                                            <span className="truncate">{item.projectName}</span>
                                        )}
                                        {item.assignee && (
                                            <span className="flex items-center gap-1">
                                                <User size={12} />
                                                {item.assignee}
                                            </span>
                                        )}
                                        {item.dueDate && (
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                {item.dueDate}
                                            </span>
                                        )}
                                        {item.daysInfo && (
                                            <span className="text-xs">{item.daysInfo}</span>
                                        )}
                                        {item.meta && (
                                            <span className="text-xs">{item.meta}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer showing more items */}
            {hasMore && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-navy-800/50 text-center">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        +{items.length - maxItems} more items
                    </span>
                </div>
            )}
        </div>
    );
};

export default TaskListSection;








