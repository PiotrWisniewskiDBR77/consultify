/**
 * QuickTaskPopover — Lightweight task creation from a mindmap node.
 */
import { CheckSquare, Plus, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';

interface QuickTaskPopoverProps {
  isPl: boolean;
  nodeId: string;
  nodeLabel?: string;
  onClose: () => void;
  onAction: (action: string) => void;
}

export const QuickTaskPopover: React.FC<QuickTaskPopoverProps> = ({
  isPl,
  nodeId,
  nodeLabel,
  onClose,
  onAction,
}) => {
  const [title, setTitle] = useState(nodeLabel || '');

  const handleCreate = useCallback(() => {
    if (!title.trim()) {
      toast.error(isPl ? 'Podaj tytuł zadania' : 'Enter task title');
      return;
    }
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-node-quick-action', {
        detail: { action: 'create_task', nodeId, taskTitle: title.trim() },
      })
    );
    toast.success(isPl ? 'Zadanie utworzone' : 'Task created');
    onClose();
  }, [isPl, nodeId, onClose, title]);

  const handleAttach = useCallback(() => {
    onAction('ctx_attach_artifact');
    onClose();
  }, [onAction, onClose]);

  return (
    <div className="w-64 rounded-xl bg-white dark:bg-navy-900 shadow-2xl border border-slate-200/40 dark:border-navy-700/40 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
          <CheckSquare size={12} className="text-slate-500" />
          {isPl ? 'Szybkie zadanie' : 'Quick task'}
        </span>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X size={12} />
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder={isPl ? 'Tytuł zadania…' : 'Task title…'}
        autoFocus
        className="w-full h-8 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
      />

      <div className="flex gap-1.5">
        <button
          onClick={handleCreate}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-medium bg-slate-900 dark:bg-white text-white dark:text-navy-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
        >
          <Plus size={11} />
          {isPl ? 'Utwórz' : 'Create'}
        </button>
        <button
          onClick={handleAttach}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors"
        >
          {isPl ? 'Dołącz istniejące' : 'Attach existing'}
        </button>
      </div>
    </div>
  );
};
