/**
 * SettingsCard Component
 *
 * Consistent card style for AI settings sections.
 */

import { motion } from 'framer-motion';
import { ChevronRight, Info, LucideIcon } from 'lucide-react';
import React from 'react';

interface SettingsCardProps {
    title: string;
    description?: string;
    icon?: LucideIcon;
    iconColor?: string;
    children: React.ReactNode;
    collapsible?: boolean;
    defaultExpanded?: boolean;
    badge?: string;
    badgeColor?: string;
    infoTooltip?: string;
    className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
    title,
    description,
    icon: Icon,
    iconColor = 'text-violet-400',
    children,
    collapsible = false,
    defaultExpanded = true,
    badge,
    badgeColor = 'bg-violet-500/20 text-violet-300',
    infoTooltip,
    className = '',
}) => {
    const [expanded, setExpanded] = React.useState(defaultExpanded);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
                rounded-xl border 
                border-slate-200 dark:border-slate-700/50 
                bg-white dark:bg-gradient-to-br dark:from-slate-800/50 dark:to-slate-900/50
                backdrop-blur-sm overflow-hidden shadow-sm dark:shadow-none
                ${className}
            `}
        >
            {/* Header */}
            <div
                className={`
                    flex items-center gap-3 p-4 
                    ${collapsible ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors' : ''}
                `}
                onClick={() => collapsible && setExpanded(!expanded)}
            >
                {Icon && (
                    <div
                        className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        bg-slate-100 dark:bg-gradient-to-br dark:from-slate-700/50 dark:to-slate-800/50
                        border border-slate-200 dark:border-slate-600/50
                    `}
                    >
                        <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-navy-900 dark:text-white">{title}</h3>
                        {badge && <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>}
                        {infoTooltip && (
                            <div className="relative group">
                                <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-400 cursor-help" />
                                <div
                                    className="
                                    absolute left-1/2 -translate-x-1/2 bottom-full mb-2
                                    px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                                    text-xs text-slate-600 dark:text-slate-300 w-48 text-center shadow-lg dark:shadow-none
                                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                    transition-all duration-200 z-50
                                "
                                >
                                    {infoTooltip}
                                </div>
                            </div>
                        )}
                    </div>
                    {description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{description}</p>
                    )}
                </div>

                {collapsible && (
                    <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                    </motion.div>
                )}
            </div>

            {/* Content */}
            <motion.div
                initial={false}
                animate={{
                    height: !collapsible || expanded ? 'auto' : 0,
                    opacity: !collapsible || expanded ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
            >
                <div className="px-4 pb-4 pt-0">
                    <div className="border-t border-slate-200 dark:border-slate-700/50 pt-4">{children}</div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SettingsCard;
