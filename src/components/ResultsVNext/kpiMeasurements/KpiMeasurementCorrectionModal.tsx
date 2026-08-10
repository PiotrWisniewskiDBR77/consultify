/**
 * KpiMeasurementCorrectionModal — RN-G2 §G #7 form for `POST
 * /api/vnext/results/kpi/:kpiId/measurements/:measurementId/corrections`.
 *
 * Fields = exactly `CorrectMeasurementSchema`
 * (`server/src/validators/resultsVnextKpi.validators.ts` L213-217):
 *   actualValue (number OR explicit null via the "no value" toggle — same
 *   tri-state as the record form, `CorrectMeasurementSchema.actualValue` is
 *   also `.nullable()`) · correctionReason (REQUIRED, unlike the record
 *   form's optional `reason` — `z.string().min(1)`, not `.optional()`).
 *
 * Shows the ORIGINAL row's value/period read-only for context — this is a
 * correction of a specific, already-recorded fact, not a blank new entry.
 * `correctMeasurement` inserts a NEW row referencing the original via
 * `correctionOfMeasurementId` (`kpiMeasurementCommands.ts` — append-only,
 * `REVOKE UPDATE` on the table) — the original is never mutated, and this
 * form's copy says so explicitly rather than implying an in-place edit.
 */
import { AlertTriangle, Pencil } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { KpiMeasurementDto } from '../kpiApi';
import { formatKpiMeasurementPeriod } from './kpiMeasurementMappers';

export interface KpiMeasurementCorrectionFormValues {
  actualValue: number | null;
  correctionReason: string;
}

export interface KpiMeasurementCorrectionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: KpiMeasurementCorrectionFormValues) => void;
  isPolish: boolean;
  measurement: KpiMeasurementDto | null;
  busy?: boolean;
  errorMessage?: string | null;
}

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const KpiMeasurementCorrectionModal: React.FC<KpiMeasurementCorrectionModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  measurement,
  busy = false,
  errorMessage = null,
}) => {
  const [noValue, setNoValue] = useState(false);
  const [actualValueText, setActualValueText] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open || !measurement) return;
    setNoValue(measurement.actualValue === null);
    setActualValueText(measurement.actualValue === null ? '' : String(measurement.actualValue));
    setCorrectionReason('');
    setTouched(false);
  }, [open, measurement]);

  const parsedActualValue = actualValueText.trim() === '' ? null : Number(actualValueText);
  const actualValueInvalid =
    !noValue && actualValueText.trim() !== '' && !Number.isFinite(parsedActualValue);
  const reasonError = touched && !correctionReason.trim();

  const submitDisabled = busy || !measurement;

  const handleSubmit = () => {
    setTouched(true);
    if (!measurement || !correctionReason.trim()) return;
    if (!noValue && actualValueText.trim() === '') return;
    if (!noValue && !Number.isFinite(parsedActualValue)) return;
    onSubmit({
      actualValue: noValue ? null : (parsedActualValue as number),
      correctionReason: correctionReason.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Koryguj pomiar' : 'Correct measurement'}
      description={
        isPolish
          ? 'Zapisze nowy, korygujący wiersz — oryginalny pomiar zostaje bez zmian w historii (append-only).'
          : 'Saves a new, superseding row — the original measurement stays unchanged in history (append-only).'
      }
      size="md"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      className="max-h-[85vh] overflow-y-auto"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            data-testid="kpi-measurement-correction-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Pencil size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Koryguj' : 'Correct'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {measurement ? (
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[12px] text-c-text-secondary">
            <div>
              {isPolish ? 'Okres' : 'Period'}:{' '}
              <span className="font-medium text-c-text">
                {formatKpiMeasurementPeriod(measurement.periodStart, measurement.periodEnd, isPolish)}
              </span>
            </div>
            <div>
              {isPolish ? 'Obecna wartość' : 'Current value'}:{' '}
              <span className="font-medium text-c-text tabular-nums">
                {measurement.actualValue === null ? '—' : measurement.actualValue}
              </span>
            </div>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLASS} htmlFor="kpi-measurement-correction-value">
              {isPolish ? 'Skorygowana wartość' : 'Corrected value'}
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-c-text-secondary mb-1.5">
              <input
                type="checkbox"
                checked={noValue}
                onChange={(e) => setNoValue(e.target.checked)}
                data-testid="kpi-measurement-correction-no-value"
                className="h-3.5 w-3.5 rounded border-c-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
              {isPolish ? 'Brak wartości' : 'No value'}
            </label>
          </div>
          <input
            id="kpi-measurement-correction-value"
            type="number"
            inputMode="decimal"
            value={actualValueText}
            onChange={(e) => setActualValueText(e.target.value)}
            disabled={noValue}
            className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
            data-testid="kpi-measurement-correction-value"
          />
          {actualValueInvalid ? (
            <p className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Podaj liczbę albo zaznacz „Brak wartości"' : 'Enter a number, or check "No value"'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-measurement-correction-reason">
            {isPolish ? 'Powód korekty' : 'Correction reason'}
          </label>
          <textarea
            id="kpi-measurement-correction-reason"
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder={isPolish ? 'np. błędny odczyt licznika, poprawiono po audycie' : 'e.g. faulty meter reading, fixed after audit'}
            className={TEXTAREA_CLASS}
            data-testid="kpi-measurement-correction-reason"
            aria-invalid={reasonError || undefined}
            aria-describedby={reasonError ? 'kpi-measurement-correction-reason-error' : undefined}
          />
          {reasonError ? (
            <p id="kpi-measurement-correction-reason-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Powód korekty jest wymagany' : 'Correction reason is required'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-measurement-correction-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiMeasurementCorrectionModal;
