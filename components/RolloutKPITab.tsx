import React from 'react';
import { FullSession, KPITracking } from '../types';
import { TrendingUp, Plus, ArrowUp, ArrowDown, Activity } from 'lucide-react';

interface RolloutKPITabProps {
    data: FullSession['rollout'];
    onUpdate: (data: FullSession['rollout']) => void;
}

export const RolloutKPITab: React.FC<RolloutKPITabProps> = ({ data, onUpdate }) => {
    const kpis = data?.kpis || [];

    const addKPI = () => {
        const newKPI: KPITracking = {
            id: Date.now().toString(),
            name: 'New KPI',
            baseline: 0,
            target: 100,
            current: 0,
            unit: '%',
            history: []
        };
        onUpdate({ ...data, kpis: [...kpis, newKPI] });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <TrendingUp className="text-green-500" />
                        KPI Tracking
                    </h2>
                    <p className="text-slate-500">Monitor operational and financial performance.</p>
                </div>
                <button onClick={addKPI} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                    <Plus size={18} /> Add KPI
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kpis.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 dark:bg-navy-900 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                        No KPIs defined yet.
                    </div>
                )}

                {kpis.map((kpi, i) => {
                    const progress = ((kpi.current - kpi.baseline) / (kpi.target - kpi.baseline)) * 100;
                    const isPositive = progress > 0;

                    return (
                        <div key={kpi.id} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-200">{kpi.name}</h3>
                                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                    {progress.toFixed(0)}%
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">Baseline</div>
                                    <div className="font-mono font-bold text-slate-600 dark:text-slate-400">{kpi.baseline}{kpi.unit}</div>
                                </div>
                                <div className="border-x border-slate-100 dark:border-white/5">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">Current</div>
                                    <div className="font-mono font-bold text-2xl text-slate-800 dark:text-white">{kpi.current}{kpi.unit}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">Target</div>
                                    <div className="font-mono font-bold text-blue-500">{kpi.target}{kpi.unit}</div>
                                </div>
                            </div>

                            {/* Mini Chart Placeholder */}
                            <div className="h-16 bg-slate-50 dark:bg-navy-950 rounded border border-slate-100 dark:border-white/5 flex items-end justify-between px-2 pb-2 overflow-hidden">
                                {[30, 45, 40, 60, 55, 75, kpi.current].map((val, idx) => (
                                    <div key={idx} className="w-1/12 bg-blue-500/20 hover:bg-blue-500 transition-colors rounded-t-sm" style={{ height: `${(val / kpi.target) * 100}%` }}></div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
