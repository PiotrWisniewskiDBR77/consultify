import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, InitiativeStatus } from '../types';
import {
    Target, Users, Calendar, BarChart2, CheckCircle,
    AlertTriangle, Play, Edit3, Save, X, Lightbulb, ShieldAlert
} from 'lucide-react';

interface FullPilotWorkspaceProps {
    fullSession: FullSession;
    pilotInitiative: FullInitiative;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onNextStep: () => void;
    language: Language;
}

type PilotTab = 'design' | 'team' | 'control' | 'health' | 'evaluation';

export const FullPilotWorkspace: React.FC<FullPilotWorkspaceProps> = ({
    fullSession: _fullSession,
    pilotInitiative,
    onUpdateInitiative,
    onNextStep,
    language: _language
}) => {
    const [activeTab, setActiveTab] = useState<PilotTab>('design');
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

    // --- 4.1 DESIGN / SETUP TAB ---
    const renderDesign = () => {
        const hypotheses = isEditing ? editData.hypotheses : pilotInitiative.hypotheses;
        const killCriteria = isEditing ? editData.killCriteria : pilotInitiative.killCriteria;
        const scopeIn = isEditing ? editData.scopeIn : pilotInitiative.scopeIn;
        const scopeOut = isEditing ? editData.scopeOut : pilotInitiative.scopeOut;

        const isReadyToStart = (pilotInitiative.hypotheses?.length || 0) > 0 &&
            (pilotInitiative.killCriteria?.length || 0) > 0;

        return (
            <div className="space-y-8">
                {/* Header Section */}
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Experiment Design</h2>
                        <p className="text-slate-400">Define the parameters of your management experiment.</p>
                    </div>
                    {!isEditing && pilotInitiative.status !== 'Validating' && (
                        <div className="flex gap-4">
                            {!isReadyToStart ? (
                                <div className="px-4 py-2 bg-slate-800 rounded-lg text-slate-400 text-sm flex items-center gap-2 border border-slate-700">
                                    <AlertTriangle size={16} /> Complete Setup to Start
                                </div>
                            ) : (
                                <button
                                    onClick={() => onUpdateInitiative({ ...pilotInitiative, status: 'Validating' as InitiativeStatus })}
                                    className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
                                >
                                    <Play size={18} /> Start Pilot Execution
                                </button>
                            )}
                        </div>
                    )}
                    {pilotInitiative.status === 'Validating' && (
                        <div className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-bold flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            LIVE: Validating Hypotheses
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Hypotheses (MANDATORY) */}
                    <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border-l-4 border-l-purple-500 border-t border-b border-r border-slate-200 dark:border-white/5">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                            <Lightbulb size={20} className="text-purple-400" />
                            Hypotheses
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded ml-2">MANDATORY</span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Format: "If we do X, then Y will happen because Z"</p>

                        {isEditing ? (
                            <textarea
                                className="w-full h-40 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                value={editData.hypotheses?.join('\n') || ''}
                                onChange={e => setEditData({ ...editData, hypotheses: e.target.value.split('\n') })}
                                placeholder="- If we automate invoicing, then processing time drops 50% because..."
                            />
                        ) : (
                            <ul className="space-y-3">
                                {hypotheses?.map((h, i) => (
                                    <li key={i} className="flex gap-3 text-slate-300 bg-navy-950/50 p-3 rounded">
                                        <span className="font-mono text-purple-500">H{i + 1}</span>
                                        {h}
                                    </li>
                                )) || <li className="text-slate-500 italic">No hypotheses defined.</li>}
                            </ul>
                        )}
                    </div>

                    {/* 2. Kill Criteria (MANDATORY) */}
                    <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border-l-4 border-l-red-500 border-t border-b border-r border-slate-200 dark:border-white/5">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-white mb-4">
                            <ShieldAlert size={20} className="text-red-400" />
                            Kill Criteria
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded ml-2">MANDATORY</span>
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">Conditions under which we STOP the pilot immediately.</p>

                        {isEditing ? (
                            <textarea
                                className="w-full h-40 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none"
                                value={editData.killCriteria?.join('\n') || ''}
                                onChange={e => setEditData({ ...editData, killCriteria: e.target.value.split('\n') })}
                                placeholder="- Cost exceeds $50k&#10;- User adoption < 10% after week 2"
                            />
                        ) : (
                            <ul className="space-y-3">
                                {killCriteria?.map((k, i) => (
                                    <li key={i} className="flex gap-3 text-slate-300 bg-navy-950/50 p-3 rounded">
                                        <X size={16} className="text-red-500 mt-1" />
                                        {k}
                                    </li>
                                )) || <li className="text-slate-500 italic">No kill criteria defined.</li>}
                            </ul>
                        )}
                    </div>

                    {/* 3. Scope In / Out (Optional but recommended) */}
                    <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                        <h3 className="text-lg font-bold text-green-500 mb-4 flex items-center gap-2"><CheckCircle size={18} /> In Scope</h3>
                        {isEditing ? (
                            <textarea
                                className="w-full h-32 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm"
                                value={editData.scopeIn?.join('\n') || ''}
                                onChange={e => setEditData({ ...editData, scopeIn: e.target.value.split('\n') })}
                            />
                        ) : (
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                                {scopeIn?.map((s, i) => <li key={i}>{s}</li>) || <li>No items</li>}
                            </ul>
                        )}
                    </div>

                    <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                        <h3 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2"><X size={18} /> Out of Scope</h3>
                        {isEditing ? (
                            <textarea
                                className="w-full h-32 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm"
                                value={editData.scopeOut?.join('\n') || ''}
                                onChange={e => setEditData({ ...editData, scopeOut: e.target.value.split('\n') })}
                            />
                        ) : (
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                                {scopeOut?.map((s, i) => <li key={i}>{s}</li>) || <li>No items</li>}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderTeam = () => (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
            <h3 className="text-xl font-bold mb-6">Pilot Team Structure</h3>
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

    // --- 4.2 EXECUTION / CONTROL TAB ---
    const renderControl = () => (
        <div className="flex h-[calc(100vh-280px)] gap-6 overflow-hidden">

            {/* LEFT: Task Board (Kanban style) */}
            <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/5 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <Calendar size={18} className="text-blue-500" />
                        Hypothesis Validation Tasks
                    </h3>
                    <button className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        + Add Task
                    </button>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                    <div className="flex h-full gap-4 min-w-[800px]">
                        {[
                            { id: 'planned', label: 'Planned', color: 'border-slate-300' },
                            { id: 'in_progress', label: 'In Progress', color: 'border-blue-500' },
                            { id: 'blocked', label: 'Blocked', color: 'border-red-500' },
                            { id: 'validated', label: 'Validated', color: 'border-green-500' }
                        ].map(col => (
                            <div key={col.id} className="flex-1 flex flex-col min-w-[200px] bg-slate-50 dark:bg-navy-950/50 rounded-lg p-3">
                                <div className={`text-xs font-bold uppercase mb-3 pl-2 border-l-2 ${col.color} text-slate-500`}>
                                    {col.label}
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                    {/* MOCK TASKS FOR UI DEMO - Replace with real tasks filter later */}
                                    {col.id === 'planned' && (
                                        <div className="bg-white dark:bg-navy-800 p-3 rounded shadow-sm border border-slate-200 dark:border-white/5 text-sm cursor-pointer hover:border-blue-500 transition-colors">
                                            <div className="text-xs text-slate-400 mb-1">H1 Validation</div>
                                            <div className="font-semibold mb-2">Setup A/B test for pricing</div>
                                            <div className="flex items-center justify-between">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-[10px]">JD</div>
                                                <span className="text-[10px] text-slate-400">Oct 24</span>
                                            </div>
                                        </div>
                                    )}
                                    {col.id === 'in_progress' && (
                                        <div className="bg-white dark:bg-navy-800 p-3 rounded shadow-sm border border-slate-200 dark:border-white/5 text-sm cursor-pointer border-l-2 border-l-blue-500">
                                            <div className="text-xs text-slate-400 mb-1">H2 Validation</div>
                                            <div className="font-semibold mb-2">Interview 5 Key Stakeholders</div>
                                            <div className="flex items-center justify-between">
                                                <div className="w-5 h-5 rounded-full bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200 flex items-center justify-center text-[10px]">PW</div>
                                                <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-1 rounded">Today</span>
                                            </div>
                                        </div>
                                    )}
                                    {col.id === 'validated' && (
                                        <div className="bg-white dark:bg-navy-800 p-3 rounded shadow-sm border border-slate-200 dark:border-white/5 text-sm opacity-60">
                                            <div className="text-xs text-slate-400 mb-1">H1 Validation</div>
                                            <div className="font-semibold mb-2 line-through">Define success metrics</div>
                                            <div className="flex items-center gap-1 text-green-500 text-[10px] font-bold">
                                                <CheckCircle size={10} /> Validated
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT: Risks & Blockers */}
            <div className="w-80 flex flex-col gap-6">
                {/* Blockers */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4 flex-1">
                    <h3 className="font-bold text-red-500 flex items-center gap-2 mb-4">
                        <AlertTriangle size={18} /> Top Blockers
                    </h3>
                    <div className="space-y-3">
                        {/* Mock Blocker */}
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/20 rounded-lg text-sm">
                            <div className="font-semibold text-red-700 dark:text-red-400 mb-1">Budget Approval Pending</div>
                            <p className="text-xs text-red-600/70 dark:text-red-400/70">CFO sign-off required for external tooling.</p>
                        </div>
                        <button className="w-full py-2 text-xs font-bold text-slate-500 hover:text-red-500 border border-dashed border-slate-300 dark:border-slate-700 rounded transition-colors">
                            + Report Blocker
                        </button>
                    </div>
                </div>

                {/* AI Actions */}
                <div className="bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm mb-3">AI Pilot Assistant</h3>
                    <div className="space-y-2">
                        <button className="w-full text-left p-2.5 bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-white/5 hover:border-purple-500 transition-colors flex items-center gap-2 text-xs font-medium">
                            <span>🤖</span> Review Pilot Pace
                        </button>
                        <button className="w-full text-left p-2.5 bg-white dark:bg-navy-800 rounded border border-slate-200 dark:border-white/5 hover:border-purple-500 transition-colors flex items-center gap-2 text-xs font-medium">
                            <span>📉</span> Analyze Risks
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- 4.3 HEALTH / SIGNALS TAB ---
    const renderHealth = () => (
        <div className="space-y-6">

            {/* Top Row: Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Pilot Velocity (Burndown)</h4>
                    <div className="flex items-end gap-2 h-32 mb-2">
                        {/* Mock Charts */}
                        <div className="w-8 bg-blue-200 rounded-t h-[80%]"></div>
                        <div className="w-8 bg-blue-300 rounded-t h-[60%]"></div>
                        <div className="w-8 bg-blue-400 rounded-t h-[50%]"></div>
                        <div className="w-8 bg-blue-500 rounded-t h-[45%]"></div>
                        <div className="w-8 bg-blue-600 rounded-t h-[30%] animate-pulse"></div>
                    </div>
                    <div className="text-right text-xs text-green-500 font-bold">On Track vs Plan</div>
                </div>

                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Hypothesis Coverage</h4>
                    <div className="relative w-32 h-32 mx-auto">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-navy-800" />
                            <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray="351" strokeDashoffset="100" className="text-purple-500" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                            72%
                        </div>
                    </div>
                    <div className="text-center mt-2 text-xs text-slate-500">2 of 3 Hypotheses Validated</div>
                </div>

                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-4">Risk Pulse</h4>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Critical</span>
                            <span className="font-bold">1</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> High</span>
                            <span className="font-bold">2</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Medium</span>
                            <span className="font-bold">4</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Signals & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-900 text-white p-6 rounded-xl border border-white/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-6 relative z-10">
                        <span className="text-2xl">📡</span> AI Early Signals
                    </h3>

                    <div className="space-y-4 relative z-10">
                        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/5">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-400 mt-1 shrink-0" size={18} />
                                <div>
                                    <div className="font-bold text-amber-100 text-sm mb-1">Drift Detected</div>
                                    <p className="text-xs text-slate-300">Execution tasks are diverging from <span className="text-white font-mono">H1 (Pricing)</span>. The team is spending 60% of time on technical refactoring not directly related to validation.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/5">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="text-green-400 mt-1 shrink-0" size={18} />
                                <div>
                                    <div className="font-bold text-green-100 text-sm mb-1">Positive Signal</div>
                                    <p className="text-xs text-slate-300">Stakeholder interviews (Task-102) are showing 90% positive sentiment, exceeding the 70% success criteria.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                    <h3 className="font-bold text-lg mb-6">Recent Activity Log</h3>
                    <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-navy-700">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="relative pl-10">
                                <div className="absolute left-0 top-1 w-10 h-10 flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-navy-600 border-2 border-white dark:border-navy-900"></div>
                                </div>
                                <div className="text-sm">
                                    <span className="font-bold text-navy-900 dark:text-white">John Doe</span> updated task <span className="font-mono text-xs text-blue-500">T-124</span> status to <span className="font-bold text-green-500">Validated</span>
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">2 hours ago</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    // --- 4.4 PILOT REVIEW / DECISION ---
    const renderEvaluation = () => (
        <div className="space-y-8">
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 p-6 rounded-xl">
                <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300 mb-2">Pilot Conclusion</h2>
                <p className="text-blue-700/80 dark:text-blue-200/70 text-sm">
                    The pilot phase is complete. Based on the validation data and learnings, make a strategic decision for this initiative.
                    <br />This decision is final for the current pilot iteration.
                </p>
            </div>

            {/* 1. Learning Block (Mandatory) */}
            <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5">
                <h3 className="flex items-center gap-2 text-lg font-bold mb-6">
                    <Lightbulb size={20} className="text-yellow-500" />
                    Key Learnings (Mandatory)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">What Worked?</label>
                        <textarea
                            className="w-full h-32 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm focus:border-green-500 outline-none"
                            placeholder="- New pricing model increased conversion by 15%..."
                        ></textarea>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-2">What didn't work / Surprises?</label>
                        <textarea
                            className="w-full h-32 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none"
                            placeholder="- Customer support was overwhelmed..."
                        ></textarea>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-slate-500 mb-2">Recommendation for Next Steps</label>
                        <textarea
                            className="w-full h-24 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm focus:border-blue-500 outline-none"
                            placeholder="We should proceed with scaling but invest in support automation first..."
                        ></textarea>
                    </div>
                </div>
            </div>

            {/* 2. Final Decision */}
            <div>
                <h3 className="flex items-center gap-2 text-lg font-bold mb-6">
                    <CheckCircle size={20} className="text-slate-400" />
                    Strategic Decision
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-transform shadow-sm hover:shadow-xl hover:shadow-green-500/10"
                        onClick={onNextStep}>
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 ring-4 ring-green-500/10">
                            <Play size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">SCALE</h3>
                        <p className="text-green-600/70 dark:text-green-400/70 mt-2 text-sm">
                            Hypothesis Validated.<br />Move to Rollout (Module 5).
                        </p>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-transform shadow-sm hover:shadow-xl hover:shadow-amber-500/10">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10">
                            <Edit3 size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-amber-700 dark:text-amber-400">ITERATE</h3>
                        <p className="text-amber-600/70 dark:text-amber-400/70 mt-2 text-sm">
                            Partially Validated.<br />Adjust hypothesis & re-run.
                        </p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:scale-105 transition-transform shadow-sm hover:shadow-xl hover:shadow-red-500/10">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400 ring-4 ring-red-500/10">
                            <X size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-red-700 dark:text-red-400">KILL</h3>
                        <p className="text-red-600/70 dark:text-red-400/70 mt-2 text-sm">
                            Hypothesis Failed.<br />Stop investment & Archive.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Tab Content Switcher
    const renderContent = () => {
        switch (activeTab) {
            case 'design': return renderDesign(); // 4.1
            case 'team': return renderTeam();
            case 'control': return renderControl(); // 4.2
            case 'health': return renderHealth(); // 4.3
            case 'evaluation': return renderEvaluation(); // 4.4
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white">
            {/* Header */}
            <div className="h-20 border-b border-slate-200 dark:border-white/10 px-8 flex items-center justify-between bg-white/50 dark:bg-navy-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div>
                    <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <span>MODULE 4: PILOT EXECUTION</span>
                        {pilotInitiative.status === 'Validating' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>}
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-3 text-navy-900 dark:text-white">
                        {pilotInitiative.name}
                        {pilotInitiative.status === 'Validating' && <span className="text-xs bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700 px-2 py-1 rounded">LIVE</span>}
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    {isEditing ? (
                        <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold transition-colors text-white">
                            <Save size={16} /> Save Changes
                        </button>
                    ) : (
                        <button onClick={startEdit} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 rounded-lg text-sm font-bold transition-colors border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white">
                            <Edit3 size={16} /> Edit Design
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation Tabs (Updated Structure) */}
            <div className="flex border-b border-slate-200 dark:border-white/10 px-8 gap-8 mt-4">
                {[
                    { id: 'design', label: '1. Design', icon: Target }, // 4.1 Scope -> Design
                    { id: 'team', label: '2. Team', icon: Users },
                    { id: 'control', label: '3. Control', icon: Calendar }, // 4.2 Plan -> Control
                    { id: 'health', label: '4. Health', icon: BarChart2 }, // 4.3 KPIs -> Health
                    { id: 'evaluation', label: '5. Decision', icon: CheckCircle }, // 4.4 Eval -> Decision
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as PilotTab)}
                        className={`pb-4 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-purple-500 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-navy-950">
                <div className="max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
