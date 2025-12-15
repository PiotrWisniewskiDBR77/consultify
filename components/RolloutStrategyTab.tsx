import React, { useState } from 'react';
import { FullSession, FullInitiative } from '../types';
import { Layout, Check, Plus, Trash2, Lock, Unlock } from 'lucide-react';

interface RolloutStrategyTabProps {
    data: FullSession['rollout'];
    onUpdate: (data: FullSession['rollout']) => void;
    isAdmin: boolean;
}

export const RolloutStrategyTab: React.FC<RolloutStrategyTabProps> = ({ data, onUpdate, isAdmin }) => {
    // Local state for editing to avoid constant parent updates, sync on blur/action
    const [scope, setScope] = useState(data?.scope || {
        programName: '',
        businessGoals: [],
        inScope: [],
        outScope: [],
        strategicPillars: []
    });

    const [isLocked, setIsLocked] = useState(false);

    const handleSave = () => {
        onUpdate({ ...data, scope });
    };

    const addListItem = (field: 'businessGoals' | 'inScope' | 'outScope') => {
        setScope({ ...scope, [field]: [...scope[field], ''] });
    };

    const updateListItem = (field: 'businessGoals' | 'inScope' | 'outScope', index: number, value: string) => {
        const list = [...scope[field]];
        list[index] = value;
        setScope({ ...scope, [field]: list });
    };

    const removeListItem = (field: 'businessGoals' | 'inScope' | 'outScope', index: number) => {
        const list = [...scope[field]];
        list.splice(index, 1);
        setScope({ ...scope, [field]: list });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Layout className="text-purple-500" />
                        Program Strategy & Scope
                    </h2>
                    <p className="text-slate-500">Define the boundaries and strategic pillars of the transformation.</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setIsLocked(!isLocked)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold border ${isLocked ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-300'}`}
                    >
                        {isLocked ? <><Lock size={16} /> Strategy Locked</> : <><Unlock size={16} /> Strategy Unlocked</>}
                    </button>
                )}
            </div>

            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                {/* 1. Program Definition */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-purple-400">Program Definition</h3>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-500 mb-2">Program Name</label>
                        <input
                            type="text"
                            value={scope.programName}
                            onChange={(e) => setScope({ ...scope, programName: e.target.value })}
                            onBlur={handleSave}
                            placeholder="e.g., Project Phoenix 2025"
                            className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-3"
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-500 mb-2">Business Goals</label>
                        <div className="space-y-2">
                            {scope.businessGoals.map((g, i) => (
                                <div key={i} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={g}
                                        onChange={(e) => updateListItem('businessGoals', i, e.target.value)}
                                        onBlur={handleSave}
                                        className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm"
                                        placeholder="Goal..."
                                    />
                                    <button onClick={() => removeListItem('businessGoals', i)} className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            <button onClick={() => addListItem('businessGoals')} className="text-xs font-bold text-purple-500 flex items-center gap-1 mt-2">
                                <Plus size={14} /> Add Goal
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Scope */}
                <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                    <h3 className="font-bold text-lg mb-4 text-blue-400">Scope Boundaries</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-green-500 mb-2 flex items-center gap-2"><Check size={16} /> In Scope</label>
                            <div className="space-y-2">
                                {scope.inScope.map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            value={item}
                                            onChange={(e) => updateListItem('inScope', i, e.target.value)}
                                            onBlur={handleSave}
                                            className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm"
                                        />
                                        <button onClick={() => removeListItem('inScope', i)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addListItem('inScope')} className="text-green-500 text-xs font-bold flex items-center gap-1">+ Add Scope</button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-red-500 mb-2 flex items-center gap-2"><Trash2 size={16} /> Out of Scope</label>
                            <div className="space-y-2">
                                {scope.outScope.map((item, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            value={item}
                                            onChange={(e) => updateListItem('outScope', i, e.target.value)}
                                            onBlur={handleSave}
                                            className="flex-1 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg p-2 text-sm opacity-70"
                                        />
                                        <button onClick={() => removeListItem('outScope', i)} className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                                <button onClick={() => addListItem('outScope')} className="text-red-500 text-xs font-bold flex items-center gap-1">+ Add Excl.</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategic Pillars (Placeholder for now) */}
            <div className="bg-white dark:bg-navy-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                <h3 className="font-bold text-lg mb-4 text-slate-300">Strategic Pillars</h3>
                <p className="text-sm text-slate-500 mb-4">Core themes driving this transformation.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Mock pillars for UI */}
                    {['Digital Foundation', 'Customer Experience', 'Operational Excellence'].map((pillar, i) => (
                        <div key={i} className="p-4 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg text-center font-bold">
                            {pillar}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
