import React, { useState } from 'react';
import { Target, BarChart2, Maximize, Ban, Zap, Sparkles, CheckCircle2, Rocket, Bot, GanttChartSquare } from 'lucide-react';

import { DynamicList, DynamicListItem } from '../shared/DynamicList';
import { AITextArea } from '../shared/AITextArea';

export const GoalsExpectationsModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'intent' | 'metrics' | 'scope' | 'nogo' | 'expectations'>('intent');

    // MOCK DATA STATES
    const [kpis, setKpis] = useState<DynamicListItem[]>([
        { id: '1', name: 'Revenue Growth', baseline: '$10M', target: '$15M', timeframe: '12m' },
        { id: '2', name: 'OEE', baseline: '65%', target: '80%', timeframe: '6m' }
    ]);

    const [inScope, setInScope] = useState<DynamicListItem[]>([
        { id: '1', item: 'Production Line A', notes: 'Full digitalization' }
    ]);

    const [outScope, setOutScope] = useState<DynamicListItem[]>([
        { id: '1', item: 'Logistics Warehouse', notes: 'Next phase' }
    ]);

    const [noGo, setNoGo] = useState<DynamicListItem[]>([
        { id: '1', area: 'Headcount Reduction', reason: 'Union agreement' }
    ]);

    // AI Suggestions Mock State
    const [aiSuggestions, setAiSuggestions] = useState([
        { id: 1, type: 'add', item: 'Safety Incident Rate (TRIR)', tab: 'metrics', reason: 'Common safety KPI missing compared to industry standard.', confidence: 'Medium' }
    ]);

    // Handlers
    const createHandler = (setter: React.Dispatch<React.SetStateAction<DynamicListItem[]>>) => ({
        onAdd: (item: Omit<DynamicListItem, 'id'>) => setter(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9) }]),
        onUpdate: (id: string, updates: Partial<DynamicListItem>) => setter(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)),
        onDelete: (id: string) => setter(prev => prev.filter(p => p.id !== id))
    });

    const kpiHandlers = createHandler(setKpis);
    const inScopeHandlers = createHandler(setInScope);
    const outScopeHandlers = createHandler(setOutScope);
    const noGoHandlers = createHandler(setNoGo);

    // TABS CONFIG
    const tabs = [
        { id: 'intent', label: 'Strategic Intent', icon: Target },
        { id: 'metrics', label: 'Success Metrics', icon: BarChart2 },
        { id: 'scope', label: 'Scope & Boundaries', icon: Maximize },
        { id: 'nogo', label: 'No-Go Zone', icon: Ban },
        { id: 'expectations', label: 'Expectations', icon: Zap },
    ];

    return (
        <div className="space-y-6">
            {/* AI Suggestion Banner (Mock) - Contextual to Metrics Tab */}
            {aiSuggestions.length > 0 && activeTab === 'metrics' && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
                    <Sparkles className="text-purple-600 mt-1" size={18} />
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">AI Suggested Addition</h4>
                        <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
                            I noticed you haven't included <strong>Safety Incident Rate (TRIR)</strong>. This is a standard manufacturing KPI. Shall I add it?
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700">Add KPI</button>
                        <button className="px-3 py-1 bg-white text-purple-600 border border-purple-200 text-xs rounded hover:bg-slate-50">Dismiss</button>
                    </div>
                </div>
            )}

            {/* Sub-Module Tabs */}
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

            {/* Content Area */}
            <div className="min-h-[400px]">
                {/* TAB 1: STRATEGIC INTENT */}
                {activeTab === 'intent' && (
                    <div className="space-y-8 max-w-4xl">
                        <div>
                            <label className="block text-sm font-bold text-navy-900 dark:text-white mb-2">Primary Objective (North Star)</label>
                            <p className="text-xs text-slate-500 mb-2">What is the single most important goal for this transformation?</p>
                            <AITextArea
                                rows={3}
                                placeholder="E.g. Become the market leader in customized manufacturing by reducing lead times by 50%..."
                                onRefine={() => { }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-navy-900 dark:text-white mb-2">Secondary Objectives</label>
                            <AITextArea
                                rows={2}
                                placeholder="E.g. Improve employee retention, Reduce carbon footprint..."
                                onRefine={() => { }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-navy-900 dark:text-white mb-4">Top Priorities (Select max 3)</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { id: 'eff', label: 'Efficiency / Cost Reduction' },
                                    { id: 'growth', label: 'Growth / Sales Increase' },
                                    { id: 'inv', label: 'Innovation / New Products' },
                                    { id: 'qual', label: 'Quality / Compliance' },
                                    { id: 'speed', label: 'Speed / Agility' },
                                    { id: 'cust', label: 'Customer Experience' }
                                ].map(p => (
                                    <label key={p.id} className="relative flex items-center gap-3 border border-slate-200 dark:border-white/10 p-4 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all group">
                                        <input type="checkbox" className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 peer" />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 peer-checked:text-purple-700 dark:peer-checked:text-purple-300">{p.label}</span>
                                        <div className="absolute inset-0 border-2 border-purple-500 rounded-lg opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"></div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: SUCCESS METRICS (KPIs) */}
                {activeTab === 'metrics' && (
                    <div className="space-y-6">
                        <DynamicList
                            title="Success Metrics (KPIs)"
                            description="Define verifiable metrics to track success. Use 'Add Item' to define new KPIs."
                            items={kpis}
                            columns={[
                                { key: 'name', label: 'KPI Name', width: 'w-1/3', placeholder: 'e.g. OEE' },
                                { key: 'baseline', label: 'Baseline', width: 'w-1/6', placeholder: 'e.g. 60%' },
                                { key: 'target', label: 'Target', width: 'w-1/6', placeholder: 'e.g. 85%' },
                                { key: 'timeframe', label: 'Timeframe', width: 'w-1/6', type: 'select', options: [{ label: '3 Months', value: '3m' }, { label: '6 Months', value: '6m' }, { label: '12 Months', value: '12m' }] },
                            ]}
                            {...kpiHandlers}
                        />
                    </div>
                )}

                {/* TAB 3: SCOPE & BOUNDARIES */}
                {activeTab === 'scope' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <DynamicList
                            title="In Scope (Included)"
                            description="Areas, departments, or processes explicitly included."
                            items={inScope}
                            columns={[
                                { key: 'item', label: 'Item / Area', width: 'w-1/2', placeholder: 'e.g. Plant A' },
                                { key: 'notes', label: 'Notes', width: 'w-1/2', placeholder: 'e.g. Full audit' },
                            ]}
                            {...inScopeHandlers}
                        />

                        <div className="relative">
                            <div className="absolute -left-4 top-1/2 -translate-y-1/2 hidden md:block">
                                <div className="h-full w-[1px] bg-slate-200 dark:bg-white/10"></div>
                            </div>
                            <DynamicList
                                title="Out of Scope (Excluded)"
                                description="Areas explicitly excluded to prevent scope creep."
                                items={outScope}
                                columns={[
                                    { key: 'item', label: 'Item / Area', width: 'w-1/2', placeholder: 'e.g. Logistics' },
                                    { key: 'notes', label: 'Reason', width: 'w-1/2', placeholder: 'e.g. Already optimized' },
                                ]}
                                {...outScopeHandlers}
                            />
                        </div>
                    </div>
                )}

                {/* TAB 4: NO-GO ZONE */}
                {activeTab === 'nogo' && (
                    <DynamicList
                        title="No-Go Zone"
                        description="Areas or topics that are off-limits due to politics, regulations, or strategy."
                        items={noGo}
                        columns={[
                            { key: 'area', label: 'Sensitive Area', width: 'w-1/3', placeholder: 'e.g. Headcount' },
                            { key: 'reason', label: 'Reason/Constraint', width: 'w-2/3', placeholder: 'e.g. Strict union agreement until 2026' },
                        ]}
                        {...noGoHandlers}
                    />
                )}

                {/* TAB 5: EXPECTATIONS */}
                {activeTab === 'expectations' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Preferred Working Style */}
                        {/* Transformation Archetype */}
                        <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors">
                            <h3 className="font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                <Rocket size={20} className="text-orange-500" />
                                Transformation Archetype
                            </h3>
                            <p className="text-xs text-slate-500 mb-6">How do you want to deliver value? Define the speed and depth of change.</p>

                            <div className="space-y-4">
                                {[
                                    { id: 'fast', label: 'Pilot & Scale (Agile)', desc: 'Rapid prototyping, MVPs, quick feedback loops. Best for high uncertainty.' },
                                    { id: 'deep', label: 'Core Transformation (Waterfall)', desc: 'Deep structural change, phased rollout, risk averse. Best for legacy systems.' },
                                    { id: 'targeted', label: 'value-Led / Use Case', desc: 'Focus on specific high-ROI pain points. Best for tight budgets.' }
                                ].map(style => (
                                    <label key={style.id} className="relative block cursor-pointer group">
                                        <input type="radio" name="style" className="peer sr-only" />
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-navy-950/50 peer-checked:bg-orange-50 dark:peer-checked:bg-orange-900/20 peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500/50 transition-all hover:bg-white dark:hover:bg-navy-800">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-sm text-navy-900 dark:text-white peer-checked:text-orange-700 dark:peer-checked:text-orange-400">{style.label}</span>
                                                <div className="w-4 h-4 rounded-full border border-slate-300 peer-checked:border-orange-500 peer-checked:bg-orange-500 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-500 leading-relaxed block">{style.desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Human-AI Engagement Model */}
                        <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors">
                            <h3 className="font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                <Bot size={20} className="text-purple-500" />
                                Human-AI Collaboration
                            </h3>
                            <p className="text-xs text-slate-500 mb-6">Define the level of autonomy you grant to the AI in this engagement.</p>

                            <div className="space-y-4">
                                {[
                                    { id: 'advisor', label: 'Strategic Advisor', desc: 'AI challenges assumptions & provides benchmarks. You decide.' },
                                    { id: 'partner', label: 'Collaborative Co-Pilot', desc: 'AI drafts content & plans. You review & refine.' },
                                    { id: 'agent', label: 'Autonomous Agent', desc: 'AI executes defined workflows (e.g., data hygiene) with oversight.' }
                                ].map(role => (
                                    <label key={role.id} className="relative block cursor-pointer group">
                                        <input type="radio" name="airole" className="peer sr-only" />
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-navy-950/50 peer-checked:bg-purple-50 dark:peer-checked:bg-purple-900/20 peer-checked:border-purple-500 peer-checked:ring-1 peer-checked:ring-purple-500/50 transition-all hover:bg-white dark:hover:bg-navy-800">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-sm text-navy-900 dark:text-white peer-checked:text-purple-700 dark:peer-checked:text-purple-400">{role.label}</span>
                                                <div className="w-4 h-4 rounded-full border border-slate-300 peer-checked:border-purple-500 peer-checked:bg-purple-500 flex items-center justify-center">
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100" />
                                                </div>
                                            </div>
                                            <span className="text-xs text-slate-500 leading-relaxed block">{role.desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Steering & Governance */}
                        <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:border-purple-300 dark:hover:border-purple-500/50 transition-colors">
                            <h3 className="font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                <GanttChartSquare size={20} className="text-blue-500" />
                                Steering & Governance
                            </h3>
                            <p className="text-xs text-slate-500 mb-6">How will we track progress and ensure alignment?</p>

                            <div className="space-y-4">
                                {[
                                    { id: 'weekly', label: 'Weekly SteerCo', desc: 'Tactical alignment on sprints & blockers.' },
                                    { id: 'monthly', label: 'Monthly QBR', desc: 'Strategic review of value delivered & roadmap.' },
                                    { id: 'daily', label: 'Daily Standups', desc: 'High-touch operational coordination.' },
                                    { id: 'milestone', label: 'Milestone Based', desc: 'Reviews triggered by key deliverables.' }
                                ].map(cadence => (
                                    <label key={cadence.id} className="relative block cursor-pointer group">
                                        <input type="radio" name="cadence" className="peer sr-only" />
                                        <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-navy-950/50 hover:bg-white dark:hover:bg-navy-800 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20 peer-checked:border-blue-500 transition-all">
                                            <div className="w-4 h-4 rounded-full border border-slate-300 peer-checked:border-blue-500 peer-checked:bg-blue-500 flex items-center justify-center shrink-0">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-navy-900 dark:text-white peer-checked:text-blue-700 dark:peer-checked:text-blue-400">{cadence.label}</div>
                                                <div className="text-[10px] text-slate-500">{cadence.desc}</div>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
