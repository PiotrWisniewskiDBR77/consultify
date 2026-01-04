/**
 * MembershipStatsCard - Membership statistics dashboard component
 *
 * Features:
 * - Active users trend chart
 * - User breakdown by status/role
 * - Growth metrics
 * - Time range selector
 *
 * Design: Metric cards with mini sparklines
 */

import {
    Activity,
    ArrowDown,
    ArrowUp,
    BarChart3,
    Calendar,
    ChevronDown,
    HelpCircle,
    TrendingDown,
    TrendingUp,
    UserCheck,
    UserMinus,
    UserPlus,
    Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Progress } from '../../ui/primitives/Progress';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Time range options
export type TimeRange = '7d' | '30d' | '90d' | '1y';

// Stats data point
export interface StatsDataPoint {
    date: string;
    value: number;
}

// Membership stats
export interface MembershipStats {
    totalUsers: number;
    activeUsers: number;
    newUsersThisPeriod: number;
    churnedUsersThisPeriod: number;
    pendingInvitations: number;
    growthRate: number; // percentage
    activeRate: number; // percentage
    avgSessionsPerUser: number;
    usersByRole: { role: string; count: number; color: string }[];
    usersByStatus: { status: string; count: number; color: string }[];
    activeUsersTrend: StatsDataPoint[];
    newUsersTrend: StatsDataPoint[];
}

interface MembershipStatsCardProps {
    stats: MembershipStats;
    timeRange: TimeRange;
    onTimeRangeChange?: (range: TimeRange) => void;
    onViewDetails?: (metric: string) => void;
    className?: string;
}

