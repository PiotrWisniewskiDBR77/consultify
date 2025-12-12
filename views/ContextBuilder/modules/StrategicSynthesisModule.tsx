import React, { useState } from 'react';
import { Radiation, ShieldCheck, GitMerge, FileText, Sparkles, AlertTriangle, Check, X, Trophy, EyeOff, Target, Lock, TrendingUp } from 'lucide-react';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';

export const StrategicSynthesisModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'risks' | 'enablers' | 'scenarios' | 'summary'>('risks');
    const [selectedScenario, setSelectedScenario] = useState<string>('balanced');

    // MOCK DATA
    const [risks, setRisks] = useState<DynamicListItem[]>([
        { id: '1', risk: 'Middle Management Resistance', why: 'Fear of automation redundancy', severity: 'High', mitigation: 'Change Mgmt Program' }
    ]);

    const [enablers, setEnablers] = useState<DynamicListItem[]>([
        { id: '1', enabler: 'Strong Technical Engineering', seen: 'R&D Department Performance', leverage: 'Use as pilot champions' }
    ]);

    // AI Suggestions Mock (Blind Spots)
    const [aiRiskSuggestions, setAiRiskSuggestions] = useState([
        { id: 'img1', risk: 'Compliance Data Gap', why: 'Audit 2023 showed missing logs', source: 'Internal Audit.pdf' }
    ]);

    const createHandler = (setter: React.Dispatch<React.SetStateAction<DynamicListItem[]>>) => ({
        onAdd: (item: Omit<DynamicListItem, 'id'>) => setter(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9) }]),
        onUpdate: (id: string, updates: Partial<DynamicListItem>) => setter(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)),
        onDelete: (id: string) => setter(prev => prev.filter(p => p.id !== id))
    });

    const riskHandlers = createHandler(setRisks);
    const enablerHandlers = createHandler(setEnablers);

    // TABS CONFIG
    const tabs = [
        { id: 'risks', label: 'Hidden Risks', icon: EyeOff },
        { id: 'enablers', label: 'Enablers & Strengths', icon: ShieldCheck },
        { id: 'scenarios', label: 'Transformation Scenarios', icon: GitMerge },
        { id: 'summary', label: 'Executive Report', icon: FileText },
    ];

    return (
        <div className="space-y-6">
            <div className="flex border-b border-slate-200 dark:border-white/10 space-x-6 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-500 hover:text-navy-900 dark:hover:text-white'}
                        `}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">

                {/* TAB 1: HIDDEN RISKS */}
                {activeTab === 'risks' && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-navy-900/50 p-4 rounded-lg text-sm text-slate-600 dark:text-slate-300">
                            <strong>Why this matters:</strong> Clients often miss these risks because they are embedded in daily operations or cultural habits. Identifying them early prevents project stall.
                        </div>

                        {/* AI Blind Spot Suggestion */}
                        {aiRiskSuggestions.map(s => (
                            <div key={s.id} className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-4 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className="bg-orange-100 dark:bg-orange-900/30 p-2.5 rounded-full text-orange-600">
                                        <EyeOff size={20} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h5 className="text-sm font-bold text-navy-900 dark:text-white">Detected Blind Spot: {s.risk}</h5>
                                            <span className="px-1.5 py-0.5 bg-orange-200/50 text-orange-700 dark:text-orange-400 text-[10px] uppercase font-bold tracking-wider rounded">High Probability</span>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            <span className="font-semibold">Why you missed it:</span> Usually buried in audit logs ({s.source}).
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-green-600 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                        <Check size={14} /> Confirm
                                    </button>
                                    <button className="flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 rounded hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <X size={14} /> Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}

                        <DynamicList
                            title="Validated Risks & Obstacles"
                            description="Risks that have been confirmed and need mitigation strategies."
                            items={risks}
                            columns={[
                                { key: 'risk', label: 'Risk Name', width: 'w-1/4', placeholder: 'e.g. Data Leakage' },
                                { key: 'why', label: 'Root Cause / Why?', width: 'w-1/4', placeholder: 'e.g. No DLP policy' },
                                { key: 'severity', label: 'Severity', type: 'select', options: [{ label: 'High', value: 'High' }, { label: 'Medium', value: 'Medium' }, { label: 'Low', value: 'Low' }], width: 'w-1/6' },
                                { key: 'mitigation', label: 'Mitigation Idea', width: 'w-1/3', placeholder: 'e.g. Implement DLP tools' },
                            ]}
                            {...riskHandlers}
                        />
                    </div>
                )}

                {/* TAB 2: ENABLERS & STRENGTHS */}
                {activeTab === 'enablers' && (
                    <div className="space-y-6">
                        <DynamicList
                            title="Enablers & Strengths"
                            description="Assets and capabilities we can leverage for successful transformation."
                            items={enablers}
                            columns={[
                                { key: 'enabler', label: 'Strength / Enabler', width: 'w-1/3', placeholder: 'e.g. Agile Culture' },
                                { key: 'seen', label: 'Where Seen / Evidence', width: 'w-1/3', placeholder: 'e.g. IT Team sprints' },
                                { key: 'leverage', label: 'How to Leverage', width: 'w-1/3', placeholder: 'e.g. Expand to other depts' },
                            ]}
                            {...enablerHandlers}
                        />
                    </div>
                )}

                {/* TAB 3: SCENARIOS */}
                {activeTab === 'scenarios' && (
                    <div className="space-y-6">
                        <div className="text-center mb-8">
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">Transformation Paths</h3>
                            <p className="text-sm text-slate-500">AI analysis of your Ambition vs. Constraints suggests the following paths.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                {
                                    id: 'conservative',
                                    title: 'Quick Wins First',
                                    icon: ShieldCheck,
                                    color: 'text-blue-600',
                                    bg: 'bg-blue-50 dark:bg-blue-900/10',
                                    border: 'border-blue-200 dark:border-blue-800',
                                    logic: 'Focus on low-hanging fruit to build confidence.',
                                    matchReason: 'Good fit for low CAPEX, but misses your "High Growth" goal.',
                                    matchScore: 65,
                                    early: 'Process mapping, 5S implementation.'
                                },
                                {
                                    id: 'balanced',
                                    title: 'Balanced Hybrid',
                                    icon: GitMerge,
                                    color: 'text-purple-600',
                                    bg: 'bg-purple-50 dark:bg-purple-900/10',
                                    border: 'border-purple-200 dark:border-purple-800',
                                    logic: 'Parallel tracks: Quick wins + 1 major pilot.',
                                    matchReason: 'Matches your "Efficiency" priority and mitigates "Mgmt Resistance".',
                                    matchScore: 92,
                                    recommended: true,
                                    early: 'Pilot Line A Digitalization + Training.'
                                },
                                {
                                    id: 'ambitious',
                                    title: 'Full Transformation',
                                    icon: Trophy,
                                    color: 'text-orange-600',
                                    bg: 'bg-orange-50 dark:bg-orange-900/10',
                                    border: 'border-orange-200 dark:border-orange-800',
                                    logic: 'Rip and replace legacy. All-in digitalization.',
                                    matchReason: 'Too risky given "Legacy IT" constraints.',
                                    matchScore: 40,
                                    early: 'New ERP, Factory-wide Sensors.'
                                }
                            ].map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedScenario(s.id)}
                                    className={`
                                        relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg flex flex-col h-full
                                        ${selectedScenario === s.id ? `${s.border} ring-2 ring-offset-2 ring-purple-500` : 'border-slate-100 dark:border-white/5'}
                                        ${s.bg}
                                    `}
                                >
                                    {s.recommended && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            AI Recommended
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`${s.color} p-2 bg-white dark:bg-white/10 rounded-lg`}>
                                            <s.icon size={24} />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-navy-900 dark:text-white">{s.matchScore}%</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">Fit Score</div>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-lg text-navy-900 dark:text-white mb-2">{s.title}</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mb-4 leading-relaxed">{s.logic}</p>

                                    <div className="mt-auto space-y-4 pt-4 border-t border-black/5 dark:border-white/5">
                                        <div>
                                            <span className="font-bold text-xs text-slate-500 block mb-1">Why this match?</span>
                                            <p className="text-xs text-slate-700 dark:text-slate-200 italic">"{s.matchReason}"</p>
                                        </div>
                                        <div>
                                            <span className="font-bold text-xs text-purple-600 block mb-1">Early Win:</span>
                                            <span className="text-xs text-slate-700 dark:text-slate-200">{s.early}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 4: EXECUTIVE REPORT */}
                {activeTab === 'summary' && (
                    <div className="max-w-4xl mx-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
                        {/* Header */}
                        <div className="bg-slate-50 dark:bg-navy-950/50 p-8 border-b border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="bg-navy-900 text-white p-2.5 rounded-lg">
                                        <FileText size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Executive Context Report</h2>
                                        <p className="text-sm text-slate-500">Consolidated Strategic Baseline • {new Date().toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider">
                                        <Check size={12} /> Ready for Strategy
                                    </span>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                                This document synthesizes all initial findings (Profile, Goals, Challenges, External Trends). It serves as the <strong>foundational truth</strong> for the upcoming Strategic Roadmap.
                            </p>
                        </div>

                        {/* Report Content */}
                        <div className="p-8 space-y-8">

                            {/* 1. Context & Identity */}
                            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="col-span-1">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Target size={14} /> Identity
                                    </h5>
                                    <div className="text-sm text-navy-900 dark:text-white font-medium">
                                        Automotive Manufacturer<br />
                                        Mid-Sized (Scaling)<br />
                                        Make-to-Order (MTO)
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <TrendingUp size={14} /> Core Ambition
                                    </h5>
                                    <p className="text-sm text-navy-900 dark:text-white leading-relaxed">
                                        To achieve a <strong>50% reduction in lead times</strong> while maintaining top-tier quality.
                                        The organization prioritizes <strong>Efficiency</strong> and <strong>Growth</strong> over pure cost-cutting.
                                    </p>
                                </div>
                            </section>

                            <hr className="border-slate-100 dark:border-white/5" />

                            {/* 2. Critical Blockers & Blind Spots */}
                            <section>
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Lock size={14} /> The Reality Check (Blockers)
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg border border-red-100 dark:border-red-900/20">
                                        <span className="text-red-600 text-xs font-bold uppercase mb-1 block">Critical Bottleneck</span>
                                        <p className="text-sm font-medium text-navy-900 dark:text-white">High Scrap Rate on Line 3</p>
                                        <p className="text-xs text-slate-500 mt-1">Directly impacts the 50% lead time goal.</p>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/20">
                                        <span className="text-orange-600 text-xs font-bold uppercase mb-1 block">Detected Blind Spot</span>
                                        <p className="text-sm font-medium text-navy-900 dark:text-white">Compliance Data Gap (Audit Logs)</p>
                                        <p className="text-xs text-slate-500 mt-1">Often overlooked, posing legal risk.</p>
                                    </div>
                                </div>
                            </section>

                            {/* 3. Strategic Pressures */}
                            <section>
                                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Radiation size={14} /> External Pressure (Why Now?)
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-slate-400 mt-1">•</span>
                                        <span><strong>Carbon Neutrality 2030:</strong> Regulatory deadline requires immediate tracking updates.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-slate-400 mt-1">•</span>
                                        <span><strong>AI Automation Wave:</strong> Competitors are automating design workflows, threatening market share.</span>
                                    </li>
                                </ul>
                            </section>

                            {/* 4. Scenario Selection */}
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-xl border border-purple-100 dark:border-purple-800/50 mt-4">
                                <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <GitMerge size={14} /> Selected Path Forward
                                </h3>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-lg font-bold text-navy-900 dark:text-white mb-2">
                                            Balanced Hybrid Scenario
                                        </p>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 max-w-xl">
                                            We will pursue a parallel track approach: implementing <strong>Quick Wins</strong> (Line 3 Pilot) to fix immediate bleeding, while slowly introducing a <strong>Change Management</strong> layer to prepare for broader automation.
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-purple-600">92%</div>
                                        <div className="text-[10px] font-bold text-purple-400 uppercase">Fit Score</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
