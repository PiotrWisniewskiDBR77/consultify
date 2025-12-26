/**
 * VelocityChart - Task velocity visualization
 * Part of My Work Module PMO Upgrade
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { VelocityMetrics, VelocityChartProps } from '../../../types/myWork';
import { useExecutionScore } from '../../../hooks/useExecutionScore';

/**
 * Simple bar chart component
 */
const BarChart: React.FC<{
    data: Array<{ completed: number; created: number }>;
    maxValue: number;
    height: number;
}> = ({ data, maxValue, height }) => {
    const barWidth = `${100 / data.length}%`;
    
    return (
        <div className="flex items-end justify-between gap-1 w-full" style={{ height }}>
            {data.map((item, idx) => {
                const completedHeight = (item.completed / maxValue) * height;
                const createdHeight = (item.created / maxValue) * height;
                
                return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-0.5">
                        {/* Created bar (background) */}
                        <div className="w-full relative rounded-t">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: createdHeight }}
                                transition={{ delay: idx * 0.05, duration: 0.3 }}
                                className="w-full bg-slate-200 dark:bg-white/10 rounded-t absolute bottom-0"
                            />
                            {/* Completed bar (foreground) */}
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: completedHeight }}
                                transition={{ delay: idx * 0.05 + 0.1, duration: 0.3 }}
                                className="w-full bg-brand rounded-t absolute bottom-0"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * VelocityChart Component
 */
export const VelocityChart: React.FC<Partial<VelocityChartProps> & { className?: string }> = ({
    metrics: externalMetrics,
    showTeamAverage = true,
    height = 120,
    className = ''
}) => {
    const { t } = useTranslation();
    const { velocity: hookVelocity, loading, loadVelocity } = useExecutionScore({ autoLoad: !externalMetrics });
    
    const metrics = externalMetrics || hookVelocity;
    
    // Calculate max value for scaling
    const maxValue = useMemo(() => {
        if (!metrics?.data) return 10;
        return Math.max(
            ...metrics.data.map(d => Math.max(d.completed, d.created)),
            10
        );
    }, [metrics]);
    
    // Trend icon and color
    const trend = metrics?.trend || 'stable';
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-slate-400';
    
    if (loading && !metrics) {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-xl p-6 ${className}`}>
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
            </div>
        );
    }
    
    if (!metrics) {
        return null;
    }
    
    return (
        <div className={`bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6 ${className}`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        {t('myWork.dashboard.velocity', 'Task Velocity')}
                    </h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-navy-900 dark:text-white">
                            {metrics.averageVelocity}
                        </span>
                        <span className="text-sm text-slate-400">
                            tasks/week
                        </span>
                    </div>
                </div>
                
                {/* Trend */}
                <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon size={16} />
                    <span className="text-sm font-medium capitalize">{trend}</span>
                </div>
            </div>
            
            {/* Chart */}
            <div className="mb-4">
                <BarChart 
                    data={metrics.data} 
                    maxValue={maxValue} 
                    height={height} 
                />
                
                {/* X-axis labels */}
                <div className="flex justify-between mt-2">
                    {metrics.data.map((d, idx) => (
                        <div key={idx} className="flex-1 text-center">
                            <span className="text-[10px] text-slate-400">
                                {new Date(d.date).toLocaleDateString('pl-PL', { 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Legend & Stats */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                {/* Legend */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-brand" />
                        <span className="text-xs text-slate-500">
                            {t('myWork.dashboard.completed', 'Completed')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-slate-200 dark:bg-white/10" />
                        <span className="text-xs text-slate-500">
                            {t('myWork.dashboard.created', 'Created')}
                        </span>
                    </div>
                </div>
                
                {/* Team average comparison */}
                {showTeamAverage && (
                    <div className="text-right">
                        <p className="text-xs text-slate-400">
                            {t('myWork.dashboard.teamAverage', 'Team avg:')} {metrics.teamAverageVelocity}
                        </p>
                        {metrics.averageVelocity > metrics.teamAverageVelocity && (
                            <p className="text-[10px] text-green-500">
                                +{Math.round(((metrics.averageVelocity - metrics.teamAverageVelocity) / metrics.teamAverageVelocity) * 100)}% above team
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VelocityChart;

