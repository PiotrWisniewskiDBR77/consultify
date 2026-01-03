/**
 * TeamPerformancePreview - Quick team status overview
 * BCG/McKinsey style: Heatmap, data-dense, actionable
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    BarChart3
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TeamMember {
    id: string;
    name: string;
    initials: string;
    capacity: number;
    tasksCompleted: number;
    tasksTotal: number;
    trend: 'up' | 'down' | 'stable';
}

interface TeamPerformancePreviewProps {
    members?: TeamMember[];
    avgCapacity?: number;
    avgVelocity?: number;
    velocityTrend?: 'up' | 'down' | 'stable';
    loading?: boolean;
    onViewAll?: () => void;
    onMemberClick?: (id: string) => void;
}

// Capacity indicator with color
const CapacityIndicator: React.FC<{ capacity: number }> = ({ capacity }) => {
    const getColor = () => {
        if (capacity > 100) return 'bg-rose-500';
        if (capacity > 85) return 'bg-amber-500';
        if (capacity > 60) return 'bg-emerald-500';
        return 'bg-cyan-500';
    };

    const getTextColor = () => {
        if (capacity > 100) return 'text-rose-600 dark:text-rose-400';
        if (capacity > 85) return 'text-amber-600 dark:text-amber-400';
        return 'text-navy-900 dark:text-white';
    };

    return (
        <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(capacity, 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${getColor()}`}
                />
            </div>
            <span className={`text-xs font-bold tabular-nums w-10 text-right ${getTextColor()}`}>
                {capacity}%
            </span>
        </div>
    );
};

// Team member row
const TeamMemberRow: React.FC<{
    member: TeamMember;
    onClick?: () => void;
}> = ({ member, onClick }) => {
    const isOverloaded = member.capacity > 100;
    const TrendIcon = member.trend === 'up' ? TrendingUp : member.trend === 'down' ? TrendingDown : null;

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ backgroundColor: 'rgba(124, 58, 237, 0.05)' }}
            className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                ${isOverloaded ? 'bg-rose-50/50 dark:bg-rose-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'}
            `}
            onClick={onClick}
        >
            {/* Avatar */}
            <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white
                ${isOverloaded 
                    ? 'bg-gradient-to-br from-rose-500 to-red-600' 
                    : 'bg-gradient-to-br from-violet-500 to-purple-600'
                }
            `}>
                {member.initials}
            </div>

            {/* Name & Progress */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
                        {member.name}
                    </span>
                    {isOverloaded && (
                        <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                    )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{member.tasksCompleted}/{member.tasksTotal} tasks</span>
                    {TrendIcon && (
                        <TrendIcon 
                            size={10} 
                            className={member.trend === 'up' ? 'text-emerald-500' : 'text-rose-500'} 
                        />
                    )}
                </div>
            </div>

            {/* Capacity */}
            <CapacityIndicator capacity={member.capacity} />
        </motion.div>
    );
};

export const TeamPerformancePreview: React.FC<TeamPerformancePreviewProps> = ({
    members = [],
    avgCapacity = 0,
    avgVelocity = 0,
    velocityTrend = 'stable',
    loading = false,
    onViewAll,
    onMemberClick
}) => {
    const { t } = useTranslation();

    // Default/mock members
    const displayMembers: TeamMember[] = members.length > 0 ? members : [
        { id: '1', name: 'Anna Kowalska', initials: 'AK', capacity: 95, tasksCompleted: 6, tasksTotal: 8, trend: 'up' },
        { id: '2', name: 'Piotr Nowak', initials: 'PN', capacity: 120, tasksCompleted: 5, tasksTotal: 12, trend: 'down' },
        { id: '3', name: 'Marta Wiśniewska', initials: 'MW', capacity: 65, tasksCompleted: 3, tasksTotal: 5, trend: 'stable' },
        { id: '4', name: 'Jan Kowalczyk', initials: 'JK', capacity: 40, tasksCompleted: 2, tasksTotal: 3, trend: 'up' },
        { id: '5', name: 'Karolina Mazur', initials: 'KM', capacity: 85, tasksCompleted: 4, tasksTotal: 7, trend: 'stable' },
    ];

    const calculatedAvgCapacity = avgCapacity || Math.round(displayMembers.reduce((sum, m) => sum + m.capacity, 0) / displayMembers.length);
    const overloadedCount = displayMembers.filter(m => m.capacity > 100).length;
    const availableCount = displayMembers.filter(m => m.capacity < 50).length;

    const VelocityTrendIcon = velocityTrend === 'up' ? TrendingUp : velocityTrend === 'down' ? TrendingDown : null;

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-white/5">
                    <div className="h-6 w-40 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
                </div>
                <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10" />
                            <div className="flex-1">
                                <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded mb-1" />
                                <div className="h-3 w-16 bg-slate-100 dark:bg-white/5 rounded" />
                            </div>
                            <div className="w-20 h-2 bg-slate-200 dark:bg-white/10 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden h-full flex flex-col"
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <Users size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                {t('executive.team.title', 'Team Performance')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {displayMembers.length} {t('executive.team.members', 'members')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 shrink-0">
                <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                            {t('executive.team.avgCapacity', 'Avg Capacity')}
                        </p>
                        <p className={`text-lg font-bold ${
                            calculatedAvgCapacity > 90 ? 'text-amber-500' : 'text-navy-900 dark:text-white'
                        }`}>
                            {calculatedAvgCapacity}%
                        </p>
                    </div>
                    <div className="text-center border-x border-slate-200 dark:border-white/10">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                            {t('executive.team.overloaded', 'Overloaded')}
                        </p>
                        <p className={`text-lg font-bold ${overloadedCount > 0 ? 'text-rose-500' : 'text-navy-900 dark:text-white'}`}>
                            {overloadedCount}
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                            {t('executive.team.available', 'Available')}
                        </p>
                        <p className={`text-lg font-bold ${availableCount > 0 ? 'text-emerald-500' : 'text-navy-900 dark:text-white'}`}>
                            {availableCount}
                        </p>
                    </div>
                </div>
            </div>

            {/* Team Members List */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-1">
                    {displayMembers.slice(0, 6).map((member, idx) => (
                        <motion.div
                            key={member.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <TeamMemberRow
                                member={member}
                                onClick={() => onMemberClick?.(member.id)}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            {onViewAll && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 shrink-0">
                    <button
                        onClick={onViewAll}
                        className="w-full text-center text-sm font-medium text-brand hover:text-brand-hover flex items-center justify-center gap-1 transition-colors"
                    >
                        {t('executive.team.viewAll', 'View full team report')}
                        <ArrowRight size={14} />
                    </button>
                </div>
            )}
        </motion.div>
    );
};

export default TeamPerformancePreview;








