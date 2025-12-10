import React, { useState } from 'react';
import { FullSession, FullInitiative, Language } from '../types';
import { translations } from '../translations';
import {
    Target, Users, Calendar, BarChart2, CheckCircle,
    AlertTriangle, ArrowRight, Play, Edit3, Save, X
} from 'lucide-react';

interface FullPilotWorkspaceProps {
    fullSession: FullSession;
    pilotInitiative: FullInitiative;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onNextStep: () => void;
    language: Language;
}

type PilotTab = 'scope' | 'team' | 'plan' | 'kpis' | 'dashboard' | 'evaluation';

export const FullPilotWorkspace: React.FC<FullPilotWorkspaceProps> = ({
    fullSession,
    pilotInitiative,
    onUpdateInitiative,
    onNextStep,
    language
}) => {
    const [activeTab, setActiveTab] = useState<PilotTab>('scope');
    const [isEditing, setIsEditing] = useState(false);

    // Local state for editing fields before saving
    const [editData, setEditData] = useState<Partial<FullInitiative>>({});

    const handleSave = () => {
        onUpdateInitiative({ ...pilotInitiative, ...editData });
        setIsEditing(false);
        setEditData({});
    };

    const startEdit = () => {
        setEditData(pilotInitiative);
        setIsEditing(true);
    };

    // Render functions for each tab
    const renderScope = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
                {/* Scope IN */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-green-600 mb-4">
                        <CheckCircle size={20} /> Scope IN (Must Do)
                    </h3>
                    {isEditing ? (
                        <textarea
                            className="w-full h-40 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm"
                            value={editData.scopeIn?.join('\n') || ''}
                            onChange={e => setEditData({ ...editData, scopeIn: e.target.value.split('\n') })}
                            placeholder="List items included in the pilot..."
                        />
                    ) : (
                        <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
                            {pilotInitiative.scopeIn?.map((item, i) => <li key={i}>{item}</li>) || <li className="text-slate-500 italic">No scope items defined</li>}
                        </ul>
                    )}
                </div>

                {/* Scope OUT */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-red-500 mb-4">
                        <AlertTriangle size={20} /> Scope OUT (Won't Do)
                    </h3>
                    {isEditing ? (
                        <textarea
                            className="w-full h-40 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm"
                            value={editData.scopeOut?.join('\n') || ''}
                            onChange={e => setEditData({ ...editData, scopeOut: e.target.value.split('\n') })}
                            placeholder="List items explicitly excluded..."
                        />
                    ) : (
                        <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
                            {pilotInitiative.scopeOut?.map((item, i) => <li key={i}>{item}</li>) || <li className="text-slate-500 italic">No exclusion items defined</li>}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );

    const renderTeam = () => (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
            <h3 className="text-xl font-bold mb-6">Pilot Team Structure</h3>
            {/* Simple Team Display logic for now - typically would link to Users/Team Members */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center">
                    <div className="text-sm text-slate-500 uppercase font-bold mb-2">Project Sponsor</div>
                    <div className="text-lg font-semibold">{pilotInitiative.sponsor?.firstName || 'Not Assigned'}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center border-2 border-blue-500/20">
                    <div className="text-sm text-blue-500 uppercase font-bold mb-2">Pilot Owner</div>
                    <div className="text-lg font-semibold">{pilotInitiative.ownerBusiness?.firstName || 'Not Assigned'}</div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg text-center">
                    <div className="text-sm text-slate-500 uppercase font-bold mb-2">Tech Lead</div>
                    <div className="text-lg font-semibold">{pilotInitiative.ownerExecution?.firstName || 'Not Assigned'}</div>
                </div>
            </div>
        </div>
    );

    const renderPlan = () => (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
            <h3 className="text-xl font-bold mb-6">Execution Plan & Milestones</h3>
            {isEditing ? (
                <div className="space-y-4">
                    {(editData.milestones || []).map((m, idx) => (
                        <div key={idx} className="flex gap-4">
                            <input value={m.name} onChange={e => {
                                const newM = [...(editData.milestones || [])];
                                newM[idx].name = e.target.value;
                                setEditData({ ...editData, milestones: newM });
                            }} className="flex-1 bg-slate-50 dark:bg-navy-950 border p-2 rounded" />
                            <input type="date" value={m.date} onChange={e => {
                                const newM = [...(editData.milestones || [])];
                                newM[idx].date = e.target.value;
                                setEditData({ ...editData, milestones: newM });
                            }} className="bg-slate-50 dark:bg-navy-950 border p-2 rounded" />
                        </div>
                    ))}
                    <button onClick={() => setEditData({ ...editData, milestones: [...(editData.milestones || []), { name: 'New Milestone', date: '', status: 'pending' }] })} className="text-sm text-blue-500">+ Add Milestone</button>
                </div>
            ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-navy-700 ml-4 space-y-8 py-2">
                    {pilotInitiative.milestones?.map((m, i) => (
                        <div key={i} className="relative pl-6">
                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${m.status === 'completed' ? 'bg-green-500 border-green-500' : 'bg-white dark:bg-navy-900 border-slate-300 dark:border-slate-500'}`}></div>
                            <div className="text-sm text-slate-400 mb-0.5">{m.date}</div>
                            <div className="text-base font-semibold">{m.name}</div>
                        </div>
                    )) || <div className="text-center text-slate-500">No milestones set.</div>}
                </div>
            )}
        </div>
    );

    const renderKPIs = () => (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
            <h3 className="text-xl font-bold mb-6">Success Criteria (KPIs)</h3>
            {isEditing ? (
                <textarea
                    className="w-full h-40 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm"
                    value={editData.successCriteria?.join('\n') || ''}
                    onChange={e => setEditData({ ...editData, successCriteria: e.target.value.split('\n') })}
                    placeholder="List KPIs..."
                />
            ) : (
                <ul className="space-y-3">
                    {pilotInitiative.successCriteria?.map((kpi, i) => (
                        <li key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-navy-950 rounded-lg">
                            <Target size={18} className="text-purple-500" />
                            {kpi}
                        </li>
                    )) || <div className="text-slate-500 italic">No KPIs defined.</div>}
                </ul>
            )}
        </div>
    );

    // Tab Content Switcher
    const renderContent = () => {
        switch (activeTab) {
            case 'scope': return renderScope();
            case 'team': return renderTeam();
            case 'plan': return renderPlan();
            case 'kpis': return renderKPIs();
            case 'dashboard': return <div className="p-10 text-center text-slate-500">Dashboard Visualization Placeholder</div>;
            case 'evaluation': return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-transform"
                        onClick={onNextStep}>
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                            <Play size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">GO: Full Rollout</h3>
                        <p className="text-green-600/70 dark:text-green-400/70 mt-2">Pilot successful. Proceed to scale.</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-transform">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
                            <X size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-red-700 dark:text-red-400">NO-GO: Pivot</h3>
                        <p className="text-red-600/70 dark:text-red-400/70 mt-2">Pilot failed. Re-evaluate strategy.</p>
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-950 text-white">
            {/* Header */}
            <div className="h-20 border-b border-white/10 px-8 flex items-center justify-between bg-navy-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                    <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">Active Pilot Experiment</div>
                    <h1 className="text-2xl font-bold">{pilotInitiative.name}</h1>
                </div>
                <div className="flex items-center gap-4">
                    {isEditing ? (
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold transition-colors">
                            <Save size={16} /> Save Changes
                        </button>
                    ) : (
                        <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors border border-white/10">
                            <Edit3 size={16} /> Edit Pilot Data
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 px-8 gap-8 mt-4">
                {[
                    { id: 'scope', label: '1. Scope', icon: Target },
                    { id: 'team', label: '2. Team', icon: Users },
                    { id: 'plan', label: '3. Plan', icon: Calendar },
                    { id: 'kpis', label: '4. KPIs', icon: BarChart2 },
                    { id: 'dashboard', label: '5. Dashboard', icon: Play },
                    { id: 'evaluation', label: '6. Evaluation', icon: CheckCircle },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as PilotTab)}
                        className={`pb-4 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-navy-950">
                <div className="max-w-5xl mx-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
