/**
 * DecisionBottleneckPanel - Alert panel for decision bottlenecks
 * Shows aging decisions, blocking decisions, and overloaded owners
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    Clock,
    Lock,
    Users,
    ChevronDown,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

interface AgingDecision {
    id: string;
    title: string;
    daysWaiting: number;
    ownerName?: string;
    decision_type: string;
}

interface BlockingDecision {
    id: string;
    title: string;
    blockedCount: number;
    ownerName?: string;
    decision_type: string;
}

interface OverloadedOwner {
    userId: string;
    name: string;
    email: string;
    pendingCount: number;
}

interface BottleneckData {
    aging: AgingDecision[];
    blocking: BlockingDecision[];
    ownerOverload: OverloadedOwner[];
}

interface DecisionBottleneckPanelProps {
    onDecisionClick?: (decisionId: string) => void;
}

// Section component for collapsible alerts
const AlertSection: React.FC<{
    title: string;
    icon: React.ReactNode;
    count: number;
    color: 'amber' | 'red' | 'purple';
    children: React.ReactNode;
    defaultOpen?: boolean;
}> = ({ title, icon, count, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    const colorStyles = {
        amber: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            border: 'border-amber-200 dark:border-amber-800/50',
            badge: 'bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300',
            icon: 'text-amber-500'
        },
        red: {
            bg: 'bg-red-50 dark:bg-red-900/20',
            border: 'border-red-200 dark:border-red-800/50',
            badge: 'bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300',
            icon: 'text-red-500'
        },
        purple: {
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            border: 'border-purple-200 dark:border-purple-800/50',
            badge: 'bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300',
            icon: 'text-purple-500'
        }
    };

    const styles = colorStyles[color];

    if (count === 0) return null;

    return (
        <div className={`rounded-lg border ${styles.border} ${styles.bg} overflow-hidden`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:opacity-90 transition-opacity"
            >
                <div className="flex items-center gap-2">
                    <span className={styles.icon}>{icon}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {title}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${styles.badge}`}>
                        {count}
                    </span>
                </div>
                {isOpen ? (
                    <ChevronDown size={16} className="text-slate-400" />
                ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                )}
            </button>
            
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const DecisionBottleneckPanel: React.FC<DecisionBottleneckPanelProps> = ({
    onDecisionClick
}) => {
    const { t } = useTranslation();
    const [data, setData] = useState<BottleneckData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const currentProjectId = useAppStore(state => state.currentProjectId);

    // Fetch bottleneck data
    const fetchBottlenecks = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            const url = currentProjectId 
                ? `/decisions/bottlenecks?projectId=${currentProjectId}`
                : '/decisions/bottlenecks';
            
            const result = await Api.get(url);
            setData(result);
        } catch (error) {
            console.error('Failed to fetch bottlenecks:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchBottlenecks();
    }, [currentProjectId]);

    // Calculate total issues
    const totalIssues = data 
        ? (data.aging?.length || 0) + (data.blocking?.length || 0) + (data.ownerOverload?.length || 0)
        : 0;

    // If no issues, show nothing
    if (!loading && totalIssues === 0) {
        return null;
    }

    if (loading) {
        return (
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-32 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-48" />
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        {t('decisions.bottlenecks', 'Decision Bottlenecks')}
                    </span>
                </div>
                <button
                    onClick={() => fetchBottlenecks(true)}
                    disabled={refreshing}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Aging Decisions */}
            <AlertSection
                title={t('decisions.aging', 'Aging Decisions')}
                icon={<Clock size={14} />}
                count={data?.aging?.length || 0}
                color="amber"
            >
                {data?.aging?.map(d => (
                    <button
                        key={d.id}
                        onClick={() => onDecisionClick?.(d.id)}
                        className="w-full text-left p-2 bg-white dark:bg-navy-900 rounded border border-amber-100 dark:border-amber-800/30 hover:border-amber-300 transition-colors"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                                {d.title}
                            </span>
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 font-medium">
                                {d.daysWaiting}d
                            </span>
                        </div>
                        {d.ownerName && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                Owner: {d.ownerName}
                            </span>
                        )}
                    </button>
                ))}
            </AlertSection>

            {/* Blocking Decisions */}
            <AlertSection
                title={t('decisions.blocking', 'Blocking Work')}
                icon={<Lock size={14} />}
                count={data?.blocking?.length || 0}
                color="red"
            >
                {data?.blocking?.map(d => (
                    <button
                        key={d.id}
                        onClick={() => onDecisionClick?.(d.id)}
                        className="w-full text-left p-2 bg-white dark:bg-navy-900 rounded border border-red-100 dark:border-red-800/30 hover:border-red-300 transition-colors"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate flex-1">
                                {d.title}
                            </span>
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 font-medium">
                                {d.blockedCount} blocked
                            </span>
                        </div>
                        {d.ownerName && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                Owner: {d.ownerName}
                            </span>
                        )}
                    </button>
                ))}
            </AlertSection>

            {/* Owner Overload */}
            <AlertSection
                title={t('decisions.overload', 'Overloaded Owners')}
                icon={<Users size={14} />}
                count={data?.ownerOverload?.length || 0}
                color="purple"
                defaultOpen={false}
            >
                {data?.ownerOverload?.map(owner => (
                    <div
                        key={owner.userId}
                        className="p-2 bg-white dark:bg-navy-900 rounded border border-purple-100 dark:border-purple-800/30"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {owner.name}
                            </span>
                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300 font-medium">
                                {owner.pendingCount} pending
                            </span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {owner.email}
                        </span>
                    </div>
                ))}
            </AlertSection>
        </div>
    );
};

export default DecisionBottleneckPanel;









