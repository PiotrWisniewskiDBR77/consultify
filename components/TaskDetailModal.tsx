import React, { useState } from 'react';
import { Task, User, RiskRating, TaskStatus } from '../types';
import {
    X, Save, Calendar, DollarSign,
    AlertTriangle, CheckSquare, Link
} from 'lucide-react';

interface TaskDetailModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => void;
    currentUser: User;
    users?: User[]; // For assignee selection
    language?: 'EN' | 'PL' | 'DE' | 'AR';
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
    task: initialTask,
    isOpen,
    onClose,
    onSave,
     
    currentUser,
    users = [],
     
    language = 'EN'
}) => {
    const [task, setTask] = useState<Task>({ ...initialTask });
    const [activeTab, setActiveTab] = useState<'details' | 'acceptance' | 'dependencies'>('details');

    if (!isOpen) return null;

    const handleSave = () => {
        onSave(task);
        onClose();
    };

    const getRiskColor = (risk?: RiskRating) => {
        switch (risk) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
            default: return 'text-slate-400 bg-slate-400/10';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-navy-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-white/10 flex justify-between items-start bg-navy-950">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                                {task.projectId || 'Task'} / {task.id.substring(0, 6)}
                            </span>
                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${task.taskType === 'analytical' ? 'border-purple-500/30 text-purple-400' :
                                task.taskType === 'execution' ? 'border-blue-500/30 text-blue-400' :
                                    'border-slate-500/30 text-slate-400'
                                }`}>
                                {task.taskType || 'General'}
                            </span>
                        </div>
                        <input
                            value={task.title}
                            onChange={e => setTask({ ...task, title: e.target.value })}
                            className="bg-transparent text-xl font-bold text-white w-full outline-none placeholder:text-slate-600"
                            placeholder="Task Title"
                        />
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Layout: Sidebar + Main Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-64 bg-navy-950/50 border-r border-white/5 p-4 space-y-6 overflow-y-auto">

                        {/* Status */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Status</label>
                            <select
                                value={task.status}
                                onChange={e => setTask({ ...task, status: e.target.value as TaskStatus })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-300 outline-none focus:border-blue-500"
                            >
                                {['todo', 'in_progress', 'review', 'done', 'blocked'].map(s => (
                                    <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        {/* Assignee */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Assignee</label>
                            <div className="flex items-center gap-2 p-1.5 rounded bg-navy-900 border border-white/5">
                                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                                    {task.assignee?.firstName?.[0] || '?'}
                                </div>
                                <select
                                    className="bg-transparent text-sm text-slate-300 outline-none w-full"
                                    value={task.assigneeId || ''}
                                    onChange={e => setTask({ ...task, assigneeId: e.target.value })}
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Priority & Risk */}
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Priority</label>
                                <select
                                    value={task.priority}
                                     
                                    onChange={e => setTask({ ...task, priority: e.target.value as any })}
                                    className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-300 outline-none"
                                >
                                    {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Risk Rating</label>
                                <select
                                    value={task.riskRating || 'low'}
                                    onChange={e => setTask({ ...task, riskRating: e.target.value as RiskRating })}
                                    className={`w-full border rounded px-2 py-1.5 text-sm outline-none font-medium ${getRiskColor(task.riskRating)}`}
                                >
                                    {['low', 'medium', 'high', 'critical'].map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Budget */}
                        <div className="pt-4 border-t border-white/5">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                                <DollarSign size={12} /> Budget & Spend
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <span className="text-[10px] text-slate-600 block">Allocated</span>
                                    <input
                                        type="number"
                                        value={task.budgetAllocated || 0}
                                        onChange={e => setTask({ ...task, budgetAllocated: Number(e.target.value) })}
                                        className="w-full bg-navy-900 border border-white/10 rounded px-1 py-1 text-xs text-slate-300"
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-600 block">Spent</span>
                                    <input
                                        type="number"
                                        value={task.budgetSpent || 0}
                                        onChange={e => setTask({ ...task, budgetSpent: Number(e.target.value) })}
                                        className="w-full bg-navy-900 border border-white/10 rounded px-1 py-1 text-xs text-slate-300"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="pt-4 border-t border-white/5">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-2">
                                <Calendar size={12} /> Due Date
                            </label>
                            <input
                                type="date"
                                value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                                onChange={e => setTask({ ...task, dueDate: e.target.value })}
                                className="w-full bg-navy-900 border border-white/10 rounded px-2 py-1.5 text-xs text-slate-300"
                            />
                        </div>

                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col bg-navy-900">
                        {/* Tabs */}
                        <div className="flex border-b border-white/5 px-4">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                Description & Plan
                            </button>
                            <button
                                onClick={() => setActiveTab('acceptance')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'acceptance' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <CheckSquare size={14} /> Acceptance Criteria
                            </button>
                            <button
                                onClick={() => setActiveTab('dependencies')}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'dependencies' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                            >
                                <Link size={14} /> Dependencies
                            </button>
                        </div>

                        <div className="flex-1 p-6 overflow-y-auto">
                            {activeTab === 'details' && (
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Description</label>
                                        <textarea
                                            value={task.description || ''}
                                            onChange={e => setTask({ ...task, description: e.target.value })}
                                            className="w-full h-40 bg-navy-950/50 border border-white/10 rounded p-4 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none"
                                            placeholder="Detailed description of the analytical or execution task..."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-2 block text-red-400 flex items-center gap-2">
                                            <AlertTriangle size={14} /> Blocking Issues / Red Flags
                                        </label>
                                        <textarea
                                            value={task.blockingIssues || ''}
                                            onChange={e => setTask({ ...task, blockingIssues: e.target.value })}
                                            className="w-full h-20 bg-red-900/10 border border-red-500/20 rounded p-3 text-sm text-slate-300 focus:border-red-500 outline-none resize-none"
                                            placeholder="Describe any blockers or critical risks..."
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'acceptance' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-400 mb-2">Define what "Done" looks like for this task.</p>
                                    <textarea
                                        value={task.acceptanceCriteria || ''}
                                        onChange={e => setTask({ ...task, acceptanceCriteria: e.target.value })}
                                        className="w-full h-64 bg-navy-950/50 border border-white/10 rounded p-4 text-sm text-slate-300 focus:border-blue-500 outline-none resize-none"
                                        placeholder="- [ ] Metric A reached&#10;- [ ] Document B approved&#10;- [ ] Code validated"
                                    />
                                </div>
                            )}

                            {activeTab === 'dependencies' && (
                                <div className="text-center py-12 text-slate-500">
                                    <Link size={32} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">Manage task dependencies here.</p>
                                    <p className="text-xs text-slate-600 mt-1">(Under Construction - Phase 2)</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-navy-950 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium flex items-center gap-2">
                        <Save size={16} /> Save Task
                    </button>
                </div>

            </div>
        </div>
    );
};
