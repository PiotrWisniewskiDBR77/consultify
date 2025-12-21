
import React, { useState, useMemo, useCallback } from 'react';
import { FullInitiative, User, StrategicIntent, StakeholderImpact, StrategicGoal } from '../types';

import {
    X, Save, Target, TrendingUp, DollarSign,
    Calendar, Users, CheckCircle,
    AlertTriangle, FileText, Globe, Sparkles, Brain, AlertOctagon
} from 'lucide-react';
import { Button } from './Button';
import { Select } from './Select';
import { InitiativeTasksTab } from './InitiativeTasksTab';
import { InitiativeIntelligenceTab } from './InitiativeIntelligenceTab';

interface InitiativeDetailModalProps {
    initiative: FullInitiative;
    isOpen: boolean;
    onClose: () => void;
    onSave: (initiative: FullInitiative) => void;
    users?: User[];
    currentUser?: User | null; // Added currentUser
    strategicGoals?: StrategicGoal[];
}

export const InitiativeDetailModal: React.FC<InitiativeDetailModalProps> = React.memo(({
    initiative: initialInitiative,
    isOpen,
    onClose,
    onSave,
    users = [],
    currentUser,
    strategicGoals = []
}) => {
    const [initiative, setInitiative] = useState<FullInitiative>({ ...initialInitiative });
    const [activeTab, setActiveTab] = useState<'overview' | 'definition' | 'execution' | 'tasks' | 'economics' | 'intelligence'>('overview');
    const [isGenerating, setIsGenerating] = useState(false);

    // OPTIMIZED: Memoized calculations to avoid recalculation on every render
    const calculateReadiness = useCallback(() => {
        // 1. Strategic (20%)
        let strategic = 0;
        if (initiative.name && initiative.name.length > 5) strategic += 5;
        if (initiative.strategicIntent) strategic += 5;
        if (initiative.axis) strategic += 5;
        if (initiative.applicantOneLiner && initiative.applicantOneLiner.length > 10) strategic += 5;

        // 2. Problem (20%)
        let problem = 0;
        if (initiative.problemStructured?.symptom) problem += 5;
        if (initiative.problemStructured?.rootCause) problem += 5;
        if (initiative.stakeholders && initiative.stakeholders.length > 0) problem += 5;
        if (initiative.hypothesis) problem += 5;

        // 3. Target (20%)
        let target = 0;
        if (initiative.targetState?.process?.length) target += 6;
        if (initiative.targetState?.behavior?.length) target += 7;
        if (initiative.targetState?.capability?.length) target += 7;

        // 4. Execution (20%)
        let execution = 0;
        if (initiative.killCriteria) execution += 10;
        if (initiative.keyRisks && initiative.keyRisks.length > 2) execution += 10;

        // 5. Value (20%) - Placeholder until Task 6
        let value = 0;
        if (initiative.businessValue) value += 20;

        const total = strategic + problem + target + execution + value;
        return { total, details: { strategic, problem, target, execution, value } };
    };

    const readinessData = calculateReadiness();
    const readiness = readinessData.total;
    const isReady = readiness >= 80;

    // OPTIMIZED: Memoized callbacks to prevent unnecessary re-renders
    const generateSummary = useCallback(() => {
        // Mock generation
        setInitiative(prev => ({
            ...prev,
            summary: `** Executive Summary(AI Generated) **\n\nThis initiative aims to ${prev.strategicIntent?.toLowerCase() || 'improve'} the organization by addressing ${prev.problemStatement?.slice(0, 30)}...\n\nIt is aligned with our goal to ${prev.applicantOneLiner || 'drive value'}.`
        }));
    }, []);

    const generateExecutionStrategy = useCallback(async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/execution-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initiative, userId: currentUser?.id })
            });
            if (!res.ok) throw new Error("AI Generation Failed");

            const data = await res.json();

            setInitiative(prev => ({
                ...prev,
                killCriteria: data.killCriteria,
                keyRisks: data.keyRisks?.map((r: any) => ({ ...r, metric: r.metric as any })) || [],
                milestones: data.milestones?.map((m: any) => ({ ...m, isDecisionGate: !!m.isDecisionGate, decision: m.decision || 'continue' })) || []
            }));
        } catch (error) {
            console.error(error);
            alert("Failed to generate strategy via AI. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    const handleCheckStrategicFit = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/strategic-fit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initiative, strategicGoals, userId: currentUser?.id })
            });
            if (!res.ok) throw new Error("AI Generation Failed");

            const data = await res.json();
            setInitiative(prev => ({
                ...prev,
                strategicFit: data
            }));
        } catch (error) {
            console.error(error);
            alert("Failed to check Strategic Fit via AI.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateList = async (targetField: any, subField: string | null = null) => {
        setIsGenerating(true);
        try {
            const contextStr = `Initiative: ${initiative.name}\nObjective: ${initiative.applicantOneLiner}`;
            let listType = targetField;
            if (subField) listType += ` (${subField})`;

            const res = await fetch('/api/ai/generate-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ context: contextStr, listType, count: 3, userId: currentUser?.id })
            });
            const items = await res.json();

            if (!Array.isArray(items)) return;

            setInitiative(prev => {
                const copy = { ...prev };
                if (targetField === 'targetState' && subField) {
                    const ts = { ...copy.targetState } as any;
                    ts[subField] = [...(ts[subField] || []), ...items];
                    copy.targetState = ts;
                }
                else if (targetField === 'deliverables') {
                    copy.deliverables = [...(copy.deliverables || []), ...items];
                }
                else if (targetField === 'scopeIn') {
                    copy.scopeIn = [...(copy.scopeIn || []), ...items];
                }
                else if (targetField === 'scopeOut') {
                    copy.scopeOut = [...(copy.scopeOut || []), ...items];
                }
                else if (targetField === 'assumptions' && subField) {
                    const assum = { ...copy.assumptions } as any;
                    // For assumptions we want a single string usually, but if list returned, join it or take first?
                    // The UI has inputs, not lists for assumptions.
                    // Wait, existing UI: input value={initiative.assumptions?.org}.
                    // So we expect a single string.
                    // I will change generate-list to just return one string if we request count=1 or join them.
                    assum[subField] = items.join('. ');
                    copy.assumptions = assum;
                }
                else if (targetField === 'successCriteria') {
                    const newCriteria = items.map((val: string) => ({ type: 'Metric' as const, value: val }));
                    copy.structuredSuccessCriteria = [...(copy.structuredSuccessCriteria || []), ...newCriteria];
                }
                return copy;
            });

        } catch (e) {
            console.error("AI List Gen Error", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        // Validation
        if (!initiative.strategicIntent) {
            alert("Strategic Intent is mandatory.");
            return;
        }
        if (!initiative.applicantOneLiner || initiative.applicantOneLiner.length < 10) {
            alert("Executive One-Liner is mandatory and must be meaningful.");
            return;
        }
        // AI Behavior: Block generic descriptions
        const isGeneric = (text?: string) => !text || text.includes("Brief overview") || text.length < 50;
        if (isGeneric(initiative.summary)) {
            alert("Executive Summary is too generic or short. Please elaborate.");
            return;
        }

        if (!initiative.killCriteria || initiative.killCriteria.length < 10) {
            alert("Kill Criteria is mandatory. Please define under what conditions this initiative should be stopped.");
            return;
        }

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-sm p-4 transition-all">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="h-16 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-6 bg-slate-50 dark:bg-navy-950">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400`}>
                            <Target size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-navy-900 dark:text-white">Initiative Charter</h2>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="uppercase">{initiative.id ? `ID: ${initiative.id.slice(0, 8)} ` : 'New Initiative'}</span>
                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                <span className="uppercase text-blue-400">{initiative.status?.replace('_', ' ') || 'DRAFT'}</span>
                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                <div className="flex items-center gap-1 text-blue-400">
                                    <TrendingUp size={12} />
                                    <span>Progress: {initiative.progress || 0}%</span>
                                </div>
                                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                                <div className={`flex items-center gap-1 ${isReady ? 'text-green-400' : 'text-orange-400'} `}>
                                    <Brain size={12} />
                                    <span>Readiness: {readiness}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={onClose}><X size={20} /></Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900/50 px-6 gap-6">
                    {[
                        { id: 'overview', label: 'Overview', icon: FileText },
                        { id: 'tasks', label: 'Tasks', icon: CheckCircle }, // New Tab
                        { id: 'definition', label: 'Definition & Scope', icon: Target },
                        { id: 'execution', label: 'Execution & Risks', icon: Calendar },
                        { id: 'economics', label: 'Value & Finance', icon: DollarSign },
                        { id: 'intelligence', label: 'Intelligence', icon: Brain },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                                ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-500'
                                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-navy-900 dark:hover:text-white'
                                } `}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-navy-900">

                    {/* TASKS TAB */}
                    {activeTab === 'tasks' && (
                        <InitiativeTasksTab
                            initiativeId={initiative.id}
                            users={users}
                            currentUser={currentUser!}
                            initiative={initiative}
                        />
                    )}

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 pb-10">
                            {/* 1. Decision Framing */}
                            <div className="bg-slate-50 dark:bg-navy-950 p-5 rounded-xl border border-slate-200 dark:border-blue-500/30 shadow-sm dark:shadow-blue-900/10 flex items-start gap-6">
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-2">
                                        <AlertOctagon size={14} /> Decision to be made
                                    </label>
                                    <input
                                        className="w-full bg-white dark:bg-navy-900 border-b-2 border-blue-500/50 text-xl font-bold text-navy-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 py-2 placeholder:text-slate-400 dark:placeholder:text-blue-900/50"
                                        placeholder="e.g. Approve Pilot Budget of $50k"
                                        value={initiative.decisionToMake || ''}
                                        onChange={e => setInitiative({ ...initiative, decisionToMake: e.target.value })}
                                    />
                                    <p className="text-xs text-slate-500">Define the specific decision executives need to make today.</p>
                                </div>
                                <div className="w-64 space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Decision Owner</label>
                                    <Select
                                        value={initiative.decisionOwnerId || ''}
                                        onChange={(val) => setInitiative({ ...initiative, decisionOwnerId: val })}
                                        placeholder="Select Owner..."
                                        options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
                                    />
                                </div>
                            </div>

                            {/* 2. Executive Definition */}
                            <div className="grid grid-cols-12 gap-6">
                                <div className="col-span-8 space-y-6">
                                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5 space-y-4">
                                        <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                            <Sparkles size={16} className="text-purple-600 dark:text-purple-400" /> Executive One-Liner
                                        </h3>
                                        <div className="bg-white dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-white/5 space-y-3">
                                            <p className="text-xs text-slate-500 font-mono mb-2">Structure: Achieve [X] by changing [Y] so that [Z improves]</p>
                                            <textarea
                                                className="w-full bg-transparent text-lg font-medium text-navy-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none h-20"
                                                placeholder="This initiative exists to..."
                                                value={initiative.applicantOneLiner || ''}
                                                onChange={e => setInitiative({ ...initiative, applicantOneLiner: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5 space-y-4">
                                        <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                            <AlertTriangle size={16} className="text-orange-500 dark:text-orange-400" /> Problem Statement (The Why)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Symptom</label>
                                                <input
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white text-sm"
                                                    placeholder="What is visible?"
                                                    value={initiative.problemStructured?.symptom || ''}
                                                    onChange={e => setInitiative({ ...initiative, problemStructured: { ...initiative.problemStructured || { symptom: '', rootCause: '', costOfInaction: '' }, symptom: e.target.value } })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Root Cause</label>
                                                <input
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white text-sm"
                                                    placeholder="Why is it happening?"
                                                    value={initiative.problemStructured?.rootCause || ''}
                                                    onChange={e => setInitiative({ ...initiative, problemStructured: { ...initiative.problemStructured || { symptom: '', rootCause: '', costOfInaction: '' }, rootCause: e.target.value } })}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Cost of Inaction</label>
                                                <input
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white text-sm"
                                                    placeholder="What if we do nothing?"
                                                    value={initiative.problemStructured?.costOfInaction || ''}
                                                    onChange={e => setInitiative({ ...initiative, problemStructured: { ...initiative.problemStructured || { symptom: '', rootCause: '', costOfInaction: '' }, costOfInaction: e.target.value } })}
                                                />
                                            </div>

                                            {/* Legacy Textarea Fallback (if user wants to write generic text) */}
                                            <div className="col-span-2 mt-2">
                                                <p className="text-xs text-slate-600 mb-1">Full Description (Legacy)</p>
                                                <textarea
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-slate-600 dark:text-slate-400 text-xs h-16 resize-none"
                                                    value={initiative.problemStatement || ''}
                                                    onChange={e => setInitiative({ ...initiative, problemStatement: e.target.value })}
                                                    placeholder="Additional context..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Basic Fields */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <InputGroup label="Initiative Name">
                                            <input
                                                className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                                                value={initiative.name}
                                                onChange={e => setInitiative({ ...initiative, name: e.target.value })}
                                            />
                                        </InputGroup>
                                        <InputGroup label="Strategic Intent">
                                            <Select
                                                value={initiative.strategicIntent || ''}
                                                onChange={(val) => setInitiative({ ...initiative, strategicIntent: val as StrategicIntent })}
                                                placeholder="Select Intent..."
                                                options={[
                                                    { value: 'Grow', label: 'Grow' },
                                                    { value: 'Fix', label: 'Fix' },
                                                    { value: 'Stabilize', label: 'Stabilize' },
                                                    { value: 'De-risk', label: 'De-risk' },
                                                    { value: 'Build capability', label: 'Build capability' }
                                                ]}
                                            />
                                        </InputGroup>
                                    </div>
                                </div>

                                <div className="col-span-4 space-y-6">
                                    {/* Strategic Fit Panel */}
                                    <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5 h-full">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-sm font-bold text-navy-900 dark:text-white">Strategic Fit</h3>
                                            <button onClick={handleCheckStrategicFit} disabled={isGenerating} className="text-blue-600 dark:text-blue-400 hover:text-navy-900 dark:hover:text-white">
                                                {isGenerating ? <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin" /> : <Sparkles size={14} />}
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-100 dark:border-white/5">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Alignment with Axis</span>
                                                {initiative.strategicFit?.axisAlign ? <CheckCircle size={14} className="text-green-500" /> : <X size={14} className="text-slate-400 dark:text-slate-600" />}
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-100 dark:border-white/5">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Corporate Goal</span>
                                                {initiative.strategicFit?.goalAlign ? <CheckCircle size={14} className="text-green-500" /> : <X size={14} className="text-slate-400 dark:text-slate-600" />}
                                            </div>
                                            <div className="flex items-center justify-between p-2 bg-white dark:bg-navy-900 rounded border border-slate-100 dark:border-white/5">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">Pain Point</span>
                                                {initiative.strategicFit?.painPointAlign ? <CheckCircle size={14} className="text-green-500" /> : <X size={14} className="text-slate-400 dark:text-slate-600" />}
                                            </div>
                                            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded border border-blue-100 dark:border-blue-500/20">
                                                <p className="text-xs text-blue-700 dark:text-blue-300 italic h-24 overflow-y-auto">
                                                    {initiative.strategicFit?.reasoning || "Click Sparkles to analyze..."}
                                                </p>
                                            </div>

                                            {/* Readiness Breakdown */}
                                            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-white/5">
                                                <h4 className="text-xs font-bold text-navy-900 dark:text-white mb-2">Readiness Score: {readiness}%</h4>
                                                <div className="space-y-1">
                                                    {Object.entries(readinessData.details).map(([key, score]) => (
                                                        <div key={key} className="flex justify-between text-xs text-slate-500 dark:text-slate-400 capitalize">
                                                            <span>{key} ({20}pts)</span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded overflow-hidden">
                                                                    <div className={`h-full ${score >= 20 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(score / 20) * 100}%` }}></div>
                                                                </div>
                                                                <span className={score >= 20 ? 'text-green-500 font-bold' : 'text-slate-500'}>{score}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Target State Snapshot */}
                            <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5">
                                <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2"><Target size={16} className="text-blue-500 dark:text-blue-400" /> Target State Snapshot (After Initiative)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    {['Process', 'Behavior', 'Capability'].map(type => (
                                        <div key={type} className="bg-white dark:bg-navy-900 p-3 rounded-lg border border-slate-200 dark:border-white/5">
                                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 border-b border-slate-100 dark:border-white/5 pb-1 flex justify-between">
                                                {type} Changes
                                                <button onClick={() => handleGenerateList('targetState', type.toLowerCase())} disabled={isGenerating} className="text-blue-500 hover:text-purple-500"><Sparkles size={10} /></button>
                                            </h4>
                                            <div className="space-y-2">
                                                {(initiative.targetState?.[type.toLowerCase() as keyof typeof initiative.targetState] || []).map((item: string, idx: number) => (
                                                    <div key={idx} className="flex gap-1 group">
                                                        <span className="text-blue-500">•</span>
                                                        <input
                                                            className="w-full bg-transparent text-xs text-slate-700 dark:text-slate-300 focus:outline-none border-none p-0"
                                                            value={item}
                                                            onChange={e => {
                                                                const newState = { ...(initiative.targetState || { process: [], behavior: [], capability: [] }) };
                                                                const key = type.toLowerCase() as keyof typeof newState;
                                                                const arr = [...(newState[key] || [])];
                                                                arr[idx] = e.target.value;
                                                                newState[key] = arr;
                                                                setInitiative({ ...initiative, targetState: newState });
                                                            }}
                                                        />
                                                        <button onClick={() => {
                                                            const newState = { ...(initiative.targetState || { process: [], behavior: [], capability: [] }) };
                                                            const key = type.toLowerCase() as keyof typeof newState;
                                                            const arr = [...(newState[key] || [])];
                                                            arr.splice(idx, 1);
                                                            newState[key] = arr;
                                                            setInitiative({ ...initiative, targetState: newState });
                                                        }} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500"><X size={12} /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => {
                                                    const newState = { ...(initiative.targetState || { process: [], behavior: [], capability: [] }) };
                                                    const key = type.toLowerCase() as keyof typeof newState;
                                                    (newState[key] as string[]).push("New item...");
                                                    setInitiative({ ...initiative, targetState: newState });
                                                }} className="text-xs text-blue-500 hover:text-blue-400">+ Add bullet</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. Governance & Evidence */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Attachments */}
                                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5">
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                        <FileText size={16} className="text-blue-500 dark:text-blue-400" /> Evidence & Attachments
                                    </h3>
                                    <div className="space-y-2">
                                        {(initiative.attachments || []).map((att, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-white dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1 bg-blue-100 dark:bg-blue-500/20 rounded"><FileText size={12} className="text-blue-600 dark:text-blue-400" /></div>
                                                    <div>
                                                        <p className="text-xs text-navy-900 dark:text-white font-medium">{att.name}</p>
                                                        <span className="text-[10px] text-slate-500 uppercase">{att.type}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => {
                                                    const list = [...(initiative.attachments || [])];
                                                    list.splice(idx, 1);
                                                    setInitiative({ ...initiative, attachments: list });
                                                }} className="text-slate-600 hover:text-red-500"><X size={12} /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => {
                                            const list = [...(initiative.attachments || [])];
                                            list.push({ id: Date.now().toString(), name: "New Evidence.pdf", type: 'strategy', url: '', uploadedAt: new Date().toISOString() });
                                            setInitiative({ ...initiative, attachments: list });
                                        }} className="text-xs text-blue-500 hover:text-blue-400">+ Add Attachment (Mock)</button>
                                    </div>
                                </div>

                                {/* Change Log */}
                                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5">
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                        <TrendingUp size={16} className="text-purple-600 dark:text-purple-400" /> Strategic Change Log
                                    </h3>
                                    <div className="space-y-3">
                                        {(initiative.changeLog || []).map((log, idx) => (
                                            <div key={idx} className="bg-white dark:bg-navy-900 p-2 rounded border border-slate-200 dark:border-white/5">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{log.date}</span>
                                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1 rounded">{log.user}</span>
                                                </div>
                                                <p className="text-xs text-navy-900 dark:text-white mb-1">{log.change}</p>
                                                <p className="text-[10px] text-slate-500 italic">Why: {log.reason}</p>
                                            </div>
                                        ))}
                                        <button onClick={() => {
                                            const list = [...(initiative.changeLog || [])];
                                            list.push({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], user: currentUser?.firstName || 'User', change: "Updated strategy", reason: "Market shift", impact: "High" });
                                            setInitiative({ ...initiative, changeLog: list });
                                        }} className="text-xs text-purple-500 hover:text-purple-400">+ Add Log Entry</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DEFINITION & SCOPE TAB */}
                    {activeTab === 'definition' && (
                        <div className="grid grid-cols-2 gap-8 h-full">
                            <div className="space-y-8 overflow-y-auto pr-2">

                                {/* Strategic Roadmap Attributes (New) */}
                                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-5 border border-slate-200 dark:border-white/5 space-y-4">
                                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                                        <Globe size={18} className="text-blue-600 dark:text-blue-500" /> Strategic Roadmap Attributes
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Strategic Role</label>
                                            <Select
                                                value={initiative.strategicRole || ''}
                                                onChange={(val) => setInitiative({ ...initiative, strategicRole: val as any })}
                                                placeholder="Select Role..."
                                                options={[
                                                    { value: 'Platform', label: 'Platform (Enabler)' },
                                                    { value: 'Engine', label: 'Engine (Core Business)' },
                                                    { value: 'Pilot', label: 'Pilot (Experiment)' },
                                                    { value: 'Scale', label: 'Scale (Growth)' },
                                                    { value: 'Transformation', label: 'Transformation' }
                                                ]}
                                            />
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            {/* Placeholder for future field or spacing */}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Placement Reason</label>
                                            <button
                                                onClick={async () => {
                                                    setIsGenerating(true);
                                                    try {
                                                        const res = await fetch('/api/ai/placement-reason', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ initiative })
                                                        });
                                                        const data = await res.json();
                                                        setInitiative(prev => ({ ...prev, placementReason: data.reason }));
                                                    } catch (e) { console.error(e); }
                                                    setIsGenerating(false);
                                                }}
                                                disabled={isGenerating}
                                                className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1"
                                            >
                                                <Sparkles size={10} /> {isGenerating ? 'Generating...' : 'Auto-fill with AI'}
                                            </button>

                                        </div>
                                        <textarea
                                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-sm text-navy-900 dark:text-slate-300 h-20 focus:outline-none focus:border-blue-500/50"
                                            placeholder="Why is this initiative placed here? (e.g. key dependency for X...)"
                                            value={initiative.placementReason || ''}
                                            onChange={e => setInitiative({ ...initiative, placementReason: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Effort Profile (1-5)</label>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Analytical', key: 'analytical', color: 'bg-blue-500' },
                                                { label: 'Operational', key: 'operational', color: 'bg-emerald-500' },
                                                { label: 'Change Mgmt', key: 'change', color: 'bg-rose-500' }
                                            ].map(metric => (
                                                <div key={metric.key} className="flex items-center gap-3">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 w-20">{metric.label}</span>
                                                    <div className="flex-1 flex items-center gap-3">
                                                        <input
                                                            type="range" min="1" max="5" step="1"
                                                            className="w-full accent-blue-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                                            value={initiative.effortProfile?.[metric.key as keyof typeof initiative.effortProfile] || 1}
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                setInitiative({
                                                                    ...initiative,
                                                                    effortProfile: {
                                                                        analytical: initiative.effortProfile?.analytical || 1,
                                                                        operational: initiative.effortProfile?.operational || 1,
                                                                        change: initiative.effortProfile?.change || 1,
                                                                        [metric.key]: val
                                                                    }
                                                                });
                                                            }}
                                                        />
                                                        <span className={`text-xs font-bold w-4 text-center ${initiative.effortProfile?.[metric.key as keyof typeof initiative.effortProfile] === 5 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                                            {initiative.effortProfile?.[metric.key as keyof typeof initiative.effortProfile] || 1}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>

                                {/* Success Criteria (Enhanced) */}
                                <div className="space-y-4">
                                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                                        <TrendingUp size={18} className="text-blue-500" /> Success Criteria (Typed)
                                        <button onClick={() => handleGenerateList('successCriteria')} disabled={isGenerating} className="ml-auto text-xs flex items-center gap-1 text-purple-500 bg-purple-100 dark:bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-200"><Sparkles size={12} /> Auto-Suggest</button>
                                    </h3>

                                    {(initiative.structuredSuccessCriteria || initiative.successCriteria?.map(s => ({ type: 'Metric', value: s })) || []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 bg-slate-50 dark:bg-navy-950 p-2 rounded border border-slate-200 dark:border-white/5">
                                            <select
                                                className="bg-white dark:bg-navy-900 text-xs text-blue-600 dark:text-blue-400 font-bold border-none outline-none rounded p-1 w-24"
                                                value={item.type}
                                                onChange={e => {
                                                    const list = [...(initiative.structuredSuccessCriteria || initiative.successCriteria?.map(s => ({ type: 'Metric', value: s })) || [])];
                                                    list[idx] = { ...item, type: e.target.value };
                                                    setInitiative({ ...initiative, structuredSuccessCriteria: list });
                                                }}
                                            >
                                                <option value="Metric">Metric</option>
                                                <option value="Behavior">Behavior</option>
                                                <option value="Process">Process</option>
                                                <option value="Capability">Capability</option>
                                            </select>
                                            <input
                                                className="flex-1 bg-transparent border-none p-1 text-sm text-navy-900 dark:text-white focus:ring-0"
                                                value={item.value}
                                                onChange={e => {
                                                    const list = [...(initiative.structuredSuccessCriteria || initiative.successCriteria?.map(s => ({ type: 'Metric', value: s })) || [])];
                                                    list[idx] = { ...item, value: e.target.value };
                                                    setInitiative({ ...initiative, structuredSuccessCriteria: list });
                                                }}
                                                placeholder="Criteria description..."
                                            />
                                            <button onClick={() => {
                                                const list = [...(initiative.structuredSuccessCriteria || initiative.successCriteria?.map(s => ({ type: 'Metric', value: s })) || [])];
                                                list.splice(idx, 1);
                                                setInitiative({ ...initiative, structuredSuccessCriteria: list });
                                            }} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                        </div>
                                    ))}
                                    <button onClick={() => {
                                        const list = [...(initiative.structuredSuccessCriteria || initiative.successCriteria?.map(s => ({ type: 'Metric', value: s })) || [])];
                                        list.push({ type: 'Metric', value: '' });
                                        setInitiative({ ...initiative, structuredSuccessCriteria: list });
                                    }} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium">+ Add Criteria</button>
                                </div>

                                {/* EXPLICIT ASSUMPTIONS (NEW) */}
                                <div className="space-y-4">
                                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                                        <AlertOctagon size={18} className="text-purple-600 dark:text-purple-500" /> Explicit Assumptions
                                        <span className="text-xs text-slate-400 font-normal ml-2">(Click label to auto-fill)</span>
                                    </h3>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-white/5">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-purple-500" onClick={() => handleGenerateList('assumptions', 'org')}>
                                                Organizational <Sparkles size={10} />
                                            </label>
                                            <input
                                                className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                                                placeholder="e.g. Structure remains stable..."
                                                value={initiative.assumptions?.org || ''}
                                                onChange={e => setInitiative({ ...initiative, assumptions: { ...initiative.assumptions, org: e.target.value } })}
                                            />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-white/5">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-purple-500" onClick={() => handleGenerateList('assumptions', 'data')}>
                                                Data / Tech <Sparkles size={10} />
                                            </label>
                                            <input
                                                className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                                                placeholder="e.g. ERP data is available by Q2..."
                                                value={initiative.assumptions?.data || ''}
                                                onChange={e => setInitiative({ ...initiative, assumptions: { ...initiative.assumptions, data: e.target.value } })}
                                            />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-white/5">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-purple-500" onClick={() => handleGenerateList('assumptions', 'budget')}>
                                                Budget / Resources <Sparkles size={10} />
                                            </label>
                                            <input
                                                className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                                                placeholder="e.g. Budget approval 1st Jan..."
                                                value={initiative.assumptions?.budget || ''}
                                                onChange={e => setInitiative({ ...initiative, assumptions: { ...initiative.assumptions, budget: e.target.value } })}
                                            />
                                        </div>
                                        <div className="bg-slate-50 dark:bg-navy-950 p-3 rounded border border-slate-200 dark:border-white/5">
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2 cursor-pointer hover:text-purple-500" onClick={() => handleGenerateList('assumptions', 'people')}>
                                                People / Skills <Sparkles size={10} />
                                            </label>
                                            <input
                                                className="w-full bg-transparent text-sm text-navy-900 dark:text-slate-300 focus:outline-none"
                                                placeholder="e.g. Key Stakeholders are available..."
                                                value={initiative.assumptions?.people || ''}
                                                onChange={e => setInitiative({ ...initiative, assumptions: { ...initiative.assumptions, people: e.target.value } })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                                    <CheckCircle size={18} className="text-green-500" /> Key Deliverables
                                    <button onClick={() => handleGenerateList('deliverables')} disabled={isGenerating} className="ml-auto text-xs flex items-center gap-1 text-purple-500 bg-purple-100 dark:bg-purple-500/10 px-2 py-1 rounded hover:bg-purple-200"><Sparkles size={12} /> Auto-Suggest</button>
                                </h3>
                                {initiative.deliverables?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input
                                            className="flex-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-sm text-navy-900 dark:text-white"
                                            value={item}
                                            onChange={e => handleArrayChange('deliverables', idx, e.target.value)}
                                            placeholder="Deliverable description..."
                                        />
                                        <button onClick={() => removeArrayItem('deliverables', idx)} className="text-slate-500 hover:text-red-500"><X size={16} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addArrayItem('deliverables')} className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium">+ Add Deliverable</button>

                                <div className="mt-8">
                                    <h3 className="text-navy-900 dark:text-white font-bold flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2">
                                        <Target size={18} className="text-orange-500" /> Scope Guard (Target)
                                    </h3>
                                    <div className="bg-orange-500/5 p-4 rounded border border-orange-500/10 mt-2">
                                        <p className="text-xs text-orange-800 dark:text-orange-200 mb-2">Scope In / Out definition determines the boundary of AI monitoring.</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-2 flex justify-between">
                                                    In Scope <button onClick={() => handleGenerateList('scopeIn')}><Sparkles size={10} /></button>
                                                </h4>
                                                {initiative.scopeIn?.map((s, idx) => (
                                                    <div key={idx} className="flex gap-1 mb-1">
                                                        <input className="w-full bg-white dark:bg-navy-900 text-xs p-1 rounded border border-orange-500/20 dark:border-white/10 text-navy-900 dark:text-white" value={s} onChange={e => handleArrayChange('scopeIn', idx, e.target.value)} />
                                                        <button onClick={() => removeArrayItem('scopeIn', idx)}><X size={12} className="text-slate-500" /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addArrayItem('scopeIn')} className="text-xs text-green-600 dark:text-green-400">+ Add</button>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-2 flex justify-between">
                                                    Out of Scope <button onClick={() => handleGenerateList('scopeOut')}><Sparkles size={10} /></button>
                                                </h4>
                                                {initiative.scopeOut?.map((s, idx) => (
                                                    <div key={idx} className="flex gap-1 mb-1">
                                                        <input className="w-full bg-white dark:bg-navy-900 text-xs p-1 rounded border border-orange-500/20 dark:border-white/10 text-navy-900 dark:text-white" value={s} onChange={e => handleArrayChange('scopeOut', idx, e.target.value)} />
                                                        <button onClick={() => removeArrayItem('scopeOut', idx)}><X size={12} className="text-slate-500" /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addArrayItem('scopeOut')} className="text-xs text-red-400">+ Add</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXECUTION & RISKS TAB */}
                    {activeTab === 'execution' && (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <h3 className="text-navy-900 dark:text-white font-bold mb-4 flex items-center justify-between">
                                    <span>Timeline & Milestones</span>
                                    <button
                                        onClick={generateExecutionStrategy}
                                        disabled={isGenerating}
                                        className={`text-xs flex items-center gap-1 border rounded px-2 py-1 transition-colors ${isGenerating
                                            ? 'text-slate-500 border-slate-700 bg-transparent cursor-not-allowed'
                                            : 'text-purple-400 hover:text-purple-300 border-purple-500/30 bg-purple-500/10'
                                            }`}
                                    >
                                        <Sparkles size={12} className={isGenerating ? "animate-spin" : ""} />
                                        {isGenerating ? "Generating..." : "Auto-fill Execution"}
                                    </button>
                                </h3>

                                <InputGroup label="Kill Criteria (Mandatory) *">
                                    <div className="bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400 text-xs font-bold uppercase">
                                            <AlertTriangle size={12} />
                                            <span>Stop Conditions</span>
                                        </div>
                                        <textarea
                                            className="w-full bg-transparent border-none p-0 text-slate-700 dark:text-slate-300 focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-600 h-24 resize-none text-sm"
                                            value={Array.isArray(initiative.killCriteria) ? initiative.killCriteria.join('\n') : initiative.killCriteria || ''}
                                            onChange={e => setInitiative({ ...initiative, killCriteria: e.target.value.split('\n') })}
                                            placeholder="Define specific conditions under which this initiative MUST be stopped (e.g., Budget overrun > 15%, Technical failure in Pilot)..."
                                        />
                                    </div>
                                </InputGroup>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Start Date">
                                        <input type="date"
                                            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white"
                                            value={initiative.startDate ? initiative.startDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, startDate: e.target.value })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="End Date">
                                        <input type="date"
                                            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white"
                                            value={initiative.endDate ? initiative.endDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, endDate: e.target.value })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="Pilot End">
                                        <input type="date"
                                            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-2 text-navy-900 dark:text-white"
                                            value={initiative.pilotEndDate ? initiative.pilotEndDate.split('T')[0] : ''}
                                            onChange={e => setInitiative({ ...initiative, pilotEndDate: e.target.value })}
                                        />
                                    </InputGroup>
                                </div>

                                {/* Milestones UI */}
                                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-white/5">
                                    <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-2 flex justify-between items-center">
                                        <span>Key Milestones & Gates</span>
                                        <button onClick={() => {
                                            const newMilestones = [...(initiative.milestones || []), { name: '', date: '', status: 'pending' as const }];
                                            setInitiative({ ...initiative, milestones: newMilestones });
                                        }} className="text-xs text-blue-600 dark:text-blue-400 hover:text-navy-900 dark:hover:text-white">+ Add</button>
                                    </h4>
                                    <div className="space-y-3">
                                        {initiative.milestones?.map((m, idx: number) => (
                                            <div key={idx} className={`p-3 rounded border transition-colors ${m.isDecisionGate ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-500/30' : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-white/5'} `}>
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="date"
                                                        className="w-24 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-1 text-xs text-navy-900 dark:text-white"
                                                        value={m.date}
                                                        onChange={e => {
                                                            const list = [...(initiative.milestones || [])];
                                                            list[idx] = { ...m, date: e.target.value };
                                                            setInitiative({ ...initiative, milestones: list });
                                                        }}
                                                    />
                                                    <input
                                                        className="flex-1 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded p-1 text-xs text-navy-900 dark:text-white"
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
                                                        setInitiative({ ...initiative, milestones: list });
                                                    }} className="text-slate-500 hover:text-red-500"><X size={14} /></button>
                                                </div>

                                                <div className="flex items-center gap-4 pl-1">
                                                    <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={m.isDecisionGate || false}
                                                            onChange={e => {
                                                                const list = [...(initiative.milestones || [])];
                                                                list[idx] = { ...m, isDecisionGate: e.target.checked };
                                                                setInitiative({ ...initiative, milestones: list });
                                                            }}
                                                            className="rounded bg-white dark:bg-navy-950 border-slate-300 dark:border-white/20 text-blue-600 dark:text-blue-500 focus:ring-offset-white dark:focus:ring-offset-navy-900"
                                                        />
                                                        Decision Gate
                                                    </label>

                                                    {m.isDecisionGate && (
                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                                            <span className="text-xs text-slate-500">Decision:</span>
                                                            <select
                                                                className={`text - xs border rounded px - 2 py - 0.5 outline - none ${m.decision === 'stop' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                                                    m.decision === 'adjust' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                                                        'bg-green-500/20 text-green-400 border-green-500/30'
                                                                    } `}
                                                                value={m.decision || 'continue'}
                                                                onChange={e => {
                                                                    const list = [...(initiative.milestones || [])];
                                                                    // @ts-expect-error - decision type is dynamic
                                                                    list[idx] = { ...m, decision: e.target.value };
                                                                    setInitiative({ ...initiative, milestones: list });
                                                                }}
                                                            >
                                                                <option value="continue">Continue</option>
                                                                <option value="adjust">Adjust</option>
                                                                <option value="stop">Stop</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-4 border border-slate-200 dark:border-white/5">
                                    <h4 className="text-sm font-bold text-navy-900 dark:text-white mb-2">Required Competencies</h4>
                                    <input
                                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-sm text-slate-600 dark:text-slate-300"
                                        placeholder="e.g. UX Design, Python, Data Science (comma separated)"
                                        value={initiative.competenciesRequired?.join(', ') || ''}
                                        onChange={e => setInitiative({ ...initiative, competenciesRequired: e.target.value.split(',').map(s => s.trim()) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-navy-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                                    <AlertTriangle size={18} className="text-orange-500" /> Key Risks
                                </h3>
                                {/* Simplified Risk Input for now (future: array of objects) */}
                                <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/10 rounded-xl p-4">
                                    <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">Identify top 3-5 risks that could derail this initiative.</p>
                                    {/* We are storing risks as simple array in JSON for this iteration, or strictly adhering to types updated */}
                                    {/* Currently logic stores keyRisks as JSON array. Let's make it simple strings for now or update UI for complex objects later. */}
                                    {/* To match updated types { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[] */}
                                    {initiative.keyRisks?.map((risk, idx: number) => (
                                        <div key={idx} className="mb-4 bg-white dark:bg-navy-900 p-3 rounded border border-slate-200 dark:border-white/5">
                                            <input
                                                className="w-full bg-transparent border-b border-slate-100 dark:border-white/10 mb-2 text-sm text-navy-900 dark:text-white focus:outline-none"
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
                                    <Button size="sm" variant="outline"
                                        disabled={(initiative.keyRisks?.length || 0) >= 5}
                                        onClick={() => {
                                            const newRisks = [...(initiative.keyRisks || [])];
                                            if (newRisks.length >= 5) return;
                                            newRisks.push({ risk: '', mitigation: '', metric: 'Medium' });
                                            setInitiative({ ...initiative, keyRisks: newRisks });
                                        }}>
                                        {(initiative.keyRisks?.length || 0) >= 5 ? 'Max 5 Risks Reached' : '+ Add Risk'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ECONOMICS TAB */}
                    {activeTab === 'economics' && (
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <InputGroup label="Business Value">
                                    <Select
                                        value={initiative.businessValue || ''}
                                        onChange={(val) => setInitiative({ ...initiative, businessValue: val as 'High' | 'Medium' | 'Low' })}
                                        options={[
                                            { value: 'High', label: 'High' },
                                            { value: 'Medium', label: 'Medium' },
                                            { value: 'Low', label: 'Low' }
                                        ]}
                                    />
                                </InputGroup>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="Value Driver">
                                        <Select
                                            value={initiative.valueDriver || ''}
                                            onChange={(val) => setInitiative({ ...initiative, valueDriver: val as any })}
                                            placeholder="Select Driver..."
                                            options={[
                                                { value: 'Cost', label: 'Cost Optimization' },
                                                { value: 'Revenue', label: 'Revenue Growth' },
                                                { value: 'Capital', label: 'Capital Efficiency' },
                                                { value: 'Risk', label: 'Risk Reduction' },
                                                { value: 'Capability', label: 'Strategic Capability' }
                                            ]}
                                        />
                                    </InputGroup>
                                    <InputGroup label="Confidence Level">
                                        <Select
                                            value={initiative.confidenceLevel || ''}
                                            onChange={(val) => setInitiative({ ...initiative, confidenceLevel: val as any })}
                                            placeholder="Confidence..."
                                            options={[
                                                { value: 'High', label: 'High' },
                                                { value: 'Medium', label: 'Medium' },
                                                { value: 'Low', label: 'Low' }
                                            ]}
                                        />
                                    </InputGroup>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup label="CAPEX Est. ($)">
                                        <input type="number"
                                            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                                            value={initiative.costCapex || 0}
                                            onChange={e => setInitiative({ ...initiative, costCapex: parseInt(e.target.value) })}
                                        />
                                    </InputGroup>
                                    <InputGroup label="OPEX Est. ($)">
                                        <input type="number"
                                            className="w-full bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-navy-900 dark:text-white focus:border-blue-500 outline-none"
                                            value={initiative.costOpex || 0}
                                            onChange={e => setInitiative({ ...initiative, costOpex: parseInt(e.target.value) })}
                                        />
                                    </InputGroup>
                                </div>

                                <InputGroup label="Value Timing">
                                    <Select
                                        value={initiative.valueTiming || ''}
                                        onChange={(val) => setInitiative({ ...initiative, valueTiming: val as any })}
                                        placeholder="Expected Realization..."
                                        options={[
                                            { value: 'Immediate', label: 'Immediate (<3mo)' },
                                            { value: 'Short term', label: 'Short term (3-12mo)' },
                                            { value: 'Long term', label: 'Long term (>12mo)' }
                                        ]}
                                    />
                                </InputGroup>
                            </div>

                            <div className="bg-slate-50 dark:bg-navy-950 rounded-xl p-6 border border-slate-200 dark:border-white/5 flex flex-col items-center justify-center text-center relative">
                                <TrendingUp size={48} className={`mb-4 opacity-50 ${initiative.valueDriver === 'Capability' ? 'text-purple-500' : 'text-green-500'} `} />
                                <h3 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Financial Summary</h3>

                                <div className="mb-4">
                                    {initiative.valueDriver === 'Capability' ? (
                                        <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold border border-purple-500/30">
                                            CAPABILITY PLAY
                                        </span>
                                    ) : initiative.valueDriver ? (
                                        <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                                            CASH PLAY
                                        </span>
                                    ) : null}
                                </div>

                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                    Total Investment: <span className="text-navy-900 dark:text-white font-mono">${((initiative.costCapex || 0) + (initiative.costOpex || 0)).toLocaleString()}</span>
                                </p>

                                {/* Sanity Check Logic Display */}
                                {initiative.costCapex && initiative.costCapex > 0 && !initiative.valueDriver && (
                                    <div className="flex items-center gap-2 text-orange-400 text-xs bg-orange-500/10 p-2 rounded w-full justify-center mb-4">
                                        <AlertTriangle size={12} />
                                        <span>Missing Value Driver for Investment</span>
                                    </div>
                                )}

                                <div className="w-full bg-white dark:bg-navy-900 rounded-lg p-4 border border-slate-200 dark:border-white/5 text-left">
                                    <span className="text-xs uppercase text-slate-500">Social Impact</span>
                                    <p className="text-navy-900 dark:text-white mt-1 text-sm">{initiative.socialImpact || 'Not defined'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INTELLIGENCE TAB */}
                    {activeTab === 'intelligence' && (
                        <InitiativeIntelligenceTab
                            initiative={initiative}
                            onChange={(updates) => setInitiative({ ...initiative, ...updates })}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="h-20 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-navy-950 px-6 flex items-center justify-between shrink-0">
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white text-sm font-medium">Cancel</button>
                    <Button onClick={handleSave} icon={<Save size={18} />}>Save Initiative Charter</Button>
                </div>

            </div>
        </div >
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if initiative data or isOpen changes
    return (
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.initiative.id === nextProps.initiative.id &&
        JSON.stringify(prevProps.initiative) === JSON.stringify(nextProps.initiative) &&
        prevProps.users.length === nextProps.users.length
    );
});

// Helper for Input fields
const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="mb-4">
        <label className="block text-xs uppercase text-slate-500 font-bold mb-1">{label}</label>
        {children}
    </div>
);
