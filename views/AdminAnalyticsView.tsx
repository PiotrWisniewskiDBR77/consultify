import React, { useEffect, useState } from 'react';
import { Api } from '../services/api';
import { BarChart3, TrendingUp, Zap, AlertTriangle, Activity } from 'lucide-react';

interface AIStats {
    totalTokens: number;
    estimatedCost: number;
    interactionCount: number;
    interactionsByAction: Record<string, number>;
    topModels: Record<string, number>;
    averageLatency: number;
    recentErrors: any[];
}

export const AdminAnalyticsView: React.FC = () => {
    const [stats, setStats] = useState<AIStats | null>(null);
    const [benchmarks, setBenchmarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsData, benchData] = await Promise.all([
                Api.aiGetStats(),
                Api.getIndustryBenchmarks('General')
            ]);
            setStats(statsData);
            setBenchmarks(benchData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadBenchmarks = async (industry: string) => {
        try {
            const data = await Api.getIndustryBenchmarks(industry);
            setBenchmarks(data);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) return <div className="p-8 text-slate-400">Loading analytics...</div>;
    if (!stats) return <div className="p-8 text-red-400">Failed to load analytics.</div>;

    const maxActionCount = Math.max(...Object.values(stats.interactionsByAction).map(v => Number(v)), 1);

    return (
        <div className="p-6 overflow-y-auto h-full space-y-4">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="text-purple-500" size={20} />
                AI Analytics & Usage
            </h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-slate-400 uppercase">Total Tokens</p>
                        <Zap size={16} className="text-yellow-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{stats.totalTokens.toLocaleString()}</h3>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-slate-400 uppercase">Est. Cost</p>
                        <TrendingUp size={16} className="text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">${stats.estimatedCost.toFixed(4)}</h3>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-slate-400 uppercase">Interactions</p>
                        <Activity size={16} className="text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{stats.interactionCount}</h3>
                </div>
                <div className="bg-navy-900 border border-white/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-slate-400 uppercase">Avg Latency</p>
                        <Activity size={16} className="text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{Math.round(stats.averageLatency)}ms</h3>
                </div>
            </div>

            {/* Usage By Feature (Bar Chart) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Usage by Feature</h3>
                    <div className="space-y-4">
                        {Object.entries(stats.interactionsByAction || {}).map(([action, count]) => (
                            <div key={action}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-300 capitalize">{action}</span>
                                    <span className="text-slate-500">{count}</span>
                                </div>
                                <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: `${(Number(count) / maxActionCount) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Errors */}
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-400" />
                        Recent Errors
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {stats.recentErrors.length === 0 ? (
                            <p className="text-slate-500 text-sm">No recent errors reported.</p>
                        ) : (
                            stats.recentErrors.map((err, i) => (
                                <div key={i} className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs">
                                    <p className="text-red-300 font-semibold mb-1">{err.action || 'Unknown Action'}</p>
                                    <p className="text-red-200/70">{err.error_message}</p>
                                    <p className="text-slate-500 mt-1">{new Date(err.timestamp).toLocaleString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Industry Benchmarks */}
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-400" />
                        Industry Benchmarks (Maturity Levels)
                    </h3>
                    <select
                        className="bg-navy-950 border border-white/10 rounded px-3 py-1 text-xs text-slate-300 outline-none focus:border-blue-500"
                        onChange={(e) => loadBenchmarks(e.target.value)}
                    >
                        <option value="General">General Industry</option>
                        <option value="Finance">Finance</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="Technology">Technology</option>
                        <option value="Retail">Retail</option>
                    </select>
                </div>

                {benchmarks.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 border border-dashed border-white/5 rounded-lg">
                        No benchmark data available yet. Run more diagnoses.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {benchmarks.map((b, index) => (
                            <div key={b.axis || index}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-300 font-medium">{b.axis}</span>
                                    <span className="text-blue-400 font-bold">{Number(b.avg_score).toFixed(1)} <span className="text-slate-600 text-[10px] font-normal">/ 5.0 (n={b.sample_size})</span></span>
                                </div>
                                <div className="w-full h-2 bg-navy-950 rounded-full overflow-hidden relative">
                                    {/* Tick marks for levels */}
                                    <div className="absolute left-[20%] h-full w-[1px] bg-black/20 z-10"></div>
                                    <div className="absolute left-[40%] h-full w-[1px] bg-black/20 z-10"></div>
                                    <div className="absolute left-[60%] h-full w-[1px] bg-black/20 z-10"></div>
                                    <div className="absolute left-[80%] h-full w-[1px] bg-black/20 z-10"></div>

                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${(Number(b.avg_score) / 5) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
