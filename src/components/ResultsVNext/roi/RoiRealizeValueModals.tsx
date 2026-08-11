/**
 * ROI Case FULL TOOL — Realize Value phase write modals: Forecast version
 * publish (`CreateRoiForecastVersionSchema`), Actual entry record
 * (`RecordActualEntrySchema`), Actual entry correction/verify/dispute (one
 * component, `kind` prop switches field set —
 * `CorrectActualEntrySchema`/`VerifyActualEntrySchema`/`DisputeActualEntrySchema`),
 * Actual snapshot publish (`PublishRoiActualSnapshotSchema`), Variance
 * record (`RecordVarianceSchema`), Variance status update
 * (`UpdateVarianceStatusSchema`), Variance cause add
 * (`AddVarianceCauseSchema`). Same "group by phase" file-count compression
 * as `RoiBuildCaseModals.tsx` — each export is still a small, independently
 * testable PURE presentational form.
 */
import { AlertTriangle, Camera, CheckCircle2, FlagOff, Plus, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { RoiCostLine, RoiBenefitLine } from './roiCaseDetailApi';
import {
  ROI_ACTUAL_ENTRY_TYPES,
  ROI_COMPARE_METRICS,
  ROI_VARIANCE_COMPARISON_TYPES,
  ROI_VARIANCE_STATUSES,
  type AddRoiVarianceCauseInput,
  type CorrectRoiActualEntryInput,
  type CreateRoiForecastVersionInput,
  type PublishRoiActualSnapshotInput,
  type RecordRoiActualEntryInput,
  type RecordRoiVarianceInput,
  type RoiActualEntryType,
  type RoiApprovalSnapshot,
  type RoiActualSnapshot,
  type RoiCompareMetric,
  type RoiForecastVersion,
  type RoiVarianceComparisonType,
  type RoiVarianceStatus,
  type UpdateRoiVarianceStatusInput,
} from './roiCaseFullToolApi';
import { roiActualEntryTypeLabel, roiCompareMetricLabel, roiVarianceComparisonTypeLabel, roiVarianceStatusLabel } from './roiCaseFullToolMappers';

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

function ErrorBanner({ message, isConflict, isPolish, testId }: { message: string | null; isConflict: boolean; isPolish: boolean; testId: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid={testId}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
      <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${message}` : `Write conflict: ${message}`) : message}</span>
    </div>
  );
}

// ==========================================================================
// Forecast version publish
// ==========================================================================

export interface RoiForecastVersionCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<CreateRoiForecastVersionInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiForecastVersionCreateModal: React.FC<RoiForecastVersionCreateModalProps> = ({ open, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false }) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!open) return; setReason(''); setTouched(false); }, [open]);
  const reasonError = touched && !reason.trim();
  const handleSubmit = () => { setTouched(true); if (!reason.trim()) return; onSubmit({ reason: reason.trim() }); };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Opublikuj wersję prognozy' : 'Publish forecast version'} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-forecast-version-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Plus size={16} /><span>{busy ? (isPolish ? 'Publikowanie…' : 'Publishing…') : (isPolish ? 'Opublikuj' : 'Publish')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-forecast-reason">{isPolish ? 'Powód (wymagany)' : 'Reason (required)'}</label>
          <textarea id="roi-forecast-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-forecast-reason" aria-invalid={reasonError || undefined} />
          {reasonError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Powód jest wymagany' : 'Reason is required'}</p> : null}
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-forecast-version-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Actual entry — record
// ==========================================================================

export interface RoiActualEntryFormModalProps {
  open: boolean;
  costLines: RoiCostLine[];
  benefitLines: RoiBenefitLine[];
  onClose: () => void;
  onSubmit: (values: RecordRoiActualEntryInput) => void;
  isPolish: boolean;
  defaultCurrency: string;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiActualEntryFormModal: React.FC<RoiActualEntryFormModalProps> = ({
  open, costLines, benefitLines, onClose, onSubmit, isPolish, defaultCurrency, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [entryType, setEntryType] = useState<RoiActualEntryType>('cost');
  const [lineId, setLineId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEntryType('cost'); setLineId(''); setPeriodStart(''); setPeriodEnd('');
    setAmount(''); setCurrency(defaultCurrency); setSource(''); setNotes(''); setTouched(false);
  }, [open, defaultCurrency]);

  const periodStartError = touched && !periodStart;
  const periodEndError = touched && !periodEnd;
  const sourceError = touched && !source.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!periodStart || !periodEnd || !source.trim()) return;
    onSubmit({
      entryType,
      costLineId: entryType === 'cost' ? lineId || null : null,
      benefitLineId: entryType === 'benefit' ? lineId || null : null,
      periodStart,
      periodEnd,
      amount: amount.trim() === '' ? null : Number(amount),
      currency: currency.trim() || null,
      source: source.trim(),
      notes: notes.trim() || null,
      reason: null,
    });
  };

  const lineOptions = entryType === 'cost' ? costLines : entryType === 'benefit' ? benefitLines : [];

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Zarejestruj wykonanie' : 'Record actual entry'} size="lg" preventOverlayClose={busy} preventEscapeClose={busy}
      className="max-h-[85vh] overflow-y-auto"
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-actual-entry-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Plus size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zarejestruj' : 'Record')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-actual-type">{isPolish ? 'Typ' : 'Type'}</label>
            <select id="roi-actual-type" value={entryType} onChange={(e) => { setEntryType(e.target.value as RoiActualEntryType); setLineId(''); }} className={FIELD_CLASS} data-testid="roi-actual-type">
              {ROI_ACTUAL_ENTRY_TYPES.map((t) => (<option key={t} value={t}>{roiActualEntryTypeLabel(t, isPolish)}</option>))}
            </select>
          </div>
          {entryType !== 'observation' ? (
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-actual-line">{entryType === 'cost' ? (isPolish ? 'Pozycja kosztowa' : 'Cost line') : (isPolish ? 'Pozycja korzyści' : 'Benefit line')}</label>
              <select id="roi-actual-line" value={lineId} onChange={(e) => setLineId(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-line">
                <option value="">—</option>
                {lineOptions.map((l: any) => (<option key={l.costLineId ?? l.benefitLineId} value={l.costLineId ?? l.benefitLineId}>{l.label}</option>))}
              </select>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-actual-period-start">{isPolish ? 'Początek okresu' : 'Period start'}</label>
            <input id="roi-actual-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-period-start" aria-invalid={periodStartError || undefined} />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-actual-period-end">{isPolish ? 'Koniec okresu' : 'Period end'}</label>
            <input id="roi-actual-period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-period-end" aria-invalid={periodEndError || undefined} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-actual-amount">{isPolish ? 'Kwota' : 'Amount'}</label>
            <input id="roi-actual-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-amount" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-actual-currency">{isPolish ? 'Waluta' : 'Currency'}</label>
            <input id="roi-actual-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-currency" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-actual-source">{isPolish ? 'Źródło (wymagane)' : 'Source (required)'}</label>
          <input id="roi-actual-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-actual-source" aria-invalid={sourceError || undefined} />
          {sourceError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Źródło jest wymagane' : 'Source is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-actual-notes">{isPolish ? 'Notatki' : 'Notes'}</label>
          <textarea id="roi-actual-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-actual-notes" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-actual-entry-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Actual entry — correction / verify / dispute (one component, `kind` switch)
// ==========================================================================

export type RoiActualEntryActionKind = 'correction' | 'verify' | 'dispute';

export interface RoiActualEntryActionModalProps {
  open: boolean;
  kind: RoiActualEntryActionKind;
  entryLabel: string;
  onClose: () => void;
  onSubmitCorrection: (values: CorrectRoiActualEntryInput) => void;
  onSubmitVerify: (notes: string | null) => void;
  onSubmitDispute: (disputeReason: string) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiActualEntryActionModal: React.FC<RoiActualEntryActionModalProps> = ({
  open, kind, entryLabel, onClose, onSubmitCorrection, onSubmitVerify, onSubmitDispute, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => { if (!open) return; setAmount(''); setCurrency(''); setText(''); setTouched(false); }, [open, kind]);

  const textRequired = kind !== 'verify';
  const textError = touched && textRequired && !text.trim();

  const title =
    kind === 'correction' ? (isPolish ? 'Koryguj wykonanie' : 'Correct actual entry')
    : kind === 'verify' ? (isPolish ? 'Zweryfikuj wykonanie' : 'Verify actual entry')
    : (isPolish ? 'Zakwestionuj wykonanie' : 'Dispute actual entry');
  const icon = kind === 'correction' ? <Camera size={16} /> : kind === 'verify' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />;

  const handleSubmit = () => {
    setTouched(true);
    if (kind === 'correction') {
      onSubmitCorrection({ amount: amount.trim() === '' ? null : Number(amount), currency: currency.trim() || null, correctionReason: text.trim() });
    } else if (kind === 'verify') {
      onSubmitVerify(text.trim() || null);
    } else {
      if (!text.trim()) return;
      onSubmitDispute(text.trim());
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} description={entryLabel} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-actual-action-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          {icon}<span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Potwierdź' : 'Confirm')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        {kind === 'correction' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-correction-amount">{isPolish ? 'Nowa kwota' : 'New amount'}</label>
              <input id="roi-correction-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD_CLASS} data-testid="roi-correction-amount" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-correction-currency">{isPolish ? 'Waluta' : 'Currency'}</label>
              <input id="roi-correction-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_CLASS} data-testid="roi-correction-currency" />
            </div>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-action-text">
            {kind === 'correction' ? (isPolish ? 'Powód korekty (wymagany)' : 'Correction reason (required)')
              : kind === 'verify' ? (isPolish ? 'Notatki (opcjonalnie)' : 'Notes (optional)')
              : (isPolish ? 'Powód sporu (wymagany)' : 'Dispute reason (required)')}
          </label>
          <textarea id="roi-action-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-action-text" aria-invalid={textError || undefined} />
          {textError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'To pole jest wymagane' : 'This field is required'}</p> : null}
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-actual-action-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Actual snapshot publish
// ==========================================================================

export interface RoiActualSnapshotPublishModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<PublishRoiActualSnapshotInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiActualSnapshotPublishModal: React.FC<RoiActualSnapshotPublishModalProps> = ({ open, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false }) => {
  const [asOfPeriodEnd, setAsOfPeriodEnd] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!open) return; setAsOfPeriodEnd(''); setReason(''); setTouched(false); }, [open]);
  const dateError = touched && !asOfPeriodEnd;
  const handleSubmit = () => { setTouched(true); if (!asOfPeriodEnd) return; onSubmit({ asOfPeriodEnd, reason: reason.trim() || null }); };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Opublikuj migawkę wykonania' : 'Publish actual snapshot'} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-actual-snapshot-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Camera size={16} /><span>{busy ? (isPolish ? 'Publikowanie…' : 'Publishing…') : (isPolish ? 'Opublikuj' : 'Publish')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-snapshot-as-of">{isPolish ? 'Stan na dzień (wymagane)' : 'As of (required)'}</label>
          <input id="roi-snapshot-as-of" type="date" autoFocus value={asOfPeriodEnd} onChange={(e) => setAsOfPeriodEnd(e.target.value)} className={FIELD_CLASS} data-testid="roi-snapshot-as-of" aria-invalid={dateError || undefined} />
          {dateError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Data jest wymagana' : 'Date is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-snapshot-reason">{isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}</label>
          <textarea id="roi-snapshot-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-snapshot-reason" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-actual-snapshot-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Variance — record
// ==========================================================================

export interface RoiVarianceFormModalProps {
  open: boolean;
  approvalSnapshots: RoiApprovalSnapshot[];
  forecastVersions: RoiForecastVersion[];
  actualSnapshots: RoiActualSnapshot[];
  onClose: () => void;
  onSubmit: (values: RecordRoiVarianceInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiVarianceFormModal: React.FC<RoiVarianceFormModalProps> = ({
  open, approvalSnapshots, forecastVersions, actualSnapshots, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [comparisonType, setComparisonType] = useState<RoiVarianceComparisonType>('approved_vs_forecast');
  const [metric, setMetric] = useState<RoiCompareMetric>('npv');
  const [approvalSnapshotId, setApprovalSnapshotId] = useState('');
  const [forecastVersionId, setForecastVersionId] = useState('');
  const [actualSnapshotId, setActualSnapshotId] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');

  useEffect(() => {
    if (!open) return;
    setComparisonType('approved_vs_forecast'); setMetric('npv');
    setApprovalSnapshotId(''); setForecastVersionId(''); setActualSnapshotId(''); setOwnerUserId('');
  }, [open]);

  const needsApproval = comparisonType === 'approved_vs_forecast' || comparisonType === 'approved_vs_actual';
  const needsForecast = comparisonType === 'approved_vs_forecast' || comparisonType === 'forecast_vs_actual';
  const needsActual = comparisonType === 'approved_vs_actual' || comparisonType === 'forecast_vs_actual';

  const handleSubmit = () => {
    onSubmit({
      comparisonType,
      metric,
      referenceApprovalSnapshotId: needsApproval ? approvalSnapshotId || null : null,
      referenceForecastVersionId: needsForecast ? forecastVersionId || null : null,
      referenceActualSnapshotId: needsActual ? actualSnapshotId || null : null,
      ownerUserId: ownerUserId.trim() || null,
      reason: null,
    });
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Zarejestruj wariancję' : 'Record variance'} size="md" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-variance-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Plus size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zarejestruj' : 'Record')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-variance-comparison">{isPolish ? 'Typ porównania' : 'Comparison type'}</label>
            <select id="roi-variance-comparison" value={comparisonType} onChange={(e) => setComparisonType(e.target.value as RoiVarianceComparisonType)} className={FIELD_CLASS} data-testid="roi-variance-comparison">
              {ROI_VARIANCE_COMPARISON_TYPES.map((c) => (<option key={c} value={c}>{roiVarianceComparisonTypeLabel(c, isPolish)}</option>))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-variance-metric">{isPolish ? 'Metryka' : 'Metric'}</label>
            <select id="roi-variance-metric" value={metric} onChange={(e) => setMetric(e.target.value as RoiCompareMetric)} className={FIELD_CLASS} data-testid="roi-variance-metric">
              {ROI_COMPARE_METRICS.map((m) => (<option key={m} value={m}>{roiCompareMetricLabel(m, isPolish)}</option>))}
            </select>
          </div>
        </div>
        {needsApproval ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-variance-approval">{isPolish ? 'Migawka akceptacji' : 'Approval snapshot'}</label>
            <select id="roi-variance-approval" value={approvalSnapshotId} onChange={(e) => setApprovalSnapshotId(e.target.value)} className={FIELD_CLASS} data-testid="roi-variance-approval">
              <option value="">—</option>
              {approvalSnapshots.map((s) => (<option key={s.snapshotId} value={s.snapshotId}>{s.snapshotId}</option>))}
            </select>
          </div>
        ) : null}
        {needsForecast ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-variance-forecast">{isPolish ? 'Wersja prognozy' : 'Forecast version'}</label>
            <select id="roi-variance-forecast" value={forecastVersionId} onChange={(e) => setForecastVersionId(e.target.value)} className={FIELD_CLASS} data-testid="roi-variance-forecast">
              <option value="">—</option>
              {forecastVersions.map((f) => (<option key={f.forecastVersionId} value={f.forecastVersionId}>#{f.sequenceNumber}</option>))}
            </select>
          </div>
        ) : null}
        {needsActual ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-variance-actual">{isPolish ? 'Migawka wykonania' : 'Actual snapshot'}</label>
            <select id="roi-variance-actual" value={actualSnapshotId} onChange={(e) => setActualSnapshotId(e.target.value)} className={FIELD_CLASS} data-testid="roi-variance-actual">
              <option value="">—</option>
              {actualSnapshots.map((s) => (<option key={s.actualSnapshotId} value={s.actualSnapshotId}>#{s.sequenceNumber}</option>))}
            </select>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-variance-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
          <input id="roi-variance-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-variance-owner" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-variance-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Variance — status update
// ==========================================================================

export interface RoiVarianceStatusModalProps {
  open: boolean;
  varianceLabel: string;
  currentStatus: RoiVarianceStatus;
  onClose: () => void;
  onSubmit: (values: Omit<UpdateRoiVarianceStatusInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiVarianceStatusModal: React.FC<RoiVarianceStatusModalProps> = ({
  open, varianceLabel, currentStatus, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [status, setStatus] = useState<RoiVarianceStatus>(currentStatus);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { if (!open) return; setStatus(currentStatus); setOwnerUserId(''); setReason(''); }, [open, currentStatus]);
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Zmień status wariancji' : 'Change variance status'} description={varianceLabel} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={() => onSubmit({ status, ownerUserId: ownerUserId.trim() || null, reason: reason.trim() || null })} disabled={busy} data-testid="roi-variance-status-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Zapisz' : 'Save')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-variance-status-select">{isPolish ? 'Status' : 'Status'}</label>
          <select id="roi-variance-status-select" value={status} onChange={(e) => setStatus(e.target.value as RoiVarianceStatus)} className={FIELD_CLASS} data-testid="roi-variance-status-select">
            {ROI_VARIANCE_STATUSES.map((s) => (<option key={s} value={s}>{roiVarianceStatusLabel(s, isPolish)}</option>))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-variance-status-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
          <input id="roi-variance-status-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-variance-status-owner" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-variance-status-reason">{isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}</label>
          <textarea id="roi-variance-status-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-variance-status-reason" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-variance-status-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Variance — add cause
// ==========================================================================

export interface RoiVarianceCauseFormModalProps {
  open: boolean;
  varianceLabel: string;
  onClose: () => void;
  onSubmit: (values: AddRoiVarianceCauseInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}
export const RoiVarianceCauseFormModal: React.FC<RoiVarianceCauseFormModalProps> = ({
  open, varianceLabel, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [causeCategory, setCauseCategory] = useState('');
  const [contributionPct, setContributionPct] = useState('');
  const [narrative, setNarrative] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!open) return; setCauseCategory(''); setContributionPct(''); setNarrative(''); setTouched(false); }, [open]);
  const categoryError = touched && !causeCategory.trim();
  const narrativeError = touched && !narrative.trim();
  const handleSubmit = () => {
    setTouched(true);
    if (!causeCategory.trim() || !narrative.trim()) return;
    onSubmit({ causeCategory: causeCategory.trim(), contributionPct: contributionPct.trim() === '' ? null : Number(contributionPct), narrative: narrative.trim(), reason: null });
  };
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={isPolish ? 'Dodaj przyczynę' : 'Add cause'} description={varianceLabel} size="sm" preventOverlayClose={busy} preventEscapeClose={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
        <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-variance-cause-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
          <Plus size={16} /><span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Dodaj' : 'Add')}</span>
        </button>
      </>}>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-cause-category">{isPolish ? 'Kategoria (wymagana)' : 'Category (required)'}</label>
          <input id="roi-cause-category" autoFocus value={causeCategory} onChange={(e) => setCauseCategory(e.target.value)} className={FIELD_CLASS} data-testid="roi-cause-category" aria-invalid={categoryError || undefined} />
          {categoryError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Kategoria jest wymagana' : 'Category is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-cause-contribution">{isPolish ? 'Udział %' : 'Contribution %'}</label>
          <input id="roi-cause-contribution" type="number" value={contributionPct} onChange={(e) => setContributionPct(e.target.value)} className={FIELD_CLASS} data-testid="roi-cause-contribution" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-cause-narrative">{isPolish ? 'Opis (wymagany)' : 'Narrative (required)'}</label>
          <textarea id="roi-cause-narrative" value={narrative} onChange={(e) => setNarrative(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-cause-narrative" aria-invalid={narrativeError || undefined} />
          {narrativeError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Opis jest wymagany' : 'Narrative is required'}</p> : null}
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-variance-cause-error" />
      </div>
    </Modal>
  );
};
