/**
 * KpiReviewedAttributionDialog — RN-G3 lane `okr` prompt-removal pass
 * (2026-08-11), extended scope: `KpiToolPage.tsx`'s "Record reviewed
 * attribution" action used `window.prompt` for a REQUIRED numeric field
 * (`RecordReviewedAttributionInput.reviewedAttributionValue: number`,
 * `kpiInitiativeImpactApi.ts`) — same violation of CLAUDE.md's "standard
 * jest KODEM" as the six OKR call sites this pass otherwise covers, just
 * discovered late (merged from a parallel KPI track).
 *
 * The two guards `window.prompt`'s inline caller did silently
 * (`value === null || value.trim() === ''` → no-op return;
 * `!Number.isFinite(numeric)` → no-op return) are now visible field-level
 * validation instead of a click that quietly does nothing.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export interface KpiReviewedAttributionDialogProps {
  open: boolean;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
  busy?: boolean;
  errorMessage?: string | null;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

export const KpiReviewedAttributionDialog: React.FC<KpiReviewedAttributionDialogProps> = ({
  open,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
}) => {
  const [raw, setRaw] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRaw('');
    setTouched(false);
  }, [open]);

  const trimmed = raw.trim();
  const numeric = Number(trimmed);
  const isEmpty = trimmed === '';
  const isInvalidNumber = !isEmpty && !Number.isFinite(numeric);
  const fieldError = touched && (isEmpty || isInvalidNumber);
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (isEmpty || isInvalidNumber) return;
    onSubmit(numeric);
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Zweryfikowana wartość atrybucji' : 'Reviewed attribution value'}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS} data-testid="kpi-reviewed-attribution-back">
            {isPolish ? 'Wstecz' : 'Back'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            data-testid="kpi-reviewed-attribution-submit"
            className={PRIMARY_BUTTON_CLASS}
          >
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz' : 'Save'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-reviewed-attribution-value">
            {isPolish ? 'Zweryfikowana wartość atrybucji (wymagane)' : 'Reviewed attribution value (required)'}
          </label>
          <input
            id="kpi-reviewed-attribution-value"
            type="text"
            inputMode="decimal"
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className={FIELD_CLASS}
            data-testid="kpi-reviewed-attribution-value"
            aria-invalid={fieldError || undefined}
            aria-describedby={fieldError ? 'kpi-reviewed-attribution-value-error' : undefined}
          />
          {fieldError ? (
            <p id="kpi-reviewed-attribution-value-error" className="mt-1 text-[11px] text-c-danger" data-testid="kpi-reviewed-attribution-value-error">
              {isEmpty ? (isPolish ? 'To pole jest wymagane' : 'This field is required') : isPolish ? 'Podaj poprawną liczbę' : 'Enter a valid number'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-reviewed-attribution-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiReviewedAttributionDialog;
