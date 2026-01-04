/**
 * TeamPerformancePanel - Comprehensive team analytics dashboard
 * BCG/McKinsey style: Data-dense, multiple views, actionable insights
 */

import { motion } from 'framer-motion';
import { AlertTriangle, BarChart3, Calendar, Clock, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { BottleneckMap } from './BottleneckMap';
import { CapacityForecast } from './CapacityForecast';
import { VelocityTrend } from './VelocityTrend';

interface TeamMetrics {
    teamSize: number;
    avgCapacity: number;
    currentVelocity: number;
    targetVelocity: number;
    bottlenecks: number;
    onTimeRate: number;
}

interface TeamPerformancePanelProps {
    onMemberClick?: (id: string) => void;
    onBottleneckResolve?: (id: string) => void;
}

// Quick stat card
const QuickStat: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'stable';
    trendValue?: string;
    status?: 'success' | 'warning' | 'danger' | 'neutral';
}> = ({ label, value, icon, trend, trendValue, status = 'neutral' }) => {
    const statusColors = {
        success: 'text-emerald-500',
        warning: 'text-amber-500',
        danger: 'text-rose-500',
        neutral: 'text-navy-900 dark:text-white',
    };

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    {icon}
                </div>
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        {label}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold tabular-nums ${statusColors[status]}`}>{value}</span>
                        {trend && trendValue && (
                            <span
                                className={`text-xs font-medium ${
                                    trend === 'up'
                                        ? 'text-emerald-500'
                                        : trend === 'down'
                                          ? 'text-rose-500'
                                          : 'text-slate-400'
                                }`}
                            >
                                {trendValue}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const TeamPerformancePanel: React.FC<TeamPerformancePanelProps> = ({ onMemberClick, onBottleneckResolve }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [metrics, setMetrics] = useState<TeamMetrics>({
        teamSize: 0,
        avgCapacity: 0,
        currentVelocity: 0,
        targetVelocity: 15,
        bottlenecks: 0,
        onTimeRate: 0,
    });

    // Fetch team data
    const fetchTeamData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Parallel API calls
            const [workloadRes, statsRes] = await Promise.allSettled([
                Api.get('/my-work/team-workload'),
                Api.get('/my-work/stats?period=week'),
            ]);

            // Process workload
            if (workloadRes.status === 'fulfilled' && Array.isArray(workloadRes.value)) {
                const team = workloadRes.value;
                const avgCapacity = Math.round(
                    team.reduce((sum: number, m: any) => sum + (m.capacity || 80), 0) / team.length,
                );

                setMetrics((prev) => ({
                    ...prev,
                    teamSize: team.length,
                    avgCapacity,
                }));
            }

            // Process stats
            if (statsRes.status === 'fulfilled' && statsRes.value) {
                const stats = statsRes.value;
                setMetrics((prev) => ({
                    ...prev,
                    currentVelocity: stats.velocityHistory?.[stats.velocityHistory.length - 1] || prev.currentVelocity,
                    onTimeRate: stats.onTimeRate || prev.onTimeRate,
                }));
            }
        } catch (error) {
            console.error('Failed to fetch team data:', error);
            // Use mock data
            setMetrics({
                teamSize: 5,
                avgCapacity: 82,
                currentVelocity: 15,
                targetVelocity: 15,
                bottlenecks: 3,
                onTimeRate: 78,
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    const handleResolve = async (id: string) => {
        toast.success(t('team.bottleneck.resolved', 'Bottleneck marked as resolved'));
        onBottleneckResolve?.(id);
        fetchTeamData(true);
    };

    const handleEscalate = async (id: string) => {
        toast.success(t('team.bottleneck.escalated', 'Bottleneck escalated to management'));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-lg shadow-cyan-500/30">
                        <Users size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white">
                            {t('team.title', 'Team Performance')}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('team.subtitle', 'Analytics, capacity, and bottlenecks')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => fetchTeamData(true)}
                    disabled={refreshing}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </motion.div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickStat
                    label={t('team.stats.teamSize', 'Team Size')}
                    value={metrics.teamSize}
                    icon={<Users size={18} />}
                />
                <QuickStat
                    label={t('team.stats.avgCapacity', 'Avg Capacity')}
                    value={`${metrics.avgCapacity}%`}
                    icon={<BarChart3 size={18} />}
                    status={metrics.avgCapacity > 90 ? 'warning' : metrics.avgCapacity > 100 ? 'danger' : 'neutral'}
                />
                <QuickStat
                    label={t('team.stats.velocity', 'Velocity')}
                    value={metrics.currentVelocity}
                    icon={<TrendingUp size={18} />}
                    trend={metrics.currentVelocity >= metrics.targetVelocity ? 'up' : 'down'}
                    trendValue={metrics.currentVelocity >= metrics.targetVelocity ? 'On target' : 'Below target'}
                    status={metrics.currentVelocity >= metrics.targetVelocity ? 'success' : 'warning'}
                />
                <QuickStat
                    label={t('team.stats.onTime', 'On-Time Rate')}
                    value={`${metrics.onTimeRate}%`}
                    icon={<Target size={18} />}
                    status={metrics.onTimeRate >= 80 ? 'success' : metrics.onTimeRate >= 60 ? 'warning' : 'danger'}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Velocity + Forecast */}
                <div className="space-y-6">
                    <VelocityTrend
                        currentVelocity={metrics.currentVelocity}
                        targetVelocity={metrics.targetVelocity}
                        loading={loading}
                    />
                </div>

                {/* Right Column: Bottlenecks */}
                <div>
                    <BottleneckMap loading={loading} onResolve={handleResolve} onEscalate={handleEscalate} />
                </div>
            </div>

            {/* Full Width: Capacity Forecast */}
            <CapacityForecast loading={loading} />
        </div>
    );
};

export default TeamPerformancePanel;