// Simple sparkline component
const Sparkline: React.FC<{
    data: StatsDataPoint[];
    color?: string;
    height?: number;
}> = ({ data, color = 'violet', height = 40 }) => {
    if (data.length === 0) return null;

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = data
        .map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = height - ((d.value - min) / range) * height;
            return `${x},${y}`;
        })
        .join(' ');

    const colorClasses: Record<string, string> = {
        violet: 'stroke-violet-500',
        emerald: 'stroke-emerald-500',
        blue: 'stroke-blue-500',
        rose: 'stroke-rose-500',
    };

    return (
        <svg className="w-full" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            <polyline
                points={points}
                fill="none"
                className={colorClasses[color] || colorClasses.violet}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

export const MembershipStatsCard: React.FC<MembershipStatsCardProps> = ({
    stats,
    timeRange,
    onTimeRangeChange,
    onViewDetails,
    className,
}) => {
    const { t } = useTranslation();
    const [showBreakdown, setShowBreakdown] = useState<'role' | 'status' | null>(null);

    // Time range labels
    const timeRangeLabels: Record<TimeRange, string> = {
        '7d': t('admin.team.stats.last7Days', 'Last 7 days'),
        '30d': t('admin.team.stats.last30Days', 'Last 30 days'),
        '90d': t('admin.team.stats.last90Days', 'Last 90 days'),
        '1y': t('admin.team.stats.lastYear', 'Last year'),
    };

    // Calculate trend direction
    const getTrend = (current: number, previous: number) => {
        if (previous === 0) return { direction: 'up' as const, percent: 0 };
        const percent = ((current - previous) / previous) * 100;
        return {
            direction: percent >= 0 ? ('up' as const) : ('down' as const),
            percent: Math.abs(percent),
        };
    };

    return (
        <div className={cn('space-y-6', className)}>
            {/* Header with Time Range */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                        {t('admin.team.stats.title', 'Membership Statistics')}
                        <Tooltip content={t('admin.team.stats.tooltip', 'Overview of your team membership and activity')}>
                            <HelpCircle size={16} className="text-slate-400" />
                        </Tooltip>
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {timeRangeLabels[timeRange]}
                    </p>
                </div>

                {onTimeRangeChange && (
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-navy-700 rounded-lg">
                        {(['7d', '30d', '90d', '1y'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => onTimeRangeChange(range)}
                                className={cn(
                                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                                    timeRange === range
                                        ? 'bg-white dark:bg-navy-600 text-navy-900 dark:text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white',
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Users */}
                <div
                    className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 cursor-pointer hover:border-violet-300 dark:hover:border-violet-700"
                    onClick={() => onViewDetails?.('total')}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.stats.totalUsers', 'Total Users')}
                        </span>
                        <Users size={18} className="text-violet-500" />
                    </div>
                    <p className="text-3xl font-bold text-navy-900 dark:text-white mb-2">
                        {stats.totalUsers.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                        {stats.growthRate >= 0 ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                                <TrendingUp size={12} />+{stats.growthRate.toFixed(1)}%
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
                                <TrendingDown size={12} />{stats.growthRate.toFixed(1)}%
                            </span>
                        )}
                        <span className="text-xs text-slate-400">
                            {t('admin.team.stats.vsLastPeriod', 'vs last period')}
                        </span>
                    </div>
                </div>

                {/* Active Users */}
                <div
                    className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700"
                    onClick={() => onViewDetails?.('active')}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.stats.activeUsers', 'Active Users')}
                        </span>
                        <Activity size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                        {stats.activeUsers.toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            {stats.activeRate.toFixed(0)}% {t('admin.team.stats.ofTotal', 'of total')}
                        </span>
                        <div className="w-16">
                            <Sparkline data={stats.activeUsersTrend} color="emerald" height={24} />
                        </div>
                    </div>
                </div>

                {/* New Users */}
                <div
                    className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700"
                    onClick={() => onViewDetails?.('new')}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.stats.newUsers', 'New Users')}
                        </span>
                        <UserPlus size={18} className="text-blue-500" />
                    </div>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                        +{stats.newUsersThisPeriod}
                    </p>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                            {t('admin.team.stats.thisPeriod', 'This period')}
                        </span>
                        <div className="w-16">
                            <Sparkline data={stats.newUsersTrend} color="blue" height={24} />
                        </div>
                    </div>
                </div>

                {/* Churned Users */}
                <div
                    className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 cursor-pointer hover:border-rose-300 dark:hover:border-rose-700"
                    onClick={() => onViewDetails?.('churned')}
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            {t('admin.team.stats.churnedUsers', 'Churned')}
                        </span>
                        <UserMinus size={18} className="text-rose-500" />
                    </div>
                    <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mb-2">
                        -{stats.churnedUsersThisPeriod}
                    </p>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                            {stats.pendingInvitations}{' '}
                            {t('admin.team.stats.pendingInvites', 'pending invites')}
                        </span>
                    </div>
                </div>
            </div>

            {/* Breakdown Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Users by Role */}
                <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-navy-900 dark:text-white">
                            {t('admin.team.stats.byRole', 'Users by Role')}
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowBreakdown(showBreakdown === 'role' ? null : 'role')}
                        >
                            <BarChart3 size={16} />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {stats.usersByRole.map((item) => (
                            <div key={item.role}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {item.role}
                                    </span>
                                    <span className="text-sm font-medium text-navy-900 dark:text-white">
                                        {item.count}
                                    </span>
                                </div>
                                <Progress
                                    value={(item.count / stats.totalUsers) * 100}
                                    size="sm"
                                    color="primary"
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Users by Status */}
                <div className="p-4 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-navy-900 dark:text-white">
                            {t('admin.team.stats.byStatus', 'Users by Status')}
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                setShowBreakdown(showBreakdown === 'status' ? null : 'status')
                            }
                        >
                            <BarChart3 size={16} />
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {stats.usersByStatus.map((item) => {
                            const colorClasses: Record<string, string> = {
                                emerald: 'bg-emerald-500',
                                amber: 'bg-amber-500',
                                slate: 'bg-slate-500',
                                rose: 'bg-rose-500',
                            };

                            return (
                                <div key={item.status} className="flex items-center gap-3">
                                    <span
                                        className={cn(
                                            'w-3 h-3 rounded-full',
                                            colorClasses[item.color] || 'bg-slate-500',
                                        )}
                                    />
                                    <span className="flex-1 text-sm text-slate-600 dark:text-slate-400">
                                        {item.status}
                                    </span>
                                    <span className="text-sm font-medium text-navy-900 dark:text-white">
                                        {item.count}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({((item.count / stats.totalUsers) * 100).toFixed(0)}%)
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('admin.team.stats.avgSessions', 'Avg Sessions/User')}
                    </p>
                    <p className="text-lg font-semibold text-navy-900 dark:text-white">
                        {stats.avgSessionsPerUser.toFixed(1)}
                    </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('admin.team.stats.activationRate', 'Activation Rate')}
                    </p>
                    <p className="text-lg font-semibold text-navy-900 dark:text-white">
                        {stats.activeRate.toFixed(0)}%
                    </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('admin.team.stats.netGrowth', 'Net Growth')}
                    </p>
                    <p
                        className={cn(
                            'text-lg font-semibold',
                            stats.newUsersThisPeriod - stats.churnedUsersThisPeriod >= 0
                                ? 'text-emerald-600'
                                : 'text-rose-600',
                        )}
                    >
                        {stats.newUsersThisPeriod - stats.churnedUsersThisPeriod >= 0 ? '+' : ''}
                        {stats.newUsersThisPeriod - stats.churnedUsersThisPeriod}
                    </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {t('admin.team.stats.pendingInvites', 'Pending Invites')}
                    </p>
                    <p className="text-lg font-semibold text-navy-900 dark:text-white">
                        {stats.pendingInvitations}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MembershipStatsCard;

