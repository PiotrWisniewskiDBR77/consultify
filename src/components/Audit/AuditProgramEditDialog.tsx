import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AuditProgram } from './auditApi';
import { updateProgram } from './auditApi';

interface Props {
  program: AuditProgram | null;
  onClose: () => void;
  onSaved: (program: AuditProgram) => void;
}

export const AuditProgramEditDialog: React.FC<Props> = ({ program, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!program) return;
    setName(program.name);
    setDescription(program.description ?? '');
    setObjective(program.objective ?? '');
    setError(null);
  }, [program]);

  if (!program) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await updateProgram(program.id, {
        name: name.trim(),
        description: description.trim() || null,
        objective: objective.trim() || null,
      });
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('common.saveFailed', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
      <form
        aria-label={t('audit.editProgram', 'Edit audit program')}
        onSubmit={(event) => void save(event)}
        className="w-full max-w-xl rounded-2xl border border-c-border bg-c-surface p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-c-text">
            {t('audit.editProgram', 'Edit audit program')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
            <X className="h-5 w-5 text-c-text-muted" />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-c-text">
            {t('audit.programName', 'Program name')}
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-c-text"
            />
          </label>
          <label className="block text-sm font-medium text-c-text">
            {t('audit.objective')}
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-c-text"
            />
          </label>
          <label className="block text-sm font-medium text-c-text">
            {t('common.description', 'Description')}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-c-border bg-c-surface px-3 py-2 text-c-text"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-c-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-c-border px-4 py-2 text-sm text-c-text"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.save', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
};
