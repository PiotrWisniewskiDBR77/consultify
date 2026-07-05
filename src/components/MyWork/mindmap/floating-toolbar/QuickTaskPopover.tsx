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
    <div className="w-64 rounded-xl bg-c-surface-raised dark:bg-c-surface shadow-2xl border border-c-border-subtle dark:border-c-border p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-c-text-secondary dark:text-c-text flex items-center gap-1.5">
          <CheckSquare size={12} className="text-c-text-secondary" />
          {isPl ? 'Szybkie zadanie' : 'Quick task'}
        </span>
        <button
          onClick={onClose}
          className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
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
        className="w-full h-8 px-2.5 rounded-lg text-xs bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border text-c-text-secondary dark:text-c-text-muted placeholder:text-c-text-muted focus:outline-none focus:border-c-border transition-colors"
      />

      <div className="flex gap-1.5">
        <button
          onClick={handleCreate}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-medium bg-c-surface dark:bg-c-surface-raised text-c-text dark:text-c-text-secondary hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors"
        >
          <Plus size={11} />
          {isPl ? 'Utwórz' : 'Create'}
        </button>
        <button
          onClick={handleAttach}
          className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface-raised hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        >
          {isPl ? 'Dołącz istniejące' : 'Attach existing'}
        </button>
      </div>
    </div>
  );
};
