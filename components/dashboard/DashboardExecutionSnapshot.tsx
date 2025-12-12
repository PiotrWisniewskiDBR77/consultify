import React, { useMemo } from 'react';
import {
    LayoutDashboard, CheckCircle2, AlertTriangle, XCircle,
    TrendingUp, TrendingDown, Activity, Play, Clock
} from 'lucide-react';
import { FullSession, AppView } from '../../types';

interface DashboardExecutionSnapshotProps {
    session: FullSession;
    onNavigate: (view: AppView) => void;
}

export const DashboardExecutionSnapshot: React.FC<DashboardExecutionSnapshotProps> = ({ session, onNavigate }) => {

    // --- 1. Project Logic & Stats ---
    const initiativeStats = useMemo(() => {
        const inits = session.initiatives || [];
        const total = inits.length;
        const inProgress = inits.filter(i => ['In Progress', 'To Do', 'Ready'].includes(i.status)).length;
        const completed = inits.filter(i => ['Done', 'completed'].includes(i.status)).length;
        // Simplified "Delayed" logic: if status is Blocked or priority is Critical and not done
        const delayed = inits.filter(i => i.status === 'Blocked' || (i.priority === 'Critical' && i.status !== 'Done')).length;

        return { total, inProgress, completed, delayed };
    }, [session]);

    // --- 2. Weighted Progress Calculation (Card A) ---
    const overallProgress = useMemo(() => {
        let score = 0;
        // Weights: Expectations (20%), Assessment (20%), Initiatives (25%), Pilot (15%), Rollout (20%)
        if (session.step1Completed) score += 20;
        if (session.step2Completed) score += 20;
        if (session.step3Completed) score += 25;
        if (session.step5Completed) score += 15;
        // Rollout logic: For now, if step 5 is done, we assume some rollout progress.
        if (session.step5Completed && initiativeStats.total > 0) {
            const rolloutProgress = (initiativeStats.completed / initiativeStats.total) * 20;
            score += rolloutProgress;
        }

        return Math.min(100, Math.round(score));
    }, [session, initiativeStats]);

    // --- 3. Current Phase Logic (Card B) ---
    const currentPhase = useMemo(() => {
        if (!session.step1Completed) return { name: 'Expectations', status: 'Define goals' };
        if (!session.step2Completed) return { name: 'Assessment', status: 'Assessment incomplete' };
        if (!session.step3Completed) return { name: 'Roadmap', status: 'Planning initiatives' };
        if (!session.step5Completed) return { name: 'Pilot Execution', status: 'Testing solutions' };
        return { name: 'Full Rollout', status: 'Scaling solutions' };
    }, [session]);

    // --- 4. Priority Alerts Logic (Card C) ---
    const priorityAlerts = useMemo(() => {
        const alerts = [];
        if (!session.step2Completed) alerts.push("Assessment incomplete: Missing key data.");
        if (initiativeStats.delayed > 0) alerts.push(`${initiativeStats.delayed} initiatives delayed.`);
        // Mock 3rd alert if needed or based on other logic
        if (initiativeStats.delayed > 2) alerts.push("Critical dependency blocked in Data Workstream.");
        else alerts.push("Review Q3 budget allocation.");

        return alerts.slice(0, 3);
    }, [session, initiativeStats]);

    // --- 5. Mock KPIs ---
    const kpis = [
        { label: 'Cycle Time', value: '12d', trend: '-2d', isPositive: true },
        { label: 'Budget Usage', value: '45%', trend: '+5%', isPositive: false },
        { label: 'ROI Realized', value: '$12k', trend: '+$2k', isPositive: true },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">

            {/* SECTION 1: PROJECT STATUS OVERVIEW (3 Cards) */}
            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                <Activity className="text-purple-500" /> Project Status Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* CARD A: Overall Progress */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-4">Overall Progress</h3>
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-5xl font-black text-navy-900 dark:text-white">{overallProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${overallProgress}%` }}
                        />
                    </div>
                </div>

                {/* CARD B: Current Phase */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-center relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Clock size={80} />
                    </div>
                    <h3 className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-2">Current Phase</h3>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                        {currentPhase.name}
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        {currentPhase.status}
                    </p>
                </div>

                {/* CARD C: Priority Alerts */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-500/20 shadow-sm">
                    <h3 className="text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
                        <AlertTriangle size={14} /> Priority Alerts
                    </h3>
                    <ul className="space-y-3">
                        {priorityAlerts.map((alert, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200 font-medium">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <span className="leading-snug">{alert}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* SECTION 2: Execution Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                {/* LEFT COLUMN: Counters & Live Tasks */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Initiative Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Total */}
                        <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10 shadow-sm">
                            <div className="text-slate-500 text-xs font-bold uppercase mb-2">Total Initiatives</div>
                            <div className="text-3xl font-bold text-navy-900 dark:text-white">{initiativeStats.total}</div>
                        </div>
                        {/* In Progress */}
                        <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                            <div className="text-blue-500 text-xs font-bold uppercase mb-2 flex items-center gap-1">
                                <Play size={12} className="fill-current" /> In Progress
                            </div>
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{initiativeStats.inProgress}</div>
                        </div>
                        {/* Completed */}
                        <div className="bg-white dark:bg-navy-900 rounded-xl p-5 border border-slate-200 dark:border-white/10 shadow-sm">
                            <div className="text-green-500 text-xs font-bold uppercase mb-2 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Completed
                            </div>
                            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{initiativeStats.completed}</div>
                        </div>
                        {/* Delayed */}
                        <div className={`rounded-xl p-5 border shadow-sm ${initiativeStats.delayed > 0
                                ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30'
                                : 'bg-white border-slate-200 dark:bg-navy-900 dark:border-white/10'
                            }`}>
                            <div className={`text-xs font-bold uppercase mb-2 flex items-center gap-1 ${initiativeStats.delayed > 0 ? 'text-red-500' : 'text-slate-400'
                                }`}>
                                <AlertTriangle size={12} /> Delayed
                            </div>
                            <div className={`text-3xl font-bold ${initiativeStats.delayed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300'
                                }`}>
                                {initiativeStats.delayed}
                            </div>
                        </div>
                    </div>

                    {/* Live Active Tasks List */}
                    <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                        <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                            <Play size={16} className="text-blue-500 fill-current" />
                            Live Active Initiatives
                        </h3>

                        {session.initiatives?.filter(i => ['In Progress', 'To Do'].includes(i.status)).length === 0 ? (
                            <div className="text-sm text-slate-400 italic py-4">No active initiatives currently tracked.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-white/5 text-xs text-slate-400 uppercase tracking-wider">
                                            <th className="py-2 font-medium">Initiative</th>
                                            <th className="py-2 font-medium">Owner</th>
                                            <th className="py-2 font-medium">Priority</th>
                                            <th className="py-2 font-medium text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm divide-y divide-slate-100 dark:divide-white/5">
                                        {session.initiatives
                                            ?.filter(i => ['In Progress', 'To Do'].includes(i.status))
                                            .slice(0, 5)
                                            .map((initiative) => (
                                                <tr key={initiative.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="py-3 pr-4">
                                                        <div className="font-bold text-navy-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                            {initiative.name}
                                                        </div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">
                                                            {initiative.description || 'No description provided'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                                {initiative.ownerExecution?.lastName?.charAt(0) || initiative.ownerBusiness?.lastName?.charAt(0) || 'U'}
                                                            </div>
                                                            <span className="text-xs text-slate-600 dark:text-slate-400">
                                                                {initiative.ownerExecution?.lastName || initiative.ownerBusiness?.lastName || 'Unassigned'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${initiative.priority === 'Critical' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                                                                initiative.priority === 'High' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' :
                                                                    'bg-blue-50 text-blue-600 dark:bg-blue-900/30'
                                                            }`}>
                                                            {initiative.priority}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 text-right">
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 text-xs font-bold">
                                                            <Play size={10} className="fill-current" />
                                                            {initiative.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {/* View All Actions Button */}
                        <div className="mt-4 text-center">
                            <button onClick={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)} className="text-sm font-bold text-purple-600 hover:text-purple-700 flex items-center justify-center gap-2 dark:text-purple-400">
                                <LayoutDashboard size={14} />
                                Manage All Initiatives
                            </button>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: KPIs & Shortcuts */}
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="bg-white dark:bg-navy-900 rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                        <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-purple-500" />
                            Key Performance Indicators
                        </h3>
                        <div className="space-y-4">
                            {kpis.map((kpi, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium">{kpi.label}</div>
                                        <div className="text-lg font-bold text-navy-900 dark:text-white">{kpi.value}</div>
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-bold ${kpi.isPositive ? 'text-green-500' : 'text-red-500'
                                        }`}>
                                        {kpi.isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        {kpi.trend}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
};
