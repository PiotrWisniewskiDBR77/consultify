/**
 * Cash Flow Chart Component
 *
 * Visualizes projected cash flows over the investment horizon.
 * Shows costs, benefits, net cash flow, and cumulative cash flow.
 */

import { Layers, TrendingDown, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface CashFlowEntry {
    year: number;
    costs: number;
    benefits: number;
    netCashFlow: number;
    cumulativeCashFlow: number;
}

interface CashFlowChartProps {
    cashFlows: CashFlowEntry[];
    currency?: string;
    showCumulative?: boolean;
    showBreakeven?: boolean;
    height?: number;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({
    cashFlows,
    currency = 'PLN',
    showCumulative = true,
    showBreakeven = true,
    height = 400,
}) => {
    const formatCurrency = (value: number) => {
        if (Math.abs(value) >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        }
        if (Math.abs(value) >= 1000) {
            return `${(value / 1000).toFixed(0)}k`;
        }
        return value.toFixed(0);
    };

    const breakEvenYear = useMemo(() => {
        for (let i = 0; i < cashFlows.length; i++) {
            if (cashFlows[i].cumulativeCashFlow >= 0 && i > 0 && cashFlows[i - 1].cumulativeCashFlow < 0) {
                return cashFlows[i].year;
            }
        }
        return null;
    }, [cashFlows]);

    const stats = useMemo(() => {
        const totalCosts = cashFlows.reduce((sum, cf) => sum + cf.costs, 0);
        const totalBenefits = cashFlows.reduce((sum, cf) => sum + cf.benefits, 0);
        const totalNet = cashFlows.reduce((sum, cf) => sum + cf.netCashFlow, 0);
        const maxCumulative = Math.max(...cashFlows.map((cf) => cf.cumulativeCashFlow));
        const minCumulative = Math.min(...cashFlows.map((cf) => cf.cumulativeCashFlow));

        return { totalCosts, totalBenefits, totalNet, maxCumulative, minCumulative };
    }, [cashFlows]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-navy-800 p-4 rounded-xl shadow-xl border border-slate-200 dark:border-white/10">
                    <p className="font-bold text-navy-900 dark:text-white mb-2">Rok {label}</p>
                    <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-red-500 flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-red-500" />
                                Koszty:
                            </span>
                            <span className="font-medium text-navy-900 dark:text-white">
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(
                                    Math.abs(data.costs),
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-emerald-500 flex items-center gap-1">
                                <div className="w-3 h-3 rounded bg-emerald-500" />
                                Korzyści:
                            </span>
                            <span className="font-medium text-navy-900 dark:text-white">
                                {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(data.benefits)}
                            </span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-white/10 pt-1.5 mt-1.5">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-blue-500 flex items-center gap-1">
                                    <div className="w-3 h-3 rounded bg-blue-500" />
                                    Netto:
                                </span>
                                <span
                                    className={`font-bold ${data.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                >
                                    {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(
                                        data.netCashFlow,
                                    )}
                                </span>
                            </div>
                        </div>
                        {showCumulative && (
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-purple-500 flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full border-2 border-purple-500" />
                                    Skumulowane:
                                </span>
                                <span
                                    className={`font-bold ${data.cumulativeCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                >
                                    {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(
                                        data.cumulativeCashFlow,
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    if (cashFlows.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10">
                <div className="text-center text-slate-500 dark:text-slate-400">
                    <Layers size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Brak danych do wyświetlenia wykresu</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-navy-800 rounded-2xl border border-slate-200 dark:border-white/10 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Layers size={20} className="text-blue-500" />
                        Przepływy pieniężne
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Projekcja na {cashFlows.length} lat
                    </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Suma kosztów</p>
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {new Intl.NumberFormat('pl-PL', {
                                style: 'currency',
                                currency,
                                maximumFractionDigits: 0,
                            }).format(stats.totalCosts)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Suma korzyści</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {new Intl.NumberFormat('pl-PL', {
                                style: 'currency',
                                currency,
                                maximumFractionDigits: 0,
                            }).format(stats.totalBenefits)}
                        </p>
                    </div>
                    {breakEvenYear && showBreakeven && (
                        <div className="text-right pl-6 border-l border-slate-200 dark:border-white/10">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Break-even</p>
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Rok {breakEvenYear}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={height}>
                <ComposedChart data={cashFlows} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                    <XAxis
                        dataKey="year"
                        tickFormatter={(value) => `Rok ${value}`}
                        tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <YAxis tickFormatter={formatCurrency} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value: string) => (
                            <span className="text-sm text-slate-600 dark:text-slate-400">{value}</span>
                        )}
                    />

                    {/* Break-even reference line */}
                    {showBreakeven && (
                        <ReferenceLine
                            y={0}
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            label={{ value: 'Break-even', position: 'left', fill: '#94a3b8', fontSize: 11 }}
                        />
                    )}

                    {/* Bars for costs and benefits */}
                    <Bar dataKey="costs" name="Koszty" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="benefits" name="Korzyści" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />

                    {/* Area for net cash flow */}
                    <Area
                        type="monotone"
                        dataKey="netCashFlow"
                        name="Przepływ netto"
                        fill="rgba(59, 130, 246, 0.2)"
                        stroke="#3b82f6"
                        strokeWidth={2}
                    />

                    {/* Line for cumulative cash flow */}
                    {showCumulative && (
                        <Line
                            type="monotone"
                            dataKey="cumulativeCashFlow"
                            name="Skumulowane"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                            activeDot={{ r: 6, fill: '#8b5cf6' }}
                        />
                    )}
                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend explanation */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-center gap-8 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500" />
                        <span>Koszty (wydatki)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-500" />
                        <span>Korzyści (wpływy)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500" />
                        <span>Przepływ netto</span>
                    </div>
                    {showCumulative && (
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 rounded bg-purple-500" />
                            <span>Skumulowane</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashFlowChart;



