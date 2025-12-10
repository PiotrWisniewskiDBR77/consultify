import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BurnDownData, VelocityData } from '../services/analytics';

interface BurnDownChartProps {
    data: BurnDownData[];
}

export const BurnDownChart: React.FC<BurnDownChartProps> = ({ data }) => {
    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
                Burn-Down Chart
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Track progress against planned timeline
            </p>

            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                    <XAxis
                        dataKey="week"
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend />
                    <Line
                        type="monotone"
                        dataKey="ideal"
                        stroke="#64748b"
                        strokeDasharray="5 5"
                        name="Ideal"
                        dot={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="planned"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        name="Planned"
                    />
                    <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Actual"
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

interface VelocityChartProps {
    data: VelocityData[];
}

export const VelocityChart: React.FC<VelocityChartProps> = ({ data }) => {
    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-4">
                Team Velocity
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Weekly task completion rate
            </p>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                    <XAxis
                        dataKey="week"
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                    />
                    <Legend />
                    <Bar
                        dataKey="target"
                        fill="#64748b"
                        name="Target"
                        opacity={0.5}
                    />
                    <Bar
                        dataKey="completed"
                        fill="#8b5cf6"
                        name="Completed"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    icon?: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    change,
    icon,
    trend = 'neutral'
}) => {
    const trendColor = trend === 'up'
        ? 'text-green-500'
        : trend === 'down'
            ? 'text-red-500'
            : 'text-slate-500';

    return (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    {title}
                </div>
                {icon && (
                    <div className="text-purple-500">
                        {icon}
                    </div>
                )}
            </div>

            <div className="flex items-baseline gap-3">
                <div className="text-3xl font-bold text-navy-900 dark:text-white">
                    {value}
                </div>
                {change !== undefined && (
                    <div className={`text-sm font-medium ${trendColor}`}>
                        {change > 0 ? '+' : ''}{change}%
                    </div>
                )}
            </div>
        </div>
    );
};
