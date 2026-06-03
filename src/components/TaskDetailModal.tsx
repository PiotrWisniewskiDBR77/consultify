import {
  AlertTriangle,
  Brain,
  Calendar,
  CheckSquare,
  DollarSign,
  FileText,
  GitCommit,
  History,
  Layout,
  Link,
  Save,
  Shield,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

import {
  DecisionImpact,
  FullInitiative,
  RiskRating,
  Task,
  TaskStatus,
  TaskType,
  User,
} from '../types';

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

export const TaskDetailModal: React.FC<TaskDetailModalProps> = React.memo(
  ({
    task: initialTask,
    isOpen,
    onClose,
    onSave,
    currentUser,
    users = [],
    language = 'EN',
    initiative,
  }) => {
    const [task, setTask] = useState<Task>({ ...initialTask });
    const [activeTab, setActiveTab] = useState<
      'strategy' | 'execution' | 'evidence' | 'dependencies' | 'history'
    >('strategy');
    const [aiLoading, setAiLoading] = useState(false);

    // Reset task when modal opens with new task
    useEffect(() => {
      setTask({ ...initialTask });
    }, [initialTask, isOpen]);

    // OPTIMIZED: Memoized callbacks to prevent unnecessary re-renders
    const handleSave = useCallback(() => {
      // Validation
      if (!task.title.trim()) {
        alert('Title is required');
        return;
      }

      // Strategic Validation
      if ((task.taskType as string) === 'DECISION') {
        if (!task.decisionImpact?.decisionStatement) {
          alert('Decision tasks require a Decision Statement.');
          setActiveTab('strategy');
          return;
        }
      }

      if (task.priority === 'urgent' && !task.expectedOutcome) {
        if (!confirm('Urgent tasks usually require an Expected Outcome. Save anyway?')) {
          setActiveTab('strategy');
          return;
        }
      }

      onSave(task);
      onClose();
    }, [task, onSave, onClose, setActiveTab]);

    const generateAiInsight = useCallback(async () => {
      setAiLoading(true);
      try {
        const insight = await (Api as any).generateTaskInsight(task, initiative);
        setTask((prev) => ({
          ...prev,
          aiInsight: insight,
        }));
      } catch (error) {
        console.error('AI Generation failed', error);
      } finally {
        setAiLoading(false);
      }
    }, [task, initiative]);

    if (!isOpen) return null;

    const getRiskColor = (risk?: RiskRating | string) => {
      // Handle RiskRating object or string legacy
      const val = (typeof risk === 'object' ? risk?.metric || '' : risk || '').toLowerCase();

      switch (val) {
        case 'critical':
          return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        case 'high':
          return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        case 'medium':
          return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        case 'low':
          return 'text-green-500 bg-green-500/10 border-green-500/20';
        default:
          return 'text-slate-600 dark:text-slate-500 bg-slate-400/10';
      }
    };

    const TASK_TYPES: string[] = ['task', 'bug', 'story', 'epic', 'subtask', 'pilot'];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-navy-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh]">
          {/* Initiative Context Banner */}
          {initiative && (
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-navy-700 bg-gradient-to-r from-blue-50 via-primary-50/50 to-transparent dark:from-blue-900/20 dark:via-primary-900/10 dark:to-transparent flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                  <Target size={12} className="text-slate-900 dark:text-white" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Initiative:
                </span>
                <span className="text-sm font-bold text-navy-900 dark:text-white">
                  {initiative.name}
                </span>
              </div>
              <div className="flex-1" />
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  initiative.status === 'DRAFT'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : initiative.status === 'PLANNING'
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : initiative.status === 'REVIEW'
                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
                        : initiative.status === 'APPROVED'
                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                          : initiative.status === 'EXECUTING'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                            : initiative.status === 'DONE'
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {initiative.status}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-500">
                {initiative.priority} Priority • {initiative.axis}
              </span>
            </div>
          )}

          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-navy-700 flex justify-between items-start bg-slate-50 dark:bg-navy-950 shrink-0">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                  {task.projectId
                    ? 'Project Task'
                    : initiative
                      ? 'Initiative Task'
                      : 'Standalone Task'}
                </span>
                <div className="h-4 w-[1px] bg-slate-300 dark:bg-white/10"></div>
                <select
                  value={task.taskType}
                  onChange={(e) => setTask({ ...task, taskType: e.target.value as TaskType })}
                  className="bg-transparent text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 outline-none border-b border-dashed border-blue-500/30 hover:text-blue-500 dark:hover:text-blue-300"
                >
                  {TASK_TYPES.map((t: any) => (
                    <option
                      key={t}
                      value={t}
                      className="bg-white dark:bg-navy-900 text-navy-900 dark:text-white"
                    >
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={task.title}
                onChange={(e) => setTask({ ...task, title: e.target.value })}
                className="bg-transparent text-2xl font-bold text-navy-900 dark:text-white w-full outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                placeholder="Enter task title..."
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white dark:bg-navy-950/50 p-1 rounded border border-slate-200 dark:border-navy-700 shadow-sm dark:shadow-none">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-600 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-white uppercase">
                  {task.assignee?.firstName?.[0] || '?'}
                </div>
                <select
                  className="bg-transparent text-sm text-navy-900 dark:text-slate-300 outline-none w-32"
                  value={task.assigneeId || ''}
                  onChange={(e) => setTask({ ...task, assigneeId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={onClose}
                className="text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main Content Layout */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT COLUMN: Sidebar Navigation & Metadata */}
            <div className="w-64 bg-slate-50 dark:bg-navy-950/50  border-slate-200 dark:border-navy-700 flex flex-col shrink-0">
              <nav className="p-2 space-y-1">
                {[
                  { id: 'strategy', label: 'Strategic Context', icon: Target },
                  { id: 'execution', label: 'Execution Plan', icon: Layout },
                  { id: 'evidence', label: 'Evidence of Done', icon: Shield },
                  { id: 'dependencies', label: 'Dependencies', icon: Link },
                  { id: 'history', label: 'Change Log', icon: History },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-blue-100 dark:bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-navy-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="mt-auto p-4 space-y-4 border-t border-slate-200 dark:border-navy-700">
                {/* AI Insight Card (Mini) */}
                <div className="bg-gradient-to-br from-primary-100 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border border-primary-200 dark:border-navy-700 rounded p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1">
                      <Sparkles size={12} /> AI Insight
                    </span>
                    <button
                      onClick={generateAiInsight}
                      disabled={aiLoading}
                      className="text-[10px] bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 px-2 py-0.5 rounded text-primary-600 dark:text-white transition-colors border border-primary-100 dark:border-transparent"
                    >
                      {aiLoading ? 'Thinking...' : 'Refresh'}
                    </button>
                  </div>
                  {task.aiInsight ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>
                          Relevance:{' '}
                          <span className="text-navy-900 dark:text-white">
                            {task.aiInsight.strategicRelevance}
                          </span>
                        </span>
                        <span>
                          Risk:{' '}
                          <span className="text-navy-900 dark:text-white">
                            {task.aiInsight.executionRisk}
                          </span>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed italic">
                        "{task.aiInsight.summary}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                      No insight generated yet.
                    </p>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] items-center gap-1 font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 flex">
                      <Calendar size={10} /> Due Date
                    </label>
                    <input
                      type="date"
                      value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                      onChange={(e) => setTask({ ...task, dueDate: e.target.value })}
                      className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Status
                      </label>
                      <select
                        value={task.status}
                        onChange={(e) => setTask({ ...task, status: e.target.value as TaskStatus })}
                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-1 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                      >
                        {['todo', 'in_progress', 'review', 'done', 'blocked'].map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ').toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Priority
                      </label>
                      <select
                        value={task.priority}
                        onChange={(e) => setTask({ ...task, priority: e.target.value as any })}
                        className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-1 py-1.5 text-xs text-navy-900 dark:text-slate-300"
                      >
                        {['low', 'medium', 'high', 'urgent'].map((p: any) => (
                          <option key={p} value={p}>
                            {p.toUpperCase()}
                          </option>
                        ))}
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
                      <Target size={16} className="text-primary-600 dark:text-primary-400" />{' '}
                      Expected Strategic Outcome
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                      What specifically will change in the business once this task is done?
                    </p>
                    <textarea
                      value={task.expectedOutcome || ''}
                      onChange={(e) => setTask({ ...task, expectedOutcome: e.target.value })}
                      className="w-full h-24 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 focus:border-primary-500/50 outline-none resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      placeholder="e.g., Reduce customer onboarding time by 20%..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-950/30 border border-slate-200 dark:border-navy-700">
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-3">
                        Decision Impact
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                            Decision Type
                          </label>
                          <select
                            value={task.decisionImpact?.decisionType || 'CONTINUE'}
                            onChange={(e) =>
                              setTask({
                                ...task,
                                decisionImpact: {
                                  ...task.decisionImpact,
                                  decisionType: e.target.value as any,
                                  decisionStatement: task.decisionImpact?.decisionStatement || '',
                                },
                              })
                            }
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-white"
                          >
                            {[
                              'CONTINUE',
                              'MOVE_TO_PILOT',
                              'MOVE_TO_SCALE',
                              'STOP',
                              'APPROVE_INVESTMENT',
                            ].map((d) => (
                              <option key={d} value={d}>
                                {d.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">
                            Decision Statement
                          </label>
                          <input
                            value={task.decisionImpact?.decisionStatement || ''}
                            onChange={(e) =>
                              setTask({
                                ...task,
                                decisionImpact: {
                                  ...task.decisionImpact,
                                  decisionType: task.decisionImpact?.decisionType || 'CONTINUE',
                                  decisionStatement: e.target.value,
                                },
                              })
                            }
                            className="w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            placeholder="If successful, we will..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Strategic Contribution (removed for now) */}
                  </div>
                </div>
              )}

              {activeTab === 'execution' && (
                <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                  <div>
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600 dark:text-blue-400" /> Detailed
                      Description
                    </h3>
                    <textarea
                      value={task.description || ''}
                      onChange={(e) => setTask({ ...task, description: e.target.value })}
                      className="w-full h-64 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-4 text-sm text-navy-900 dark:text-slate-300 focus:border-blue-500/50 outline-none resize-none font-mono leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      placeholder="Use markdown for detailed execution steps..."
                    />
                  </div>

                  {/* Task Weight for Progress Calculation */}
                  <div className="p-4 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold text-primary-700 dark:text-primary-400 flex items-center gap-2">
                        <Target size={14} /> Task Weight (Progress Impact)
                      </h3>
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {task.weight || 1}x
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                      Higher weight = more contribution to initiative progress when completed
                    </p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((w) => (
                        <button
                          key={w}
                          onClick={() => setTask({ ...task, weight: w })}
                          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                            (task.weight || 1) === w
                              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                              : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700 hover:border-primary-500/30'
                          }`}
                        >
                          {w}x
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={task.weightReason || ''}
                      onChange={(e) => setTask({ ...task, weightReason: e.target.value })}
                      className="mt-3 w-full bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-xs text-navy-900 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-primary-500/30"
                      placeholder="Reason for weight (e.g., Critical path item, High risk...)"
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-500/10">
                    <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
                      <AlertTriangle size={14} /> Blocking Issues / Risks
                    </h3>
                    <textarea
                      value={task.blockingIssues || ''}
                      onChange={(e) => setTask({ ...task, blockingIssues: e.target.value })}
                      className="w-full h-20 bg-transparent border-none text-sm text-navy-900 dark:text-slate-300 placeholder:text-rose-400/50 dark:placeholder:text-rose-500/30 outline-none resize-none"
                      placeholder="Describe any critical blockers..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="space-y-6 max-w-3xl animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                      <Shield size={16} className="text-green-600 dark:text-green-400" /> Evidence
                      of Done
                    </h3>
                  </div>

                  {/* Evidence Requirements */}
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-950/30 border border-slate-200 dark:border-navy-700 space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select required evidence types to mark this task as "Verified Done".
                    </p>
                    <div className="flex gap-4">
                      {['DOCUMENT', 'DATA', 'DEMO', 'APPROVAL'].map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            const current = Array.isArray(task.evidenceRequired)
                              ? task.evidenceRequired
                              : [];
                            if (current.includes(type as any)) {
                              setTask({
                                ...task,
                                evidenceRequired: (Array.isArray(current) ? current : []).filter(
                                  (t: any) => t !== type
                                ),
                              });
                            } else {
                              setTask({
                                ...task,
                                evidenceRequired: [...current, type as any],
                              });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            Array.isArray(task.evidenceRequired) &&
                            task.evidenceRequired.includes(type as any)
                              ? 'bg-green-100 dark:bg-green-500/20 border-green-500 dark:border-green-500/50 text-green-700 dark:text-green-400'
                              : 'bg-white dark:bg-transparent border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/30'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Acceptance Criteria */}
                  <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 block">
                      Detailed Acceptance Criteria
                    </label>
                    <textarea
                      value={
                        Array.isArray(task.acceptanceCriteria)
                          ? task.acceptanceCriteria.join('\n')
                          : String(task.acceptanceCriteria || '')
                      }
                      onChange={(e) =>
                        setTask({ ...task, acceptanceCriteria: e.target.value.split('\n') })
                      }
                      className="w-full h-40 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-sm text-navy-900 dark:text-slate-300 focus:border-green-500/30 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                      placeholder="- [ ] Metric A > 50%&#10;- [ ] User Flow Tested"
                    />
                  </div>

                  {/* Evidence Sign-off */}
                  <div
                    className={`p-5 rounded-xl border-2 transition-all ${
                      task.signedOff
                        ? 'bg-green-50 dark:bg-green-500/10 border-green-500'
                        : 'bg-amber-50 dark:bg-amber-500/10 border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                          {task.signedOff ? (
                            <>
                              <CheckSquare size={16} className="text-green-600" />
                              Evidence Signed Off
                            </>
                          ) : (
                            <>
                              <Shield size={16} className="text-amber-500" />
                              Evidence Awaiting Sign-off
                            </>
                          )}
                        </h4>
                        {task.signedOff && task.signedOffAt && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Signed by{' '}
                            {users.find((u) => u.id === task.signedOffBy)?.firstName || 'Unknown'}{' '}
                            {users.find((u) => u.id === task.signedOffBy)?.lastName || ''} on{' '}
                            {new Date(task.signedOffAt).toLocaleDateString()}
                          </p>
                        )}
                        {!task.signedOff && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            I confirm all required evidence has been collected and criteria met.
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (task.signedOff) {
                            // Remove sign-off
                            setTask({
                              ...task,
                              signedOff: false,
                              signedOffAt: undefined,
                              signedOffBy: undefined,
                            });
                          } else {
                            // Add sign-off
                            setTask({
                              ...task,
                              signedOff: true,
                              signedOffAt: new Date().toISOString(),
                              signedOffBy: currentUser.id,
                            });
                          }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          task.signedOff
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 hover:text-rose-600'
                            : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/30'
                        }`}
                      >
                        {task.signedOff ? 'Revoke Sign-off' : '✓ Sign Off Evidence'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'dependencies' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 space-y-4 animate-in fade-in">
                  <Link size={48} className="opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-500">
                      Dependency Management
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                      This module will allow visual linking between tasks (Blocks / Blocked By).
                      Coming in Phase 2.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4 animate-in fade-in">
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                    <History size={16} className="text-slate-600 dark:text-slate-500" /> Change Log
                  </h3>
                  <div className="space-y-3">
                    {task.changeLog && task.changeLog.length > 0 ? (
                      task.changeLog.map((log, i: number) => (
                        <div
                          key={i}
                          className="flex gap-3 text-xs p-3 rounded bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700"
                        >
                          <div className="mt-0.5">
                            <GitCommit size={14} className="text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <div className="text-navy-900 dark:text-slate-300">
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {log.changedBy}
                              </span>{' '}
                              changed{' '}
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                {log.field}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400">
                              <span className="line-through opacity-50">
                                {String(log.oldValue || 'empty').substring(0, 20)}
                              </span>
                              <span>→</span>
                              <span className="text-green-600 dark:text-green-400">
                                {String(log.newValue || 'empty').substring(0, 20)}
                              </span>
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-600">
                              {new Date(log.changedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                        No history available.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 flex justify-between items-center shrink-0">
            <div className="text-[10px] text-slate-500 dark:text-slate-600">
              {task.updatedAt ? `Last updated: ${new Date(task.updatedAt).toLocaleString()}` : ''}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg shadow-blue-900/20 text-sm font-medium flex items-center gap-2 transition-all"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if task data or isOpen changes
    return (
      prevProps.isOpen === nextProps.isOpen &&
      prevProps.task.id === nextProps.task.id &&
      JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task) &&
      (prevProps.users?.length || 0) === (nextProps.users?.length || 0)
    );
  }
);
