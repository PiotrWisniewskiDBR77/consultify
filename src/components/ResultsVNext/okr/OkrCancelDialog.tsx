/**
 * OkrCancelDialog — shared confirm/reason dialog for `cancelObjective`/
 * `cancelKeyResult` (`OkrObjectiveTransitionSchema`/
 * `OkrKeyResultTransitionSchema`, both `{expectedVersion, reason?,
 * idempotencyKey}` — `reason` optional, unlike ROI's several
 * required-reason transitions). Mirrors `../roi/RoiTransitionDialog.tsx`'s
 * shape, simplified to the one transition this package wires per entity.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export interface OkrCancelDialogProps {
  open: boolean;
  /** Title of the entity being cancelled — shown so the user confirms the
   * right record. */
  entityTitle: string;
  entityKind: 'objective' | 'keyResult';
  isPolish: boolean;
  onClose: () => void;
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

const DESTRUCTIVE_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-danger-300/40 dark:border-danger-500/30 ' +
  'bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 px-4 text-sm font-medium ' +
  'transition-colors hover:bg-danger-100/70 dark:hover:bg-danger-500/15 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';

export const OkrCancelDialog: React.FC<OkrCancelDialogProps> = ({
  open,
  entityTitle,
  entityKind,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open]);

  const label =
    entityKind === 'objective'
      ? isPolish
        ? 'Anuluj cel'
        : 'Cancel objective'
      : isPolish
        ? 'Anuluj Kluczowy Rezultat'
        : 'Cancel key result';

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={label}
      description={isPolish ? `Encja: ${entityTitle}` : `Entity: ${entityTitle}`}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Wstecz' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim() || null)}
            disabled={busy}
            data-testid="okr-cancel-submit"
            className={DESTRUCTIVE_BUTTON_CLASS}
          >
            <span>{busy ? (isPolish ? 'Anulowanie…' : 'Cancelling…') : label}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="okr-cancel-reason">
            {isPolish ? 'Powód (opcjonalnie)' : 'Reason (optional)'}
          </label>
          <textarea
            id="okr-cancel-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-cancel-reason"
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-cancel-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrCancelDialog;
