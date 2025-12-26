/**
 * IndustryBenchmark
 * 
 * Comparison section showing organization vs industry average:
 * - Bar chart comparison
 * - Percentile ranking
 * - Industry-specific benchmarks
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Award, Target, Building2 } from 'lucide-react';

interface AxisData {
    actual?: number;
    target?: number;
}

interface BenchmarkData {
    industry: string;
    industryPl: string;
    averages: Record<string, number>;
    topPerformers: Record<string, number>;
}

interface IndustryBenchmarkProps {
    axisData: Record<string, AxisData>;
    industry?: string;
    benchmarkData?: BenchmarkData;
    className?: string;
}

// DRD Axes
const DRD_AXES = {
    processes: { namePl: 'Procesy', nameEn: 'Processes', icon: '⚙️' },
    digitalProducts: { namePl: 'Produkty', nameEn: 'Products', icon: '📦' },
    businessModels: { namePl: 'Modele', nameEn: 'Models', icon: '💼' },
    dataManagement: { namePl: 'Dane', nameEn: 'Data', icon: '📊' },
    culture: { namePl: 'Kultura', nameEn: 'Culture', icon: '🎯' },
    cybersecurity: { namePl: 'Cyber', nameEn: 'Cyber', icon: '🔒' },
    aiMaturity: { namePl: 'AI', nameEn: 'AI', icon: '🤖' }
};

// Default industry benchmarks
const DEFAULT_BENCHMARKS: Record<string, BenchmarkData> = {
    manufacturing: {
        industry: 'Manufacturing',
        industryPl: 'Przemysł',
        averages: {
            processes: 3.5,
            digitalProducts: 2.8,
            businessModels: 2.5,
            dataManagement: 3.2,
            culture: 2.9,
            cybersecurity: 3.8,
            aiMaturity: 2.2
        },
        topPerformers: {
            processes: 5.5,
            digitalProducts: 4.5,
            businessModels: 4.0,
            dataManagement: 5.0,
            culture: 4.5,
            cybersecurity: 5.5,
            aiMaturity: 4.0
        }
    },
    retail: {
        industry: 'Retail & E-Commerce',
        industryPl: 'Handel & E-Commerce',
        averages: {
            processes: 3.8,
            digitalProducts: 4.0,
            businessModels: 3.5,
            dataManagement: 3.8,
            culture: 3.2,
            cybersecurity: 3.5,
            aiMaturity: 3.0
        },
        topPerformers: {
            processes: 5.8,
            digitalProducts: 6.0,
            businessModels: 5.5,
            dataManagement: 5.5,
            culture: 5.0,
            cybersecurity: 5.5,
            aiMaturity: 5.0
        }
    },
    financial: {
        industry: 'Financial Services',
        industryPl: 'Usługi Finansowe',
        averages: {
            processes: 4.2,
            digitalProducts: 4.5,
            businessModels: 3.8,
            dataManagement: 4.5,
            culture: 3.5,
            cybersecurity: 5.0,
            aiMaturity: 3.5
        },
        topPerformers: {
            processes: 6.0,
            digitalProducts: 6.5,
            businessModels: 5.5,
            dataManagement: 6.0,
            culture: 5.5,
            cybersecurity: 6.5,
            aiMaturity: 5.5
        }
    }
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-navy-800 px-4 py-3 rounded-xl shadow-xl border border-slate-200 dark:border-white/10">
                <p className="font-semibold text-navy-900 dark:text-white mb-2">{label}</p>
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
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export const IndustryBenchmark: React.FC<IndustryBenchmarkProps> = ({
    axisData,
    industry = 'manufacturing',
    benchmarkData,
    className = ''
}) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    const benchmark = benchmarkData || DEFAULT_BENCHMARKS[industry] || DEFAULT_BENCHMARKS.manufacturing;

    // Prepare chart data
    const chartData = useMemo(() => {
        return Object.entries(DRD_AXES).map(([key, config]) => {
            const actual = axisData[key]?.actual || 0;
            const industryAvg = benchmark.averages[key] || 3;
            const topPerformer = benchmark.topPerformers[key] || 5;

            return {
                axis: isPolish ? config.namePl : config.nameEn,
                axisKey: key,
                icon: config.icon,
                organization: actual,
                industryAverage: industryAvg,
                topPerformers: topPerformer,
                diff: actual - industryAvg,
                percentile: Math.min(100, Math.max(0, ((actual - industryAvg) / (topPerformer - industryAvg)) * 50 + 50))
            };
        });
    }, [axisData, benchmark, isPolish]);

    // Calculate overall stats
    const stats = useMemo(() => {
        const avgActual = chartData.reduce((sum, d) => sum + d.organization, 0) / chartData.length;
        const avgIndustry = chartData.reduce((sum, d) => sum + d.industryAverage, 0) / chartData.length;
        const aboveAverage = chartData.filter(d => d.organization > d.industryAverage).length;
        const avgPercentile = chartData.reduce((sum, d) => sum + d.percentile, 0) / chartData.length;

        return { avgActual, avgIndustry, aboveAverage, avgPercentile };
    }, [chartData]);

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                        {isPolish ? 'Benchmarki Branżowe' : 'Industry Benchmarks'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Porównanie z' : 'Compared to'} {isPolish ? benchmark.industryPl : benchmark.industry}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-lg">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-navy-900 dark:text-white">
                        {isPolish ? benchmark.industryPl : benchmark.industry}
                    </span>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Target className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Twój wynik' : 'Your Score'}
                        </span>
                    </div>
                    <div className="text-3xl font-bold">{stats.avgActual.toFixed(1)}</div>
                    <div className="text-xs opacity-75 mt-1">/ 7 max</div>
                </div>

                <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                        <Building2 className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Średnia branży' : 'Industry Avg'}
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-navy-900 dark:text-white">{stats.avgIndustry.toFixed(1)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">/ 7 max</div>
                </div>

                <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                        {stats.avgActual > stats.avgIndustry ? (
                            <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : stats.avgActual < stats.avgIndustry ? (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                            <Minus className="w-4 h-4" />
                        )}
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Różnica' : 'Difference'}
                        </span>
                    </div>
                    <div className={`text-3xl font-bold ${
                        stats.avgActual > stats.avgIndustry ? 'text-green-600' : 
                        stats.avgActual < stats.avgIndustry ? 'text-red-600' : 'text-slate-600'
                    }`}>
                        {stats.avgActual > stats.avgIndustry ? '+' : ''}{(stats.avgActual - stats.avgIndustry).toFixed(1)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {isPolish ? 'poziomów' : 'levels'}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Award className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                            {isPolish ? 'Percentyl' : 'Percentile'}
                        </span>
                    </div>
                    <div className="text-3xl font-bold">{Math.round(stats.avgPercentile)}</div>
                    <div className="text-xs opacity-75 mt-1">
                        {stats.avgPercentile >= 75 ? (isPolish ? 'Top 25%' : 'Top 25%') :
                         stats.avgPercentile >= 50 ? (isPolish ? 'Top 50%' : 'Top 50%') :
                         (isPolish ? 'Poniżej średniej' : 'Below Average')}
                    </div>
                </div>
            </div>

            {/* Bar chart */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-6">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-white/10" />
                        <XAxis 
                            dataKey="axis" 
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis 
                            domain={[0, 7]}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                        />
                        <Bar 
                            dataKey="organization" 
                            name={isPolish ? 'Twoja organizacja' : 'Your Organization'}
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                            dataKey="industryAverage" 
                            name={isPolish ? 'Średnia branży' : 'Industry Average'}
                            fill="#94a3b8"
                            radius={[4, 4, 0, 0]}
                        />
                        <Bar 
                            dataKey="topPerformers" 
                            name={isPolish ? 'Top Performerzy' : 'Top Performers'}
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                            opacity={0.5}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Axis-by-axis breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartData.map((axis, index) => {
                    const isAbove = axis.organization > axis.industryAverage;
                    const diff = axis.organization - axis.industryAverage;

                    return (
                        <motion.div
                            key={axis.axisKey}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                                p-4 rounded-xl border transition-colors
                                ${isAbove 
                                    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' 
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{axis.icon}</span>
                                    <span className="font-medium text-navy-900 dark:text-white">
                                        {axis.axis}
                                    </span>
                                </div>
                                <span className={`text-sm font-bold ${
                                    isAbove ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'
                                }`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {isPolish ? 'Ty' : 'You'}: <strong>{axis.organization.toFixed(1)}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {isPolish ? 'Branża' : 'Industry'}: <strong>{axis.industryAverage.toFixed(1)}</strong>
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full rounded-full ${isAbove ? 'bg-green-500' : 'bg-blue-500'}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (axis.organization / 7) * 100)}%` }}
                                    transition={{ delay: 0.3 + index * 0.05, duration: 0.5 }}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

export default IndustryBenchmark;

