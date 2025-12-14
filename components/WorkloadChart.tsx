import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { FullInitiative, Quarter } from '../types';

interface WorkloadChartProps {
    initiatives: FullInitiative[];
    quarters: Quarter[];
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ initiatives, quarters }) => {
    // 1. Process Data
    const data = useMemo(() => {
        return quarters.map(q => {
            const inits = initiatives.filter(i => i.quarter === q);

            // Calculate total effort of each type
            // Assuming effortProfile is populated. If not, fallback to default (e.g. 1 per initiative)
            let analytical = 0;
            let operational = 0;
            let change = 0;

            inits.forEach(i => {
                // If effortProfile exists
                if (i.effortProfile) {
                    analytical += i.effortProfile.analytical || 0;
                    operational += i.effortProfile.operational || 0;
                    change += i.effortProfile.change || 0;
                } else {
                    // Fallback heuristics based on type/intent if needed
                    // For now, allow 0
                    analytical += 1; // Default
                }
            });

            const total = analytical + operational + change;

            // Determine Status (Simplified Logic for Visualization)
            let status: 'OK' | 'High' | 'Overload' = 'OK';
            if (total > 15) status = 'High'; // Threshold example
            if (change > 8) status = 'Overload'; // Change saturation

            return {
                name: q,
                analytical,
                operational,
                change,
                total,
                status
            };
        });
    }, [initiatives, quarters]);

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div className="bg-white dark:bg-navy-800 p-3 border border-slate-200 dark:border-white/10 rounded shadow-lg text-xs">
                    <p className="font-bold text-navy-900 dark:text-white mb-2">{label}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-slate-500 dark:text-slate-400">Analytical: {dataPoint.analytical}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-slate-500 dark:text-slate-400">Operational: {dataPoint.operational}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                            <span className="text-slate-500 dark:text-slate-400">Change: {dataPoint.change}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 font-semibold">
                            Status: <span className={
                                dataPoint.status === 'Overload' ? 'text-red-500' :
                                    dataPoint.status === 'High' ? 'text-amber-500' : 'text-green-500'
                            }>{dataPoint.status}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-32 w-full mt-4">
            <div className="flex justify-between items-center mb-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workload Distribution</h4>
                <div className="flex gap-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Analytical</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Operational</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div>Change</div>
                </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} barSize={12}>
                    <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="analytical" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                    <Bar dataKey="operational" stackId="a" fill="#10b981" />
                    <Bar dataKey="change" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
