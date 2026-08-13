/**
 * KpiTransitionDialog — RN-G5 shared reason-collection/confirm dialog for the
 * three definition-lifecycle transitions this package wires: submit /
 * approve (reason optional, `ApproveDefinitionVersionSchema`/
 * `SubmitDefinitionSchema`) and reject (`rejectionReason` REQUIRED non-empty,
 * `RejectDefinitionVersionSchema`).
 *
 * PURE presentational, same convention as `RoiTransitionDialog.tsx` (this
 * file's direct template) and `KpiDraftFormModal.tsx` — caller supplies the
 * transition kind + write/error state, never calls `kpiApi.ts` itself.
 *
 * Zero `window.prompt`/`confirm`/`alert` — a real themed `Modal` dialog
 * (a11y contract: `role="dialog"`+`aria-modal`+`aria-labelledby`, real Tab
 * focus trap, Escape-to-close, focus restore — all from the shared `Modal`
 * primitive, none reinvented here).
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export type KpiTransitionKind = 'submit' | 'approve' | 'reject';

export interface KpiTransitionDialogProps {
  open: boolean;
  kind: KpiTransitionKind | null;
  /** KPI code of the record being acted on — shown in the dialog description
   * so the user confirms the right record. */
  kpiCode: string;
  isPolish: boolean;
  onClose: () => void;
  /** `reason` is `null` only when the field is optional AND left blank —
   * never an empty string sent where the server requires non-empty
   * (`reject`). */
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
  /** `true` when the last error was specifically the server's
   * `SELF_APPROVAL_DENIED` (403) — shown with framing that explains WHY,
   * rather than a generic error (this is a real, expected-reachable
   * business rule, not a bug). */
  isSelfApprovalDenied?: boolean;
}

const TEXTAREA_CLASS =
  'w-full min-h-[88px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const KIND_LABEL: Record<KpiTransitionKind, { pl: string; en: string }> = {
  submit: { pl: 'Zgłoś do zatwierdzenia', en: 'Submit for approval' },
  approve: { pl: 'Zatwierdź', en: 'Approve' },
  reject: { pl: 'Odrzuć', en: 'Reject' },
};

const REASON_REQUIRED: Record<KpiTransitionKind, boolean> = {
  submit: false,
  approve: false,
  reject: true,
};

export const KpiTransitionDialog: React.FC<KpiTransitionDialogProps> = ({
  open,
  kind,
  kpiCode,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
  isSelfApprovalDenied = false,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setTouched(false);
  }, [open, kind]);

  if (!kind) return null;

  const reasonRequired = REASON_REQUIRED[kind];
  const reasonError = touched && reasonRequired && !reason.trim();
  // Submit stays clickable with an empty required reason — same fix as
  // `RoiTransitionDialog.tsx`/`KpiDraftFormModal.tsx` (a `disabled` button
  // never fires `onClick`, which would make `reasonError` unreachable).
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (reasonRequired && !reason.trim()) return;
    onSubmit(reason.trim() || null);
  };

  const label = isPolish ? KIND_LABEL[kind].pl : KIND_LABEL[kind].en;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={label}
      description={isPolish ? `KPI: ${kpiCode}` : `KPI: ${kpiCode}`}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            data-testid="kpi-transition-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : label}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-transition-reason">
            {kind === 'reject'
              ? isPolish
                ? 'Powód odrzucenia (wymagany)'
                : 'Rejection reason (required)'
              : isPolish
                ? 'Powód (opcjonalnie)'
                : 'Reason (optional)'}
          </label>
          <textarea
            id="kpi-transition-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-transition-reason"
            aria-invalid={reasonError || undefined}
            aria-describedby={reasonError ? 'kpi-transition-reason-error' : undefined}
          />
          {reasonError ? (
            <p id="kpi-transition-reason-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Powód jest wymagany dla odrzucenia' : 'A reason is required to reject'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-transition-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>
              {isSelfApprovalDenied
                ? isPolish
                  ? `Nie możesz zatwierdzić własnej definicji — potrzebna druga osoba. (${errorMessage})`
                  : `You cannot approve your own definition — a second person is required. (${errorMessage})`
                : isConflict
                  ? isPolish
                    ? `Konflikt zapisu: ${errorMessage}`
                    : `Write conflict: ${errorMessage}`
                  : errorMessage}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiTransitionDialog;
