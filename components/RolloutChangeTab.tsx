import React, { useState } from 'react';
import { FullSession, StakeholderMapItem, CommsPlanItem } from '../types';
import { Megaphone, Users, MessageCircle, Plus, Trash2, Mail, Mic } from 'lucide-react';

interface RolloutChangeTabProps {
    data: FullSession['rollout'];
    onUpdate: (data: FullSession['rollout']) => void;
}

export const RolloutChangeTab: React.FC<RolloutChangeTabProps> = ({ data, onUpdate }) => {
    const [subTab, setSubTab] = useState<'stakeholders' | 'comms'>('stakeholders');

    const stakeholders = data?.changeManagement?.stakeholders || [];
    const comms = data?.changeManagement?.commsPlan || [];

    const updateChangeData = (update: any) => {
        onUpdate({
            ...data,
            changeManagement: {
                stakeholders,
                commsPlan: comms,
                ...update
            }
        });
    };

    const addStakeholder = () => {
        const newItem: StakeholderMapItem = {
            id: Date.now().toString(),
            name: 'New Stakeholder',
            role: 'Role/Group',
            influence: 3,
            attitude: 'Neutral',
            engagementStrategy: ''
        };
        updateChangeData({ stakeholders: [...stakeholders, newItem] });
    };

    const updateStakeholder = (id: string, updates: Partial<StakeholderMapItem>) => {
        const updated = stakeholders.map(s => s.id === id ? { ...s, ...updates } : s);
        updateChangeData({ stakeholders: updated });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Megaphone className="text-yellow-500" />
                        Change Management Hub
                    </h2>
                    <p className="text-slate-500">Align stakeholders and manage communications.</p>
                </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-4 border-b border-slate-200 dark:border-white/10">
                <button
                    onClick={() => setSubTab('stakeholders')}
                    className={`pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${subTab === 'stakeholders' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'border-transparent text-slate-500'}`}
                >
                    <Users size={16} /> Stakeholder Map
                </button>
                <button
                    onClick={() => setSubTab('comms')}
                    className={`pb-3 border-b-2 font-bold text-sm flex items-center gap-2 ${subTab === 'comms' ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400' : 'border-transparent text-slate-500'}`}
                >
                    <MessageCircle size={16} /> Communication Plan
                </button>
            </div>

            {subTab === 'stakeholders' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button onClick={addStakeholder} className="text-xs bg-yellow-500/10 text-yellow-600 px-3 py-1.5 rounded font-bold border border-yellow-500/20 hover:bg-yellow-500/20">
                            + Add Stakeholder
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stakeholders.map(s => (
                            <div key={s.id} className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 p-4 rounded-xl shadow-sm relative group hover:border-yellow-500/50 transition-colors">
                                <input
                                    value={s.name}
                                    onChange={(e) => updateStakeholder(s.id, { name: e.target.value })}
                                    className="font-bold text-lg bg-transparent outline-none w-full mb-1"
                                />
                                <input
                                    value={s.role}
                                    onChange={(e) => updateStakeholder(s.id, { role: e.target.value })}
                                    className="text-xs text-slate-500 bg-transparent outline-none w-full mb-3 uppercase tracking-wide"
                                />

                                <div className="flex gap-2 mb-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Influence (1-5)</label>
                                        <input
                                            type="number" min="1" max="5"
                                            value={s.influence}
                                            onChange={(e) => updateStakeholder(s.id, { influence: Number(e.target.value) as any })}
                                            className="w-full bg-slate-50 dark:bg-navy-950 p-1 rounded border border-slate-200 dark:border-white/10 text-center text-sm"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-400 font-bold block mb-1">Attitude</label>
                                        <select
                                            value={s.attitude}
                                            onChange={(e) => updateStakeholder(s.id, { attitude: e.target.value as any })}
                                            className={`w-full p-1 rounded border text-center text-[10px] font-bold outline-none
                                                 ${s.attitude === 'Supportive' ? 'bg-green-100 text-green-700 border-green-200' :
                                                    s.attitude === 'Resistant' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'}
                                             `}
                                        >
                                            <option>Supportive</option>
                                            <option>Neutral</option>
                                            <option>Resistant</option>
                                        </select>
                                    </div>
                                </div>

                                <textarea
                                    value={s.engagementStrategy || ''}
                                    onChange={(e) => updateStakeholder(s.id, { engagementStrategy: e.target.value })}
                                    placeholder="Engagement strategy..."
                                    className="w-full bg-slate-50 dark:bg-navy-950 p-2 rounded border border-slate-200 dark:border-white/10 text-xs h-20 resize-none"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {subTab === 'comms' && (
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-navy-950 text-xs uppercase text-slate-500 font-bold">
                            <tr>
                                <th className="p-4">Message / Topic</th>
                                <th className="p-4">Audience</th>
                                <th className="p-4">Channel</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {/* Placeholder rows */}
                            <tr className="hover:bg-slate-50 dark:hover:bg-white/5">
                                <td className="p-4 text-sm font-medium">Program Kickoff Announcement</td>
                                <td className="p-4 text-sm text-slate-500">All Company</td>
                                <td className="p-4"><span className="flex items-center gap-1 text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded"><Mic size={12} /> Townhall</span></td>
                                <td className="p-4 text-sm text-slate-500">Oct 15, 2025</td>
                                <td className="p-4"><span className="text-xs font-bold text-green-600">Sent</span></td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="p-4 text-center border-t border-slate-100 dark:border-white/5">
                        <button className="text-sm font-bold text-blue-500 hover:text-blue-600 flex items-center justify-center gap-1">
                            <Plus size={16} /> Add Communication
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
