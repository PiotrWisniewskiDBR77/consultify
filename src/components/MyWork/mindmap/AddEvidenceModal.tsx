/**
 * AddEvidenceModal — Replaces window.prompt for adding evidence links.
 * Provides title + URL/note fields.
 */
import { FileText, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddEvidenceModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, url?: string) => void;
}

export const AddEvidenceModal: React.FC<AddEvidenceModalProps> = ({ open, onClose, onAdd }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    onAdd(trimmedTitle, url.trim() || undefined);
    setTitle('');
    setUrl('');
    onClose();
  }, [onAdd, onClose, title, url]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <FileText size={16} />
            {isPl ? 'Dodaj dowód / źródło' : 'Add evidence / source'}
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            {isPl ? 'Tytuł' : 'Title'}
          </label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={isPl ? 'Nazwa dowodu...' : 'Evidence title...'}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            {isPl ? 'URL lub notatka źródła' : 'Source URL or note'}
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={isPl ? 'https://... lub opis' : 'https://... or description'}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPl ? 'Dodaj' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};
