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
  const { t } = useTranslation();
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
        t('kimi.template.actions.operationFailed', 'Operation failed.');
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
          <span>{t('kimi.template.actions.approve', 'Approve')}</span>
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
          <span>{t('kimi.template.actions.deprecate', 'Deprecate')}</span>
        </button>
      )}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-c-surface-raised backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${testId}-dialog-title`}
          data-testid={`${testId}-dialog`}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-[420px] max-w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle">
              <h2 id={`${testId}-dialog-title`} className="text-sm font-semibold text-c-text">
                {pending === 'approve'
                  ? t('kimi.template.actions.approveTitle', 'Approve template')
                  : t('kimi.template.actions.deprecateTitle', 'Deprecate template')}
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-c-text-secondary hover:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus rounded p-1"
                aria-label={t('kimi.template.actions.close', 'Close')}
                data-testid={`${testId}-dialog-close`}
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-[12px] text-c-text-secondary">
                {pending === 'approve'
                  ? t(
                      'kimi.template.actions.approveBody',
                      'Approving makes this template visible to all tenants. The action is logged in approval_history.'
                    )
                  : t(
                      'kimi.template.actions.deprecateBody',
                      'Deprecating hides the template from new users. Existing bases that already used it remain untouched. The action is logged in approval_history.'
                    )}
              </p>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-secondary">
                  {t('kimi.template.actions.noteLabel', 'Note (optional)')}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1.5 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
                  data-testid={`${testId}-dialog-note`}
                />
              </label>
              {error && (
                <p
                  className="text-[12px] text-danger-600 dark:text-danger-300"
                  role="alert"
                  data-testid={`${testId}-dialog-error`}
                >
                  {error}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-c-border-subtle">
              <button
                type="button"
                onClick={close}
                className="px-3 py-1.5 rounded-md text-sm text-c-text-secondary hover:bg-c-surface-raised"
              >
                {t('kimi.template.actions.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  void handleConfirm();
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-c-text disabled:opacity-50 ${
                  pending === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
                data-testid={`${testId}-dialog-confirm`}
              >
                {submitting && <Loader2 size={14} className="animate-spin" aria-hidden />}
                {pending === 'approve'
                  ? t('kimi.template.actions.approve', 'Approve')
                  : t('kimi.template.actions.deprecate', 'Deprecate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateLifecycleActions;
