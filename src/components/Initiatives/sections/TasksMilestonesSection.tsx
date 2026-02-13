/**
 * TasksMilestonesSection
 *
 * Card-based task management for initiatives.
 * Inspired by ImplementationIdeasSection — each task has its own expandable card
 * with status indicator on the left, full task form, and inline editing.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  Loader2,
  Milestone,
  Plus,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps, TaskItem } from './types';

// ==========================================
// STATUS CONFIG
// ==========================================

const TASK_STATUS_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; color: string; dotColor: string; bgColor: string; textColor: string }
> = {
  todo: {
    label: { en: 'To Do', pl: 'Do zrobienia' },
    color: 'bg-slate-400',
    dotColor: 'bg-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-500/20',
    textColor: 'text-slate-600 dark:text-slate-400',
  },
  in_progress: {
    label: { en: 'In Progress', pl: 'W trakcie' },
    color: 'bg-blue-500',
    dotColor: 'bg-blue-500 animate-pulse',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  review: {
    label: { en: 'Review', pl: 'Przegląd' },
    color: 'bg-purple-500',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-100 dark:bg-purple-500/20',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  blocked: {
    label: { en: 'Blocked', pl: 'Zablokowane' },
    color: 'bg-red-500',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-100 dark:bg-red-500/20',
    textColor: 'text-red-600 dark:text-red-400',
  },
  done: {
    label: { en: 'Done', pl: 'Ukończone' },
    color: 'bg-emerald-500',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-500/20',
    textColor: 'text-emerald-600 dark:text-emerald-400',
  },
};

const PRIORITY_CONFIG: Record<string, { label: { en: string; pl: string }; color: string }> = {
  low: { label: { en: 'Low', pl: 'Niski' }, color: 'text-slate-500' },
  medium: { label: { en: 'Medium', pl: 'Średni' }, color: 'text-blue-500' },
  high: { label: { en: 'High', pl: 'Wysoki' }, color: 'text-orange-500' },
  urgent: { label: { en: 'Urgent', pl: 'Pilny' }, color: 'text-red-500' },
  critical: { label: { en: 'Critical', pl: 'Krytyczny' }, color: 'text-red-600 font-bold' },
};

const TASK_TYPE_OPTIONS = [
  { value: 'execution', label: { en: 'Execution', pl: 'Realizacja' } },
  { value: 'analysis', label: { en: 'Analysis', pl: 'Analiza' } },
  { value: 'decision', label: { en: 'Decision', pl: 'Decyzja' } },
  { value: 'design', label: { en: 'Design', pl: 'Projekt' } },
  { value: 'build', label: { en: 'Build', pl: 'Budowa' } },
  { value: 'test', label: { en: 'Test', pl: 'Test' } },
  { value: 'deploy', label: { en: 'Deploy', pl: 'Wdrożenie' } },
  { value: 'other', label: { en: 'Other', pl: 'Inne' } },
];

// ==========================================
// SOURCE CONFIG (Manual / AI)
// ==========================================

const SOURCE_CONFIG: Record<
  string,
  { label: { en: string; pl: string }; icon: typeof User; color: string }
> = {
  manual: {
    label: { en: 'Manual', pl: 'Ręczny' },
    icon: User,
    color: 'text-slate-500 dark:text-slate-400',
  },
  ai: {
    label: { en: 'AI', pl: 'AI' },
    icon: Sparkles,
    color: 'text-violet-500 dark:text-violet-400',
  },
};

// ==========================================
// HELPER: normalize status for case-insensitive lookup
// ==========================================
function normalizeStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower === 'in_progress' || lower === 'inprogress') return 'in_progress';
  if (lower === 'todo' || lower === 'to_do') return 'todo';
  if (lower === 'done' || lower === 'completed') return 'done';
  if (lower === 'blocked') return 'blocked';
  if (lower === 'review' || lower === 'in_review') return 'review';
  return lower;
}

// ==========================================
// TASK CARD COMPONENT
// ==========================================

interface TaskCardProps {
  task: TaskItem;
  isPolish: boolean;
  isNew?: boolean;
  users: { id: string; firstName: string; lastName: string; email?: string }[];
  onUpdate: (id: string, updates: Partial<TaskItem> & Record<string, any>) => void;
  onRemove: (id: string) => void;
  onOpen?: (id: string) => void;
  readOnly?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isPolish,
  isNew,
  users,
  onUpdate,
  onRemove,
  onOpen,
  readOnly,
}) => {
  const [expanded, setExpanded] = useState(isNew || false);
  const status = normalizeStatus(task.status);
  const statusConfig = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.todo;
  const isDone = status === 'done';
  const isBlocked = status === 'blocked';

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-xl border transition-all ${
        isDone
          ? 'border-emerald-300/50 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-500/5'
          : isBlocked
            ? 'border-red-300/50 dark:border-red-500/30 bg-red-50/30 dark:bg-red-500/5'
            : task.source === 'ai'
              ? expanded
                ? 'border-violet-300 dark:border-violet-500/50 bg-violet-50/30 dark:bg-violet-500/5'
                : 'border-violet-200/60 dark:border-violet-500/30 bg-violet-50/20 dark:bg-violet-500/5'
              : expanded
                ? 'border-emerald-300 dark:border-emerald-500/50 bg-white dark:bg-navy-900/80'
                : 'border-slate-200 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-800/50'
      }`}
    >
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Status indicator (left side) */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${statusConfig.dotColor}`} />
          <div className={`w-0.5 flex-1 min-h-[12px] rounded-full ${statusConfig.color} opacity-30`} />
        </div>

        {/* Title + tags */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={task.title}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate(task.id, { title: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full text-sm font-medium bg-transparent focus:outline-none truncate ${
              isDone
                ? 'text-slate-400 line-through'
                : 'text-slate-700 dark:text-slate-200'
            }`}
            placeholder={isPolish ? 'Nazwa zadania...' : 'Task name...'}
            readOnly={readOnly}
          />
          <div className="flex items-center gap-2 mt-1">
            {/* Source badge (Manual / AI) */}
            {(() => {
              const src = task.source || 'manual';
              const srcConfig = SOURCE_CONFIG[src] || SOURCE_CONFIG.manual;
              const SrcIcon = srcConfig.icon;
              return (
                <span className={`flex items-center gap-0.5 text-[10px] font-medium ${srcConfig.color}`}>
                  <SrcIcon size={9} />
                  {isPolish ? srcConfig.label.pl : srcConfig.label.en}
                </span>
              );
            })()}
            {/* Priority badge */}
            {task.priority && (
              <span className={`text-[10px] font-medium ${PRIORITY_CONFIG[task.priority.toLowerCase()]?.color || 'text-slate-500'}`}>
                {isPolish
                  ? PRIORITY_CONFIG[task.priority.toLowerCase()]?.label.pl || task.priority
                  : PRIORITY_CONFIG[task.priority.toLowerCase()]?.label.en || task.priority}
              </span>
            )}
            {/* Assignee */}
            {task.assigneeName && (
              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                <User size={9} />
                {task.assigneeName}
              </span>
            )}
            {/* Due date */}
            {task.dueDate && (
              <span
                className={`text-[10px] flex items-center gap-0.5 ${
                  !isDone && new Date(task.dueDate) < new Date()
                    ? 'text-red-500 font-medium'
                    : 'text-slate-400'
                }`}
              >
                <Calendar size={9} />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {/* Milestone badge */}
            {task.isMilestone && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-0.5">
                <Milestone size={9} />
                {isPolish ? 'Kamień milowy' : 'Milestone'}
              </span>
            )}
          </div>
        </div>

        {/* Right side: status dropdown + actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={status}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate(task.id, { status: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={readOnly}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border-0 cursor-pointer focus:outline-none ${statusConfig.bgColor} ${statusConfig.textColor}`}
          >
            {Object.entries(TASK_STATUS_CONFIG).map(([key, config]) => (
              <option key={key} value={key}>
                {isPolish ? config.label.pl : config.label.en}
              </option>
            ))}
          </select>

          {onOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen(task.id);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title={isPolish ? 'Otwórz w pełnym widoku' : 'Open full view'}
            >
              <ExternalLink size={14} />
            </button>
          )}

          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(task.id);
              }}
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}

          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-navy-600 space-y-3">
              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                  {isPolish ? 'Opis / podejście' : 'Description / approach'}
                </label>
                <textarea
                  value={task.description || ''}
                  onChange={(e) => onUpdate(task.id, { description: e.target.value })}
                  rows={3}
                  disabled={readOnly}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 resize-y"
                  placeholder={isPolish ? 'Opisz podejście, kroki, narzędzia...' : 'Describe the approach, steps, tools...'}
                />
              </div>

              {/* Row: Priority + Task Type + Estimated Hours */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {isPolish ? 'Priorytet' : 'Priority'}
                  </label>
                  <select
                    value={(task.priority || 'medium').toLowerCase()}
                    onChange={(e) => onUpdate(task.id, { priority: e.target.value })}
                    disabled={readOnly}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>
                        {isPolish ? config.label.pl : config.label.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {isPolish ? 'Typ zadania' : 'Task type'}
                  </label>
                  <select
                    value={(task as any).taskType || 'execution'}
                    onChange={(e) => onUpdate(task.id, { taskType: e.target.value })}
                    disabled={readOnly}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                  >
                    {TASK_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isPolish ? opt.label.pl : opt.label.en}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {isPolish ? 'Estymacja (h)' : 'Estimate (h)'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-slate-400 flex-shrink-0" />
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={(task as any).estimatedHours || ''}
                      onChange={(e) =>
                        onUpdate(task.id, {
                          estimatedHours: e.target.value ? parseFloat(e.target.value) : null,
                        })
                      }
                      disabled={readOnly}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Row: Assignee + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {isPolish ? 'Przypisany do' : 'Assignee'}
                  </label>
                  <select
                    value={(task as any).assigneeId || ''}
                    onChange={(e) => {
                      const userId = e.target.value;
                      const user = users.find((u) => u.id === userId);
                      onUpdate(task.id, {
                        assigneeId: userId || null,
                        assigneeName: user
                          ? `${user.firstName} ${user.lastName}`.trim()
                          : undefined,
                      });
                    }}
                    disabled={readOnly}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                  >
                    <option value="">{isPolish ? '— Nie przypisano —' : '— Unassigned —'}</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    {isPolish ? 'Termin' : 'Due date'}
                  </label>
                  <input
                    type="date"
                    value={task.dueDate ? task.dueDate.split('T')[0] : ''}
                    onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
                    disabled={readOnly}
                    className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              {/* Milestone toggle */}
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={task.isMilestone || false}
                    onChange={(e) => onUpdate(task.id, { isMilestone: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Milestone size={12} />
                    {isPolish ? 'Kamień milowy' : 'Milestone'}
                  </span>
                </label>
                {task.isMilestone && (
                  <input
                    type="date"
                    value={task.milestoneDate ? task.milestoneDate.split('T')[0] : ''}
                    onChange={(e) => onUpdate(task.id, { milestoneDate: e.target.value || null })}
                    disabled={readOnly}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-purple-400"
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface TaskDraft {
  title: string;
  description: string;
  status: string;
  priority: string;
  taskType: string;
  source: 'manual' | 'ai';
  dueDate?: string;
  assigneeId?: string;
  estimatedHours?: number | null;
}

const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  taskType: 'execution',
  source: 'manual',
  dueDate: '',
  assigneeId: '',
  estimatedHours: null,
};

// ==========================================
// MAIN SECTION COMPONENT
// ==========================================

export const TasksMilestonesSection: React.FC<InitiativeSectionProps> = ({
  expanded,
  onToggle,
  readonly,
}) => {
  const {
    tasks,
    setTasks,
    tasksDone,
    milestones,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    onOpenTask,
    users,
    initiative,
    showCreateTask,
    setShowCreateTask,
  } = useInitiativeContext();

  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'blocked' | 'done'>('all');
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const addTriggered = useRef(false);
  const initiativeId = initiative?.id;
  const projectId =
    initiative?.projectId || initiative?.project_id || initiative?.project?.id || null;

  const filteredTasks = useMemo(() => {
    const nonMilestone = tasks.filter((t) => !t.isMilestone);
    switch (activeFilter) {
      case 'open':
        return nonMilestone.filter(
          (t) => !['done', 'DONE', 'blocked', 'BLOCKED'].includes(t.status)
        );
      case 'blocked':
        return nonMilestone.filter((t) => ['blocked', 'BLOCKED'].includes(t.status));
      case 'done':
        return nonMilestone.filter((t) => ['done', 'DONE'].includes(t.status));
      default:
        return nonMilestone;
    }
  }, [tasks, activeFilter]);

  const openTaskDraft = useCallback(
    (overrides?: Partial<TaskDraft>) => {
      const defaultTitle = isPolish ? 'Nowe zadanie' : 'New task';
      setTaskDraft({
        ...EMPTY_TASK_DRAFT,
        title: defaultTitle,
        ...overrides,
      });
    },
    [isPolish]
  );

  const createTaskArtifact = useCallback(async (draft: TaskDraft) => {
    if (!initiativeId) return;
    const safeTitle = (draft.title || '').trim() || (isPolish ? 'Nowe zadanie' : 'New task');

    const res = await Api.post('/tasks', {
      title: safeTitle,
      description: draft.description || '',
      projectId,
      initiativeId,
      status: draft.status || 'todo',
      priority: draft.priority || 'medium',
      taskType: draft.taskType || 'execution',
      source: draft.source || 'manual',
      dueDate: draft.dueDate || null,
      assigneeId: draft.assigneeId || null,
      estimatedHours: draft.estimatedHours ?? null,
    });

    const selectedUser = users.find((u) => u.id === (draft.assigneeId || ''));
    const newTask: TaskItem = {
      id: res.id,
      title: safeTitle,
      description: draft.description || '',
      status: draft.status || 'todo',
      priority: draft.priority || 'medium',
      taskType: draft.taskType || 'execution',
      dueDate: draft.dueDate || undefined,
      assigneeId: draft.assigneeId || undefined,
      assigneeName: selectedUser
        ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim()
        : undefined,
      estimatedHours: draft.estimatedHours ?? null,
      isMilestone: false,
      milestoneDate: undefined,
      source: draft.source || 'manual',
    };

    setTasks((prev) => [...prev, newTask]);
    setNewTaskIds((prev) => new Set(prev).add(res.id));
  }, [initiativeId, isPolish, projectId, setTasks, users]);

  // Open create frame (manual source)
  const handleAddTask = useCallback(() => {
    openTaskDraft({ source: 'manual' });
  }, [openTaskDraft]);

  const handleCreateTaskFromDraft = useCallback(async () => {
    if (!taskDraft || isCreatingTask) return;
    setIsCreatingTask(true);
    try {
      await createTaskArtifact(taskDraft);
      setTaskDraft(null);
    } catch (e: any) {
      toast.error(isPolish ? 'Nie udało się utworzyć zadania' : 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  }, [taskDraft, isCreatingTask, createTaskArtifact, isPolish]);

  // Add AI-generated task (creates artifact via API)
  const handleAddAITask = useCallback(
    async (aiTask: { title: string; description?: string; priority?: string; taskType?: string }) => {
      if (!initiativeId) return;
      try {
        await createTaskArtifact({
          ...EMPTY_TASK_DRAFT,
          title: aiTask.title || '',
          description: aiTask.description || '',
          priority: aiTask.priority || 'medium',
          taskType: aiTask.taskType || 'execution',
          source: 'ai',
        });
      } catch {
        // silent — toast already shown by handleGenerateAI
      }
    },
    [initiativeId, createTaskArtifact]
  );

  // Update task locally + persist to API
  const handleUpdateTask = useCallback(
    async (id: string, updates: Partial<TaskItem> & Record<string, any>) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
      // Persist (debounced would be better, but simple approach for now)
      try {
        await Api.patch(`/tasks/${id}`, updates);
      } catch {
        // Revert would be complex; leave optimistic for now
      }
    },
    [setTasks]
  );

  // Remove task
  const handleRemoveTask = useCallback(
    async (id: string) => {
      try {
        await Api.delete(`/tasks/${id}`);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setNewTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success(isPolish ? 'Zadanie usunięte' : 'Task removed');
      } catch {
        toast.error(isPolish ? 'Nie udało się usunąć' : 'Failed to remove');
      }
    },
    [isPolish, setTasks]
  );

  // When "New Task" button in toolbar triggers showCreateTask, auto-add a task card
  useEffect(() => {
    if (showCreateTask && !addTriggered.current) {
      addTriggered.current = true;
      openTaskDraft({ source: 'manual' });
      setShowCreateTask(false);
      setTimeout(() => {
        addTriggered.current = false;
      }, 300);
    }
  }, [showCreateTask, openTaskDraft, setShowCreateTask]);

  return (
    <CollapsibleSection
      id="tasks"
      title={isPolish ? 'Zadania i kamienie milowe' : 'Tasks & Milestones'}
      icon={<CheckSquare size={18} className="text-emerald-500 dark:text-emerald-400" />}
      iconBg="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {milestones.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 flex items-center gap-1">
              <Milestone size={10} />
              {milestones.length}
            </span>
          )}
          <span className="text-xs text-slate-400">
            {tasksDone}/{tasks.length}
          </span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleAddTask();
            }}
            disabled={readonly}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium transition-all"
          >
            <Plus size={14} />
            <span>{isPolish ? 'Nowe' : 'New'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async (e) => {
              e.stopPropagation();
              const result = await handleGenerateAI('tasks');
              // Process AI result and create task artifacts
              if (result) {
                const content = result.parsedContent || result.content;
                let aiTasks: any[] = [];
                if (Array.isArray(content)) {
                  aiTasks = content;
                } else if (typeof content === 'object' && content?.tasks) {
                  aiTasks = content.tasks;
                } else if (typeof content === 'string') {
                  try {
                    const parsed = JSON.parse(content);
                    aiTasks = Array.isArray(parsed) ? parsed : parsed?.tasks || [];
                  } catch {
                    // Not JSON — ignore
                  }
                }
                for (const t of aiTasks) {
                  await handleAddAITask({
                    title: t.title || t.name || '',
                    description: t.description || t.approach || '',
                    priority: t.priority || 'medium',
                    taskType: t.taskType || t.type || 'execution',
                  });
                }
              }
            }}
            disabled={readonly || isGeneratingAI === 'tasks'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
            title={isPolish ? 'AI zasugeruje zadania' : 'AI will suggest tasks'}
          >
            {isGeneratingAI === 'tasks' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {/* Create Task Frame */}
      {!readonly && taskDraft && (
        <div className="mb-3 rounded-xl border border-emerald-300 dark:border-emerald-500/50 bg-white dark:bg-navy-900/80">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-600">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div className="w-0.5 h-4 rounded-full bg-emerald-500/30" />
              </div>
              <input
                type="text"
                value={taskDraft.title}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                className="w-full text-sm font-medium bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
                placeholder={isPolish ? 'Nazwa zadania...' : 'Task name...'}
              />
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            <textarea
              value={taskDraft.description}
              onChange={(e) =>
                setTaskDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))
              }
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:border-emerald-400 resize-y"
              placeholder={isPolish ? 'Opisz podejście, kroki, narzędzia...' : 'Describe the approach, steps, tools...'}
            />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select
                value={taskDraft.status}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, status: e.target.value } : prev))}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                {Object.entries(TASK_STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {isPolish ? config.label.pl : config.label.en}
                  </option>
                ))}
              </select>
              <select
                value={taskDraft.priority}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, priority: e.target.value } : prev))}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {isPolish ? config.label.pl : config.label.en}
                  </option>
                ))}
              </select>
              <select
                value={taskDraft.taskType}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, taskType: e.target.value } : prev))}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                {TASK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {isPolish ? opt.label.pl : opt.label.en}
                  </option>
                ))}
              </select>
              <select
                value={taskDraft.source}
                onChange={(e) =>
                  setTaskDraft((prev) =>
                    prev ? { ...prev, source: e.target.value === 'ai' ? 'ai' : 'manual' } : prev
                  )
                }
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                <option value="manual">{isPolish ? 'Ręcznie' : 'Manual'}</option>
                <option value="ai">AI</option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <input
                type="date"
                value={taskDraft.dueDate || ''}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, dueDate: e.target.value } : prev))}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              />
              <select
                value={taskDraft.assigneeId || ''}
                onChange={(e) => setTaskDraft((prev) => (prev ? { ...prev, assigneeId: e.target.value } : prev))}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              >
                <option value="">{isPolish ? '— Nie przypisano —' : '— Unassigned —'}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step={0.5}
                value={taskDraft.estimatedHours ?? ''}
                onChange={(e) =>
                  setTaskDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          estimatedHours: e.target.value ? parseFloat(e.target.value) : null,
                        }
                      : prev
                  )
                }
                placeholder={isPolish ? 'Estymacja (h)' : 'Estimate (h)'}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setTaskDraft(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateTaskFromDraft}
                disabled={isCreatingTask}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/90 text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
              >
                {isCreatingTask
                  ? isPolish
                    ? 'Tworzenie...'
                    : 'Creating...'
                  : isPolish
                    ? 'Zapisz task'
                    : 'Save task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
            {isPolish ? 'ZADANIA' : 'TASKS'} ({filteredTasks.length})
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-1 mb-3 p-1 bg-slate-100/50 dark:bg-navy-800/50 rounded-lg">
          {[
            {
              key: 'all' as const,
              label: isPolish ? 'Wszystkie' : 'All',
              count: tasks.filter((t) => !t.isMilestone).length,
            },
            {
              key: 'open' as const,
              label: isPolish ? 'Otwarte' : 'Open',
              count: tasks.filter(
                (t) => !t.isMilestone && !['done', 'DONE'].includes(t.status)
              ).length,
            },
            {
              key: 'blocked' as const,
              label: isPolish ? 'Zablokowane' : 'Blocked',
              count: tasks.filter((t) => ['blocked', 'BLOCKED'].includes(t.status)).length,
            },
            {
              key: 'done' as const,
              label: isPolish ? 'Ukończone' : 'Done',
              count: tasks.filter((t) => ['done', 'DONE'].includes(t.status)).length,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                activeFilter === tab.key
                  ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                  : tab.count > 0 || tab.key === 'all'
                    ? 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-navy-700/50'
                    : 'text-slate-300 dark:text-slate-600 cursor-default'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-[9px] text-slate-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Task Cards */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <CheckSquare size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak zadań' : 'No tasks yet'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isPolish
              ? 'Dodaj zadanie ręcznie lub pozwól AI zasugerować'
              : 'Add tasks manually or let AI suggest them'}
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400">
            {isPolish ? 'Brak zadań w tym filtrze' : 'No tasks match this filter'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isPolish={isPolish}
                isNew={newTaskIds.has(task.id)}
                users={users}
                onUpdate={handleUpdateTask}
                onRemove={handleRemoveTask}
                onOpen={onOpenTask}
                readOnly={readonly}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add Task Button */}
      <div className="mt-3">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleAddTask}
          disabled={readonly}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <Plus size={18} />
          <span className="text-sm font-medium">
            {isPolish ? 'Dodaj zadanie' : 'Add task'}
          </span>
        </motion.button>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{isPolish ? 'Postęp' : 'Progress'}</span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {Math.round((tasksDone / tasks.length) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(tasksDone / tasks.length) * 100}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
        </div>
      )}

      {/* Source counter (AI vs Manual) */}
      {tasks.length > 0 && (() => {
        const aiCount = tasks.filter((t) => t.source === 'ai').length;
        const manualCount = tasks.length - aiCount;
        return (
          <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <User size={10} className="text-slate-400" />
              {manualCount} {isPolish ? 'ręcznych' : 'manual'}
            </span>
            {aiCount > 0 && (
              <span className="flex items-center gap-1">
                <Sparkles size={10} className="text-violet-400" />
                {aiCount} AI
              </span>
            )}
          </div>
        );
      })()}
    </CollapsibleSection>
  );
};
