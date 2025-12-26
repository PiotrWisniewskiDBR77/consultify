/**
 * BottleneckAlerts - Display blocking issues and bottlenecks
 * Part of My Work Module PMO Upgrade
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Clock,
    Link2,
    UserX,
    Calendar,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Bottleneck, BottleneckAlertsProps, BottleneckType } from '../../../types/myWork';
import { useExecutionScore } from '../../../hooks/useExecutionScore';

/**
 * Bottleneck type configuration
 */
const bottleneckConfig: Record<BottleneckType, {
    icon: React.ReactNode;
    color: string;
    bgColor: string;
}> = {
    stalled_tasks: {
        icon: <Clock size={16} />,
        color: 'text-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30'
    },
    overdue_cluster: {
        icon: <Calendar size={16} />,
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30'
    },
    blocked_chain: {
        icon: <Link2 size={16} />,
        color: 'text-orange-500',
        bgColor: 'bg-orange-100 dark:bg-orange-900/30'
    },
    missing_assignment: {
        icon: <UserX size={16} />,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30'
    },
    decision_delay: {
        icon: <AlertTriangle size={16} />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30'
    }
};

/**
 * Single bottleneck alert item
 */
const BottleneckItem: React.FC<{
    bottleneck: Bottleneck;
    onClick?: () => void;
}> = ({ bottleneck, onClick }) => {
    const config = bottleneckConfig[bottleneck.type];
    
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            onClick={onClick}
            className={`
                flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all
                hover:shadow-md
                ${bottleneck.impact === 'high' 
                    ? 'border-red-200 dark:border-red-800/30 bg-red-50/50 dark:bg-red-900/10' 
                    : bottleneck.impact === 'medium'
                        ? 'border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900'
                }
            `}
        >
            {/* Icon */}
            <div className={`shrink-0 p-2 rounded-lg ${config.bgColor}`}>
                <span className={config.color}>{config.icon}</span>
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`
                        text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                        ${bottleneck.impact === 'high' 
                            ? 'bg-red-500 text-white' 
                            : bottleneck.impact === 'medium'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                        }
                    `}>
                        {bottleneck.impact} impact
                    </span>
                    <span className="text-xs text-slate-500">
                        {bottleneck.count} {bottleneck.count === 1 ? 'item' : 'items'}
                    </span>
                </div>
                
                <p className="text-sm text-navy-900 dark:text-white font-medium mb-1">
                    {bottleneck.suggestion}
                </p>
                
                {/* Affected items preview */}
                {bottleneck.affectedTasks && bottleneck.affectedTasks.length > 0 && (
                    <p className="text-xs text-slate-500">
                        Affects {bottleneck.affectedTasks.length} task(s)
                    </p>
                )}
            </div>
            
            {/* Arrow */}
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
        </motion.div>
    );
};

/**
 * BottleneckAlerts Component
 */
export const BottleneckAlerts: React.FC<Partial<BottleneckAlertsProps> & { className?: string }> = ({
    bottlenecks: externalBottlenecks,
    onBottleneckClick,
    maxVisible = 5,
    className = ''
}) => {
    const { t } = useTranslation();
    const { bottlenecks: hookBottlenecks, loading } = useExecutionScore({ autoLoad: !externalBottlenecks });
    
    const bottlenecks = externalBottlenecks || hookBottlenecks;
    const visibleBottlenecks = bottlenecks.slice(0, maxVisible);
    const hasMore = bottlenecks.length > maxVisible;
    
    if (loading && !bottlenecks.length) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-xl p-6 ${className}`}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
            </div>
        );
    }
    
    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-500" />
                    <h3 className="font-semibold text-navy-900 dark:text-white">
                        {t('myWork.dashboard.bottlenecks', 'Bottlenecks')}
                    </h3>
                    {bottlenecks.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full">
                            {bottlenecks.length}
                        </span>
                    )}
                </div>
            </div>
            
            {/* Bottlenecks List */}
            <div className="p-4 space-y-3">
                {bottlenecks.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">
                        <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('myWork.dashboard.noBottlenecks', 'No bottlenecks detected')}</p>
                        <p className="text-xs mt-1">{t('myWork.dashboard.allClear', 'Everything is running smoothly!')}</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {visibleBottlenecks.map((bottleneck, idx) => (
                            <BottleneckItem
                                key={`${bottleneck.type}-${idx}`}
                                bottleneck={bottleneck}
                                onClick={() => onBottleneckClick?.(bottleneck)}
                            />
                        ))}
                    </AnimatePresence>
                )}
                
                {/* Show more */}
                {hasMore && (
                    <button className="w-full text-center py-2 text-sm text-brand hover:underline">
                        {t('common.showMore', 'Show more')} ({bottlenecks.length - maxVisible})
                    </button>
                )}
            </div>
        </div>
    );
};

export default BottleneckAlerts;

