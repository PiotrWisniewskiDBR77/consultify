/**
 * EmptyState - Empty state component for My Work module
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    Target,
    Inbox,
    CheckCircle2,
    Calendar,
    Bell,
    BarChart2,
    Sparkles,
    Plus
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

type EmptyStateType = 
    | 'focus'
    | 'inbox'
    | 'tasks'
    | 'decisions'
    | 'notifications'
    | 'dashboard'
    | 'generic';

interface EmptyStateProps {
    type: EmptyStateType;
    title?: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
    showAISuggestion?: boolean;
    onAISuggestion?: () => void;
    className?: string;
}

/**
 * Type configurations
 */
const typeConfig: Record<EmptyStateType, {
    icon: React.ReactNode;
    defaultTitle: string;
    defaultDescription: string;
    gradient: string;
}> = {
    focus: {
        icon: <Target size={32} />,
        defaultTitle: 'No Focus Tasks',
        defaultDescription: 'Select up to 5 tasks to focus on today. AI can help you prioritize.',
        gradient: 'from-blue-500/20 to-indigo-500/20 dark:from-blue-500/10 dark:to-indigo-500/10'
    },
    inbox: {
        icon: <Inbox size={32} />,
        defaultTitle: 'Inbox Zero!',
        defaultDescription: "You've processed all items. Great job staying on top of things!",
        gradient: 'from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10'
    },
    tasks: {
        icon: <CheckCircle2 size={32} />,
        defaultTitle: 'No Tasks',
        defaultDescription: 'Create a task to get started with your work.',
        gradient: 'from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10'
    },
    decisions: {
        icon: <Calendar size={32} />,
        defaultTitle: 'No Pending Decisions',
        defaultDescription: 'All decisions have been made. Check back later for new ones.',
        gradient: 'from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10'
    },
    notifications: {
        icon: <Bell size={32} />,
        defaultTitle: 'All Caught Up',
        defaultDescription: 'No new notifications. You can customize your notification preferences.',
        gradient: 'from-cyan-500/20 to-blue-500/20 dark:from-cyan-500/10 dark:to-blue-500/10'
    },
    dashboard: {
        icon: <BarChart2 size={32} />,
        defaultTitle: 'No Data Yet',
        defaultDescription: 'Complete some tasks to see your execution metrics and trends.',
        gradient: 'from-violet-500/20 to-purple-500/20 dark:from-violet-500/10 dark:to-purple-500/10'
    },
    generic: {
        icon: <Sparkles size={32} />,
        defaultTitle: 'Nothing Here',
        defaultDescription: 'This section is empty. Start by adding some items.',
        gradient: 'from-slate-500/20 to-gray-500/20 dark:from-slate-500/10 dark:to-gray-500/10'
    }
};

/**
 * EmptyState Component
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
    type,
    title,
    description,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction,
    showAISuggestion = false,
    onAISuggestion,
    className = ''
}) => {
    const { t } = useTranslation();
    const config = typeConfig[type];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
                flex flex-col items-center justify-center text-center p-8 rounded-2xl
                bg-gradient-to-br ${config.gradient}
                border border-slate-200/50 dark:border-white/5
                ${className}
            `}
        >
            {/* Icon */}
            <div className="mb-4 text-slate-400 dark:text-slate-500">
                {config.icon}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
                {title || t(`myWork.empty.${type}.title`, config.defaultTitle)}
            </h3>

            {/* Description */}
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                {description || t(`myWork.empty.${type}.description`, config.defaultDescription)}
            </p>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
                {/* AI Suggestion Button */}
                {showAISuggestion && onAISuggestion && (
                    <button
                        onClick={onAISuggestion}
                        className="
                            inline-flex items-center gap-2 px-4 py-2 rounded-lg
                            bg-gradient-to-r from-purple-600 to-indigo-600
                            hover:from-purple-500 hover:to-indigo-500
                            text-white text-sm font-medium
                            shadow-lg shadow-purple-500/25
                            transition-all duration-200
                        "
                    >
                        <Sparkles size={16} />
                        {t('myWork.empty.aiSuggest', 'AI Suggest')}
                    </button>
                )}

                {/* Primary Action */}
                {actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="
                            inline-flex items-center gap-2 px-4 py-2 rounded-lg
                            bg-blue-600 hover:bg-blue-500
                            text-white text-sm font-medium
                            shadow-lg shadow-blue-500/25
                            transition-colors
                        "
                    >
                        <Plus size={16} />
                        {actionLabel}
                    </button>
                )}

                {/* Secondary Action */}
                {secondaryActionLabel && onSecondaryAction && (
                    <button
                        onClick={onSecondaryAction}
                        className="
                            inline-flex items-center gap-2 px-4 py-2 rounded-lg
                            bg-white dark:bg-navy-800 
                            border border-slate-200 dark:border-white/10
                            text-slate-700 dark:text-slate-300 
                            text-sm font-medium
                            hover:bg-slate-50 dark:hover:bg-navy-700
                            transition-colors
                        "
                    >
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

/**
 * Compact inline empty state
 */
export const EmptyStateInline: React.FC<{
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}> = ({ message, actionLabel, onAction, className = '' }) => {
    return (
        <div className={`text-center py-6 ${className}`}>
            <p className="text-sm text-slate-400 dark:text-slate-500">
                {message}
            </p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-medium"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

export default EmptyState;

