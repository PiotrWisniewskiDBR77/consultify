/**
 * RoiTransitionDialog — the ONE shared reason-collection/confirm dialog for
 * all 7 ROI Case lifecycle transitions this package wires (RN_G2_UI_SCOPE.md
 * §G #16 subset): approve / reject / request-changes / reopen-for-revision /
 * cancel / start-pir / close.
 *
 * PURE presentational, same convention as `RoiCaseCreateModal.tsx` — the
 * caller supplies which transition, the case being acted on, and the
 * write/error state; this component never calls `roiApi.ts` itself, so the
 * exact same component renders both the live `ResultsRoiHub.tsx` and the
 * dev-render QA harness.
 *
 * Whether the reason/notes field is REQUIRED (reject/request-changes/
 * reopen-for-revision/cancel) or optional (approve/start-pir/close) comes
 * from `ROI_TRANSITIONS[transitionId].reasonRequired`
 * (`roiRegistryMappers.ts`) — itself copied verbatim from each endpoint's
 * Zod schema (`RejectRoiCaseSchema`/`RequestChangesOnRoiCaseSchema`/
 * `ReopenApprovedRoiCaseForRevisionSchema`/`RoiCaseCancellationSchema` all
 * have a `min(1)` reason field; `RoiCaseTransitionSchema`/`CloseRoiCaseSchema`
 * have an optional one) — never invented per-dialog here.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import { ROI_TRANSITIONS, type RoiTransitionId } from './roiRegistryMappers';

export interface RoiTransitionDialogProps {
  open: boolean;
  transitionId: RoiTransitionId | null;
  /** Title of the case being acted on — shown in the dialog description so
   * the user confirms the right record. */
  caseTitle: string;
  isPolish: boolean;
  onClose: () => void;
  /** `reason` is `null` only when the field is optional AND left blank —
   * never an empty string sent where the server requires non-empty. */
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
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

export const RoiTransitionDialog: React.FC<RoiTransitionDialogProps> = ({
  open,
  transitionId,
  caseTitle,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setTouched(false);
  }, [open, transitionId]);

  const def = transitionId ? ROI_TRANSITIONS[transitionId] : null;
  const reasonRequired = def?.reasonRequired ?? false;
  const reasonError = touched && reasonRequired && !reason.trim();
  // Submit stays clickable even with an empty required reason — same fix as
  // `RoiCaseCreateModal.tsx` (RN-G2 create-package QA, 2026-08-10): a
  // `disabled` button never fires `onClick`, which would make `reasonError`
  // permanently unreachable. Only `busy` (save in flight) disables it.
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (reasonRequired && !reason.trim()) return;
    onSubmit(reason.trim() || null);
  };

  if (!def) return null;

  const label = isPolish ? def.label.pl : def.label.en;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={label}
      description={isPolish ? `Sprawa: ${caseTitle}` : `Case: ${caseTitle}`}
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
            data-testid="roi-transition-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : label}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-transition-reason">
            {reasonRequired
              ? isPolish
                ? 'Powód (wymagany)'
                : 'Reason (required)'
              : isPolish
                ? 'Powód (opcjonalnie)'
                : 'Reason (optional)'}
          </label>
          <textarea
            id="roi-transition-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="roi-transition-reason"
            aria-invalid={reasonError || undefined}
            aria-describedby={reasonError ? 'roi-transition-reason-error' : undefined}
          />
          {reasonError ? (
            <p id="roi-transition-reason-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Powód jest wymagany dla tego przejścia' : 'A reason is required for this transition'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="roi-transition-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>
              {isConflict
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

export default RoiTransitionDialog;
