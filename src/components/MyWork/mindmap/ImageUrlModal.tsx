/**
 * ImageUrlModal — Replaces window.prompt for adding image URLs to nodes.
 */
import { Image, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImageUrlModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export const ImageUrlModal: React.FC<ImageUrlModalProps> = ({ open, onClose, onSubmit }) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [url, setUrl] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setUrl('');
    onClose();
  }, [onClose, onSubmit, url]);

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
            <Image size={16} />
            {isPl ? 'Dodaj obraz' : 'Add image'}
          </div>
          <button
            onClick={onClose}
            className="text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>

        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={isPl ? 'URL obrazka...' : 'Image URL...'}
          className="mb-3 w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
        />

        {url.trim() && (
          <div className="mb-3 flex justify-center">
            <img
              src={url}
              alt="preview"
              className="max-h-24 max-w-full rounded border border-slate-200 object-contain dark:border-navy-700"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
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
            disabled={!url.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPl ? 'Dodaj' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};
