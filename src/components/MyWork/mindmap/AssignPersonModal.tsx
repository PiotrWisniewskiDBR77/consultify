/**
 * AssignPersonModal — Replaces window.prompt for node assignment.
 * Shows recent assignees from the graph for quick selection.
 */
import { UserPlus, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [value, setValue] = useState(currentAssignee || '');
  const inputRef = useRef<HTMLInputElement>(null);

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
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <UserPlus size={16} />
            {isPl ? 'Przypisz osobę' : 'Assign person'}
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={isPl ? 'Imię i nazwisko...' : 'Name...'}
          className="mb-2 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
        />

        {uniqueRecent.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">
              {isPl ? 'Ostatnio przypisani' : 'Recent'}
            </div>
            <div className="flex flex-wrap gap-1">
              {uniqueRecent.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    onAssign(name);
                    onClose();
                  }}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-blue-100 hover:text-blue-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700"
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
            className="rounded px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPl ? 'Przypisz' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
};
