/**
 * RoiBaselineEditModal — edit form for `PUT
 * /api/vnext/results/roi/cases/:caseId/baseline` (`captureOrUpdateBaseline`,
 * RN_G2_UI_SCOPE.md §G #12).
 *
 * Same PURE presentational convention as `RoiCaseCreateModal.tsx`/
 * `RoiTransitionDialog.tsx`: caller supplies the current `RoiBaseline` (or
 * `null` — the "no record yet" edge case, see `roiCaseDetailApi.ts`
 * `getRoiBaseline` doc-comment) and owns the actual `putRoiBaseline` call.
 *
 * Fields = exactly `CaptureOrUpdateBaselineSchema`
 * (`server/src/validators/resultsVnextRoi.validators.ts` L147-164), no more.
 * Every field is OPTIONAL on the wire (server keeps the existing value when
 * a field is `undefined` — `roiBaselineCommands.ts` L158-181, "merged.X =
 * edits.X !== undefined ? edits.X : currentRow.X"), but this form always
 * submits every field EXPLICITLY (a value or `null`) rather than omitting
 * unedited ones — the right choice for a single always-visible edit form:
 * "field left blank" must mean "clear this", not "silently keep whatever the
 * server already had", or a user clearing a field would see it snap back on
 * the next load.
 */
import { AlertTriangle, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { PutRoiBaselineInput, RoiBaseline, RoiBaselineProjectionMethod, RoiConfidenceLevel } from './roiCaseDetailApi';
import { ROI_BASELINE_PROJECTION_METHODS, ROI_CONFIDENCE_LEVELS } from './roiCaseDetailApi';
import { roiBaselineProjectionMethodLabel, roiConfidenceLabel } from './roiCaseDetailMappers';

export interface RoiBaselineEditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<PutRoiBaselineInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  /** `null` only in the (design-documented-as-rare) "no record yet" edge
   * case — the form still opens, all fields start empty, and submit
   * captures the baseline for the first time via the same PUT. */
  baseline: RoiBaseline | null;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
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

export const RoiBaselineEditModal: React.FC<RoiBaselineEditModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  baseline,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [currentUnit, setCurrentUnit] = useState('');
  const [currentAsOf, setCurrentAsOf] = useState('');
  const [method, setMethod] = useState<RoiBaselineProjectionMethod>('flat');
  const [growthRate, setGrowthRate] = useState('');
  const [referenceValue, setReferenceValue] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState('');
  const [confidence, setConfidence] = useState<RoiConfidenceLevel | ''>('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setPeriodStart(baseline?.baselinePeriodStart?.slice(0, 10) ?? '');
    setPeriodEnd(baseline?.baselinePeriodEnd?.slice(0, 10) ?? '');
    setCurrentValue(baseline?.currentMeasuredValue !== null && baseline?.currentMeasuredValue !== undefined ? String(baseline.currentMeasuredValue) : '');
    setCurrentUnit(baseline?.currentMeasuredUnit ?? '');
    setCurrentAsOf(baseline?.currentMeasuredAsOf?.slice(0, 10) ?? '');
    setMethod(baseline?.bauProjectionMethod ?? 'flat');
    setGrowthRate(baseline?.bauGrowthRatePct !== null && baseline?.bauGrowthRatePct !== undefined ? String(baseline.bauGrowthRatePct) : '');
    setReferenceValue(baseline?.bauReferenceValue !== null && baseline?.bauReferenceValue !== undefined ? String(baseline.bauReferenceValue) : '');
    setNotes(baseline?.interventionComparisonNotes ?? '');
    setSource(baseline?.source ?? '');
    setConfidence(baseline?.confidence ?? '');
    setOwnerUserId(baseline?.ownerUserId ?? '');
    setReason('');
  }, [open, baseline]);

  const handleSubmit = () => {
    onSubmit({
      baselinePeriodStart: periodStart || null,
      baselinePeriodEnd: periodEnd || null,
      currentMeasuredValue: currentValue.trim() === '' ? null : Number(currentValue),
      currentMeasuredUnit: currentUnit.trim() || null,
      currentMeasuredAsOf: currentAsOf || null,
      bauProjectionMethod: method,
      bauGrowthRatePct: growthRate.trim() === '' ? null : Number(growthRate),
      bauReferenceValue: referenceValue.trim() === '' ? null : Number(referenceValue),
      interventionComparisonNotes: notes.trim() || null,
      source: source.trim() || null,
      confidence: confidence || null,
      ownerUserId: ownerUserId.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Edytuj baseline' : 'Edit baseline'}
      description={isPolish ? 'Zapisuje realny baseline sprawy ROI (PUT .../baseline).' : 'Saves the real ROI case baseline (PUT .../baseline).'}
      size="lg"
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
            disabled={busy}
            data-testid="roi-baseline-edit-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Save size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz baseline' : 'Save baseline'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-current-value">{isPolish ? 'Bieżąca wartość zmierzona' : 'Current measured value'}</label>
            <input id="roi-baseline-current-value" type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-current-value" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-current-unit">{isPolish ? 'Jednostka' : 'Unit'}</label>
            <input id="roi-baseline-current-unit" value={currentUnit} onChange={(e) => setCurrentUnit(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-current-unit" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-baseline-current-as-of">{isPolish ? 'Stan na dzień' : 'Measured as of'}</label>
          <input id="roi-baseline-current-as-of" type="date" value={currentAsOf} onChange={(e) => setCurrentAsOf(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-current-as-of" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-period-start">{isPolish ? 'Początek okresu baseline' : 'Baseline period start'}</label>
            <input id="roi-baseline-period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-period-start" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-period-end">{isPolish ? 'Koniec okresu baseline' : 'Baseline period end'}</label>
            <input id="roi-baseline-period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-period-end" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-method">{isPolish ? 'Metoda projekcji BAU' : 'BAU projection method'}</label>
            <select id="roi-baseline-method" value={method} onChange={(e) => setMethod(e.target.value as RoiBaselineProjectionMethod)} className={FIELD_CLASS} data-testid="roi-baseline-method">
              {ROI_BASELINE_PROJECTION_METHODS.map((m) => (
                <option key={m} value={m}>{roiBaselineProjectionMethodLabel(m, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-growth-rate">{isPolish ? 'Stopa wzrostu BAU (%)' : 'BAU growth rate (%)'}</label>
            <input id="roi-baseline-growth-rate" type="number" value={growthRate} onChange={(e) => setGrowthRate(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-growth-rate" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-reference-value">{isPolish ? 'Wartość referencyjna BAU' : 'BAU reference value'}</label>
            <input id="roi-baseline-reference-value" type="number" value={referenceValue} onChange={(e) => setReferenceValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-reference-value" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-baseline-notes">{isPolish ? 'Notatki porównawcze' : 'Comparison notes'}</label>
          <textarea id="roi-baseline-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-baseline-notes" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-source">{isPolish ? 'Źródło' : 'Source'}</label>
            <input id="roi-baseline-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-source" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-confidence">{isPolish ? 'Pewność' : 'Confidence'}</label>
            <select id="roi-baseline-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as RoiConfidenceLevel | '')} className={FIELD_CLASS} data-testid="roi-baseline-confidence">
              <option value="">—</option>
              {ROI_CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{roiConfidenceLabel(c, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-baseline-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
            <input id="roi-baseline-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-baseline-owner" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-baseline-reason">{isPolish ? 'Notatka do audytu (opcjonalnie)' : 'Audit note (optional)'}</label>
          <textarea id="roi-baseline-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-baseline-reason" />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-baseline-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiBaselineEditModal;
