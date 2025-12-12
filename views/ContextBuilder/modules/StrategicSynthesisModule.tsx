import React, { useState } from 'react';
import { Radiation, ShieldCheck, GitMerge, FileText, Sparkles, AlertTriangle, Check, X, Trophy } from 'lucide-react';
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

    // AI Suggestions Mock
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
        { id: 'risks', label: 'Hidden Risks', icon: Radiation },
        { id: 'enablers', label: 'Enablers & Strengths', icon: ShieldCheck },
        { id: 'scenarios', label: 'Transformation Scenarios', icon: GitMerge },
        { id: 'summary', label: 'Advisor Summary', icon: FileText },
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
                        {/* AI Suggestion */}
                        {aiRiskSuggestions.map(s => (
                            <div key={s.id} className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                                        <AlertTriangle size={16} />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-navy-900 dark:text-white">AI Detected Risk: {s.risk}</h5>
                                        <p className="text-xs text-slate-500">Source: {s.source} • Cause: {s.why}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-xs font-bold text-green-600 rounded hover:bg-green-50">
                                        <Check size={12} /> Accept
                                    </button>
                                    <button className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-xs font-bold text-red-600 rounded hover:bg-red-50">
                                        <X size={12} /> Dismiss
                                    </button>
                                </div>
                            </div>
                        ))}

                        <DynamicList
                            title="Validated Risks"
                            description="Risks that have been confirmed and need mitigation."
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
                            <p className="text-sm text-slate-500">AI has generated 3 viable scenarios based on your constraints and goals.</p>
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
                                    risks: 'May not solve core structural issues.',
                                    preconditions: 'Minimal CAPEX available.',
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
                                    risks: 'Resource contention between tasks.',
                                    preconditions: 'Dedicated PM + Moderate Budget.',
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
                                    risks: 'High disruption, culture shock.',
                                    preconditions: 'CEO Sponsorship + High CAPEX.',
                                    early: 'New ERP, Factory-wide Sensors.'
                                }
                            ].map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedScenario(s.id)}
                                    className={`
                                        relative cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg
                                        ${selectedScenario === s.id ? `${s.border} ring-2 ring-offset-2 ring-purple-500` : 'border-slate-100 dark:border-white/5'}
                                        ${s.bg}
                                    `}
                                >
                                    {selectedScenario === s.id && (
                                        <div className="absolute top-3 right-3 bg-purple-600 text-white rounded-full p-1">
                                            <Check size={12} />
                                        </div>
                                    )}
                                    <div className={`${s.color} mb-4`}>
                                        <s.icon size={32} />
                                    </div>
                                    <h4 className="font-bold text-lg text-navy-900 dark:text-white mb-2">{s.title}</h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold mb-4">{s.logic}</p>

                                    <div className="space-y-3 text-xs">
                                        <div>
                                            <span className="font-bold text-slate-500 block mb-1">Key Risks:</span>
                                            <span className="text-slate-700 dark:text-slate-200">{s.risks}</span>
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-500 block mb-1">Pre-conditions:</span>
                                            <span className="text-slate-700 dark:text-slate-200">{s.preconditions}</span>
                                        </div>
                                        <div className="pt-2 border-t border-black/5 dark:border-white/5 mt-2">
                                            <span className="font-bold text-purple-600 block mb-1">Early Initiatives:</span>
                                            <span className="text-slate-700 dark:text-slate-200">{s.early}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 4: ADVISOR SUMMARY */}
                {activeTab === 'summary' && (
                    <div className="max-w-4xl mx-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm p-8 print:shadow-none print:border-none">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-6 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-600 p-2 rounded-lg text-white">
                                    <Sparkles size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Strategic Context Summary</h2>
                                    <p className="text-sm text-slate-500">Generated by AI Advisor • {new Date().toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Confidence Score</span>
                                <span className="text-xl font-bold text-green-600">92%</span>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <section>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">1. Who You Are (Context)</h3>
                                <p className="text-base text-navy-900 dark:text-white leading-relaxed">
                                    A <strong>mid-sized Manufacturing firm</strong> in the <strong>Automotive</strong> sector, currently in a <strong>Scaling</strong> phase.
                                    You operate primarily on a <strong>Make-to-Order (MTO)</strong> model with a centralized decision structure.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">2. What You Want (Ambition)</h3>
                                <p className="text-base text-navy-900 dark:text-white leading-relaxed">
                                    Your "North Star" is to <strong>reduce lead times by 50%</strong> while maintaining quality.
                                    Top priorities are <strong>Efficiency</strong> and <strong>Growth</strong>.
                                    You prefer a <strong>Balanced</strong> transformation pace.
                                </p>
                            </section>

                            <div className="grid grid-cols-2 gap-8">
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">3. What Blocks You</h3>
                                    <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                        <li>High Scrap Rate on Line 3 (Critical)</li>
                                        <li>Legacy IT Systems preventing real-time data</li>
                                        <li>Middle Management Resistance</li>
                                    </ul>
                                </section>
                                <section>
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">4. Strategic Pressure</h3>
                                    <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-200 space-y-1">
                                        <li>Carbon Neutrality 2030 imposes strict regulatory deadlines.</li>
                                        <li>AI Automation is reshaping design workflows in your sector.</li>
                                    </ul>
                                </section>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                <h3 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-2">5. Recommendation</h3>
                                <p className="text-lg font-medium text-navy-900 dark:text-white mb-4">
                                    Pursue the <strong>Balanced Hybrid</strong> Scenario.
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                    Given your budget constraints but high ambition for growth, a full "Rip and Replace" is too risky.
                                    Instead, focus on a <strong>Digital Pilot in Line 3</strong> to solve the immediate scrap issue (Quick Win),
                                    while running a parallel <strong>Change Management program</strong> to address management resistance
                                    before scaling to other lines.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
