/**
 * AssignPersonModal — Replaces window.prompt for node assignment.
 * Shows recent assignees from the graph for quick selection.
 */
import { UserPlus, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface AssignPersonModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (name: string) => void;
  currentAssignee?: string;
  recentAssignees?: string[];
}

export const AssignPersonModal: React.FC<AssignPersonModalProps> = ({
  open,
  onClose,
  onAssign,
  currentAssignee,
  recentAssignees = [],
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentAssignee || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: inputRef });

  const uniqueRecent = useMemo(
    () => Array.from(new Set(recentAssignees.filter(Boolean))).slice(0, 8),
    [recentAssignees]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAssign(trimmed);
    onClose();
  }, [onAssign, onClose, value]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-c-bg"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-person-modal-title"
        tabIndex={-1}
        className="w-80 rounded-lg border border-c-border-subtle bg-c-surface-raised p-4 shadow-xl outline-none dark:border-c-border-subtle dark:bg-c-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            id="assign-person-modal-title"
            className="flex items-center gap-2 text-sm font-medium text-c-text-secondary dark:text-c-text"
          >
            <UserPlus size={16} />
            {t('ideas.mindmap.assignPerson', 'Assign person')}
          </div>
          <button
            onClick={onClose}
            className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('ideas.mindmap.name', 'Name...')}
          className="mb-2 w-full rounded border border-c-border-subtle px-3 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
        />

        {uniqueRecent.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-c-text-secondary">
              {t('ideas.mindmap.recent', 'Recent')}
            </div>
            <div className="flex flex-wrap gap-1">
              {uniqueRecent.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    onAssign(name);
                    onClose();
                  }}
                  className="rounded-full bg-c-surface-raised px-2 py-0.5 text-xs text-c-text-secondary hover:bg-c-surface-raised hover:text-c-info dark:bg-c-surface dark:text-c-text-muted dark:hover:bg-c-surface"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface"
          >
            {t('ideas.mindmap.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="rounded bg-c-info px-3 py-1 text-xs text-c-text hover:bg-c-info disabled:opacity-40"
          >
            {t('ideas.mindmap.assign', 'Assign')}
          </button>
        </div>
      </div>
    </div>
  );
};
