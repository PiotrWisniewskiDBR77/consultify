/**
 * TemplateLifecycleActions — Approve / Deprecate buttons for a single
 * `tp_base_templates` row (Block A · EPIC-T6).
 *
 * Affordance rules:
 *   * Hidden entirely when `isSuperAdmin === false` (server is still
 *     authoritative — the route layer enforces `requireSuperAdmin`).
 *   * `draft → approved` and `approved → deprecated` are the documented
 *     forward edges. `deprecated` is terminal (no `to-draft` route lives
 *     on the backend yet — handled when revert lands).
 *   * Each click prompts a confirmation dialog with an optional `note`
 *     captured into `approval_history`.
 */

import { CheckCircle2, Loader2, MinusCircle, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { TemplateStatus } from '@/services/api/templateLifecycle.api';

type Action = 'approve' | 'deprecate';

export interface TemplateLifecycleActionsProps {
  templateId: string;
  status: TemplateStatus;
  isSuperAdmin: boolean;
  onApprove?: (templateId: string, note?: string) => Promise<void>;
  onDeprecate?: (templateId: string, note?: string) => Promise<void>;
  testId?: string;
}

export const TemplateLifecycleActions: React.FC<TemplateLifecycleActionsProps> = ({
  templateId,
  status,
  isSuperAdmin,
  onApprove,
  onDeprecate,
  testId = 'template-lifecycle-actions',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [pending, setPending] = useState<Action | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isSuperAdmin) return null;

  const showApprove = status === 'draft' && !!onApprove;
  const showDeprecate = status === 'approved' && !!onDeprecate;

  const close = (): void => {
    if (submitting) return;
    setPending(null);
    setNote('');
    setError(null);
  };

  const handleConfirm = async (): Promise<void> => {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmedNote = note.trim() ? note.trim() : undefined;
      if (pending === 'approve' && onApprove) {
        await onApprove(templateId, trimmedNote);
      } else if (pending === 'deprecate' && onDeprecate) {
        await onDeprecate(templateId, trimmedNote);
      }
      setPending(null);
      setNote('');
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        (isPl ? 'Operacja nieudana.' : 'Operation failed.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1" data-testid={testId}>
      {showApprove && (
        <button
          type="button"
          onClick={() => setPending('approve')}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
          data-testid={`${testId}-approve`}
        >
          <CheckCircle2 size={11} aria-hidden />
          <span>{isPl ? 'Zatwierdź' : 'Approve'}</span>
        </button>
      )}
      {showDeprecate && (
        <button
          type="button"
          onClick={() => setPending('deprecate')}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
          data-testid={`${testId}-deprecate`}
        >
          <MinusCircle size={11} aria-hidden />
          <span>{isPl ? 'Wycofaj' : 'Deprecate'}</span>
        </button>
      )}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${testId}-dialog-title`}
          data-testid={`${testId}-dialog`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-[420px] max-w-full rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
              <h2
                id={`${testId}-dialog-title`}
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                {pending === 'approve'
                  ? isPl
                    ? 'Zatwierdź szablon'
                    : 'Approve template'
                  : isPl
                    ? 'Wycofaj szablon'
                    : 'Deprecate template'}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-slate-600 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-400 rounded p-1"
                aria-label={isPl ? 'Zamknij' : 'Close'}
                data-testid={`${testId}-dialog-close`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-[12px] text-slate-600 dark:text-slate-300">
                {pending === 'approve'
                  ? isPl
                    ? 'Zatwierdzenie sprawia, że szablon staje się widoczny dla wszystkich użytkowników. Operacja zapisuje wpis w historii zatwierdzeń.'
                    : 'Approving makes this template visible to all tenants. The action is logged in approval_history.'
                  : isPl
                    ? 'Wycofanie ukrywa szablon przed nowymi użytkownikami. Istniejące bazy korzystające z szablonu pozostają nienaruszone. Operacja jest zapisywana w historii zatwierdzeń.'
                    : 'Deprecating hides the template from new users. Existing bases that already used it remain untouched. The action is logged in approval_history.'}
              </p>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isPl ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-2 py-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                  data-testid={`${testId}-dialog-note`}
                />
              </label>
              {error && (
                <p
                  className="text-[12px] text-rose-600 dark:text-rose-300"
                  role="alert"
                  data-testid={`${testId}-dialog-error`}
                >
                  {error}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-navy-700">
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 rounded-md text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void handleConfirm();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white disabled:opacity-50 ${
                  pending === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
                data-testid={`${testId}-dialog-confirm`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {pending === 'approve'
                  ? isPl
                    ? 'Zatwierdź'
                    : 'Approve'
                  : isPl
                    ? 'Wycofaj'
                    : 'Deprecate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateLifecycleActions;
