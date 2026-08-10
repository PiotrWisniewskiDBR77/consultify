/**
 * RoiRemoveLineItemDialog — the ONE shared delete-confirmation dialog for
 * assumptions/cost lines/benefit lines (`DELETE .../assumptions/:id`,
 * `.../cost-lines/:id`, `.../benefit-lines/:id`, RN_G2_UI_SCOPE.md §G
 * #13-14). Same PURE presentational convention as `RoiTransitionDialog.tsx`
 * — caller supplies the item and write state, this component never calls
 * `roiCaseDetailApi.ts` itself.
 *
 * Reason is ALWAYS optional here (`RemoveAssumptionSchema`/
 * `RemoveCostLineSchema`/`RemoveBenefitLineSchema` all have
 * `reason: nullableReasonField`, `resultsVnextRoiEconomicModel.validators.ts`
 * L124-128/L156-160/L192-196 — none REQUIRE it, unlike some of the ROI Case
 * lifecycle transitions `RoiTransitionDialog` handles) — so this dialog does
 * NOT reuse `RoiTransitionDialog` (whose `reasonRequired` branching would be
 * dead code here) and is a separate, smaller component instead of an
 * awkward "reasonRequired always false" call site.
 */
import { AlertTriangle, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';

export interface RoiRemoveLineItemDialogProps {
  open: boolean;
  /** Label of the item being removed (assumption/cost line/benefit line
   * name) — shown in the confirmation copy so the user confirms the right
   * record. */
  itemLabel: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
const DANGER_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg bg-c-danger px-4 text-sm font-medium text-white ' +
  'transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const RoiRemoveLineItemDialog: React.FC<RoiRemoveLineItemDialogProps> = ({
  open,
  itemLabel,
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

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Usuń pozycję' : 'Remove item'}
      description={isPolish ? `Pozycja: ${itemLabel}` : `Item: ${itemLabel}`}
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
            onClick={() => onSubmit(reason.trim() || null)}
            disabled={busy}
            data-testid="roi-remove-line-item-submit"
            className={DANGER_BUTTON_CLASS}
          >
            <Trash2 size={16} />
            <span>{busy ? (isPolish ? 'Usuwanie…' : 'Removing…') : isPolish ? 'Usuń' : 'Remove'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-remove-line-item-reason">
            {isPolish ? 'Powód (opcjonalnie)' : 'Reason (optional)'}
          </label>
          <textarea
            id="roi-remove-line-item-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="roi-remove-line-item-reason"
          />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-remove-line-item-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiRemoveLineItemDialog;
