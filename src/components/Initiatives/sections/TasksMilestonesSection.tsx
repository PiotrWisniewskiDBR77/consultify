/**
 * TasksMilestonesSection
 *
 * Card-based task management for initiatives.
 * Inspired by ImplementationIdeasSection — each task has its own expandable card
 * with status indicator on the left, full task form, and inline editing.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ExternalLink, MoreVertical, Plus, Sparkles, Trash2, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps, TaskItem } from './types';

// ==========================================
// STATUS CONFIG
// ==========================================

const TASK_STATUS_CONFIG: Record<
  string,
  {
    label: { en: string; pl: string };
    color: string;
    dotColor: string;
    bgColor: string;
    textColor: string;
  }
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

const formatDueDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
};

// ==========================================
// MAIN SECTION COMPONENT
// ==========================================

export const TasksMilestonesSection: React.FC<InitiativeSectionProps> = ({ readonly }) => {
  const {
    tasks,
    setTasks,
    tasksDone,
    isPolish,
    onOpenTask,
    users,
    initiative,
    showCreateTask,
    setShowCreateTask,
  } = useInitiativeContext();

  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [demoRowsInjected, setDemoRowsInjected] = useState(false);
  const addTriggered = useRef(false);
  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const initiativeId = initiative?.id;
  const projectId =
    initiative?.projectId || initiative?.project_id || initiative?.project?.id || null;

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return ad - bd;
    });
  }, [tasks]);

  const closeMenu = useCallback(() => setMenuTaskId(null), []);

  useEffect(() => {
    if (!menuTaskId) return;
    const onDocClick = () => setMenuTaskId(null);
    const t = setTimeout(() => document.addEventListener('click', onDocClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', onDocClick);
    };
  }, [menuTaskId]);

  useEffect(() => {
    if (isAddingInline) {
      setTimeout(() => quickInputRef.current?.focus(), 20);
    }
  }, [isAddingInline]);

  const createTaskArtifact = useCallback(
    async (
      title: string,
      source: 'manual' | 'ai' = 'manual',
      options?: {
        description?: string;
        status?: string;
        priority?: string;
        dueDate?: string | null;
        assigneeId?: string | null;
      }
    ) => {
      if (!initiativeId) return;
      const safeTitle = (title || '').trim() || (isPolish ? 'Nowe zadanie' : 'New task');

      const res = await Api.post('/tasks', {
        title: safeTitle,
        description: options?.description || '',
        projectId,
        initiativeId,
        status: options?.status || 'todo',
        priority: options?.priority || 'medium',
        taskType: 'execution',
        source,
        dueDate: options?.dueDate || null,
        assigneeId: options?.assigneeId || null,
        estimatedHours: null,
      });

      const selectedUser = users.find((u) => u.id === (options?.assigneeId || ''));

      const newTask: TaskItem = {
        id: res.id,
        title: safeTitle,
        description: options?.description || '',
        status: options?.status || 'todo',
        priority: options?.priority || 'medium',
        taskType: 'execution',
        dueDate: options?.dueDate || undefined,
        assigneeId: options?.assigneeId || undefined,
        assigneeName: selectedUser
          ? `${selectedUser.firstName} ${selectedUser.lastName}`.trim()
          : undefined,
        estimatedHours: null,
        isMilestone: false,
        milestoneDate: undefined,
        source,
      };

      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [initiativeId, isPolish, projectId, setTasks, users]
  );

  const handleStartInlineAdd = useCallback(() => {
    if (readonly) return;
    setIsAddingInline(true);
    setNewTaskTitle('');
  }, [readonly]);

  const handleCreateInlineTask = useCallback(async () => {
    if (isCreatingTask) return;
    setIsCreatingTask(true);
    try {
      const created = await createTaskArtifact(newTaskTitle, 'manual');
      setIsAddingInline(false);
      setNewTaskTitle('');
      if (created?.id && onOpenTask) onOpenTask(created.id);
    } catch (e: any) {
      toast.error(isPolish ? 'Nie udało się utworzyć zadania' : 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  }, [isCreatingTask, createTaskArtifact, newTaskTitle, isPolish, onOpenTask]);

  // Remove task
  const handleRemoveTask = useCallback(
    async (id: string) => {
      try {
        await Api.delete(`/tasks/${id}`);
        setTasks((prev) => prev.filter((t) => t.id !== id));
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
      handleStartInlineAdd();
      setShowCreateTask(false);
      setTimeout(() => {
        addTriggered.current = false;
      }, 300);
    }
  }, [showCreateTask, handleStartInlineAdd, setShowCreateTask]);

  useEffect(() => {
    setDemoRowsInjected(false);
  }, [initiativeId]);

  useEffect(() => {
    if (!initiativeId || demoRowsInjected) return;
    const hasLegacyDemo = tasks.some((t) => String(t.id).startsWith('demo-task-'));
    const nonDemoCount = tasks.filter((t) => !String(t.id).startsWith('demo-task-')).length;
    if (tasks.length > 0 && !hasLegacyDemo) return;
    let cancelled = false;
    const run = async () => {
      const now = Date.now();
      const inDays = (days: number) => new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
      let createdAny = false;
      try {
        if (hasLegacyDemo) {
          if (nonDemoCount > 0) {
            setTasks((prev) => prev.filter((t) => !String(t.id).startsWith('demo-task-')));
            setDemoRowsInjected(true);
            return;
          }
          setTasks([]);
        }
        await createTaskArtifact('Kick-off and scope alignment', 'manual', {
          description: 'Initial workshop and scope confirmation.',
          status: 'done',
          priority: 'high',
          dueDate: inDays(-2),
          assigneeId: users[0]?.id || null,
        });
        createdAny = true;
        await createTaskArtifact('Define target process and acceptance criteria', 'manual', {
          description: 'Define measurable criteria for successful rollout.',
          status: 'in_progress',
          priority: 'critical',
          dueDate: inDays(5),
          assigneeId: users[1]?.id || null,
        });
        createdAny = true;
        await createTaskArtifact('Prepare pilot environment', 'ai', {
          description: 'Create pilot environment and validate readiness checklist.',
          status: 'todo',
          priority: 'medium',
          dueDate: inDays(12),
          assigneeId: users[2]?.id || null,
        });
        createdAny = true;
      } catch {
        // keep silent; UI works without demo seed
      } finally {
        if (!cancelled && (createdAny || tasks.length > 0)) setDemoRowsInjected(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [initiativeId, demoRowsInjected, tasks, createTaskArtifact, users, setTasks]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {isPolish ? 'Tasks' : 'Tasks'}
          </h2>
          {tasks.length > 0 && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readonly && (
            <button
              onClick={handleStartInlineAdd}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <Plus size={12} />
              {isPolish ? 'Dodaj task' : 'Add task'}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 dark:border-navy-700/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-navy-800/30 border-b border-slate-200 dark:border-navy-700/40">
              <th className="text-left py-2.5 pl-3 pr-2">{isPolish ? 'Task' : 'Task'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Status' : 'Status'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Owner' : 'Owner'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Due' : 'Due'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Priority' : 'Priority'}</th>
              <th className="text-left py-2.5 pr-2">{isPolish ? 'Source' : 'Source'}</th>
              <th className="text-right py-2.5 pr-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-navy-700/40">
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task) => {
                const status = normalizeStatus(task.status || 'todo');
                const statusConfig = TASK_STATUS_CONFIG[status] || TASK_STATUS_CONFIG.todo;
                const source = task.source || 'manual';
                const sourceCfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
                const priorityKey = String(task.priority || 'medium').toLowerCase();
                return (
                  <motion.tr
                    key={task.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group hover:bg-slate-50/50 dark:hover:bg-navy-800/20 transition-colors"
                  >
                    <td className="py-2.5 pl-3 pr-2">
                      <button
                        onClick={() => onOpenTask?.(task.id)}
                        className="text-left text-slate-700 dark:text-slate-200 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                      >
                        {task.title || (isPolish ? 'Bez nazwy' : 'Untitled')}
                      </button>
                    </td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${statusConfig.bgColor} ${statusConfig.textColor}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.color}`} />
                        {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-slate-600 dark:text-slate-300">
                      {task.assigneeName || '—'}
                    </td>
                    <td className="py-2.5 pr-2 text-xs text-slate-500 dark:text-slate-400">
                      {task.dueDate ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={11} />
                          {formatDueDate(task.dueDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={PRIORITY_CONFIG[priorityKey]?.color || 'text-slate-500'}>
                        {isPolish
                          ? PRIORITY_CONFIG[priorityKey]?.label.pl || task.priority || '—'
                          : PRIORITY_CONFIG[priorityKey]?.label.en || task.priority || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-xs">
                      <span className={`inline-flex items-center gap-1 ${sourceCfg.color}`}>
                        <sourceCfg.icon size={10} />
                        {isPolish ? sourceCfg.label.pl : sourceCfg.label.en}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuTaskId((prev) => (prev === task.id ? null : task.id));
                        }}
                        className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/10 transition-colors"
                        title={isPolish ? 'Akcje' : 'Actions'}
                      >
                        <MoreVertical size={14} />
                      </button>
                      {menuTaskId === task.id && (
                        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 dark:border-navy-700/70 bg-white dark:bg-navy-900 p-1.5 shadow-xl shadow-slate-900/10 dark:shadow-black/30">
                          <button
                            onClick={() => {
                              closeMenu();
                              onOpenTask?.(task.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                          >
                            <ExternalLink size={13} />
                            {isPolish ? 'Otwórz kartę' : 'Open card'}
                          </button>
                          {!readonly && (
                            <>
                              <div className="my-1 border-t border-slate-100 dark:border-navy-700/50" />
                              <button
                                onClick={() => {
                                  closeMenu();
                                  void handleRemoveTask(task.id);
                                }}
                                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={13} />
                                {isPolish ? 'Usuń' : 'Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {!readonly && isAddingInline && (
              <tr className="bg-emerald-50/30 dark:bg-emerald-500/5">
                <td className="py-2.5 pl-3 pr-2" colSpan={6}>
                  <input
                    ref={quickInputRef}
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateInlineTask();
                      }
                      if (e.key === 'Escape') {
                        setIsAddingInline(false);
                        setNewTaskTitle('');
                      }
                    }}
                    placeholder={
                      isPolish
                        ? 'Wpisz nazwę taska i Enter...'
                        : 'Type task name and press Enter...'
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-emerald-300 dark:border-emerald-500/40 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setIsAddingInline(false);
                        setNewTaskTitle('');
                      }}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => void handleCreateInlineTask()}
                      disabled={isCreatingTask}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                    >
                      {isCreatingTask
                        ? isPolish
                          ? 'Tworzenie...'
                          : 'Creating...'
                        : isPolish
                          ? 'Utwórz'
                          : 'Create'}
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {sortedTasks.length === 0 && readonly && (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {isPolish ? 'Brak tasków' : 'No tasks yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tasks.length > 0 && (
        <div className="pt-2 border-t border-slate-200/70 dark:border-navy-700/50 text-xs text-slate-500 dark:text-slate-400">
          {tasksDone}/{tasks.length} {isPolish ? 'ukończone' : 'done'}
        </div>
      )}
    </motion.div>
  );
};
