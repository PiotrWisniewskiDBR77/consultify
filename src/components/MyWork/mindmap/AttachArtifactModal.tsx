/**
 * AttachArtifactModal — Replaces window.prompt for artifact attachment.
 * Provides a type dropdown + ID input + optional label.
 */
import { Link2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import type { ArtifactType } from '@/utils/artifactLinks';

const ARTIFACT_TYPES: { value: ArtifactType; label: string }[] = [
  { value: 'initiative', label: 'Initiative' },
  { value: 'decision', label: 'Decision' },
  { value: 'task', label: 'Task' },
  { value: 'report', label: 'Report' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'notebook', label: 'Notebook page' },
];

interface AttachArtifactModalProps {
  open: boolean;
  onClose: () => void;
  onAttach: (type: ArtifactType, id: string, label?: string) => void;
}

export const AttachArtifactModal: React.FC<AttachArtifactModalProps> = ({
  open,
  onClose,
  onAttach,
}) => {
  const { t } = useTranslation();
  const [type, setType] = useState<ArtifactType>('initiative');
  const [artifactId, setArtifactId] = useState('');
  const [label, setLabel] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: idInputRef });

  const handleSubmit = useCallback(() => {
    const trimmedId = artifactId.trim();
    if (!trimmedId) return;
    onAttach(type, trimmedId, label.trim() || undefined);
    setArtifactId('');
    setLabel('');
    onClose();
  }, [artifactId, label, onAttach, onClose, type]);

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
        aria-labelledby="attach-artifact-modal-title"
        tabIndex={-1}
        className="w-96 rounded-lg border border-c-border-subtle bg-c-surface-raised p-4 shadow-xl outline-none dark:border-c-border-subtle dark:bg-c-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div
            id="attach-artifact-modal-title"
            className="flex items-center gap-2 text-sm font-medium text-c-text-secondary dark:text-c-text"
          >
            <Link2 size={16} />
            {t('ideas.mindmap.attachArtifact', 'Attach artifact')}
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] text-c-text-secondary dark:text-c-text-muted">
            {t('ideas.mindmap.type', 'Type')}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ArtifactType)}
            className="w-full rounded border border-c-border-subtle px-2 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
          >
            {ARTIFACT_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {t(`myWorkMindmap.artifactType.${at.value}`, at.label)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] text-c-text-secondary dark:text-c-text-muted">
            ID
          </label>
          <input
            ref={idInputRef}
            value={artifactId}
            onChange={(e) => setArtifactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('ideas.mindmap.artifactId', 'Artifact ID...')}
            className="w-full rounded border border-c-border-subtle px-3 py-1.5 text-sm outline-none focus:border-c-info dark:border-c-border-subtle dark:bg-c-surface dark:text-c-text"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-c-text-secondary dark:text-c-text-muted">
            {t('ideas.mindmap.labelOptional', 'Label (optional)')}
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={t('ideas.mindmap.relationshipDescription', 'Relationship description...')}
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
            disabled={!artifactId.trim()}
            className="rounded bg-c-info px-3 py-1 text-xs text-c-text hover:bg-c-info disabled:opacity-40"
          >
            {t('ideas.mindmap.attach', 'Attach')}
          </button>
        </div>
      </div>
    </div>
  );
};
