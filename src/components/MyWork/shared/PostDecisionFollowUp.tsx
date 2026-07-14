import { ListTodo, Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

interface PostDecisionFollowUpProps {
  decision: {
    id: string;
    title: string;
    status: string;
    description?: string;
    category?: string;
  };
  onClose: () => void;
  onTasksCreated?: (count: number) => void;
}

function buildSuggestions(title: string, status: string, isPl: boolean): string[] {
  if (status === 'approved') {
    return isPl
      ? [
          `Wdrożenie decyzji: ${title}`,
          `Powiadomienie interesariuszy o: ${title}`,
          `Aktualizacja dokumentacji dla: ${title}`,
        ]
      : [
          `Implement decision: ${title}`,
          `Notify stakeholders about: ${title}`,
          `Update documentation for: ${title}`,
        ];
  }
  return isPl
    ? [
        `Komunikacja odrzucenia: ${title}`,
        `Udokumentowanie uzasadnienia odrzucenia: ${title}`,
        `Zaproponowanie alternatywy dla: ${title}`,
      ]
    : [
        `Communicate rejection of: ${title}`,
        `Document rationale for rejecting: ${title}`,
        `Propose alternative for: ${title}`,
      ];
}

export const PostDecisionFollowUp: React.FC<PostDecisionFollowUpProps> = ({
  decision,
  onClose,
  onTasksCreated,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { emitMyWorkEvent } = useAppStore();

  const [tasks, setTasks] = useState<string[]>(() =>
    buildSuggestions(decision.title, decision.status, isPl)
  );
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [creating, setCreating] = useState(false);

  const updateTask = useCallback((idx: number, value: string) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? value : t)));
  }, []);

  const removeTask = useCallback((idx: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const addTask = useCallback(() => {
    setTasks((prev) => [...prev, '']);
  }, []);

  const handleCreate = useCallback(async () => {
    const validTasks = tasks.filter((t) => t.trim().length > 0);
    if (validTasks.length === 0) return;

    setCreating(true);
    let createdCount = 0;

    try {
      for (const title of validTasks) {
        const result = await Api.createPersonalTask({
          title,
          description: `${isPl ? 'Zadanie następcze z decyzji' : 'Follow-up task from decision'}: ${decision.title}`,
          status: 'todo',
          priority: 'medium',
          tags: ['decision-follow-up'],
        });
        if (result?.id) {
          createdCount++;
          emitMyWorkEvent({ type: 'item:created', entityType: 'task', entityId: result.id });
        }
      }

      onTasksCreated?.(createdCount);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message || (isPl ? 'Nie udało się utworzyć zadań' : 'Failed to create tasks')
      );
    } finally {
      setCreating(false);
    }
  }, [tasks, decision.title, isPl, emitMyWorkEvent, onTasksCreated, onClose]);

  const validCount = tasks.filter((t) => t.trim().length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200/60 dark:border-white/[0.06]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ListTodo size={16} className="text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {isPl ? 'Zadania następcze' : 'Follow-up Tasks'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-80 overflow-y-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {isPl
              ? `Decyzja "${decision.title}" została ${decision.status === 'approved' ? 'zatwierdzona' : 'odrzucona'}. Sugerowane zadania:`
              : `Decision "${decision.title}" was ${decision.status}. Suggested follow-up tasks:`}
          </p>

          <div className="space-y-2">
            {tasks.map((task, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={task}
                  onChange={(e) => updateTask(idx, e.target.value)}
                  placeholder={isPl ? 'Tytuł zadania...' : 'Task title...'}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
                />
                <button
                  onClick={() => removeTask(idx)}
                  className="p-1.5 rounded-md text-slate-600 hover:text-danger-500 dark:hover:text-danger-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addTask}
            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-medium transition-colors"
          >
            <Plus size={12} />
            {isPl ? 'Dodaj zadanie' : 'Add task'}
          </button>

          {/* Notify team checkbox */}
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyTeam}
              onChange={(e) => setNotifyTeam(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-indigo-500 focus:ring-indigo-500/30"
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {isPl ? 'Powiadom zespół' : 'Notify team'}
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {isPl ? 'Pomiń' : 'Skip'}
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || validCount === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            {isPl
              ? `Utwórz ${validCount} ${validCount === 1 ? 'zadanie' : 'zadań'}`
              : `Create ${validCount} task${validCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
