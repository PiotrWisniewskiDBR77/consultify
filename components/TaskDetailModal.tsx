import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Task, User, RiskRating, TaskStatus, TaskType, DecisionImpact, FullInitiative } from '../types';
import {
    X, Save, Calendar, DollarSign,
    AlertTriangle, CheckSquare, Link,
    Brain, Target, Shield, History, Sparkles,
    FileText, Layout, GitCommit
} from 'lucide-react';
import { Api } from '../services/api';

interface TaskDetailModalProps {
    task: Task;
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: Task) => void;
    currentUser: User;
    users?: User[]; // For assignee selection
    language?: 'EN' | 'PL' | 'DE' | 'AR';
    initiative?: FullInitiative;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = React.memo(({
    task: initialTask,
    isOpen,
    onClose,
    onSave,
    currentUser,
    users = [],
    language = 'EN',
    initiative
}) => {
    const [task, setTask] = useState<Task>({ ...initialTask });
    const [activeTab, setActiveTab] = useState<'strategy' | 'execution' | 'evidence' | 'dependencies' | 'history'>('strategy');
    const [aiLoading, setAiLoading] = useState(false);

    // Reset task when modal opens with new task
    useEffect(() => {
        setTask({ ...initialTask });
    }, [initialTask, isOpen]);

    if (!isOpen) return null;

    // OPTIMIZED: Memoized callbacks to prevent unnecessary re-renders
    const handleSave = useCallback(() => {
        // Validation
        if (!task.title.trim()) {
            alert("Title is required");
            return;
        }

        // Strategic Validation
        if (task.taskType === 'DECISION') {
            if (!task.decisionImpact?.decisionStatement) {
                alert("Decision tasks require a Decision Statement.");
                setActiveTab('strategy');
                return;
            }
        }

        if (task.priority === 'urgent' && !task.expectedOutcome) {
            if (!confirm("Urgent tasks usually require an Expected Outcome. Save anyway?")) {
                setActiveTab('strategy');
                return;
            }
        }

        onSave(task);
        onClose();
    }, [task, onSave, onClose]);

    const generateAiInsight = useCallback(async () => {
        setAiLoading(true);
        try {
            const insight = await Api.generateTaskInsight(task, initiative);
            setTask(prev => ({
                ...prev,
                aiInsight: insight
            }));
        } catch (error) {
            console.error("AI Generation failed", error);
        } finally {
            setAiLoading(false);
        }
    };

    const getRiskColor = (risk?: RiskRating | string) => {
        // Handle RiskRating object or string legacy
        const val = (typeof risk === 'object' ? (risk?.metric || '') : (risk || '')).toLowerCase();

        switch (val) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
            default: return 'text-slate-400 bg-slate-400/10';
        }
    };

    const TASK_TYPES: TaskType[] = ['ANALYSIS', 'DESIGN', 'BUILD', 'PILOT', 'VALIDATION', 'DECISION', 'CHANGE_MGMT'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-navy-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh]">

                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-start bg-slate-50 dark:bg-navy-950 shrink-0">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                                {task.projectId ? 'Project Task' : 'Initiative Task'}
                            </span>
                            <div className="h-4 w-[1px] bg-slate-300 dark:bg-white/10"></div>
                            <select
                                value={task.taskType}
                                onChange={e => setTask({ ...task, taskType: e.target.value as TaskType })}
                                className="bg-transparent text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 outline-none border-b border-dashed border-blue-500/30 hover:text-blue-500 dark:hover:text-blue-300"
                            >
                                {TASK_TYPES.map(t => <option key={t} value={t} className="bg-white dark:bg-navy-900 text-navy-900 dark:text-white">{t}</option>)}
                            </select>
                        </div>
                        <input
                            value={task.title}
                            onChange={e => setTask({ ...task, title: e.target.value })}
                            className="bg-transparent text-2xl font-bold text-navy-900 dark:text-white w-full outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            placeholder="Enter task title..."
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-navy-950/50 p-1 rounded border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-none">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-600 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-white uppercase">
                                {task.assignee?.firstName?.[0] || '?'}
                            </div>
                            <select
                                className="bg-transparent text-sm text-navy-900 dark:text-slate-300 outline-none w-32"
                                value={task.assigneeId || ''}
                                onChange={e => setTask({ ...task, assigneeId: e.target.value })}
                            >
                                <option value="">Unassigned</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                            </select>
                        </div>

                        <button onClick={onClose} className="text-slate-500 hover:text-navy-900 dark:hover:text-white p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT COLUMN: Sidebar Navigation & Metadata */}
                    <div className="w-64 bg-slate-50 dark:bg-navy-950/50 border-r border-slate-200 dark:border-white/5 flex flex-col shrink-0">
                        <nav className="p-2 space-y-1">
                            {[
                                { id: 'strategy', label: 'Strategic Context', icon: Target },
                                { id: 'execution', label: 'Execution Plan', icon: Layout },
                                { id: 'evidence', label: 'Evidence of Done', icon: Shield },
                                { id: 'dependencies', label: 'Dependencies', icon: Link },
                                { id: 'history', label: 'Change Log', icon: History },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id as any)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${activeTab === item.id
                                        ? 'bg-blue-100 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <item.icon size={16} />
                                    {item.label}
                                </button>
                            ))}
                        </nav>

                        <div className="mt-auto p-4 space-y-4 border-t border-slate-200 dark:border-white/5">
                            {/* AI Insight Card (Mini) */}
                            <div className="bg-gradient-to-br from-purple-100 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-white/5 rounded p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                        <Sparkles size={12} /> AI Insight
                                    </span>
                                    <button
                                        onClick={generateAiInsight}
                                        disabled={aiLoading}
                                        className="text-[10px] bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 px-2 py-0.5 rounded text-purple-600 dark:text-white transition-colors border border-purple-100 dark:border-transparent"
                                    >
                                        {aiLoading ? 'Thinking...' : 'Refresh'}
                                    </button>
                                </div>
                                {task.aiInsight ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                            <span>Relevance: <span className="text-navy-900 dark:text-white">{task.aiInsight.strategicRelevance}</span></span>
                                            <span>Risk: <span className="text-navy-900 dark:text-white">{task.aiInsight.executionRisk}</span></span>
                                        </div>
                                        <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                                            "{task.aiInsight.summary}"
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-500 italic">No insight generated yet.</p>
                                )}
                            </div>

                            {/* Metadata Grid */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] items-center gap-1 font-bold text-slate-500 uppercase mb-1 flex">
                                        <Calendar size={10} /> Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                                        onChange={e => setTask({ ...task, dueDate: e.target.value })}
                                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                                        <select
                                            value={task.status}
                                            onChange={e => setTask({ ...task, status: e.target.value as TaskStatus })}
                                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded px-1 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                                        >
                                            {['todo', 'in_progress', 'review', 'done', 'blocked'].map(s => (
                                                <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                                        <select
                                            value={task.priority}
                                            onChange={e => setTask({ ...task, priority: e.target.value as any })}
                                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded px-1 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                                        >
                                            {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Content Area */}
                    <div className="flex-1 bg-white dark:bg-navy-900 overflow-y-auto p-6">

                        {activeTab === 'strategy' && (
                            <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-1 flex items-center gap-2">
                                        <Target size={16} className="text-purple-600 dark:text-purple-400" /> Expected Strategic Outcome
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-2">What specifically will change in the business once this task is done?</p>
                                    <textarea
                                        value={task.expectedOutcome || ''}
                                        onChange={e => setTask({ ...task, expectedOutcome: e.target.value })}
                                        className="w-full h-24 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 focus:border-purple-500/50 outline-none resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="e.g., Reduce customer onboarding time by 20%..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-950/30 border border-slate-200 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Decision Impact</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-slate-500 block mb-1">Decision Type</label>
                                                <select
                                                    value={task.decisionImpact?.decisionType || 'CONTINUE'}
                                                    onChange={e => setTask({
                                                        ...task,
                                                        decisionImpact: { ...task.decisionImpact, decisionType: e.target.value as any, decisionStatement: task.decisionImpact?.decisionStatement || '' }
                                                    })}
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-white"
                                                >
                                                    {['CONTINUE', 'MOVE_TO_PILOT', 'MOVE_TO_SCALE', 'STOP', 'APPROVE_INVESTMENT'].map(d => (
                                                        <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 block mb-1">Decision Statement</label>
                                                <input
                                                    value={task.decisionImpact?.decisionStatement || ''}
                                                    onChange={e => setTask({
                                                        ...task,
                                                        decisionImpact: { ...task.decisionImpact, decisionType: task.decisionImpact?.decisionType || 'CONTINUE', decisionStatement: e.target.value }
                                                    })}
                                                    className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    placeholder="If successful, we will..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-950/30 border border-slate-200 dark:border-white/5">
                                        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">Strategic Contribution</h4>
                                        <div className="space-y-2">
                                            {['PROCESS_CHANGE', 'BEHAVIOR_CHANGE', 'CAPABILITY_CHANGE'].map(type => (
                                                <label key={type} className="flex items-center gap-2 p-2 rounded hover:bg-slate-200 dark:hover:bg-white/5 cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={task.strategicContribution?.includes(type as any) || false}
                                                        onChange={e => {
                                                            const current = task.strategicContribution || [];
                                                            if (e.target.checked) {
                                                                setTask({ ...task, strategicContribution: [...current, type as any] });
                                                            } else {
                                                                setTask({ ...task, strategicContribution: current.filter(t => t !== type) });
                                                            }
                                                        }}
                                                        className="rounded border-slate-300 dark:border-white/20 bg-white dark:bg-navy-900 text-blue-600 focus:ring-0"
                                                    />
                                                    <span className="text-xs text-navy-900 dark:text-slate-300 capitalize">{type.replace('_', ' ').toLowerCase()}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'execution' && (
                            <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                        <FileText size={16} className="text-blue-600 dark:text-blue-400" /> Detailed Description
                                    </h3>
                                    <textarea
                                        value={task.description || ''}
                                        onChange={e => setTask({ ...task, description: e.target.value })}
                                        className="w-full h-64 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg p-4 text-sm text-navy-900 dark:text-slate-300 focus:border-blue-500/50 outline-none resize-none font-mono leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="Use markdown for detailed execution steps..."
                                    />
                                </div>
                                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/10">
                                    <h3 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                                        <AlertTriangle size={14} /> Blocking Issues / Risks
                                    </h3>
                                    <textarea
                                        value={task.blockingIssues || ''}
                                        onChange={e => setTask({ ...task, blockingIssues: e.target.value })}
                                        className="w-full h-20 bg-transparent border-none text-sm text-navy-900 dark:text-slate-300 placeholder:text-red-400/50 dark:placeholder:text-red-500/30 outline-none resize-none"
                                        placeholder="Describe any critical blockers..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'evidence' && (
                            <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                        <Shield size={16} className="text-green-600 dark:text-green-400" /> Evidence of Done
                                    </h3>
                                </div>

                                {/* Evidence Requirements */}
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-950/30 border border-slate-200 dark:border-white/5 space-y-4">
                                    <p className="text-xs text-slate-500">Select required evidence types to mark this task as "Verified Done".</p>
                                    <div className="flex gap-4">
                                        {['DOCUMENT', 'DATA', 'DEMO', 'APPROVAL'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    const current = task.evidenceRequired || [];
                                                    if (current.includes(type as any)) {
                                                        setTask({ ...task, evidenceRequired: current.filter(t => t !== type) });
                                                    } else {
                                                        setTask({ ...task, evidenceRequired: [...current, type as any] });
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${task.evidenceRequired?.includes(type as any)
                                                    ? 'bg-green-100 dark:bg-green-500/20 border-green-500 dark:border-green-500/50 text-green-700 dark:text-green-400'
                                                    : 'bg-white dark:bg-transparent border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300 dark:hover:border-white/30'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Acceptance Criteria */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Detailed Acceptance Criteria</label>
                                    <textarea
                                        value={task.acceptanceCriteria || ''}
                                        onChange={e => setTask({ ...task, acceptanceCriteria: e.target.value })}
                                        className="w-full h-40 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 focus:border-green-500/30 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                        placeholder="- [ ] Metric A > 50%&#10;- [ ] User Flow Tested"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'dependencies' && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 animate-in fade-in">
                                <Link size={48} className="opacity-20" />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-400">Dependency Management</p>
                                    <p className="text-xs text-slate-600 mt-1 max-w-xs mx-auto">
                                        This module will allow visual linking between tasks (Blocks / Blocked By). Coming in Phase 2.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                                    <History size={16} className="text-slate-400" /> Change Log
                                </h3>
                                <div className="space-y-3">
                                    {task.changeLog && task.changeLog.length > 0 ? (
                                        task.changeLog.map((log, i) => (
                                            <div key={i} className="flex gap-3 text-xs p-3 rounded bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                                                <div className="mt-0.5">
                                                    <GitCommit size={14} className="text-slate-500" />
                                                </div>
                                                <div>
                                                    <div className="text-navy-900 dark:text-slate-300">
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{log.changedBy}</span> changed <span className="font-mono text-slate-500 dark:text-slate-400">{log.field}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-slate-500">
                                                        <span className="line-through opacity-50">{String((log.oldValue || 'empty')).substring(0, 20)}</span>
                                                        <span>→</span>
                                                        <span className="text-green-600 dark:text-green-400">{String((log.newValue || 'empty')).substring(0, 20)}</span>
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-600">
                                                        {new Date(log.changedAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-slate-600 italic">No history available.</p>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950 flex justify-between items-center shrink-0">
                    <div className="text-[10px] text-slate-500 dark:text-slate-600">
                        {task.updatedAt ? `Last updated: ${new Date(task.updatedAt).toLocaleString()}` : ''}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white text-sm transition-colors">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-900/20 text-sm font-medium flex items-center gap-2 transition-all">
                            <Save size={16} /> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if task data or isOpen changes
    return (
        prevProps.isOpen === nextProps.isOpen &&
        prevProps.task.id === nextProps.task.id &&
        JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task) &&
        prevProps.users.length === nextProps.users.length
    );
});
