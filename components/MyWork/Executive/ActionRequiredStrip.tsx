/**
 * ActionRequiredStrip - Urgent items requiring immediate attention
 * BCG/McKinsey style: Prominent, scannable, action-oriented
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Clock,
    FileQuestion,
    CheckCircle2,
    XCircle,
    ChevronRight,
    Zap,
    User,
    Calendar,
    ArrowRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ActionItem {
    id: string;
    type: 'decision' | 'task' | 'escalation' | 'blocker';
    title: string;
    description?: string;
    urgency: 'critical' | 'high' | 'medium';
    dueDate?: string;
    daysOverdue?: number;
    owner?: string;
    projectName?: string;
    actions?: {
        primary?: { label: string; action: () => void };
        secondary?: { label: string; action: () => void };
    };
}

interface ActionRequiredStripProps {
    items?: ActionItem[];
    loading?: boolean;
    onViewAll?: () => void;
    onItemClick?: (item: ActionItem) => void;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
}

// Type icon mapping
const typeIcons = {
    decision: FileQuestion,
    task: Clock,
    escalation: Zap,
    blocker: AlertTriangle
};

// Urgency styling
const urgencyConfig = {
    critical: {
        bg: 'bg-rose-50 dark:bg-rose-900/20',
        border: 'border-rose-200 dark:border-rose-500/30',
        text: 'text-rose-700 dark:text-rose-300',
        badge: 'bg-rose-500 text-white',
        glow: 'shadow-rose-500/20'
    },
    high: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-500/30',
        text: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-500 text-white',
        glow: 'shadow-amber-500/20'
    },
    medium: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-500/30',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-500 text-white',
        glow: 'shadow-blue-500/20'
    }
};

// Action Item Card
const ActionItemCard: React.FC<{
    item: ActionItem;
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
    onClick?: () => void;
}> = ({ item, onApprove, onReject, onClick }) => {
    const { t } = useTranslation();
    const Icon = typeIcons[item.type];
    const config = urgencyConfig[item.urgency];

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            whileHover={{ scale: 1.01 }}
            className={`
                flex-shrink-0 w-80 p-4 rounded-xl border ${config.border} ${config.bg}
                cursor-pointer transition-all hover:shadow-lg ${config.glow}
            `}
            onClick={onClick}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${config.badge} flex items-center justify-center`}>
                        <Icon size={16} />
                    </div>
                    <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}>
                            {item.type === 'decision' ? t('executive.action.decision', 'Decision') :
                             item.type === 'task' ? t('executive.action.task', 'Task') :
                             item.type === 'escalation' ? t('executive.action.escalation', 'Escalation') :
                             t('executive.action.blocker', 'Blocker')}
                        </span>
                        {item.urgency === 'critical' && (
                            <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded animate-pulse">
                                CRITICAL
                            </span>
                        )}
                    </div>
                </div>
                {item.daysOverdue !== undefined && item.daysOverdue > 0 && (
                    <span className={`text-xs font-bold ${config.text} flex items-center gap-1`}>
                        <AlertTriangle size={12} />
                        {item.daysOverdue}d
                    </span>
                )}
            </div>

            {/* Title */}
            <h4 className="text-sm font-semibold text-navy-900 dark:text-white line-clamp-2 mb-2">
                {item.title}
            </h4>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                {item.projectName && (
                    <span className="truncate max-w-[100px]">{item.projectName}</span>
                )}
                {item.owner && (
                    <span className="flex items-center gap-1">
                        <User size={10} />
                        {item.owner}
                    </span>
                )}
                {item.dueDate && (
                    <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(item.dueDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                    </span>
                )}
            </div>

            {/* Quick Actions for Decisions */}
            {item.type === 'decision' && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onApprove?.(item.id);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1"
                    >
                        <CheckCircle2 size={12} />
                        {t('executive.action.approve', 'Approve')}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onReject?.(item.id);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors flex items-center justify-center gap-1"
                    >
                        <XCircle size={12} />
                        {t('executive.action.reject', 'Reject')}
                    </button>
                </div>
            )}

            {/* View Action for non-decisions */}
            {item.type !== 'decision' && (
                <div className="flex items-center justify-end text-xs font-medium text-brand">
                    {t('executive.action.view', 'View details')}
                    <ChevronRight size={14} />
                </div>
            )}
        </motion.div>
    );
};

export const ActionRequiredStrip: React.FC<ActionRequiredStripProps> = ({
    items = [],
    loading = false,
    onViewAll,
    onItemClick,
    onApprove,
    onReject
}) => {
    const { t } = useTranslation();

    // Default/mock items if none provided
    const displayItems: ActionItem[] = items.length > 0 ? items : [
        {
            id: '1',
            type: 'decision',
            title: 'Budget Approval: Q1 Marketing Campaign',
            urgency: 'critical',
            daysOverdue: 2,
            projectName: 'Marketing 2025',
            owner: 'Anna K.'
        },
        {
            id: '2',
            type: 'escalation',
            title: 'Vendor Delay: Server Infrastructure',
            description: '2-week delay on cloud migration',
            urgency: 'high',
            projectName: 'IT Modernization'
        },
        {
            id: '3',
            type: 'task',
            title: 'Review Architecture Documentation',
            urgency: 'medium',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            owner: 'Tomasz K.'
        }
    ];

    const criticalCount = displayItems.filter(i => i.urgency === 'critical').length;
    const highCount = displayItems.filter(i => i.urgency === 'high').length;

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 animate-pulse" />
                    <div className="h-5 w-40 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                </div>
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex-shrink-0 w-80 h-36 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (displayItems.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 p-6"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                        <CheckCircle2 size={24} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                            {t('executive.action.allClear', 'All Clear!')}
                        </h3>
                        <p className="text-sm text-emerald-600 dark:text-emerald-300">
                            {t('executive.action.noUrgent', 'No urgent items requiring your attention.')}
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            criticalCount > 0 
                                ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-lg shadow-rose-500/30 animate-pulse' 
                                : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30'
                        }`}>
                            <Zap size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                {t('executive.action.title', 'Action Required')}
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                    criticalCount > 0 
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' 
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                }`}>
                                    {displayItems.length}
                                </span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {criticalCount > 0 && (
                                    <span className="text-rose-500 font-medium">{criticalCount} critical</span>
                                )}
                                {criticalCount > 0 && highCount > 0 && ' • '}
                                {highCount > 0 && (
                                    <span className="text-amber-500 font-medium">{highCount} high priority</span>
                                )}
                            </p>
                        </div>
                    </div>
                    
                    {onViewAll && (
                        <button
                            onClick={onViewAll}
                            className="text-sm text-brand font-medium hover:text-brand-hover flex items-center gap-1 transition-colors"
                        >
                            {t('executive.action.viewAll', 'View all')}
                            <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Scrollable Items */}
            <div className="p-4">
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    <AnimatePresence mode="popLayout">
                        {displayItems.map((item, idx) => (
                            <ActionItemCard
                                key={item.id}
                                item={item}
                                onApprove={onApprove}
                                onReject={onReject}
                                onClick={() => onItemClick?.(item)}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

export default ActionRequiredStrip;


