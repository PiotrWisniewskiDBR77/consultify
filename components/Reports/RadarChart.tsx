/**
 * RadarChart (Spider Chart)
 * 
 * 7-axis visualization for DRD maturity:
 * - Actual level (blue filled area)
 * - Target level (green dashed line)
 * - Industry benchmark (gray dashed line) - optional
 * - Animated reveal on scroll
 * - Interactive tooltips
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RadarChart as RechartsRadar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// DRD 7 Axes configuration
const DRD_AXES = {
    processes: { 
        namePl: 'Procesy Cyfrowe', 
        nameEn: 'Digital Processes', 
        icon: '⚙️',
        maxLevel: 7
    },
    digitalProducts: { 
        namePl: 'Produkty Cyfrowe', 
        nameEn: 'Digital Products', 
        icon: '📦',
        maxLevel: 5 
    },
    businessModels: { 
        namePl: 'Modele Biznesowe', 
        nameEn: 'Business Models', 
        icon: '💼',
        maxLevel: 5 
    },
    dataManagement: { 
        namePl: 'Zarządzanie Danymi', 
        nameEn: 'Data Management', 
        icon: '📊',
        maxLevel: 7 
    },
    culture: { 
        namePl: 'Kultura Transformacji', 
        nameEn: 'Transformation Culture', 
        icon: '🎯',
        maxLevel: 5 
    },
    cybersecurity: { 
        namePl: 'Cyberbezpieczeństwo', 
        nameEn: 'Cybersecurity', 
        icon: '🔒',
        maxLevel: 5 
    },
    aiMaturity: { 
        namePl: 'Dojrzałość AI', 
        nameEn: 'AI Maturity', 
        icon: '🤖',
        maxLevel: 5 
    }
};

interface AxisData {
    actual?: number;
    target?: number;
    justification?: string;
}

interface RadarChartProps {
    axisData: Record<string, AxisData>;
    showTarget?: boolean;
    showBenchmark?: boolean;
    benchmarkData?: Record<string, number>;
    height?: number;
    animated?: boolean;
    className?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    if (active && payload && payload.length) {
        const axisKey = Object.keys(DRD_AXES).find(
            key => DRD_AXES[key as keyof typeof DRD_AXES].namePl === label || 
                   DRD_AXES[key as keyof typeof DRD_AXES].nameEn === label
        );
        const axisConfig = axisKey ? DRD_AXES[axisKey as keyof typeof DRD_AXES] : null;

        return (
            <div className="bg-white dark:bg-navy-800 px-4 py-3 rounded-xl shadow-xl border border-slate-200 dark:border-white/10">
                <p className="font-semibold text-navy-900 dark:text-white mb-2">
                    {axisConfig?.icon} {label}
                </p>
                <div className="space-y-1 text-sm">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                            <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-slate-600 dark:text-slate-400">
                                {entry.name}:
                            </span>
                            <span className="font-medium text-navy-900 dark:text-white">
                                {entry.value.toFixed(1)}
                            </span>
                            {axisConfig && (
                                <span className="text-slate-400 dark:text-slate-500">
                                    / {axisConfig.maxLevel}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export const RadarChartComponent: React.FC<RadarChartProps> = ({
    axisData,
    showTarget = true,
    showBenchmark = false,
    benchmarkData,
    height = 400,
    animated = true,
    className = ''
}) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    // Transform data for Recharts
    const chartData = useMemo(() => {
        return Object.entries(DRD_AXES).map(([key, config]) => {
            const data = axisData[key] || {};
            return {
                axis: isPolish ? config.namePl : config.nameEn,
                axisKey: key,
                actual: data.actual || 0,
                target: data.target || 0,
                benchmark: benchmarkData?.[key] || 4, // Default benchmark
                fullMark: config.maxLevel
            };
        });
    }, [axisData, benchmarkData, isPolish]);

    // Calculate average scores
    const averageActual = useMemo(() => {
        const values = chartData.map(d => d.actual).filter(v => v > 0);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }, [chartData]);

    const averageTarget = useMemo(() => {
        const values = chartData.map(d => d.target).filter(v => v > 0);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }, [chartData]);

    return (
        <div className={`relative ${className}`}>
            {/* Legend summary */}
            <div className="flex items-center justify-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                        {isPolish ? 'Aktualny' : 'Actual'}: <strong className="text-navy-900 dark:text-white">{averageActual.toFixed(1)}</strong>
                    </span>
                </div>
                {showTarget && (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-500" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {isPolish ? 'Docelowy' : 'Target'}: <strong className="text-navy-900 dark:text-white">{averageTarget.toFixed(1)}</strong>
                        </span>
                    </div>
                )}
                {showBenchmark && (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {isPolish ? 'Benchmark' : 'Benchmark'}
                        </span>
                    </div>
                )}
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={height}>
                <RechartsRadar 
                    data={chartData}
                    margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                >
                    <PolarGrid 
                        stroke="#e2e8f0" 
                        className="dark:stroke-white/10"
                    />
                    <PolarAngleAxis 
                        dataKey="axis" 
                        tick={{ 
                            fill: '#64748b', 
                            fontSize: 12,
                            fontWeight: 500
                        }}
                        className="dark:fill-slate-400"
                    />
                    <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 7]}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickCount={8}
                        axisLine={false}
                    />

                    {/* Benchmark area (if shown) */}
                    {showBenchmark && (
                        <Radar
                            name={isPolish ? 'Benchmark' : 'Benchmark'}
                            dataKey="benchmark"
                            stroke="#94a3b8"
                            fill="#94a3b8"
                            fillOpacity={0.1}
                            strokeDasharray="5 5"
                            strokeWidth={1}
                            isAnimationActive={animated}
                            animationDuration={1500}
                            animationBegin={600}
                        />
                    )}

                    {/* Target area */}
                    {showTarget && (
                        <Radar
                            name={isPolish ? 'Docelowy' : 'Target'}
                            dataKey="target"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.15}
                            strokeWidth={2}
                            strokeDasharray="8 4"
                            isAnimationActive={animated}
                            animationDuration={1200}
                            animationBegin={300}
                        />
                    )}

                    {/* Actual area */}
                    <Radar
                        name={isPolish ? 'Aktualny' : 'Actual'}
                        dataKey="actual"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 4 }}
                        activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive={animated}
                        animationDuration={1000}
                        animationBegin={0}
                    />

                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                        wrapperStyle={{ 
                            paddingTop: '20px',
                            fontSize: '12px'
                        }}
                    />
                </RechartsRadar>
            </ResponsiveContainer>

            {/* Axis icons overlay (optional decorative) */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Could add floating axis icons here */}
            </div>
        </div>
    );
};

// Compact version for inline/card use
export const RadarChartMini: React.FC<{
    axisData: Record<string, AxisData>;
    size?: number;
}> = ({ axisData, size = 200 }) => {
    const chartData = Object.entries(DRD_AXES).map(([key, config]) => ({
        axis: config.icon,
        actual: axisData[key]?.actual || 0,
        fullMark: config.maxLevel
    }));

    return (
        <ResponsiveContainer width={size} height={size}>
            <RechartsRadar data={chartData}>
                <PolarGrid stroke="#e2e8f0" />
                <Radar
                    dataKey="actual"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                    strokeWidth={2}
                />
            </RechartsRadar>
        </ResponsiveContainer>
    );
};

export default RadarChartComponent;

