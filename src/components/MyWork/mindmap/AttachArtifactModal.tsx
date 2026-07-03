/**
 * AttachArtifactModal — Replaces window.prompt for artifact attachment.
 * Provides a type dropdown + ID input + optional label.
 */
import { Link2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactType } from '@/utils/artifactLinks';

const ARTIFACT_TYPES: { value: ArtifactType; label: string; labelPl: string }[] = [
  { value: 'initiative', label: 'Initiative', labelPl: 'Inicjatywa' },
  { value: 'decision', label: 'Decision', labelPl: 'Decyzja' },
  { value: 'task', label: 'Task', labelPl: 'Zadanie' },
  { value: 'report', label: 'Report', labelPl: 'Raport' },
  { value: 'assessment', label: 'Assessment', labelPl: 'Ocena' },
  { value: 'notebook', label: 'Notebook page', labelPl: 'Strona notatnika' },
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [type, setType] = useState<ArtifactType>('initiative');
  const [artifactId, setArtifactId] = useState('');
  const [label, setLabel] = useState('');

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
      className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-navy-700 dark:bg-navy-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Link2 size={16} />
            {isPl ? 'Dołącz artefakt' : 'Attach artifact'}
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
            {isPl ? 'Typ' : 'Type'}
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ArtifactType)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
          >
            {ARTIFACT_TYPES.map((at) => (
              <option key={at.value} value={at.value}>
                {isPl ? at.labelPl : at.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">ID</label>
          <input
            autoFocus
            value={artifactId}
            onChange={(e) => setArtifactId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={isPl ? 'ID artefaktu...' : 'Artifact ID...'}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-navy-600 dark:bg-navy-800 dark:text-white"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
            {isPl ? 'Etykieta (opcjonalnie)' : 'Label (optional)'}
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={isPl ? 'Opis powiązania...' : 'Relationship description...'}
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
            disabled={!artifactId.trim()}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {isPl ? 'Dołącz' : 'Attach'}
          </button>
        </div>
      </div>
    </div>
  );
};
