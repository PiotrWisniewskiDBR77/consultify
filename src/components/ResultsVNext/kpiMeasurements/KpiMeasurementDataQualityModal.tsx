/**
 * KpiMeasurementDataQualityModal — RN-G2 §G #7 shared form for `POST
 * .../measurements/:measurementId/verify` and `.../dispute`. One component,
 * two modes — the two endpoints are structurally identical (both INSERT a
 * superseding row that only changes `dataQualityStatus`, see
 * `kpiMeasurementCommands.ts`'s `insertSupersedingMeasurement`), differing
 * only in which fixed status they target and whether their free-text field
 * is required:
 *   - verify:  `VerifyMeasurementSchema`  — `notes` OPTIONAL
 *   - dispute: `DisputeMeasurementSchema` — `disputeReason` REQUIRED, min 1
 *
 * -- CONFIRMED (kpiMeasurementCommands.ts, grepped, see kpiApi.ts header):
 * NO role/self-check gates either action — any org member with visibility
 * into this KPI can verify or dispute any measurement, including one they
 * recorded themselves. This form does not disable itself for the "recorded
 * by me" case because no such rule exists server-side to mirror.
 */
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { KpiMeasurementDto } from '../kpiApi';
import { formatKpiMeasurementPeriod } from './kpiMeasurementMappers';

export type KpiMeasurementDataQualityMode = 'verify' | 'dispute';

export interface KpiMeasurementDataQualityFormValues {
  /** `notes` for verify, `disputeReason` for dispute — same field, the
   * caller routes it to the right API param based on `mode`. */
  text: string;
}

export interface KpiMeasurementDataQualityModalProps {
  open: boolean;
  mode: KpiMeasurementDataQualityMode;
  onClose: () => void;
  onSubmit: (values: KpiMeasurementDataQualityFormValues) => void;
  isPolish: boolean;
  measurement: KpiMeasurementDto | null;
  busy?: boolean;
  errorMessage?: string | null;
}

const TEXTAREA_CLASS =
  'w-full min-h-[80px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const KpiMeasurementDataQualityModal: React.FC<KpiMeasurementDataQualityModalProps> = ({
  open,
  mode,
  onClose,
  onSubmit,
  isPolish,
  measurement,
  busy = false,
  errorMessage = null,
}) => {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const isDispute = mode === 'dispute';

  useEffect(() => {
    if (!open) return;
    setText('');
    setTouched(false);
  }, [open, mode]);

  const textError = touched && isDispute && !text.trim();
  const submitDisabled = busy || !measurement;

  const handleSubmit = () => {
    setTouched(true);
    if (!measurement) return;
    if (isDispute && !text.trim()) return;
    onSubmit({ text: text.trim() });
  };

  const title = isDispute
    ? isPolish
      ? 'Zakwestionuj pomiar'
      : 'Dispute measurement'
    : isPolish
      ? 'Zweryfikuj pomiar'
      : 'Verify measurement';

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={
        isDispute
          ? isPolish
            ? 'Zapisze nowy wiersz ze statusem jakości „Zakwestionowany" — oryginalny pomiar zostaje w historii bez zmian.'
            : 'Saves a new row with data-quality status "Disputed" — the original measurement stays unchanged in history.'
          : isPolish
            ? 'Zapisze nowy wiersz ze statusem jakości „Zweryfikowany" — oryginalny pomiar zostaje w historii bez zmian.'
            : 'Saves a new row with data-quality status "Verified" — the original measurement stays unchanged in history.'
      }
      size="sm"
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
            data-testid={`kpi-measurement-${mode}-submit`}
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isDispute ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
            <span>
              {busy
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : isDispute
                  ? isPolish
                    ? 'Zakwestionuj'
                    : 'Dispute'
                  : isPolish
                    ? 'Zweryfikuj'
                    : 'Verify'}
            </span>
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
              {isPolish ? 'Wartość' : 'Value'}:{' '}
              <span className="font-medium text-c-text tabular-nums">
                {measurement.actualValue === null ? '—' : measurement.actualValue}
              </span>
            </div>
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-measurement-dq-text">
            {isDispute
              ? isPolish
                ? 'Powód zakwestionowania'
                : 'Dispute reason'
              : isPolish
                ? 'Notatka (opcjonalnie)'
                : 'Notes (optional)'}
          </label>
          <textarea
            id="kpi-measurement-dq-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isDispute
                ? isPolish
                  ? 'np. wartość niezgodna z raportem źródłowym'
                  : 'e.g. value does not match the source report'
                : isPolish
                  ? 'np. potwierdzone na podstawie raportu X'
                  : 'e.g. confirmed against report X'
            }
            className={TEXTAREA_CLASS}
            data-testid="kpi-measurement-dq-text"
            aria-invalid={textError || undefined}
            aria-describedby={textError ? 'kpi-measurement-dq-text-error' : undefined}
          />
          {textError ? (
            <p id="kpi-measurement-dq-text-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Powód jest wymagany' : 'Reason is required'}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid={`kpi-measurement-${mode}-error`}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiMeasurementDataQualityModal;
