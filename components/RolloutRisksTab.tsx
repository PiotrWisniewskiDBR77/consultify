import React, { useState } from 'react';
import { FullSession, RAIDItem, FullInitiative } from '../types';
import { AlertOctagon, HelpCircle, AlertTriangle, Link as LinkIcon, Plus, ChevronDown, ChevronRight, Check } from 'lucide-react';

interface RolloutRisksTabProps {
    data: FullSession['rollout'];
    initiatives: FullInitiative[];
    onUpdate: (data: FullSession['rollout']) => void;
}

export const RolloutRisksTab: React.FC<RolloutRisksTabProps> = ({ data, initiatives, onUpdate }) => {
    const [activeType, setActiveType] = useState<'Risk' | 'Issue' | 'Assumption' | 'Dependency'>('Risk');
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    // Mock items if empty
    const items = data?.risks || [];

    const filteredItems = items.filter(i => i.type === activeType);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const addItem = () => {
        const newItem: RAIDItem = {
            id: Date.now().toString(),
            type: activeType,
            title: 'New ' + activeType,
            description: '',
            severity: 'Medium',
            status: 'Open',
            dueDate: new Date().toISOString()
        };
        onUpdate({ ...data, risks: [...items, newItem] });
    };

    const updateItem = (id: string, updates: Partial<RAIDItem>) => {
        const newItems = items.map(i => i.id === id ? { ...i, ...updates } : i);
        onUpdate({ ...data, risks: newItems });
    };

    const getSeverityColor = (sev: string) => {
        switch (sev) {
            case 'Critical': return 'text-red-600 bg-red-100 dark:bg-red-900/50 dark:text-red-400';
            case 'High': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/50 dark:text-orange-400';
            case 'Medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 dark:text-yellow-400';
            default: return 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <AlertOctagon className="text-red-500" />
                        RAID Log
                    </h2>
                    <p className="text-slate-500">Manage Risks, Assumptions, Issues, and Dependencies.</p>
                </div>
                <button
                    onClick={addItem}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <Plus size={18} /> Add {activeType}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10 pb-1">
                {[
                    { id: 'Risk', icon: AlertOctagon, color: 'text-red-500' },
                    { id: 'Issue', icon: AlertTriangle, color: 'text-orange-500' },
                    { id: 'Assumption', icon: HelpCircle, color: 'text-blue-500' },
                    { id: 'Dependency', icon: LinkIcon, color: 'text-purple-500' }
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setActiveType(type.id as any)}
                        className={`px-4 py-3 font-bold text-sm flex items-center gap-2 rounded-t-lg transition-colors border-b-2 ${activeType === type.id
                                ? 'bg-slate-50 dark:bg-white/5 border-red-500 text-slate-800 dark:text-white'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 border-transparent'
                            }`}
                    >
                        <type.icon size={16} className={activeType === type.id ? type.color : 'text-slate-400'} />
                        {type.id}s
                        <span className="bg-slate-200 dark:bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] text-slate-600 dark:text-slate-300">
                            {items.filter(i => i.type === type.id).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-navy-900 rounded-b-xl rounded-tr-xl border border-slate-200 dark:border-white/5 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-navy-950 text-xs text-slate-500 uppercase font-semibold sticky top-0 z-10">
                        <tr>
                            <th className="p-4 w-10"></th>
                            <th className="p-4 w-1/3">Title</th>
                            <th className="p-4">Severity</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Owner</th>
                            <th className="p-4">Due Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                    No {activeType.toLowerCase()}s recorded.
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map(item => (
                                <React.Fragment key={item.id}>
                                    <tr className="hover:bg-slate-50 dark:hover:bg-white/5 group">
                                        <td className="p-4 text-center cursor-pointer" onClick={() => toggleExpand(item.id)}>
                                            {expandedIds.includes(item.id) ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                        </td>
                                        <td className="p-4">
                                            <input
                                                value={item.title}
                                                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                                                className="w-full bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none focus:text-blue-500"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${getSeverityColor(item.severity)}`}>
                                                {item.severity}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <select
                                                value={item.status}
                                                onChange={(e) => updateItem(item.id, { status: e.target.value as any })}
                                                className="bg-transparent text-sm font-medium text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
                                            >
                                                <option>Open</option>
                                                <option>Mitigated</option>
                                                <option>Closed</option>
                                            </select>
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                            {item.ownerId || "Unassigned"}
                                        </td>
                                        <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                    {expandedIds.includes(item.id) && (
                                        <tr className="bg-slate-50/50 dark:bg-white/5">
                                            <td colSpan={6} className="p-4 pl-14">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Description</label>
                                                        <textarea
                                                            value={item.description}
                                                            onChange={(e) => updateItem(item.id, { description: e.target.value })}
                                                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-sm"
                                                            rows={3}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">
                                                            {activeType === 'Risk' ? 'Mitigation Plan' : 'Action Plan'}
                                                        </label>
                                                        <textarea
                                                            value={item.mitigationPlan || ''}
                                                            onChange={(e) => updateItem(item.id, { mitigationPlan: e.target.value })}
                                                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded p-2 text-sm"
                                                            rows={3}
                                                            placeholder="What actions are required?"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex justify-end">
                                                    <button className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-1">
                                                        <Trash2 size={12} /> Delete Item
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Temp icon import for Trash2 since I missed it
import { Trash2 } from 'lucide-react';
