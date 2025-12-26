/**
 * QuickActions - Reusable quick action buttons for tasks
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    Calendar,
    UserPlus,
    Archive,
    Trash2,
    MoreHorizontal,
    Play,
    Pause,
    Flag,
    MessageSquare,
    ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type QuickActionType = 
    | 'complete'
    | 'schedule'
    | 'delegate'
    | 'archive'
    | 'delete'
    | 'start'
    | 'pause'
    | 'flag'
    | 'comment'
    | 'open';

interface QuickAction {
    type: QuickActionType;
    label: string;
    icon: React.ReactNode;
    className: string;
    confirmRequired?: boolean;
}

interface QuickActionsProps {
    visible?: boolean;
    actions?: QuickActionType[];
    onAction: (action: QuickActionType) => void;
    size?: 'sm' | 'md';
    direction?: 'horizontal' | 'vertical';
    className?: string;
}

/**
 * Action configurations
 */
const actionConfig: Record<QuickActionType, Omit<QuickAction, 'type'>> = {
    complete: {
        label: 'Complete',
        icon: <CheckCircle />,
        className: 'hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400'
    },
    schedule: {
        label: 'Schedule',
        icon: <Calendar />,
        className: 'hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400'
    },
    delegate: {
        label: 'Delegate',
        icon: <UserPlus />,
        className: 'hover:bg-purple-100 hover:text-purple-600 dark:hover:bg-purple-900/30 dark:hover:text-purple-400'
    },
    archive: {
        label: 'Archive',
        icon: <Archive />,
        className: 'hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300'
    },
    delete: {
        label: 'Delete',
        icon: <Trash2 />,
        className: 'hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
        confirmRequired: true
    },
    start: {
        label: 'Start',
        icon: <Play />,
        className: 'hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400'
    },
    pause: {
        label: 'Pause',
        icon: <Pause />,
        className: 'hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400'
    },
    flag: {
        label: 'Flag',
        icon: <Flag />,
        className: 'hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400'
    },
    comment: {
        label: 'Comment',
        icon: <MessageSquare />,
        className: 'hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400'
    },
    open: {
        label: 'Open',
        icon: <ExternalLink />,
        className: 'hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300'
    }
};

/**
 * QuickActions Component
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
    visible = true,
    actions = ['complete', 'schedule', 'delegate', 'archive'],
    onAction,
    size = 'sm',
    direction = 'horizontal',
    className = ''
}) => {
    const { t } = useTranslation();

    const sizeClasses = {
        sm: 'p-1.5',
        md: 'p-2'
    };

    const iconSizes = {
        sm: 14,
        md: 16
    };

    const handleAction = (action: QuickActionType) => {
        const config = actionConfig[action];
        if (config.confirmRequired) {
            if (confirm(t('myWork.actions.confirmDelete', 'Are you sure?'))) {
                onAction(action);
            }
        } else {
            onAction(action);
        }
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`
                        flex gap-1
                        ${direction === 'vertical' ? 'flex-col' : 'flex-row'}
                        ${className}
                    `}
                >
                    {actions.map((actionType) => {
                        const config = actionConfig[actionType];
                        return (
                            <button
                                key={actionType}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(actionType);
                                }}
                                className={`
                                    rounded-lg text-slate-400 transition-all duration-200
                                    ${sizeClasses[size]}
                                    ${config.className}
                                `}
                                title={t(`myWork.actions.${actionType}`, config.label)}
                            >
                                {React.cloneElement(config.icon as React.ReactElement, {
                                    size: iconSizes[size]
                                })}
                            </button>
                        );
                    })}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/**
 * Single quick action button
 */
export const QuickActionButton: React.FC<{
    action: QuickActionType;
    onClick: () => void;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}> = ({ action, onClick, size = 'md', showLabel = false, className = '' }) => {
    const { t } = useTranslation();
    const config = actionConfig[action];

    const sizeClasses = {
        sm: 'p-1.5 text-xs gap-1',
        md: 'p-2 text-sm gap-1.5',
        lg: 'p-2.5 text-sm gap-2'
    };

    const iconSizes = {
        sm: 12,
        md: 14,
        lg: 16
    };

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`
                inline-flex items-center rounded-lg text-slate-500 transition-all duration-200
                ${sizeClasses[size]}
                ${config.className}
                ${className}
            `}
            title={t(`myWork.actions.${action}`, config.label)}
        >
            {React.cloneElement(config.icon as React.ReactElement, {
                size: iconSizes[size]
            })}
            {showLabel && (
                <span>{t(`myWork.actions.${action}`, config.label)}</span>
            )}
        </button>
    );
};

/**
 * More actions dropdown trigger
 */
export const MoreActionsButton: React.FC<{
    onClick: (e: React.MouseEvent) => void;
    size?: 'sm' | 'md';
    className?: string;
}> = ({ onClick, size = 'sm', className = '' }) => {
    const sizeClasses = {
        sm: 'p-1.5',
        md: 'p-2'
    };

    return (
        <button
            onClick={onClick}
            className={`
                rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600
                dark:hover:bg-white/5 dark:hover:text-slate-300
                transition-colors
                ${sizeClasses[size]}
                ${className}
            `}
            title="More actions"
        >
            <MoreHorizontal size={size === 'sm' ? 14 : 16} />
        </button>
    );
};

export default QuickActions;

