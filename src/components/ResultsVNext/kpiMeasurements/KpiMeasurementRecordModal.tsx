/**
 * KpiMeasurementRecordModal — RN-G2 §G #7 form for `POST
 * /api/vnext/results/kpi/:kpiId/measurements` (record a new measurement).
 *
 * Same shape/shell convention as `../roi/RoiCaseCreateModal.tsx` (own header
 * doc for the rationale) — `Modal` primitive, pure presentational (data +
 * write behaviour supplied by the caller via `onSubmit`/`busy`/
 * `errorMessage`), so the same component renders both the live panel and the
 * dev-render QA harness.
 *
 * Fields = exactly `RecordMeasurementSchema`
 * (`server/src/validators/resultsVnextKpi.validators.ts` L181-195), minus
 * `definitionVersionId` (omitted — this UI always measures against the KPI's
 * current version, resolved server-side) and `evidenceRefs` (no evidence
 * upload surface in this package, server defaults to `[]`):
 *   periodStart/periodEnd (required dates) · actualValue (number OR
 *   explicitly null via the "no value" toggle — `RecordMeasurementSchema
 *   .actualValue` is `.nullable()`, NOT `.optional()`, so recording a period
 *   with no value is a real, distinct write, never a fabricated `0`) ·
 *   source (required, free text — the backend has no fixed source enum) ·
 *   notes/reason (optional).
 *
 * `performanceStatus` has NO field here — the server computes it from the
 * KPI's current definition-version bounds and this form never sees or
 * fabricates it (see `../kpiApi.ts`'s `recordKpiMeasurement` doc).
 */
import { AlertTriangle, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export interface KpiMeasurementRecordFormValues {
  periodStart: string;
  periodEnd: string;
  actualValue: number | null;
  source: string;
  notes: string | null;
  reason: string | null;
}

export interface KpiMeasurementRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: KpiMeasurementRecordFormValues) => void;
  isPolish: boolean;
  kpiCode: string;
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

export const KpiMeasurementRecordModal: React.FC<KpiMeasurementRecordModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  kpiCode,
  busy = false,
  errorMessage = null,
}) => {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [noValue, setNoValue] = useState(false);
  const [actualValueText, setActualValueText] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPeriodStart('');
    setPeriodEnd('');
    setNoValue(false);
    setActualValueText('');
    setSource('');
    setNotes('');
    setReason('');
    setTouched(false);
  }, [open]);

  const periodStartError = touched && !periodStart;
  const periodEndError = touched && !periodEnd;
  const sourceError = touched && !source.trim();
  const parsedActualValue = actualValueText.trim() === '' ? null : Number(actualValueText);
  const actualValueInvalid =
    !noValue && actualValueText.trim() !== '' && !Number.isFinite(parsedActualValue);

  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (!periodStart || !periodEnd || !source.trim()) return;
    if (!noValue && actualValueText.trim() === '') return; // must pick a value or explicitly "no value"
    if (!noValue && !Number.isFinite(parsedActualValue)) return;
    onSubmit({
      periodStart,
      periodEnd,
      actualValue: noValue ? null : (parsedActualValue as number),
      source: source.trim(),
      notes: notes.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Zarejestruj pomiar' : 'Record measurement'}
      description={
        isPolish
          ? `Nowy pomiar dla ${kpiCode} — status wyniku wyliczy serwer wg wersji definicji.`
          : `New measurement for ${kpiCode} — the server computes the performance status from the current definition version.`
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
            data-testid="kpi-measurement-record-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zarejestruj' : 'Record'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-measurement-period-start">
              {isPolish ? 'Początek okresu' : 'Period start'}
            </label>
            <input
              id="kpi-measurement-period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className={FIELD_CLASS}
              data-testid="kpi-measurement-period-start"
              aria-invalid={periodStartError || undefined}
              aria-describedby={periodStartError ? 'kpi-measurement-period-start-error' : undefined}
            />
            {periodStartError ? (
              <p id="kpi-measurement-period-start-error" className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Wymagane' : 'Required'}
              </p>
            ) : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-measurement-period-end">
              {isPolish ? 'Koniec okresu' : 'Period end'}
            </label>
            <input
              id="kpi-measurement-period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className={FIELD_CLASS}
              data-testid="kpi-measurement-period-end"
              aria-invalid={periodEndError || undefined}
              aria-describedby={periodEndError ? 'kpi-measurement-period-end-error' : undefined}
            />
            {periodEndError ? (
              <p id="kpi-measurement-period-end-error" className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Wymagane' : 'Required'}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLASS} htmlFor="kpi-measurement-actual-value">
              {isPolish ? 'Wartość' : 'Value'}
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-c-text-secondary mb-1.5">
              <input
                type="checkbox"
                checked={noValue}
                onChange={(e) => setNoValue(e.target.checked)}
                data-testid="kpi-measurement-no-value"
                className="h-3.5 w-3.5 rounded border-c-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
              {isPolish ? 'Brak wartości dla tego okresu' : 'No value for this period'}
            </label>
          </div>
          <input
            id="kpi-measurement-actual-value"
            type="number"
            inputMode="decimal"
            value={actualValueText}
            onChange={(e) => setActualValueText(e.target.value)}
            disabled={noValue}
            placeholder={isPolish ? 'np. 74' : 'e.g. 74'}
            className={`${FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
            data-testid="kpi-measurement-actual-value"
          />
          {noValue ? (
            <p className="mt-1 text-[11px] text-c-text-muted">
              {isPolish
                ? 'Zapisze się jako brak wartości (null) — nigdy jako 0.'
                : 'Saves as an explicit no-value (null) — never a fabricated 0.'}
            </p>
          ) : actualValueInvalid ? (
            <p className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Podaj liczbę albo zaznacz „Brak wartości"' : 'Enter a number, or check "No value"'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-measurement-source">
            {isPolish ? 'Źródło' : 'Source'}
          </label>
          <input
            id="kpi-measurement-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={isPolish ? 'np. manual, connector-erp' : 'e.g. manual, connector-erp'}
            className={FIELD_CLASS}
            data-testid="kpi-measurement-source"
            aria-invalid={sourceError || undefined}
            aria-describedby={sourceError ? 'kpi-measurement-source-error' : undefined}
          />
          {sourceError ? (
            <p id="kpi-measurement-source-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Źródło jest wymagane' : 'Source is required'}
            </p>
          ) : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-measurement-notes">
            {isPolish ? 'Notatki (opcjonalnie)' : 'Notes (optional)'}
          </label>
          <textarea
            id="kpi-measurement-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-measurement-notes"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-measurement-reason">
            {isPolish ? 'Powód (opcjonalnie, do audytu)' : 'Reason (optional, audit trail)'}
          </label>
          <textarea
            id="kpi-measurement-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-measurement-reason"
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-measurement-record-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiMeasurementRecordModal;
