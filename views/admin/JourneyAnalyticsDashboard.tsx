import React, { useState, useEffect } from 'react';
import { BarChart3, Clock, TrendingDown, Users, ChevronDown, RefreshCw } from 'lucide-react';
import { Api } from '../../services/api';

/**
 * JourneyAnalyticsDashboard — Admin view for journey metrics
 * 
 * Shows:
 * - Phase funnel visualization
 * - Time-to-Value metrics
 * - Drop-off analysis
 */

interface FunnelData {
    [phase: string]: number;
}

interface DropOffItem {
    from: string;
    to: string;
    usersIn: number;
    usersOut: number;
    dropOffPercent: number;
}

interface TTVData {
    avgTTV: number | null;
    sampleSize: number;
}

const PHASE_NAMES: Record<string, string> = {
    A: 'Pre-Entry',
    B: 'Demo',
    C: 'Trial',
    D: 'Org Setup',
    E: 'First Value',
    F: 'Team',
};

const PHASES = ['A', 'B', 'C', 'D', 'E', 'F'];

const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    subtitle?: string;
}> = ({ title, value, icon: Icon, subtitle }) => (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Icon size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <p className="text-2xl font-bold text-navy-900 dark:text-white">{value}</p>
                {subtitle && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
                )}
            </div>
        </div>
    </div>
);

const FunnelBar: React.FC<{
    phase: string;
    phaseName: string;
    users: number;
    maxUsers: number;
    dropOff?: number;
}> = ({ phase, phaseName, users, maxUsers, dropOff }) => {
    const percentage = maxUsers > 0 ? (users / maxUsers) * 100 : 0;

    return (
        <div className="flex items-center gap-4">
            <div className="w-24 text-right">
                <span className="font-medium text-navy-900 dark:text-white">{phase}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{phaseName}</span>
            </div>
            <div className="flex-1 relative">
                <div className="h-8 bg-slate-100 dark:bg-navy-900 rounded-lg overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
                <div className="absolute inset-0 flex items-center justify-between px-3">
                    <span className="text-sm font-medium text-white drop-shadow-sm">
                        {users}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                        {percentage.toFixed(0)}%
                    </span>
                </div>
            </div>
            {dropOff !== undefined && dropOff > 0 && (
                <div className="w-16 text-right">
                    <span className={`text-xs font-medium ${dropOff > 30 ? 'text-red-500' : dropOff > 15 ? 'text-amber-500' : 'text-green-500'}`}>
                        -{dropOff.toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

export const JourneyAnalyticsDashboard: React.FC = () => {
    const [funnel, setFunnel] = useState<FunnelData>({});
    const [dropOff, setDropOff] = useState<DropOffItem[]>([]);
    const [ttv, setTTV] = useState<TTVData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState('all');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [funnelRes, ttvRes] = await Promise.all([
                Api.get('/analytics/journey/funnel'),
                Api.get('/analytics/journey/ttv'),
            ]);

            setFunnel(funnelRes.data?.funnel || {});
            setDropOff(funnelRes.data?.dropOff || []);
            setTTV(ttvRes.data);
        } catch (error) {
            console.error('Failed to fetch journey analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const maxUsers = Math.max(...Object.values(funnel).map(n => n || 0), 1);
    const totalActivated = funnel['E'] || 0;
    const totalStarted = funnel['A'] || 0;
    const activationRate = totalStarted > 0 ? ((totalActivated / totalStarted) * 100).toFixed(1) : '0';

    // Find highest drop-off
    const highestDropOff = dropOff.reduce((max, item) =>
        item.dropOffPercent > (max?.dropOffPercent || 0) ? item : max
        , null as DropOffItem | null);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <BarChart3 size={24} className="text-purple-500" />
                        Journey Analytics
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        User journey metrics and conversion funnel
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
                    >
                        <option value="all">All time</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                    </select>

                    <button
                        onClick={fetchData}
                        className="p-2 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <MetricCard
                    title="Avg Time-to-Value"
                    value={ttv?.avgTTV ? `${ttv.avgTTV} min` : '—'}
                    icon={Clock}
                    subtitle={ttv?.sampleSize ? `Based on ${ttv.sampleSize} users` : undefined}
                />
                <MetricCard
                    title="Activation Rate"
                    value={`${activationRate}%`}
                    icon={Users}
                    subtitle="Users reaching Phase E"
                />
                <MetricCard
                    title="Highest Drop-off"
                    value={highestDropOff ? `${highestDropOff.from}→${highestDropOff.to}` : '—'}
                    icon={TrendingDown}
                    subtitle={highestDropOff ? `${highestDropOff.dropOffPercent.toFixed(0)}% drop` : undefined}
                />
            </div>

            {/* Funnel */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-8">
                <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-6">
                    Phase Funnel
                </h2>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw size={24} className="animate-spin text-purple-500" />
                    </div>
                ) : (
                    <div className="space-y-3">
                        {PHASES.map((phase, idx) => {
                            const dropOffItem = dropOff.find(d => d.from === phase);
                            return (
                                <FunnelBar
                                    key={phase}
                                    phase={phase}
                                    phaseName={PHASE_NAMES[phase]}
                                    users={funnel[phase] || 0}
                                    maxUsers={maxUsers}
                                    dropOff={dropOffItem?.dropOffPercent}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Drop-off Analysis */}
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
                    Drop-off Analysis
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">Transition</th>
                                <th className="text-right py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">Users In</th>
                                <th className="text-right py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">Users Out</th>
                                <th className="text-right py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">Drop-off</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dropOff.map((item) => (
                                <tr key={`${item.from}-${item.to}`} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                    <td className="py-3 px-4">
                                        <span className="font-medium text-navy-900 dark:text-white">
                                            {item.from} → {item.to}
                                        </span>
                                        <span className="text-xs text-slate-500 ml-2">
                                            {PHASE_NAMES[item.from]} → {PHASE_NAMES[item.to]}
                                        </span>
                                    </td>
                                    <td className="text-right py-3 px-4 text-navy-900 dark:text-white">
                                        {item.usersIn}
                                    </td>
                                    <td className="text-right py-3 px-4 text-navy-900 dark:text-white">
                                        {item.usersOut}
                                    </td>
                                    <td className="text-right py-3 px-4">
                                        <span className={`font-medium ${item.dropOffPercent > 30 ? 'text-red-500' :
                                                item.dropOffPercent > 15 ? 'text-amber-500' :
                                                    'text-green-500'
                                            }`}>
                                            {item.dropOffPercent.toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default JourneyAnalyticsDashboard;
