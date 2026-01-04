/**
 * AIMemoryMetricsDashboard
 *
 * Admin dashboard component for viewing AI memory usage, performance,
 * and efficiency metrics. Part of Enterprise AI Readiness initiative.
 *
 * Features:
 * - Memory usage trends chart
 * - Token efficiency metrics
 * - Latency percentiles (P50, P95, P99)
 * - Cost savings from trimming
 * - Real-time memory state
 *
 * @version 1.0.0
 */

import {
    Activity,
    AlertTriangle,
    BarChart2,
    Brain,
    CheckCircle,
    Clock,
    Database,
    DollarSign,
    Gauge,
    HardDrive,
    Layers,
    RefreshCw,
    TrendingDown,
    TrendingUp,
    Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ============================================================================
// Types
// ============================================================================

interface DailyMetric {
    date: string;
    total_reads: number;
    total_writes: number;
    total_trims: number;
    total_cleanups: number;
    peak_tokens: number;
    avg_tokens: number;
    tokens_saved: number;
    avg_latency: number;
    avg_relevance: number;
}

interface MetricsSummary {
    totalReads: number;
    totalWrites: number;
    totalTrims: number;
    totalTokensSaved: number;
    peakTokens: number;
    avgLatency?: number;
    avgRelevance?: number;
    avgTokensPerDay?: number;
    estimatedCostSaved?: string;
}

interface MemoryState {
    projectMemory: {
        tokens: number;
        itemCount: number;
        majorDecisions: number;
        phaseTransitions: number;
        recommendations: number;
    };
    organizationMemory: {
        tokens: number;
        patterns: number;
        style: string;
    };
    totalTokens: number;
    efficiency: {
        utilizationPercent: string;
        recommendedLimit: number;
    };
}

interface LatencyMetrics {
    p50: number;
    p95: number;
    p99: number;
    count: number;
    avg: number;
}

interface AIMemoryMetricsDashboardProps {
    projectId?: string;
    className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

const MetricCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
}> = ({ title, value, subtitle, icon, trend, trendValue, color = 'primary' }) => {
    const colorClasses = {
        primary: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
        success: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
        warning: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
        danger: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    };

    return (
        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {title}
                    </p>
                    <p className="text-2xl font-bold text-navy-900 dark:text-white mt-1">{value}</p>
                    {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
                    {trend && trendValue && (
                        <div
                            className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                                trend === 'up'
                                    ? 'text-emerald-600'
                                    : trend === 'down'
                                      ? 'text-red-600'
                                      : 'text-slate-500'
                            }`}
                        >
                            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {trendValue}
                        </div>
                    )}
                </div>
                <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>{icon}</div>
            </div>
        </div>
    );
};

const ProgressBar: React.FC<{
    value: number;
    max: number;
    label?: string;
    color?: 'primary' | 'success' | 'warning' | 'danger';
}> = ({ value, max, label, color = 'primary' }) => {
    const percentage = Math.min(100, (value / max) * 100);
    const colorClasses = {
        primary: 'bg-indigo-500',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500',
    };

    return (
        <div className="w-full">
            {label && (
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{label}</span>
                    <span>{percentage.toFixed(1)}%</span>
                </div>
            )}
            <div className="h-2 bg-slate-100 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClasses[color]} transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

const SimpleBarChart: React.FC<{
    data: { label: string; value: number }[];
    maxValue?: number;
    color?: string;
}> = ({ data, maxValue, color = 'indigo' }) => {
    const max = maxValue || Math.max(...data.map((d) => d.value)) || 1;

    return (
        <div className="flex items-end gap-1 h-20">
            {data.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                    <div
                        className={`w-full bg-${color}-500 dark:bg-${color}-400 rounded-t transition-all duration-300`}
                        style={{ height: `${(item.value / max) * 100}%`, minHeight: '2px' }}
                    />
                    <span className="text-[8px] text-slate-400 mt-1 truncate w-full text-center">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const AIMemoryMetricsDashboard: React.FC<AIMemoryMetricsDashboardProps> = ({ projectId, className = '' }) => {
    const { t } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
    const [summary, setSummary] = useState<MetricsSummary | null>(null);
    const [memoryState, setMemoryState] = useState<MemoryState | null>(null);
    const [latencyMetrics, setLatencyMetrics] = useState<LatencyMetrics | null>(null);
    const [period, setPeriod] = useState(7);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all metrics in parallel
            const [metricsRes, stateRes, latencyRes] = await Promise.all([
                fetch(`/api/ai/memory/metrics?period=${period}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }).then((r) => r.json()),
                fetch(`/api/ai/memory/current?projectId=${projectId || ''}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }).then((r) => r.json()),
                fetch('/api/ai/memory/latency?hours=24', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }).then((r) => r.json()),
            ]);

            if (metricsRes.success) {
                setDailyMetrics(metricsRes.daily || []);
                setSummary(metricsRes.summary || null);
            }

            if (stateRes.success) {
                setMemoryState(stateRes);
            }

            if (latencyRes.success) {
                setLatencyMetrics(latencyRes);
            }
        } catch (err) {
            console.error('[AIMemoryMetricsDashboard] Error fetching metrics:', err);
            setError('Failed to load metrics');
        } finally {
            setLoading(false);
        }
    }, [period, projectId]);

    useEffect(() => {
        fetchMetrics();

        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchMetrics, 60000);
        return () => clearInterval(interval);
    }, [fetchMetrics]);

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    if (loading && !summary) {
        return (
            <div className={`p-6 ${className}`}>
                <div className="flex items-center justify-center py-12">
                    <RefreshCw size={24} className="animate-spin text-slate-400" />
                    <span className="ml-2 text-slate-500">Loading metrics...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                        <Brain size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                            {t('ai.memory.dashboard', 'AI Memory Dashboard')}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('ai.memory.dashboardSubtitle', 'Monitor memory usage and performance')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-200"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                    </select>
                    <button
                        onClick={fetchMetrics}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-500" />
                    <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    title={t('ai.memory.totalOperations', 'Total Operations')}
                    value={formatNumber((summary?.totalReads || 0) + (summary?.totalWrites || 0))}
                    subtitle={`${summary?.totalReads || 0} reads, ${summary?.totalWrites || 0} writes`}
                    icon={<Activity size={18} />}
                    color="primary"
                />
                <MetricCard
                    title={t('ai.memory.tokensSaved', 'Tokens Saved')}
                    value={formatNumber(summary?.totalTokensSaved || 0)}
                    subtitle={`~$${summary?.estimatedCostSaved || '0.00'} saved`}
                    icon={<DollarSign size={18} />}
                    color="success"
                />
                <MetricCard
                    title={t('ai.memory.peakUsage', 'Peak Usage')}
                    value={formatNumber(summary?.peakTokens || 0)}
                    subtitle="tokens"
                    icon={<TrendingUp size={18} />}
                    color="warning"
                />
                <MetricCard
                    title={t('ai.memory.avgLatency', 'Avg Latency')}
                    value={`${Math.round(summary?.avgLatency || 0)}ms`}
                    subtitle={latencyMetrics ? `P95: ${latencyMetrics.p95}ms` : undefined}
                    icon={<Clock size={18} />}
                    color={summary?.avgLatency && summary.avgLatency > 100 ? 'danger' : 'success'}
                />
            </div>

            {/* Current Memory State & Latency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Memory State */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <HardDrive size={16} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                            {t('ai.memory.currentState', 'Current Memory State')}
                        </h3>
                    </div>

                    {memoryState && (
                        <div className="space-y-4">
                            <ProgressBar
                                value={memoryState.totalTokens}
                                max={memoryState.efficiency.recommendedLimit}
                                label={`Memory Utilization (${memoryState.totalTokens} / ${memoryState.efficiency.recommendedLimit} tokens)`}
                                color={
                                    parseFloat(memoryState.efficiency.utilizationPercent) > 80 ? 'warning' : 'primary'
                                }
                            />

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Project Memory
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Database size={14} className="text-indigo-500" />
                                        <span className="text-sm font-semibold text-navy-900 dark:text-white">
                                            {formatNumber(memoryState.projectMemory.tokens)} tokens
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-0.5">
                                        <p>• {memoryState.projectMemory.majorDecisions} decisions</p>
                                        <p>• {memoryState.projectMemory.phaseTransitions} transitions</p>
                                        <p>• {memoryState.projectMemory.recommendations} recommendations</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Organization Memory
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Layers size={14} className="text-purple-500" />
                                        <span className="text-sm font-semibold text-navy-900 dark:text-white">
                                            {formatNumber(memoryState.organizationMemory.tokens)} tokens
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-0.5">
                                        <p>• {memoryState.organizationMemory.patterns} patterns</p>
                                        <p>• Style: {memoryState.organizationMemory.style}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Latency Distribution */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Gauge size={16} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                            {t('ai.memory.latencyDistribution', 'Latency Distribution')} (24h)
                        </h3>
                    </div>

                    {latencyMetrics && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">P50</p>
                                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                        {latencyMetrics.p50}ms
                                    </p>
                                </div>
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">P95</p>
                                    <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                                        {latencyMetrics.p95}ms
                                    </p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">P99</p>
                                    <p className="text-lg font-bold text-red-700 dark:text-red-300">
                                        {latencyMetrics.p99}ms
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-navy-700">
                                <span>Samples: {latencyMetrics.count}</span>
                                <span>Avg: {Math.round(latencyMetrics.avg || 0)}ms</span>
                                <span
                                    className={`flex items-center gap-1 ${
                                        latencyMetrics.p95 < 100 ? 'text-emerald-600' : 'text-amber-600'
                                    }`}
                                >
                                    {latencyMetrics.p95 < 100 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                                    {latencyMetrics.p95 < 100 ? 'Healthy' : 'Review Needed'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Daily Operations Chart */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart2 size={16} className="text-slate-500" />
                        <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
                            {t('ai.memory.dailyOperations', 'Daily Operations')}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                            Reads
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                            Writes
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-amber-500 rounded-full" />
                            Trims
                        </span>
                    </div>
                </div>

                {dailyMetrics.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-navy-700">
                                    <th className="text-left py-2 px-2 font-medium text-slate-500">Date</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Reads</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Writes</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Trims</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Peak Tokens</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Tokens Saved</th>
                                    <th className="text-right py-2 px-2 font-medium text-slate-500">Avg Latency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyMetrics.slice(0, 7).map((metric, idx) => (
                                    <tr
                                        key={metric.date}
                                        className="border-b border-slate-50 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800/50"
                                    >
                                        <td className="py-2 px-2 text-slate-700 dark:text-slate-300">
                                            {new Date(metric.date).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </td>
                                        <td className="text-right py-2 px-2 text-indigo-600">
                                            {formatNumber(metric.total_reads)}
                                        </td>
                                        <td className="text-right py-2 px-2 text-emerald-600">
                                            {formatNumber(metric.total_writes)}
                                        </td>
                                        <td className="text-right py-2 px-2 text-amber-600">
                                            {formatNumber(metric.total_trims)}
                                        </td>
                                        <td className="text-right py-2 px-2 text-slate-600">
                                            {formatNumber(metric.peak_tokens)}
                                        </td>
                                        <td className="text-right py-2 px-2 text-green-600">
                                            {formatNumber(metric.tokens_saved)}
                                        </td>
                                        <td className="text-right py-2 px-2 text-slate-600">
                                            {Math.round(metric.avg_latency || 0)}ms
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                        No data available for the selected period
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIMemoryMetricsDashboard;
