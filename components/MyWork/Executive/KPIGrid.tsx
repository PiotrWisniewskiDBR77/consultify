/**
 * KPIGrid - Executive KPI Dashboard Grid
 * BCG/McKinsey style: 4-quadrant layout, data-dense, actionable
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Clock,
    Users,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Minus,
    ArrowRight,
    FileQuestion,
    Target,
    Zap,
    Calendar
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface KPIData {
    tasks: {
        completed: number;
        total: number;
        overdueCount: number;
        onTimeRate: number;
        trend: 'up' | 'down' | 'stable';
    };
    decisions: {
        pending: number;
        avgWaitDays: number;
        critical: number;
        trend: 'up' | 'down' | 'stable';
    };
    team: {
        avgCapacity: number;
        overloaded: number;
        available: number;
        trend: 'up' | 'down' | 'stable';
    };
    risk: {
        level: 'low' | 'medium' | 'high' | 'critical';
        blockers: number;
        escalations: number;
        trend: 'up' | 'down' | 'stable';
    };
}

interface KPIGridProps {
    data?: Partial<KPIData>;
    loading?: boolean;
    onNavigate?: (section: string) => void;
}

// Individual KPI Card
const KPICard: React.FC<{
    title: string;
    icon: React.ReactNode;
    iconBg: string;
    value: string | number;
    subValue?: string;
    trend?: 'up' | 'down' | 'stable';
    trendLabel?: string;
    status?: 'success' | 'warning' | 'danger' | 'neutral';
    details?: { label: string; value: string | number; highlight?: boolean }[];
    onClick?: () => void;
    delay?: number;
}> = ({ 
    title, 
    icon, 
    iconBg, 
    value, 
    subValue, 
    trend, 
    trendLabel,
    status = 'neutral',
    details,
    onClick,
    delay = 0
}) => {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    
    const getTrendColor = () => {
        // For some metrics, down is good (e.g., overdue, wait time)
        if (trend === 'up') return 'text-emerald-500';
        if (trend === 'down') return 'text-rose-500';
        return 'text-slate-400';
    };

    const getStatusBorder = () => {
        switch (status) {
            case 'success': return 'border-l-emerald-500';
            case 'warning': return 'border-l-amber-500';
            case 'danger': return 'border-l-rose-500';
            default: return 'border-l-slate-300 dark:border-l-white/20';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay * 0.1, duration: 0.4 }}
            onClick={onClick}
            className={`
                bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 
                border-l-4 ${getStatusBorder()}
                p-5 hover:shadow-lg transition-all cursor-pointer group
            `}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shadow-lg`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`flex items-center gap-1 ${getTrendColor()}`}>
                        <TrendIcon size={14} />
                        {trendLabel && <span className="text-xs font-medium">{trendLabel}</span>}
                    </div>
                )}
            </div>

            {/* Title */}
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {title}
            </p>

            {/* Main Value */}
            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-navy-900 dark:text-white tabular-nums">
                    {value}
                </span>
                {subValue && (
                    <span className="text-sm text-slate-400">{subValue}</span>
                )}
            </div>

            {/* Details */}
            {details && details.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
                    {details.map((detail, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">{detail.label}</span>
                            <span className={`font-semibold tabular-nums ${
                                detail.highlight ? 'text-rose-500' : 'text-navy-900 dark:text-white'
                            }`}>
                                {detail.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Hover Arrow */}
            <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-brand font-medium flex items-center gap-1">
                    View details <ArrowRight size={12} />
                </span>
            </div>
        </motion.div>
    );
};

// Risk Level Badge
const RiskLevelBadge: React.FC<{ level: string }> = ({ level }) => {
    const config = {
        low: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', label: 'Low' },
        medium: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Medium' },
        high: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'High' },
        critical: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', label: 'Critical' }
    };

    const cfg = config[level as keyof typeof config] || config.medium;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
                level === 'critical' ? 'bg-rose-500 animate-pulse' :
                level === 'high' ? 'bg-orange-500' :
                level === 'medium' ? 'bg-amber-500' :
                'bg-emerald-500'
            }`} />
            {cfg.label}
        </span>
    );
};

export const KPIGrid: React.FC<KPIGridProps> = ({
    data,
    loading = false,
    onNavigate
}) => {
    const { t } = useTranslation();

    // Default/mock data
    const kpiData: KPIData = {
        tasks: {
            completed: data?.tasks?.completed ?? 24,
            total: data?.tasks?.total ?? 36,
            overdueCount: data?.tasks?.overdueCount ?? 3,
            onTimeRate: data?.tasks?.onTimeRate ?? 78,
            trend: data?.tasks?.trend ?? 'up'
        },
        decisions: {
            pending: data?.decisions?.pending ?? 8,
            avgWaitDays: data?.decisions?.avgWaitDays ?? 2.4,
            critical: data?.decisions?.critical ?? 2,
            trend: data?.decisions?.trend ?? 'stable'
        },
        team: {
            avgCapacity: data?.team?.avgCapacity ?? 82,
            overloaded: data?.team?.overloaded ?? 2,
            available: data?.team?.available ?? 1,
            trend: data?.team?.trend ?? 'up'
        },
        risk: {
            level: data?.risk?.level ?? 'medium',
            blockers: data?.risk?.blockers ?? 4,
            escalations: data?.risk?.escalations ?? 1,
            trend: data?.risk?.trend ?? 'stable'
        }
    };

    const completionRate = Math.round((kpiData.tasks.completed / kpiData.tasks.total) * 100);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5 animate-pulse">
                        <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-white/10 mb-4" />
                        <div className="h-4 w-20 bg-slate-200 dark:bg-white/10 rounded mb-2" />
                        <div className="h-8 w-24 bg-slate-200 dark:bg-white/10 rounded" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Tasks KPI */}
            <KPICard
                title={t('executive.kpi.tasks', 'Task Execution')}
                icon={<CheckCircle2 size={22} className="text-white" />}
                iconBg="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30"
                value={`${completionRate}%`}
                subValue={`${kpiData.tasks.completed}/${kpiData.tasks.total}`}
                trend={kpiData.tasks.trend}
                trendLabel={kpiData.tasks.trend === 'up' ? '+8%' : '-3%'}
                status={completionRate >= 75 ? 'success' : completionRate >= 50 ? 'warning' : 'danger'}
                details={[
                    { label: t('executive.kpi.onTime', 'On-time'), value: `${kpiData.tasks.onTimeRate}%` },
                    { label: t('executive.kpi.overdue', 'Overdue'), value: kpiData.tasks.overdueCount, highlight: kpiData.tasks.overdueCount > 0 }
                ]}
                onClick={() => onNavigate?.('tasks')}
                delay={0}
            />

            {/* Decisions KPI */}
            <KPICard
                title={t('executive.kpi.decisions', 'Decisions Pending')}
                icon={<FileQuestion size={22} className="text-white" />}
                iconBg="bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/30"
                value={kpiData.decisions.pending}
                subValue={t('executive.kpi.awaiting', 'awaiting')}
                trend={kpiData.decisions.trend}
                status={kpiData.decisions.critical > 0 ? 'danger' : kpiData.decisions.pending > 5 ? 'warning' : 'success'}
                details={[
                    { label: t('executive.kpi.critical', 'Critical'), value: kpiData.decisions.critical, highlight: kpiData.decisions.critical > 0 },
                    { label: t('executive.kpi.avgWait', 'Avg wait'), value: `${kpiData.decisions.avgWaitDays}d` }
                ]}
                onClick={() => onNavigate?.('decisions')}
                delay={1}
            />

            {/* Team Capacity KPI */}
            <KPICard
                title={t('executive.kpi.teamCapacity', 'Team Capacity')}
                icon={<Users size={22} className="text-white" />}
                iconBg="bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30"
                value={`${kpiData.team.avgCapacity}%`}
                subValue={t('executive.kpi.utilized', 'utilized')}
                trend={kpiData.team.trend}
                trendLabel={kpiData.team.trend === 'up' ? '+5%' : '-2%'}
                status={
                    kpiData.team.overloaded > 2 ? 'danger' : 
                    kpiData.team.avgCapacity > 90 ? 'warning' : 
                    'success'
                }
                details={[
                    { label: t('executive.kpi.overloaded', 'Overloaded'), value: kpiData.team.overloaded, highlight: kpiData.team.overloaded > 0 },
                    { label: t('executive.kpi.available', 'Available'), value: kpiData.team.available }
                ]}
                onClick={() => onNavigate?.('team')}
                delay={2}
            />

            {/* Risk Level KPI */}
            <KPICard
                title={t('executive.kpi.riskLevel', 'Risk Level')}
                icon={<AlertTriangle size={22} className="text-white" />}
                iconBg={`bg-gradient-to-br ${
                    kpiData.risk.level === 'critical' ? 'from-rose-500 to-red-600 shadow-rose-500/30' :
                    kpiData.risk.level === 'high' ? 'from-orange-500 to-red-600 shadow-orange-500/30' :
                    kpiData.risk.level === 'medium' ? 'from-amber-500 to-orange-600 shadow-amber-500/30' :
                    'from-emerald-500 to-green-600 shadow-emerald-500/30'
                }`}
                value={<RiskLevelBadge level={kpiData.risk.level} />}
                trend={kpiData.risk.trend}
                status={
                    kpiData.risk.level === 'critical' ? 'danger' :
                    kpiData.risk.level === 'high' ? 'warning' :
                    'neutral'
                }
                details={[
                    { label: t('executive.kpi.blockers', 'Blockers'), value: kpiData.risk.blockers, highlight: kpiData.risk.blockers > 2 },
                    { label: t('executive.kpi.escalations', 'Escalations'), value: kpiData.risk.escalations, highlight: kpiData.risk.escalations > 0 }
                ]}
                onClick={() => onNavigate?.('risks')}
                delay={3}
            />
        </div>
    );
};

export default KPIGrid;



