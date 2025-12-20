import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { RefreshCw, TrendingUp, AlertTriangle, Users, BookOpen, Target, ChevronRight, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const SuperAdminMetricsView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [funnels, setFunnels] = useState<any>(null);
    const [warnings, setWarnings] = useState<any[]>([]);
    const [attribution, setAttribution] = useState<any>(null);
    const [partners, setPartners] = useState<any[]>([]);
    const [helpMetrics, setHelpMetrics] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [funnelData, warningData, attrData, partnerData, helpData] = await Promise.all([
                Api.getMetricsFunnels(30),
                Api.getMetricsWarnings(),
                Api.getMetricsAttribution(30),
                Api.getMetricsPartners(90),
                Api.getMetricsHelp(30)
            ]);

            setFunnels(funnelData.funnels);
            setWarnings(warningData.warnings);
            setAttribution(attrData);
            setPartners(partnerData.leaderboard);
            setHelpMetrics(helpData);
        } catch (err: any) {
            console.error('Failed to fetch metrics:', err);
            toast.error('Failed to load conversion intelligence data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-500">
                <RefreshCw className="animate-spin mr-2" size={20} />
                Loading conversion intelligence...
            </div>
        );
    }

    return (
        <div className="space-y-8 p-1 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Conversion Intelligence</h1>
                    <p className="text-slate-400 text-sm mt-1">Enterprise Analytics & Funnel Monitoring</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-white/10 rounded-lg text-sm transition-colors"
                >
                    <RefreshCw size={16} /> Refresh Data
                </button>
            </div>

            {/* Conversion Funnels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-6 text-blue-400">
                        <TrendingUp size={20} />
                        <h2 className="text-lg font-semibold text-white">Conversion Funnels</h2>
                    </div>

                    <div className="space-y-6">
                        {funnels && Object.entries(funnels).map(([key, funnel]: [string, any]) => (
                            <div key={key} className="relative">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-medium text-slate-300">{funnel.name}</span>
                                    <span className="text-xl font-bold text-blue-400">{funnel.conversionRate}%</span>
                                </div>
                                <div className="h-2 bg-navy-950 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${funnel.conversionRate}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                                    <span>{funnel.startCount} {funnel.startEvent.split('_')[0]}s</span>
                                    <span>{funnel.endCount} {funnel.endEvent.split('_')[1] || funnel.endEvent.split('_')[0]}s</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Early Warnings */}
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-6 text-yellow-500">
                        <AlertTriangle size={20} />
                        <h2 className="text-lg font-semibold text-white">Early Warnings</h2>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {warnings.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">No critical warnings at this time.</p>
                        ) : (
                            warnings.map((warning, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-navy-950 border border-white/5 rounded-lg">
                                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${warning.severity === 'CRITICAL' ? 'bg-red-500' :
                                            warning.severity === 'HIGH' ? 'bg-orange-500' : 'bg-yellow-500'
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between gap-2">
                                            <p className="text-sm font-medium text-white truncate">{warning.organizationName || 'Unknown Org'}</p>
                                            <span className="text-[10px] font-bold text-slate-500 px-1.5 py-0.5 bg-navy-800 rounded">{warning.type}</span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">{warning.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Attribution & Partners */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-6 text-green-400">
                        <Target size={20} />
                        <h2 className="text-lg font-semibold text-white">Attribution Channels</h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-500 text-xs uppercase border-b border-white/5">
                                    <th className="pb-3 font-medium">Channel</th>
                                    <th className="pb-3 font-medium text-center">Trials</th>
                                    <th className="pb-3 font-medium text-center">Paid</th>
                                    <th className="pb-3 font-medium text-right">Conv. %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {attribution?.channels.map((channel: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3 font-medium text-slate-300">{channel.source}</td>
                                        <td className="py-3 text-center text-white">{channel.trials}</td>
                                        <td className="py-3 text-center text-white">{channel.conversions}</td>
                                        <td className="py-3 text-right">
                                            <span className={`font-bold ${channel.conversionRate > 20 ? 'text-green-400' : 'text-blue-400'}`}>
                                                {channel.conversionRate}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-6 text-purple-400">
                        <Users size={20} />
                        <h2 className="text-lg font-semibold text-white">Partners Leaderboard</h2>
                    </div>

                    <div className="space-y-4">
                        {partners.length === 0 ? (
                            <p className="text-slate-500 text-sm text-center py-8">No partner data available.</p>
                        ) : (
                            partners.slice(0, 5).map((partner, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-navy-950 border border-white/5 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{partner.partnerName}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{partner.partnerType}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">${partner.totalRevenue.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500">{partner.orgCount} conversions</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Help Effectiveness */}
            <div className="bg-navy-900 border border-white/10 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-6 text-cyan-400">
                    <BookOpen size={20} />
                    <h2 className="text-lg font-semibold text-white">Help Effectiveness (Playbooks)</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {helpMetrics?.byPlaybook.map((playbook: any, idx: number) => (
                        <div key={idx} className="bg-navy-950 border border-white/5 rounded-xl p-4">
                            <h3 className="text-sm font-medium text-white truncate mb-3" title={playbook.playbookKey}>
                                {playbook.playbookKey.replace(/_/g, ' ')}
                            </h3>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[10px] text-slate-500 uppercase">Completion Rate</span>
                                <span className="text-sm font-bold text-cyan-400">{playbook.completionRate}%</span>
                            </div>
                            <div className="h-1.5 bg-navy-900 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 rounded-full"
                                    style={{ width: `${playbook.completionRate}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-3 text-[10px] text-slate-500">
                                <span>{playbook.started} Started</span>
                                <span>{playbook.completed} Finished</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
