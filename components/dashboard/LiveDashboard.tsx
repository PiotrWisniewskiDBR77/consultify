import React, { useMemo } from 'react';
import {
    LayoutDashboard, CheckCircle2, AlertTriangle, XCircle,
    TrendingUp, TrendingDown, ArrowRight, FileText,
    Calendar, AlertOctagon, BrainCircuit, Activity, Circle, Map, Rocket
} from 'lucide-react';
import { FullSession, AppView, InitiativeStatus } from '../../types';

interface LiveDashboardProps {
    session: FullSession;
    onNavigate: (view: AppView) => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({ session, onNavigate }) => {

    // --- 1. Project Status Calculations ---
    const progressStats = useMemo(() => {
        let score = 0;
        if (session.step1Completed) score += 20; // Expectations
        if (session.step2Completed) score += 20; // Assessment
        if (session.step3Completed) score += 25; // Roadmap (Initiatives)
        if (session.step4Completed) score += 0;  // ROI (Part of Roadmap typically, but let's say it's bundled)
        if (session.step5Completed) score += 15; // Pilot
        // Rollout not explicitly tracked as a boolean in FullSession, assuming logical deduction

        // Calculate Initiative Execution Progress
        const initiatives = session.initiatives || [];
        const totalInit = initiatives.length;
        const completedInit = initiatives.filter(i => i.status === 'done' || i.status === 'completed').length;
        const executionScore = totalInit > 0 ? (completedInit / totalInit) * 20 : 0;

        return Math.min(100, score + executionScore);
    }, [session]);

    const currentPhase = useMemo(() => {
        if (!session.step2Completed) return "Assessment";
        if (!session.step3Completed) return "Strategy & Roadmap";
        if (!session.step5Completed) return "Pilot Execution";
        return "Full Rollout";
    }, [session]);

    // --- 3. Initiative Summary ---
    const initiativeStats = useMemo(() => {
        const inits = session.initiatives || [];
        const onTrack = inits.filter(i => ['In Progress', 'Done', 'completed'].includes(i.status)).length;
        const atRisk = inits.filter(i => i.priority === 'High' && ['Blocked', 'on_hold'].includes(i.status)).length;
        const delayed = inits.filter(i => i.status === 'Blocked').length; // Simplified logic

        return { total: inits.length, onTrack, atRisk, delayed };
    }, [session]);

    // --- 4. KPIs (Mock for now, should come from session.kpis in future) ---
    const kpis = [
        { label: 'Cycle Time', value: '-12%', trend: 'good', baseline: '4 days' },
        { label: 'Quality / Scrap', value: '-5%', trend: 'good', baseline: '2.1%' },
        { label: 'Throughput', value: '+8%', trend: 'good', baseline: '850 un/h' },
        { label: 'Op. Savings', value: '$120k', trend: 'good', baseline: '$0' },
    ];

    // --- 5. AI Insights (Mock/Placeholder logic) ---
    const aiInsights = {
        summary: `In this week, the project progressed by ${Math.floor(Math.random() * 5) + 1}%.The biggest risk identified is the delay in the Data Foundation workstream.`,
        actions: [
            "Strengthen the Process Owner role in Automation Workstream.",
            "Accelerate decision on Data Integration vendor.",
            "Schedule Cultural Workshop for middle management."
        ],
        risk: "Potential delay in AI User Training rollout due to resource constraints in Q3."
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">

            {/* SECTION 1: Project Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Overall Progress */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Activity size={100} />
                    </div>
                    <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">Overall Progress</h3>
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-4xl font-bold text-navy-900 dark:text-white">{progressStats.toFixed(0)}%</span>
                        <span className="text-slate-400 mb-1 font-medium">completed</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-1000" style={{ width: `${progressStats}% ` }}></div>
                    </div>
                </div>

                {/* Current Phase */}
                <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-center">
                    <h3 className="text-slate-500 font-medium text-sm uppercase tracking-wide mb-2">Current Phase</h3>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                        {currentPhase}
                    </div>
                    <p className="text-xs text-slate-400">
                        {currentPhase === 'Assessment' && "Defining baseline maturity and gaps."}
                        {currentPhase === 'Strategy & Roadmap' && "Planning initiatives and ROI."}
                        {currentPhase === 'Pilot Execution' && "Testing solutions in controlled environment."}
                        {currentPhase === 'Full Rollout' && "Scaling solutions across organization."}
                    </p>
                </div>

                {/* Priority Alerts */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-500/20 shadow-sm">
                    <h3 className="text-red-600 dark:text-red-400 font-bold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                        <AlertOctagon size={16} />
                        Priority Alerts
                    </h3>
                    <ul className="space-y-2">
                        {!session.step2Completed && (
                            <li className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                Assessment incomplete: Missing key data points.
                            </li>
                        )}
                        {initiativeStats.delayed > 0 && (
                            <li className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                                {initiativeStats.delayed} initiatives are currently delayed.
                            </li>
                        )}
                        <li className="text-sm text-red-800 dark:text-red-200 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                            Review Q3 budget allocation.
                        </li>
                    </ul>
                </div>
            </div>

            {/* SECTION 2: Module Completion Status */}
            <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm flex flex-wrap gap-4 justify-between items-center">
                {[
                    { label: 'Goals & Challenges', completed: session.step1Completed, view: AppView.FULL_STEP1_ASSESSMENT }, // technically step1 is just goal? 
                    { label: 'Assessment', completed: session.step2Completed, view: AppView.FULL_STEP1_ASSESSMENT },
                    { label: 'Roadmap', completed: session.step3Completed, view: AppView.FULL_STEP3_ROADMAP },
                    { label: 'Pilot', completed: session.step5Completed, view: AppView.FULL_STEP5_EXECUTION },
                    { label: 'Rollout', completed: false, view: AppView.FULL_STEP5_EXECUTION }
                ].map((mod, i) => (
                    <button
                        key={i}
                        onClick={() => onNavigate(mod.view)}
                        className={`flex items - center gap - 3 px - 4 py - 2 rounded - lg border transition - all ${mod.completed ? 'border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-500'} `}
                    >
                        {mod.completed ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-slate-300" />}
                        <span className="font-medium text-sm">{mod.label}</span>
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* SECTION 3: Initiative Summary & KPIs */}
                <div className="space-y-6">
                    {/* Initiative Summary */}
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                        <h3 className="font-bold text-navy-900 dark:text-white mb-4">Initiative Summary</h3>
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <div className="text-3xl font-bold">{initiativeStats.total}</div>
                                <div className="text-xs text-slate-500">Total Initiatives</div>
                            </div>
                            <button
                                onClick={() => onNavigate(AppView.FULL_STEP2_INITIATIVES)}
                                className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                            >
                                View All <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> On Track</span>
                                <span className="font-mono font-bold">{initiativeStats.onTrack}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> At Risk</span>
                                <span className="font-mono font-bold">{initiativeStats.atRisk}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Delayed</span>
                                <span className="font-mono font-bold">{initiativeStats.delayed}</span>
                            </div>
                        </div>
                    </div>

                    {/* KPI Snapshot */}
                    <div className="bg-white dark:bg-navy-900 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                        <h3 className="font-bold text-navy-900 dark:text-white mb-4">KPI Snapshot</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {kpis.map((kpi, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
                                    <div className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                        {kpi.value}
                                        {kpi.trend === 'good' ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
                                    </div>
                                    <div className="text-[10px] text-slate-400">Baseline: {kpi.baseline}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* SECTION 5: AI Insights */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden min-h-[400px]">
                        <div className="absolute top-0 right-0 p-8 opacity-20">
                            <BrainCircuit size={180} />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <BrainCircuit size={24} className="text-white" />
                                </div>
                                <h3 className="text-xl font-bold">AI Executive Insights</h3>
                            </div>

                            <div className="space-y-6">
                                {/* Weekly Summary */}
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                                    <h4 className="text-sm font-semibold text-indigo-200 uppercase tracking-wider mb-2">Weekly Executive Summary</h4>
                                    <p className="leading-relaxed text-indigo-50">
                                        {aiInsights.summary}
                                    </p>
                                </div>

                                {/* Recommended Actions */}
                                <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/10">
                                    <h4 className="text-sm font-semibold text-indigo-200 uppercase tracking-wider mb-3">Recommended Actions</h4>
                                    <ul className="space-y-3">
                                        {aiInsights.actions.map((action, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
                                                <span className="text-sm text-indigo-50">{action}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* Predictive Risk */}
                                <div className="bg-red-500/20 backdrop-blur-md rounded-xl p-5 border border-red-500/20 flex items-start gap-4">
                                    <AlertTriangle size={24} className="text-red-300 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-semibold text-red-200 uppercase tracking-wider mb-1">Early Predictive Risk</h4>
                                        <p className="text-sm text-white/90">{aiInsights.risk}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Shortcuts */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button onClick={() => onNavigate(AppView.FULL_STEP1_ASSESSMENT)} className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                            <LayoutDashboard className="mx-auto mb-2 text-purple-600 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold">Assessment</span>
                        </button>
                        <button onClick={() => onNavigate(AppView.FULL_STEP3_ROADMAP)} className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                            <Map className="mx-auto mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold">Roadmap</span>
                        </button>
                        <button onClick={() => onNavigate(AppView.FULL_STEP5_EXECUTION)} className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                            <Rocket className="mx-auto mb-2 text-orange-600 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold">Pilot</span>
                        </button>
                        <button onClick={() => onNavigate(AppView.FULL_STEP6_REPORTS)} className="p-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-colors text-center group">
                            <FileText className="mx-auto mb-2 text-green-600 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-semibold">Reports</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


