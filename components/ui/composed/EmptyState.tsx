/**
 * EmptyState Component - Apple HIG Design System
 *
 * A unified empty state display for lists, tables, and content areas.
 *
 * @example
 * <EmptyState
 *   icon={<Inbox />}
 *   title="No messages"
 *   description="You don't have any messages yet."
 *   action={{ label: "Compose", onClick: () => {} }}
 * />
 */

import { motion } from 'framer-motion';
import { AlertCircle, FileText, Inbox, Search, Settings, Users } from 'lucide-react';
import React, { forwardRef } from 'react';

import { Button } from '../primitives/Button';

export type EmptyStatePreset = 'default' | 'search' | 'error' | 'noData' | 'noUsers' | 'noConfig';

export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
}

export interface EmptyStateProps {
    /** Preset configuration */
    preset?: EmptyStatePreset;
    /** Custom icon */
    icon?: React.ReactNode;
    /** Title text */
    title?: string;
    /** Description text */
    description?: string;
    /** Primary action */
    action?: EmptyStateAction;
    /** Secondary action */
    secondaryAction?: EmptyStateAction;
    /** Compact mode (less padding) */
    compact?: boolean;
    /** Additional className */
    className?: string;
}

const presets: Record<EmptyStatePreset, { icon: React.ReactNode; title: string; description: string }> = {
    default: {
        icon: <Inbox />,
        title: 'Nothing here yet',
        description: 'Get started by creating your first item.',
    },
    search: {
        icon: <Search />,
        title: 'No results found',
        description: "Try adjusting your search or filters to find what you're looking for.",
    },
    error: {
        icon: <AlertCircle />,
        title: 'Something went wrong',
        description: "We couldn't load this content. Please try again.",
    },
    noData: {
        icon: <FileText />,
        title: 'No data available',
        description: "There's no data to display at the moment.",
    },
    noUsers: {
        icon: <Users />,
        title: 'No users yet',
        description: 'Invite team members to get started.',
    },
    noConfig: {
        icon: <Settings />,
        title: 'Not configured',
        description: 'Set up your preferences to get started.',
    },
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
    (
        {
            preset = 'default',
            icon: customIcon,
            title: customTitle,
            description: customDescription,
            action,
            secondaryAction,
            compact = false,
            className = '',
        },
        ref,
    ) => {
        const presetConfig = presets[preset];
        const icon = customIcon ?? presetConfig.icon;
        const title = customTitle ?? presetConfig.title;
        const description = customDescription ?? presetConfig.description;

        return (
            <motion.div
                ref={ref}
                className={`
          flex flex-col items-center justify-center text-center
          ${compact ? 'py-8 px-4' : 'py-16 px-8'}
          ${className}
        `}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
            >
                {/* Icon */}
                <motion.div
                    className={`
            flex items-center justify-center
            ${compact ? 'w-12 h-12 mb-4' : 'w-16 h-16 mb-6'}
            rounded-2xl
            bg-slate-100 dark:bg-navy-800
            text-slate-400 dark:text-slate-500
          `}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
                >
                    {React.isValidElement(icon)
                        ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
                              size: compact ? 24 : 32,
                          })
                        : icon}
                </motion.div>

                {/* Title */}
                <h3
                    className={`
            font-semibold text-navy-900 dark:text-white
            ${compact ? 'text-base mb-1' : 'text-lg mb-2'}
          `}
                >
                    {title}
                </h3>

                {/* Description */}
                <p
                    className={`
            text-slate-500 dark:text-slate-400 max-w-sm
            ${compact ? 'text-sm' : 'text-base'}
          `}
                >
                    {description}
                </p>

                {/* Actions */}
                {(action || secondaryAction) && (
                    <div className={`flex items-center gap-3 ${compact ? 'mt-4' : 'mt-6'}`}>
                        {secondaryAction && (
                            <Button
                                variant={secondaryAction.variant || 'ghost'}
                                size={compact ? 'sm' : 'md'}
                                onClick={secondaryAction.onClick}
                            >
                                {secondaryAction.label}
                            </Button>
                        )}
                        {action && (
                            <Button
                                variant={action.variant || 'primary'}
                                size={compact ? 'sm' : 'md'}
                                onClick={action.onClick}
                            >
                                {action.label}
                            </Button>
                        )}
                    </div>
                )}
            </motion.div>
        );
    },
);

EmptyState.displayName = 'EmptyState';

export default EmptyState;

