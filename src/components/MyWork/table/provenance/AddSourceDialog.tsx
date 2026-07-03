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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [type, setType] = useState<SourceType>(defaultType);
  const [uri, setUri] = useState('');
  const [contribution, setContribution] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = (): void => {
    setType(defaultType);
    setUri('');
    setContribution('');
    setNote('');
    setError(null);
    setSubmitting(false);
  };

  const validate = (): string | null => {
    if (uri && uri.trim().length > 2048) {
      return isPl
        ? 'Adres URL nie może przekraczać 2048 znaków.'
        : 'URI must be ≤ 2048 characters.';
    }
    if (contribution) {
      const n = Number(contribution);
      if (!Number.isFinite(n) || n < 0 || n > 1) {
        return isPl
          ? 'Wkład w pewność musi być liczbą między 0 a 1.'
          : 'Confidence contribution must be a number between 0 and 1.';
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
        (isPl ? 'Nie udało się zapisać źródła.' : 'Failed to save the source.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
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
        className="w-[420px] max-w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <h2
            id={`${testId}-title`}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            {isPl ? 'Dodaj źródło' : 'Add source'}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                reset();
                onClose();
              }
            }}
            className="text-slate-600 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-400 rounded p-1"
            aria-label={isPl ? 'Zamknij' : 'Close'}
            data-testid={`${testId}-close`}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl ? 'Typ źródła' : 'Source type'}
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
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
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl ? 'URI / link (opcjonalnie)' : 'URI / link (optional)'}
            </span>
            <input
              type="text"
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
              data-testid={`${testId}-uri`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl
                ? 'Wkład w pewność (0–1, opcjonalnie)'
                : 'Confidence contribution (0–1, optional)'}
            </span>
            <input
              type="number"
              step="0.05"
              min={0}
              max={1}
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              placeholder="0.80"
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
              data-testid={`${testId}-contribution`}
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              data-testid={`${testId}-note`}
            />
          </label>

          {error && (
            <p
              className="text-[12px] text-danger-600 dark:text-danger-300"
              role="alert"
              data-testid={`${testId}-error`}
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-navy-700">
          <button
            type="button"
            onClick={() => {
              if (!submitting) {
                reset();
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]"
            data-testid={`${testId}-submit`}
          >
            {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddSourceDialog;
