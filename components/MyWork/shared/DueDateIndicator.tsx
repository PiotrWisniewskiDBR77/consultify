/**
 * DueDateIndicator - Visual indicator for task due dates
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { Clock, AlertCircle, CalendarClock, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DueDateIndicatorProps {
    dueDate?: string | Date;
    dueTime?: string;
    isCompleted?: boolean;
    showRelative?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}

type DueStatus = 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'completed' | 'no_date';

/**
 * Calculate the due status based on due date
 */
const getDueStatus = (dueDate?: string | Date, isCompleted?: boolean): DueStatus => {
    if (isCompleted) return 'completed';
    if (!dueDate) return 'no_date';

    const due = new Date(dueDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'due_today';
    if (diffDays <= 2) return 'due_soon';
    return 'upcoming';
};

/**
 * Get relative time string
 */
const getRelativeTime = (dueDate: Date, t: (key: string, fallback: string) => string): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < -7) {
        return t('myWork.dueDate.overdueWeeks', `${Math.abs(Math.ceil(diffDays / 7))} weeks overdue`);
    }
    if (diffDays < -1) {
        return t('myWork.dueDate.overdueDays', `${Math.abs(diffDays)} days overdue`);
    }
    if (diffDays === -1) return t('myWork.dueDate.yesterday', 'Yesterday');
    if (diffDays === 0) return t('myWork.dueDate.today', 'Today');
    if (diffDays === 1) return t('myWork.dueDate.tomorrow', 'Tomorrow');
    if (diffDays <= 7) {
        return t('myWork.dueDate.inDays', `In ${diffDays} days`);
    }
    return dueDate.toLocaleDateString();
};

/**
 * Status-based styling
 */
const statusStyles: Record<DueStatus, { bg: string; text: string; icon: string }> = {
    overdue: {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        icon: 'text-red-500'
    },
    due_today: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        icon: 'text-amber-500'
    },
    due_soon: {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        icon: 'text-orange-500'
    },
    upcoming: {
        bg: 'bg-slate-100 dark:bg-slate-800',
        text: 'text-slate-600 dark:text-slate-400',
        icon: 'text-slate-500'
    },
    completed: {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        icon: 'text-green-500'
    },
    no_date: {
        bg: 'bg-slate-50 dark:bg-slate-800/50',
        text: 'text-slate-400 dark:text-slate-500',
        icon: 'text-slate-400'
    }
};

/**
 * Get icon for status
 */
const getStatusIcon = (status: DueStatus, size: number) => {
    const iconProps = { size, className: 'shrink-0' };
    switch (status) {
        case 'overdue':
            return <AlertCircle {...iconProps} />;
        case 'due_today':
        case 'due_soon':
            return <CalendarClock {...iconProps} />;
        case 'completed':
            return <CheckCircle {...iconProps} />;
        default:
            return <Clock {...iconProps} />;
    }
};

/**
 * DueDateIndicator Component
 */
export const DueDateIndicator: React.FC<DueDateIndicatorProps> = ({
    dueDate,
    dueTime,
    isCompleted = false,
    showRelative = true,
    size = 'sm',
    className = ''
}) => {
    const { t } = useTranslation();
    const status = getDueStatus(dueDate, isCompleted);
    const styles = statusStyles[status];

    const sizeClasses = {
        sm: 'text-[10px] px-1.5 py-0.5 gap-1',
        md: 'text-xs px-2 py-1 gap-1.5'
    };

    const iconSize = size === 'sm' ? 10 : 12;

    // Format display text
    let displayText: string;
    if (status === 'no_date') {
        displayText = t('myWork.dueDate.noDate', 'No date');
    } else if (status === 'completed') {
        displayText = t('myWork.dueDate.completed', 'Completed');
    } else if (dueDate) {
        const due = new Date(dueDate);
        displayText = showRelative 
            ? getRelativeTime(due, t) 
            : due.toLocaleDateString();
        
        // Add time if specified
        if (dueTime) {
            displayText += ` • ${dueTime}`;
        }
    } else {
        displayText = '';
    }

    return (
        <span
            className={`
                inline-flex items-center font-medium rounded
                ${styles.bg} ${styles.text}
                ${sizeClasses[size]}
                ${className}
            `}
        >
            <span className={styles.icon}>
                {getStatusIcon(status, iconSize)}
            </span>
            <span className="truncate">{displayText}</span>
        </span>
    );
};

/**
 * Compact inline due date (just text)
 */
export const DueDateText: React.FC<{
    dueDate?: string | Date;
    isCompleted?: boolean;
    className?: string;
}> = ({ dueDate, isCompleted, className = '' }) => {
    const { t } = useTranslation();
    const status = getDueStatus(dueDate, isCompleted);
    const styles = statusStyles[status];

    if (!dueDate && !isCompleted) return null;

    const displayText = dueDate 
        ? getRelativeTime(new Date(dueDate), t)
        : t('myWork.dueDate.completed', 'Completed');

    return (
        <span className={`${styles.text} ${className}`}>
            {displayText}
        </span>
    );
};

export default DueDateIndicator;

