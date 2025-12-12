import React, { useState } from 'react';
import { FullInitiative, User } from '../types';

import {
    X, Save, Target, TrendingUp, DollarSign,
    Calendar, Users, CheckCircle,
    AlertTriangle, FileText, Globe
} from 'lucide-react';
import { Button } from './Button';
import { InitiativeTasksTab } from './InitiativeTasksTab';

interface InitiativeDetailModalProps {
    initiative: FullInitiative;
    isOpen: boolean;
    onClose: () => void;
    onSave: (initiative: FullInitiative) => void;
    users?: User[];
    currentUser?: User | null; // Added currentUser
}

export const InitiativeDetailModal: React.FC<InitiativeDetailModalProps> = ({
    initiative: initialInitiative,
    isOpen,
    onClose,
    onSave,
    users = [],
    currentUser
}) => {
    const [initiative, setInitiative] = useState<FullInitiative>({ ...initialInitiative });
    const [activeTab, setActiveTab] = useState<'overview' | 'definition' | 'execution' | 'tasks' | 'economics'>('overview');

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(initiative);
        onClose();
    };

    const handleArrayChange = (field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut', index: number, value: string) => {
        const newArray = [...(initiative[field] || [])];
        newArray[index] = value;
        setInitiative({ ...initiative, [field]: newArray });
    };

    const addArrayItem = (field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut') => {
        setInitiative({ ...initiative, [field]: [...(initiative[field] || []), ''] });
    };

    const removeArrayItem = (field: 'deliverables' | 'successCriteria' | 'scopeIn' | 'scopeOut', index: number) => {
        const newArray = [...(initiative[field] || [])];
        newArray.splice(index, 1);
        setInitiative({ ...initiative, [field]: newArray });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-navy-900 border border-white/10 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-navy-950">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-blue-500/20 text-blue-400`}>
                            <Target size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Initiative Charter</h2>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="uppercase">{initiative.id ? `ID: ${initiative.id.slice(0, 8)}` : 'New Initiative'}</span>
                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                <span className="uppercase text-blue-400">{initiative.status?.replace('_', ' ') || 'DRAFT'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose}><X size={20} /></Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 bg-navy-900/50 px-6 gap-6">
                    {[
                        { id: 'overview', label: 'Overview', icon: FileText },
                        { id: 'tasks', label: 'Tasks', icon: CheckCircle }, // New Tab
                        { id: 'definition', label: 'Definition & Scope', icon: Target },
                        { id: 'execution', label: 'Execution & Risks', icon: Calendar },
                        { id: 'economics', label: 'Value & Finance', icon: DollarSign },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'text-blue-400 border-blue-500'
                                : 'text-slate-400 border-transparent hover:text-white'
                                }`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-navy-900">

                    {/* TASKS TAB */}
                    {activeTab === 'tasks' && (
                        <InitiativeTasksTab
                            initiativeId={initiative.id}
                            users={users}
                            currentUser={currentUser!}
                        />
                    )}

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-3 gap-6">
                            <div className="col-span-2 space-y-6">
                                <InputGroup label="Initiative Name">
                                    <input
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg p-3 text-lg font-semibold text-white focus:border-blue-500 outline-none"
                                        value={initiative.name}
                                        onChange={e => setInitiative({ ...initiative, name: e.target.value })}
                                        placeholder="e.g., Global AI Customer Service Rollout"
                                    />
                                </InputGroup>

                                <InputGroup label="Executive Summary">
                                    <textarea
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg p-3 text-slate-300 focus:border-blue-500 outline-none h-24 resize-none"
                                        value={initiative.summary || ''}
                                        onChange={e => setInitiative({ ...initiative, summary: e.target.value })}
                                        placeholder="Brief overview of the initiative..."
                                    />
                                </InputGroup>

                                <InputGroup label="Problem Statement (The Why)">
                                    <textarea
                                        className="w-full bg-navy-950 border border-white/10 rounded-lg p-3 text-slate-300 focus:border-blue-500 outline-none h-24 resize-none"
                                        value={initiative.problemStatement || ''}
                                        onChange={e => setInitiative({ ...initiative, problemStatement: e.target.value })}
                                        placeholder="What problem are we solving? Why now?"
                                    />
                                </InputGroup>

                                <InputGroup label="Hypothesis">
                                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3">
                                        <p className="text-xs text-blue-400 mb-2 font-mono">IF we implement [User Solution] THEN we will achieve [Result] BECAUSE [Reasoning]</p>
                                        <textarea
                                            className="w-full bg-transparent border-none p-0 text-white focus:ring-0 placeholder:text-slate-600"
                                            value={initiative.hypothesis || ''}
                                            onChange={e => setInitiative({ ...initiative, hypothesis: e.target.value })}
                                            placeholder="Enter hypothesis..."
                                        />
                                    </div>
                                </InputGroup>
                            </div>

                            {/* Sidebar Info */}
                            <div className="space-y-6">
                                <div className="bg-navy-950 rounded-xl p-4 border border-white/5">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <Users size={16} className="text-purple-400" /> Key Roles
                                    </h3>

                                    <div className="space-y-4">
                                        <InputGroup label="Business Owner">
                                            <select
                                                className="w-full bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
                                                value={initiative.ownerBusinessId || ''}
                                                onChange={e => setInitiative({ ...initiative, ownerBusinessId: e.target.value })}
                                            >
                                                <option value="">Select Owner...</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                                ))}
                                            </select>
                                        </InputGroup>

                                        <InputGroup label="Execution Lead">
                                            <select
                                                className="w-full bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
                                                value={initiative.ownerExecutionId || ''}
                                                onChange={e => setInitiative({ ...initiative, ownerExecutionId: e.target.value })}
                                            >
                                                <option value="">Select Lead...</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                                ))}
                                            </select>
                                        </InputGroup>

                                        <InputGroup label="Sponsor">
                                            <select
                                                className="w-full bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
                                                value={initiative.sponsorId || ''}
                                                onChange={e => setInitiative({ ...initiative, sponsorId: e.target.value })}
                                            >
                                                <option value="">Select Sponsor...</option>
                                                {users.map(u => (
                                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                                ))}
                                            </select>
                                        </InputGroup>
                                    </div>
                                </div>

                                <div className="bg-navy-950 rounded-xl p-4 border border-white/5">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <Globe size={16} className="text-blue-400" /> Context
                                    </h3>
                                    <div className="text-xs text-slate-400 italic">
                                        {initiative.marketContext ? (
                                            <p className="line-clamp-6">{initiative.marketContext}</p>
                                        ) : (
                                            <p>No market context data available. Use "Enrich" to fetch.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DEFINITION & SCOPE TAB */}
                    {activeTab === 'definition' && (
                        <div className="grid grid-cols-2 gap-8">
                            {/* Deliverables */}
                            <div className="space-y-4">
                                <h3 className="text-white font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                                    <CheckCircle size={18} className="text-green-500" /> Key Deliverables
                                </h3>
                                {initiative.deliverables?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            className="flex-1 bg-navy-950 border border-white/10 rounded p-2 text-sm text-white"
                                            value={item}
                                            onChange={e => handleArrayChange('deliverables', idx, e.target.value)}
                                            placeholder="Deliverable description..."
                                        />
                                        <button onClick={() => removeArrayItem('deliverables', idx)} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addArrayItem('deliverables')} className="text-sm text-blue-400 hover:text-blue-300 font-medium">+ Add Deliverable</button>
                            </div>

                            {/* Success Criteria */}
                            <div className="space-y-4">
                                <h3 className="text-white font-bold flex items-center gap-2 border-b border-white/10 pb-2">
                                    <TrendingUp size={18} className="text-blue-500" /> Success Criteria
                                </h3>
                                {initiative.successCriteria?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            className="flex-1 bg-navy-950 border border-white/10 rounded p-2 text-sm text-white"
                                            value={item}
                                            onChange={e => handleArrayChange('successCriteria', idx, e.target.value)}
                                            placeholder="KPI or Success Metric..."
                                        />
                                        <button onClick={() => removeArrayItem('successCriteria', idx)} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addArrayItem('successCriteria')} className="text-sm text-blue-400 hover:text-blue-300 font-medium">+ Add Criteria</button>
                            </div>

                            {/* In Scope */}
                            <div className="space-y-4 bg-green-500/5 p-4 rounded-xl border border-green-500/10">
                                <h3 className="text-green-400 font-bold flex items-center gap-2 border-b border-green-500/10 pb-2">
                                    In Scope
                                </h3>
                                {initiative.scopeIn?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            className="flex-1 bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
                                            value={item}
                                            onChange={e => handleArrayChange('scopeIn', idx, e.target.value)}
                                            placeholder="Included item..."
                                        />
                                        <button onClick={() => removeArrayItem('scopeIn', idx)} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addArrayItem('scopeIn')} className="text-sm text-green-400 hover:text-green-300 font-medium">+ Add Item</button>
                            </div>

                            {/* Out Scope */}
                            <div className="space-y-4 bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                                <h3 className="text-red-400 font-bold flex items-center gap-2 border-b border-red-500/10 pb-2">
                                    Out Scope
                                </h3>
                                {initiative.scopeOut?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            className="flex-1 bg-navy-900 border border-white/10 rounded p-2 text-sm text-white"
                                            value={item}
                                            onChange={e => handleArrayChange('scopeOut', idx, e.target.value)}
                                            placeholder="Excluded item..."
                                        />
                                        <button onClick={() => removeArrayItem('scopeOut', idx)} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addArrayItem('scopeOut')} className="text-sm text-red-400 hover:text-red-300 font-medium">+ Add Item</button>
                            </div>
                        </div>
                    )}

                    {/* EXECUTION & RISKS TAB */}
                    {activeTab === 'execution' && (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h3 className="text-white font-bold mb-4">Timeline & Milestones</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Start Date">
                                        <input type="date"
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                            value={initiative.startDate ? initiative.startDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, startDate: e.target.value })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="End Date">
                                        <input type="date"
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                            value={initiative.endDate ? initiative.endDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, endDate: e.target.value })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="Pilot End">
                                        <input type="date"
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                            value={initiative.pilotEndDate ? initiative.pilotEndDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, pilotEndDate: e.target.value })}
                                        />
                                    </InputGroup>
                                </div>

                                {/* Milestones UI */}
                                <div className="bg-navy-950 rounded-xl p-4 border border-white/5">
                                    <h4 className="text-sm font-bold text-white mb-2 flex justify-between items-center">
                                        <span>Key Milestones</span>
                                        <button onClick={() => {
                                            const newMilestones = [...(initiative.milestones || []), { name: '', date: '', status: 'pending' as const }];
                                            // TODO: Fix type definitions
                                            setInitiative({ ...initiative, milestones: newMilestones });
                                        }} className="text-xs text-blue-400 hover:text-white">+ Add</button>
                                    </h4>
                                    <div className="space-y-2">
                                        {initiative.milestones?.map((m, idx: number) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="date"
                                                    className="w-24 bg-navy-900 border border-white/10 rounded p-1 text-xs text-white"
                                                    value={m.date}
                                                    onChange={e => {
                                                        const list = [...(initiative.milestones || [])];

                                                        list[idx] = { ...m, date: e.target.value };

                                                        setInitiative({ ...initiative, milestones: list });
                                                    }}
                                                />
                                                <input
                                                    className="flex-1 bg-navy-900 border border-white/10 rounded p-1 text-xs text-white"
                                                    placeholder="Milestone name..."
                                                    value={m.name}
                                                    onChange={e => {
                                                        const list = [...(initiative.milestones || [])];

                                                        list[idx] = { ...m, name: e.target.value };

                                                        setInitiative({ ...initiative, milestones: list });
                                                    }}
                                                />
                                                <button onClick={() => {
                                                    const list = [...(initiative.milestones || [])];
                                                    list.splice(idx, 1);
                                                    // TODO: Fix type definitions
                                                    setInitiative({ ...initiative, milestones: list });
                                                }} className="text-slate-500 hover:text-red-500"><X size={14} /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-navy-950 rounded-xl p-4 border border-white/5">
                                    <h4 className="text-sm font-bold text-white mb-2">Required Competencies</h4>
                                    <input
                                        className="w-full bg-navy-900 border border-white/10 rounded p-2 text-sm text-slate-300"
                                        placeholder="e.g. UX Design, Python, Data Science (comma separated)"
                                        value={initiative.competenciesRequired?.join(', ') || ''}
                                        onChange={e => setInitiative({ ...initiative, competenciesRequired: e.target.value.split(',').map(s => s.trim()) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-orange-500" /> Key Risks
                                </h3>
                                {/* Simplified Risk Input for now (future: array of objects) */}
                                <div className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4">
                                    <p className="text-sm text-orange-200 mb-2">Identify top 3-5 risks that could derail this initiative.</p>
                                    {/* We are storing risks as simple array in JSON for this iteration, or strictly adhering to types updated */}
                                    {/* Currently logic stores keyRisks as JSON array. Let's make it simple strings for now or update UI for complex objects later. */}
                                    {/* To match updated types { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[] */}
                                    {initiative.keyRisks?.map((risk, idx: number) => (
                                        <div key={idx} className="mb-4 bg-navy-900 p-3 rounded border border-white/5">
                                            <input
                                                className="w-full bg-transparent border-b border-white/10 mb-2 text-sm text-white focus:outline-none"
                                                placeholder="Risk description..."
                                                value={risk.risk || ''}
                                                onChange={e => {
                                                    const newRisks = [...(initiative.keyRisks || [])];
                                                    newRisks[idx] = { ...risk, risk: e.target.value };
                                                    setInitiative({ ...initiative, keyRisks: newRisks });
                                                }}
                                            />
                                            <input
                                                className="w-full bg-transparent text-xs text-slate-400 focus:outline-none"
                                                placeholder="Mitigation strategy..."
                                                value={risk.mitigation || ''}
                                                onChange={e => {
                                                    const newRisks = [...(initiative.keyRisks || [])];
                                                    newRisks[idx] = { ...risk, mitigation: e.target.value };
                                                    setInitiative({ ...initiative, keyRisks: newRisks });
                                                }}
                                            />
                                            <button onClick={() => {
                                                const newRisks = [...(initiative.keyRisks || [])];
                                                newRisks.splice(idx, 1);
                                                setInitiative({ ...initiative, keyRisks: newRisks });
                                            }} className="text-xs text-red-500 mt-2">Remove</button>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const newRisks = [...(initiative.keyRisks || [])];
                                        newRisks.push({ risk: '', mitigation: '', metric: 'Medium' });
                                        setInitiative({ ...initiative, keyRisks: newRisks });
                                    }}>+ Add Risk</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ECONOMICS TAB */}
                    {activeTab === 'economics' && (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <InputGroup label="Business Value">
                                    <select
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                        value={initiative.businessValue}
                                        onChange={e => setInitiative({ ...initiative, businessValue: e.target.value as 'High' | 'Medium' | 'Low' })}
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </InputGroup>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="CAPEX Est. ($)">
                                        <input type="number"
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                            value={initiative.costCapex || 0}
                                            onChange={e => setInitiative({ ...initiative, costCapex: parseInt(e.target.value) })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="OPEX Est. ($)">
                                        <input type="number"
                                            className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white"
                                            value={initiative.costOpex || 0}
                                            onChange={e => setInitiative({ ...initiative, costOpex: parseInt(e.target.value) })}
                                        />
                                    </InputGroup>
                                </div>

                                <InputGroup label="Expected ROI (x)">
                                    <input type="number" step="0.1"
                                        className="w-full bg-navy-950 border border-white/10 rounded p-2 text-white font-bold text-green-400"
                                        value={initiative.expectedRoi || 0}
                                        onChange={e => setInitiative({ ...initiative, expectedRoi: parseFloat(e.target.value) })}
                                    />
                                </InputGroup>
                            </div>

                            <div className="bg-navy-950 rounded-xl p-6 border border-white/5 flex flex-col items-center justify-center text-center">
                                <TrendingUp size={48} className="text-green-500 mb-4 opacity-50" />
                                <h3 className="text-xl font-bold text-white mb-2">Financial Summary</h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    Total Investment: <span className="text-white font-mono">${((initiative.costCapex || 0) + (initiative.costOpex || 0)).toLocaleString()}</span>
                                </p>
                                <div className="w-full bg-navy-900 rounded-lg p-4 border border-white/5">
                                    <span className="text-xs uppercase text-slate-500">Social Impact</span>
                                    <p className="text-white mt-1">{initiative.socialImpact || 'Not defined'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="h-20 border-t border-white/5 bg-navy-950 px-6 flex items-center justify-between shrink-0">
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-sm font-medium">Cancel</button>
                    <Button onClick={handleSave} icon={<Save size={18} />}>Save Initiative Charter</Button>
                </div>

            </div>
        </div>
    );
};

// Helper for Input fields
const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="mb-4">
        <label className="block text-xs uppercase text-slate-500 font-bold mb-1">{label}</label>
        {children}
    </div>
);
