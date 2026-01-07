/**
 * AI Cost Dashboard Component
 * Displays AI usage costs and token consumption metrics
 */

import { DollarSign, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import React from 'react';

interface CostMetric {
    label: string;
    value: string;
    change: number;
    trend: 'up' | 'down' | 'neutral';
}

export const AICostDashboard: React.FC = () => {
    const metrics: CostMetric[] = [
        { label: 'Total Cost (MTD)', value: '$0.00', change: 0, trend: 'neutral' },
        { label: 'Tokens Used', value: '0', change: 0, trend: 'neutral' },
        { label: 'Avg Cost/Request', value: '$0.00', change: 0, trend: 'neutral' },
        { label: 'Est. Monthly', value: '$0.00', change: 0, trend: 'neutral' },
    ];

    const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
        switch (trend) {
            case 'up':
                return <TrendingUp className="w-4 h-4 text-red-400" />;
            case 'down':
                return <TrendingDown className="w-4 h-4 text-green-400" />;
            default:
                return <Zap className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-400" />
                <h3 className="text-lg font-semibold text-white">AI Cost Analytics</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {metrics.map((metric, index) => (
                    <div
                        key={index}
                        className="bg-navy-800 rounded-xl border border-white/10 p-4"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-400">{metric.label}</span>
                            {getTrendIcon(metric.trend)}
                        </div>
                        <div className="text-xl font-bold text-white">{metric.value}</div>
                        {metric.change !== 0 && (
                            <div className={`text-xs mt-1 ${metric.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {metric.change > 0 ? '+' : ''}{metric.change}% vs last month
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-navy-800 rounded-xl border border-white/10 p-6">
                <h4 className="text-sm font-medium text-slate-300 mb-4">Cost Breakdown by Provider</h4>
                <div className="text-center py-8 text-slate-400">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No cost data available yet</p>
                    <p className="text-xs mt-1">Start using AI features to see cost analytics</p>
                </div>
            </div>
        </div>
    );
};

export default AICostDashboard;

