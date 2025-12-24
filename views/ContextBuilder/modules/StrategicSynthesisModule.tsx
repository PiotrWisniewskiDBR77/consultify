import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, GitMerge, FileText, AlertOctagon, BrainCircuit } from 'lucide-react';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { useAppStore } from '../../../store/useAppStore';
import { TransformationScenarios } from './TransformationScenarios';
import { ReportContainer } from '../../../components/ReportBuilder/ReportContainer';
export const StrategicSynthesisModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'risks' | 'strengths' | 'scenarios' | 'summary'>('risks');
    // Store Access
    const {
        companyProfile,
        challenges,
        goals,
        synthesis,
        setSynthesis,
        updateSynthesisList
    } = useContextBuilderStore();
    const { fullSessionData, currentUser } = useAppStore();
    // Derived State
    const { risks, strengths = [], selectedScenarioId } = synthesis;
    const [selectedRisk, setSelectedRisk] = useState<DynamicListItem | null>(null);
    const [selectedStrength, setSelectedStrength] = useState<DynamicListItem | null>(null);
    // Handlers
    const createHandler = (
        listName: 'risks' | 'strengths',
        currentItems: DynamicListItem[]
    ) => ({
        onAdd: (item: Omit<DynamicListItem, 'id'>) => {
            const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
            updateSynthesisList(listName, [...currentItems, newItem]);
        },
        onUpdate: (id: string, updates: Partial<DynamicListItem>) => {
            const newItems = currentItems.map(p => p.id === id ? { ...p, ...updates } : p);
            updateSynthesisList(listName, newItems);
        },
        onDelete: (id: string) => {
            const newItems = currentItems.filter(p => p.id !== id);
            updateSynthesisList(listName, newItems);
        }
    });
    const riskHandlers = createHandler('risks', risks);
    const strengthHandlers = createHandler('strengths', strengths);
    // TABS CONFIG
    const tabs = [
        { id: 'risks', label: 'Hidden Risks', icon: AlertTriangle },
        { id: 'strengths', label: 'Strengths & Opportunities', icon: TrendingUp },
        { id: 'scenarios', label: 'Transformation Scenarios', icon: GitMerge },
        { id: 'summary', label: 'Executive Report', icon: FileText },
    ];
    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-end border-b border-slate-200 dark:border-white/10 shrink-0">
                <div className="flex space-x-6 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as 'risks' | 'strengths' | 'scenarios' | 'summary')}
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
            </div>
            <div className="flex-1 overflow-visible min-h-[500px]">
                {/* TAB 1: RISKS */}
                {activeTab === 'risks' && (
                    <div className="space-y-6 relative">
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex gap-3 text-red-800 dark:text-red-300">
                            <AlertOctagon size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold mb-1">Risk Assessment Logic</p>
                                <p className="opacity-90">Based on your <strong>{challenges.declaredChallenges.length} declared challenges</strong> and <strong>{companyProfile.activeConstraints.length} active constraints</strong>, we have identified the following risks.</p>
                            </div>
                        </div>
                        <DynamicList
                            title="Hidden Risks & Threats"
                            description="What could derail this transformation? (Generated from Constraints + Challenges)"
                            items={risks}
                            onRowClick={(item) => setSelectedRisk(item)}
                            columns={[
                                {
                                    key: 'risk',
                                    label: 'Risk / Threat',
                                    width: 'w-1/3',
                                    placeholder: 'e.g. Middle Management Resistance',
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            {(item.isAiSuggested as boolean) && (
                                                <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-md text-purple-600" title="AI Suggested Risk">
                                                    <BrainCircuit size={14} />
                                                </div>
                                            )}
                                            <span className="font-medium">{item.risk as string}</span>
                                        </div>
                                    )
                                },
                                { key: 'why', label: 'Why (Root Cause)', width: 'w-1/4', placeholder: 'e.g. Fear of redundancy' },
                                {
                                    key: 'severity',
                                    label: 'Severity',
                                    type: 'select',
                                    options: [{ label: 'Critical', value: 'Critical' }, { label: 'High', value: 'High' }, { label: 'Medium', value: 'Medium' }, { label: 'Low', value: 'Low' }],
                                    width: 'w-1/6',
                                    render: (item) => {
                                        const colorMap: Record<string, string> = {
                                            'Critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                                            'High': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                                            'Medium': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                                            'Low': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                        };
                                        const severity = item.severity as string;
                                        const colorClass = colorMap[severity as keyof typeof colorMap] || 'bg-slate-100 text-slate-700';
                                        return (
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${colorClass}`}>
                                                {severity}
                                            </span>
                                        );
                                    }
                                },
                                { key: 'mitigation', label: 'Mitigation Strategy', width: 'w-1/4', placeholder: 'e.g. Change Mgmt Program' },
                            ]}
                            {...riskHandlers}
                        />
                        {/* Risk Detail Modal / Overlay */}
                        {selectedRisk && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm" onClick={() => setSelectedRisk(null)}>
                                <div
                                    className="bg-white dark:bg-navy-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Header */}
                                    <div className="bg-slate-50 dark:bg-navy-800 p-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className={`mt-1 p-3 rounded-xl ${(selectedRisk.isAiSuggested as boolean) ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                                                {(selectedRisk.isAiSuggested as boolean) ? <BrainCircuit size={24} /> : <AlertTriangle size={24} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-xl font-bold text-navy-900 dark:text-white">{selectedRisk.risk as string}</h3>
                                                    {(selectedRisk.isAiSuggested as boolean) && (
                                                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[10px] font-bold uppercase rounded-full tracking-wide">
                                                            AI Insight
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-500 text-sm">Identified during synthesis phase</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedRisk(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    {/* Content */}
                                    <div className="p-6 space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Severity Level</label>
                                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${(selectedRisk.severity as string) === 'Critical' ? 'bg-red-100 text-red-700' :
                                                    (selectedRisk.severity as string) === 'High' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    <div className={`w-2 h-2 rounded-full ${(selectedRisk.severity as string) === 'Critical' ? 'bg-red-500' :
                                                        (selectedRisk.severity as string) === 'High' ? 'bg-orange-500' :
                                                            'bg-blue-500'
                                                        }`} />
                                                    {selectedRisk.severity as string} Priority
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Source / Context</label>
                                                <div className="text-sm text-navy-900 dark:text-white font-medium">
                                                    {(selectedRisk.isAiSuggested as boolean) ? 'Pattern Recognition Engine' : 'User Constraints'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5 space-y-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Root Cause Analysis</label>
                                                <p className="text-navy-900 dark:text-slate-200">{selectedRisk.why as string}</p>
                                            </div>
                                            <div className="h-px bg-slate-200 dark:bg-white/5" />
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Recommended Mitigation</label>
                                                <p className="text-navy-900 dark:text-slate-200">{selectedRisk.mitigation as string}</p>
                                            </div>
                                        </div>
                                        {(selectedRisk.isAiSuggested as boolean) && (
                                            <div className="flex gap-3 text-sm text-slate-500 bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20">
                                                <BrainCircuit size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                                <p>This risk was suggested because similar organizations in <strong>Automotive</strong> typically struggle with this compliance gap during digital transformations.</p>
                                            </div>
                                        )}
                                    </div>
                                    {/* Footer */}
                                    <div className="bg-slate-50 dark:bg-navy-800 p-4 border-t border-slate-200 dark:border-white/5 flex justify-end gap-3">
                                        <button
                                            onClick={() => setSelectedRisk(null)}
                                            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Close
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-navy-900 dark:bg-purple-600 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                                        >
                                            Update Risk Strategy
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* TAB 2: STRENGTHS & OPPORTUNITIES */}
                {activeTab === 'strengths' && (
                    <div className="space-y-6">
                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex gap-3 text-green-800 dark:text-green-300">
                            <TrendingUp size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-bold mb-1">Strategic Advantages</p>
                                <p className="opacity-90">Based on your <strong>Company Profile</strong> and <strong>Goals</strong>, we have identified these key strengths and market opportunities.</p>
                            </div>
                        </div>
                        <DynamicList
                            title="Strengths & Opportunities"
                            description="What strengths can you leverage? (Generated from Profile & Opportunities)"
                            items={strengths}
                            columns={[
                                {
                                    key: 'enabler',
                                    label: 'Strength / Opportunity',
                                    width: 'w-1/3',
                                    placeholder: 'e.g. Strong Engineering Team',
                                    render: (item) => (
                                        <div className="flex items-center gap-2">
                                            {(item.isAiSuggested as boolean) && (
                                                <div className="p-1 bg-purple-100 dark:bg-purple-900/30 rounded-md text-purple-600" title="AI Suggested Opportunity">
                                                    <BrainCircuit size={14} />
                                                </div>
                                            )}
                                            <span className="font-medium">{item.enabler as string}</span>
                                        </div>
                                    )
                                },
                                { key: 'seen', label: 'Evidence / Where Seen', width: 'w-1/3', placeholder: 'e.g. R&D Performance' },
                                { key: 'leverage', label: 'How to Leverage', width: 'w-1/3', placeholder: 'e.g. Use as Pilot Champions' },
                            ]}
                            onRowClick={(item) => setSelectedStrength(item)}
                            {...strengthHandlers}
                        />
                        {/* Strength Detail Modal */}
                        {selectedStrength && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm" onClick={() => setSelectedStrength(null)}>
                                <div
                                    className="bg-white dark:bg-navy-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Header */}
                                    <div className="bg-slate-50 dark:bg-navy-800 p-6 border-b border-slate-200 dark:border-white/5 flex justify-between items-start">
                                        <div className="flex gap-4">
                                            <div className={`mt-1 p-3 rounded-xl ${selectedStrength.isAiSuggested ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30' : 'bg-green-100 text-green-600 dark:bg-green-900/30'}`}>
                                                {selectedStrength.isAiSuggested ? <BrainCircuit size={24} /> : <TrendingUp size={24} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-xl font-bold text-navy-900 dark:text-white">{selectedStrength.enabler as string}</h3>
                                                    {(selectedStrength.isAiSuggested as boolean) && (
                                                        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 text-[10px] font-bold uppercase rounded-full tracking-wide">
                                                            AI Opportunity
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-500 text-sm">Identified Strength / Opportunity</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedStrength(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                    {/* Content */}
                                    <div className="p-6 space-y-6">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Impact Potential</label>
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {(selectedStrength.impact as string) || 'Medium'}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Confidence</label>
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                    {(selectedStrength.confidence as string) || 'Medium'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* TAB 3: SCENARIOS */}
                {activeTab === 'scenarios' && (
                    <div className="space-y-6">
                        <p className="text-slate-600 dark:text-slate-300">Scenario planning content...</p>
                    </div>
                )}
                {/* TAB 4: SUMMARY */}
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        <p className="text-slate-600 dark:text-slate-300">Summary content...</p>
                    </div>
                )}
            </div>
        </div>
    );
};