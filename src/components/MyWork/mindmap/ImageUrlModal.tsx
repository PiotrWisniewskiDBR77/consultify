/**
 * ImageUrlModal — Replaces window.prompt for adding image URLs to nodes.
 */
import { Image, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface ImageUrlModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export const ImageUrlModal: React.FC<ImageUrlModalProps> = ({ open, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: urlInputRef });

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
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-c-bg"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-url-modal-title"
        tabIndex={-1}
        className="w-80 rounded-lg border border-c-border-subtle bg-c-surface-raised p-4 shadow-xl outline-none dark:border-c-border-subtle dark:bg-c-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            id="image-url-modal-title"
            className="flex items-center gap-2 text-sm font-medium text-c-text-secondary dark:text-c-text"
          >
            <Image size={16} />
            {t('ideas.mindmap.addImage', 'Add image')}
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <input
          ref={urlInputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={t('ideas.mindmap.imageUrl', 'Image URL...')}
          className="mb-3 w-full rounded border border-c-border-subtle px-3 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
        />

        {url.trim() && (
          <div className="mb-3 flex justify-center">
            <img
              src={url}
              alt="preview"
              className="max-h-24 max-w-full rounded border border-c-border-subtle object-contain dark:border-c-border-subtle"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
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
            disabled={!url.trim()}
            className="rounded bg-c-info px-3 py-1 text-xs text-c-text hover:bg-c-info disabled:opacity-40"
          >
            {t('ideas.mindmap.add', 'Add')}
          </button>
        </div>
      </div>
    </div>
  );
};
