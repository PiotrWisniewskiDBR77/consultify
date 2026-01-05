/**
 * VelocityTrend - Team velocity visualization with trend analysis
 * BCG/McKinsey style: Clear trend line, actionable insights
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    Activity,
    Target,
    Zap
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VelocityData {
    period: string;       // Week label (e.g., "W1", "W2")
    completed: number;    // Tasks completed
    target?: number;      // Target velocity
}

interface VelocityTrendProps {
    data?: VelocityData[];
    currentVelocity?: number;
    previousVelocity?: number;
    targetVelocity?: number;
    loading?: boolean;
}

// Mini sparkline chart
const SparklineChart: React.FC<{ data: number[]; target?: number }> = ({ data, target }) => {
    if (!data || data.length === 0) return null;

    const max = Math.max(...data, target || 0);
    const min = Math.min(...data);
    const range = max - min || 1;
    const height = 60;
    const width = 200;
    const padding = 8;

    const points = data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = height - padding - ((val - min) / range) * (height - padding * 2);
        return { x, y, value: val };
    });

    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');

    // Target line
    const targetY = target ? height - padding - ((target - min) / range) * (height - padding * 2) : null;

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Grid lines */}
            <defs>
                <linearGradient id="velocityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Area fill */}
            <path
                d={`${pathD} L ${points[points.length - 1].x},${height - padding} L ${padding},${height - padding} Z`}
                fill="url(#velocityGradient)"
            />

            {/* Target line */}
            {targetY !== null && (
                <line
                    x1={padding}
                    y1={targetY}
                    x2={width - padding}
                    y2={targetY}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 2"
                    className="text-amber-500/50"
                />
            )}

            {/* Trend line */}
            <motion.path
                d={pathD}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-violet-500"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
            />

            {/* Data points */}
            {points.map((p, i) => (
                <motion.circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={i === points.length - 1 ? 5 : 3}
                    fill="currentColor"
                    className={i === points.length - 1 ? 'text-violet-500' : 'text-violet-400'}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                />
            ))}
        </svg>
    );
};

export const VelocityTrend: React.FC<VelocityTrendProps> = ({
    data = [],
    currentVelocity = 0,
    previousVelocity = 0,
    targetVelocity = 0,
    loading = false
}) => {
    const { t } = useTranslation();

    // Default data if none provided
    const displayData: VelocityData[] = data.length > 0 ? data : [
        { period: 'W1', completed: 12, target: 15 },
        { period: 'W2', completed: 14, target: 15 },
        { period: 'W3', completed: 11, target: 15 },
        { period: 'W4', completed: 16, target: 15 },
        { period: 'W5', completed: 13, target: 15 },
        { period: 'W6', completed: 18, target: 15 },
        { period: 'W7', completed: 15, target: 15 },
    ];

    const chartData = displayData.map(d => d.completed);
    const avgTarget = displayData[0]?.target || targetVelocity || 15;

    const calculatedCurrent = currentVelocity || displayData[displayData.length - 1]?.completed || 0;
    const calculatedPrevious = previousVelocity || displayData[displayData.length - 2]?.completed || calculatedCurrent;
    const change = calculatedCurrent - calculatedPrevious;
    const changePercent = calculatedPrevious > 0 ? Math.round((change / calculatedPrevious) * 100) : 0;

    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-slate-400';

    // Calculate achievement vs target
    const avgVelocity = chartData.reduce((a, b) => a + b, 0) / chartData.length;
    const achievementRate = avgTarget > 0 ? Math.round((avgVelocity / avgTarget) * 100) : 100;

    if (loading) {
        return (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5 animate-pulse">
                <div className="h-5 w-32 bg-slate-200 dark:bg-white/10 rounded mb-4" />
                <div className="h-16 bg-slate-100 dark:bg-white/5 rounded" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Activity size={16} className="text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-navy-900 dark:text-white">
                            {t('team.velocity.title', 'Team Velocity')}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('team.velocity.subtitle', 'Tasks completed per week')}
                        </p>
                    </div>
                </div>

                {/* Trend badge */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                    trend === 'up' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                    trend === 'down' ? 'bg-rose-100 dark:bg-rose-900/30' :
                    'bg-slate-100 dark:bg-white/10'
                }`}>
                    <TrendIcon size={14} className={trendColor} />
                    <span className={`text-xs font-bold ${trendColor}`}>
                        {changePercent > 0 ? '+' : ''}{changePercent}%
                    </span>
                </div>
            </div>

            {/* Current Velocity Display */}
            <div className="flex items-end gap-4 mb-4">
                <div>
                    <p className="text-4xl font-bold text-navy-900 dark:text-white tabular-nums">
                        {calculatedCurrent}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('team.velocity.thisWeek', 'this week')}
                    </p>
                </div>
                <div className="pb-1">
                    <div className="flex items-center gap-1 text-sm">
                        <Target size={12} className="text-amber-500" />
                        <span className="text-slate-600 dark:text-slate-400">
                            {t('team.velocity.target', 'Target')}: {avgTarget}
                        </span>
                    </div>
                </div>
            </div>

            {/* Sparkline Chart */}
            <div className="mb-4">
                <SparklineChart data={chartData} target={avgTarget} />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                <div className="text-center">
                    <p className="text-lg font-bold text-navy-900 dark:text-white tabular-nums">
                        {Math.round(avgVelocity)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('team.velocity.average', 'Average')}
                    </p>
                </div>
                <div className="text-center border-x border-slate-100 dark:border-white/5">
                    <p className={`text-lg font-bold tabular-nums ${
                        achievementRate >= 100 ? 'text-emerald-500' :
                        achievementRate >= 80 ? 'text-amber-500' :
                        'text-rose-500'
                    }`}>
                        {achievementRate}%
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('team.velocity.achievement', 'vs Target')}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-lg font-bold text-navy-900 dark:text-white tabular-nums">
                        {Math.max(...chartData)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('team.velocity.peak', 'Peak')}
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

export default VelocityTrend;



