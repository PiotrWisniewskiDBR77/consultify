import React from 'react';
import { FullSession, FullInitiative } from '../types';
import { Calendar, BarChart2, AlertCircle } from 'lucide-react';

interface RolloutPlanTabProps {
    data: FullSession['rollout'];
    initiatives: FullInitiative[];
    onUpdate: (data: FullSession['rollout']) => void;
}

export const RolloutPlanTab: React.FC<RolloutPlanTabProps> = ({ data, initiatives, onUpdate }) => {

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

    // Group initiatives by quarter
    const byQuarter: Record<string, FullInitiative[]> = {};
    quarters.forEach(q => byQuarter[q] = []);

    initiatives.forEach(init => {
        if (init.quarter && quarters.includes(init.quarter)) {
            byQuarter[init.quarter].push(init);
        } else {
            // Unscheduled or invalid quarter
            // byQuarter['Unscheduled'] would be nice, but sticking to requested grid
        }
    });

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Calendar className="text-pink-500" />
                        Master Rollout Plan
                    </h2>
                    <p className="text-slate-500">Timeline view of all strategic initiatives.</p>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-white/5 rounded border border-slate-200 dark:border-white/10 hover:bg-slate-200 text-slate-600 dark:text-slate-300">
                        Optimize Layout
                    </button>
                </div>
            </div>

            {/* Capacity / Timeline Grid */}
            <div className="flex-1 overflow-x-auto overflow-y-auto bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 relative">
                <div className="min-w-[1200px] h-full flex flex-col">
                    {/* Header */}
                    <div className="grid grid-cols-8 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 sticky top-0 z-10">
                        {quarters.map(q => (
                            <div key={q} className="p-3 text-center font-bold text-slate-600 dark:text-slate-400 border-r last:border-r-0 border-slate-200 dark:border-white/10">
                                {q}
                            </div>
                        ))}
                    </div>

                    {/* Lanes */}
                    <div className="flex-1 grid grid-cols-8 divide-x divide-slate-100 dark:divide-white/5">
                        {quarters.map(q => {
                            const inits = byQuarter[q] || [];
                            const isOverloaded = inits.length > 4; // Mock capacity limit

                            return (
                                <div key={q} className={`p-2 relative group min-h-[300px] ${isOverloaded ? 'bg-red-50/30' : ''}`}>
                                    {isOverloaded && (
                                        <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-600 text-[10px] font-bold text-center py-0.5 border-b border-red-200">
                                            <AlertCircle size={10} className="inline mr-1" /> Overloaded
                                        </div>
                                    )}

                                    <div className="space-y-2 mt-4">
                                        {inits.map(init => (
                                            <div key={init.id} className="p-2 rounded bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 shadow-sm text-xs hover:shadow-md transition-shadow cursor-pointer dark:text-slate-200">
                                                <div className={`w-1.5 h-1.5 rounded-full mb-1 ${init.priority === 'High' ? 'bg-red-500' :
                                                        init.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                                    }`} />
                                                <div className="font-semibold truncate">{init.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-1">{init.status}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend / Stats */}
            <div className="flex gap-4 text-xs text-slate-500 bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> High Priority</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Medium Priority</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Low Priority</div>
            </div>
        </div>
    );
};
