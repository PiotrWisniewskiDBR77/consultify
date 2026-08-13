/**
 * AddSourceDialog — Modal form to attach a new source to a record
 * (Block B / EPIC-T8).
 *
 * Captures: source_type (enum), source_uri (optional URL), confidence_
 * contribution (0..1, optional), source_metadata.note (optional). The
 * component is controlled — the parent supplies `onSubmit` and decides
 * how to call the API.
 */

import { Loader2, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import type { CreateRecordSourceInput, SourceType } from '@/services/api/recordProvenance.api';

const SOURCE_TYPE_OPTIONS: Array<{ value: SourceType; en: string; pl: string }> = [
  { value: 'manual', en: 'Manual', pl: 'Ręczne' },
  { value: 'ai_extraction', en: 'AI extraction', pl: 'Ekstrakcja AI' },
  { value: 'import', en: 'Import', pl: 'Import' },
  { value: 'integration', en: 'Integration', pl: 'Integracja' },
  { value: 'system', en: 'System', pl: 'System' },
];

export interface AddSourceDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateRecordSourceInput) => Promise<void>;
  defaultType?: SourceType;
  testId?: string;
}

export const AddSourceDialog: React.FC<AddSourceDialogProps> = ({
  open,
  onClose,
  onSubmit,
  defaultType = 'manual',
  testId = 'provenance-add-source-dialog',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [type, setType] = useState<SourceType>(defaultType);
  const [uri, setUri] = useState('');
  const [contribution, setContribution] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const reset = (): void => {
    setType(defaultType);
    setUri('');
    setContribution('');
    setNote('');
    setError(null);
    setSubmitting(false);
  };

  const handleDialogClose = (): void => {
    if (submitting) return;
    reset();
    onClose();
  };

  useDialogA11y({ open, onClose: handleDialogClose, containerRef: dialogRef });

  if (!open) return null;

  const validate = (): string | null => {
    if (uri && uri.trim().length > 2048) {
      return t('myWorkTable.addSourceDialog.uriTooLong');
    }
    if (contribution) {
      const n = Number(contribution);
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        return t('myWorkTable.addSourceDialog.confidenceMustBeNumber');
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: CreateRecordSourceInput = {
        source_type: type,
        source_uri: uri.trim() ? uri.trim() : null,
        confidence_contribution: contribution ? Number(contribution) : null,
        source_metadata: note.trim() ? { note: note.trim() } : {},
      };
      await onSubmit(payload);
      reset();
      onClose();
    } catch (submitErr) {
      const message =
        (submitErr as { message?: string })?.message ??
        t('myWorkTable.addSourceDialog.failedToSave');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-overlay flex items-center justify-center backdrop-blur-sm p-4"
      style={{ backgroundColor: 'color-mix(in srgb, var(--c-bg) 60%, transparent)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
      tabIndex={-1}
      data-testid={testId}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          reset();
          onClose();
        }
      }}
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="w-[420px] max-w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
          <h2 id={`${testId}-title`} className="text-sm font-semibold text-c-text">
            {t('myWorkTable.addSourceDialog.title')}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                reset();
                onClose();
              }
            }}
            className="text-c-text-secondary hover:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus rounded p-1"
            aria-label={t('myWorkTable.addSourceDialog.close')}
            data-testid={`${testId}-close`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('myWorkTable.addSourceDialog.sourceType')}
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              data-testid={`${testId}-type`}
            >
              {SOURCE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isPl ? opt.pl : opt.en}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('myWorkTable.addSourceDialog.uriLabel')}
            </span>
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              data-testid={`${testId}-uri`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('myWorkTable.addSourceDialog.confidenceLabel')}
            </span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="0.80"
              className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              data-testid={`${testId}-contribution`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
              {t('myWorkTable.addSourceDialog.noteLabel')}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
              data-testid={`${testId}-note`}
            />
          </label>

          {error && (
            <p className="text-[12px] text-c-danger" role="alert" data-testid={`${testId}-error`}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-c-border-subtle">
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                reset();
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-md text-sm text-c-text-muted hover:bg-c-surface-raised"
          >
            {t('myWorkTable.addSourceDialog.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-c-text hover:opacity-90 text-c-surface disabled:opacity-60"
            data-testid={`${testId}-submit`}
          >
            {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {t('myWorkTable.addSourceDialog.save')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSourceDialog;
