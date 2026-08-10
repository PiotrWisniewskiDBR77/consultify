/**
 * AddEvidenceModal — Replaces window.prompt for adding evidence links.
 * Provides title + URL/note fields.
 */
import { FileText, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface AddEvidenceModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string, url?: string) => void;
}

export const AddEvidenceModal: React.FC<AddEvidenceModalProps> = ({ open, onClose, onAdd }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: titleInputRef });

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
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-c-bg"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-evidence-modal-title"
        tabIndex={-1}
        className="w-96 rounded-lg border border-c-border-subtle bg-c-surface-raised p-4 shadow-xl outline-none dark:border-c-border-subtle dark:bg-c-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            id="add-evidence-modal-title"
            className="flex items-center gap-2 text-sm font-medium text-c-text-secondary dark:text-c-text"
          >
            <FileText size={16} />
            {t('ideas.mindmap.addEvidenceSource', 'Add evidence / source')}
          </div>
          <button
            onClick={onClose}
            className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] text-c-text-secondary dark:text-c-text-muted">
            {t('ideas.mindmap.title', 'Title')}
          </label>
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('ideas.mindmap.evidenceTitle', 'Evidence title...')}
            className="w-full rounded border border-c-border-subtle px-3 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-c-text-secondary dark:text-c-text-muted">
            {t('ideas.mindmap.sourceUrlNote', 'Source URL or note')}
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('ideas.mindmap.httpsDescription', 'https://... or description')}
            className="w-full rounded border border-c-border-subtle px-3 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface"
          >
            {t('ideas.mindmap.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="rounded bg-c-info px-3 py-1 text-xs text-c-text hover:bg-c-info disabled:opacity-40"
          >
            {t('ideas.mindmap.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
};
