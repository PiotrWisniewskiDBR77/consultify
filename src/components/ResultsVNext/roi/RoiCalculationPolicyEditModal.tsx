/**
 * RoiCalculationPolicyEditModal — edit form for `PUT
 * /api/vnext/results/roi/cases/:caseId/calculation-policy`
 * (`captureOrUpdateCalculationPolicy`, RN_G2_UI_SCOPE.md §G #12). Same
 * convention as `RoiBaselineEditModal.tsx` (this file's sibling) — see that
 * file's header comment for why every field is submitted explicitly rather
 * than only the touched ones.
 *
 * Fields = exactly `CaptureOrUpdateCalculationPolicySchema`
 * (`server/src/validators/resultsVnextRoiEconomicModel.validators.ts`
 * L85-97), no more. `requiredMetrics` is a free-form string array on the
 * wire (`z.array(z.string().max(64))`) — edited here as a comma-separated
 * field, split/trimmed on submit, matching how every other free-text-list
 * input in this codebase avoids inventing a tag-picker UI for an unbounded
 * server-side string array.
 */
import { AlertTriangle, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { PutRoiCalculationPolicyInput, RoiCalculationPolicy, RoiConfidenceLevel, RoiRoundingPolicy, RoiTaxTreatment } from './roiCaseDetailApi';
import { ROI_CONFIDENCE_LEVELS, ROI_ROUNDING_POLICIES, ROI_TAX_TREATMENTS } from './roiCaseDetailApi';
import { roiConfidenceLabel, roiRoundingPolicyLabel, roiTaxTreatmentLabel } from './roiCaseDetailMappers';

export interface RoiCalculationPolicyEditModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Omit<PutRoiCalculationPolicyInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  policy: RoiCalculationPolicy | null;
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

export const RoiCalculationPolicyEditModal: React.FC<RoiCalculationPolicyEditModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  policy,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [discountRate, setDiscountRate] = useState('');
  const [taxTreatment, setTaxTreatment] = useState<RoiTaxTreatment | ''>('');
  const [inflationRate, setInflationRate] = useState('');
  const [roundingPolicy, setRoundingPolicy] = useState<RoiRoundingPolicy>('half_up_2dp');
  const [requiredMetrics, setRequiredMetrics] = useState('');
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState<RoiConfidenceLevel | ''>('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setDiscountRate(policy?.discountRatePct !== null && policy?.discountRatePct !== undefined ? String(policy.discountRatePct) : '');
    setTaxTreatment(policy?.taxTreatment ?? '');
    setInflationRate(policy?.inflationRatePct !== null && policy?.inflationRatePct !== undefined ? String(policy.inflationRatePct) : '');
    setRoundingPolicy(policy?.roundingPolicy ?? 'half_up_2dp');
    setRequiredMetrics(policy?.requiredMetrics?.join(', ') ?? '');
    setNotes(policy?.notes ?? '');
    setConfidence(policy?.confidence ?? '');
    setOwnerUserId(policy?.ownerUserId ?? '');
    setReason('');
  }, [open, policy]);

  const handleSubmit = () => {
    const metrics = requiredMetrics
      .split(',')
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    onSubmit({
      discountRatePct: discountRate.trim() === '' ? null : Number(discountRate),
      taxTreatment: taxTreatment || null,
      inflationRatePct: inflationRate.trim() === '' ? null : Number(inflationRate),
      roundingPolicy,
      requiredMetrics: metrics.length > 0 ? metrics : null,
      notes: notes.trim() || null,
      confidence: confidence || null,
      ownerUserId: ownerUserId.trim() || null,
      reason: reason.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Edytuj politykę kalkulacji' : 'Edit calculation policy'}
      description={isPolish ? 'Zapisuje realną politykę kalkulacji sprawy ROI (PUT .../calculation-policy).' : 'Saves the real ROI case calculation policy (PUT .../calculation-policy).'}
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
            data-testid="roi-policy-edit-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Save size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz politykę' : 'Save policy'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-policy-discount-rate">{isPolish ? 'Stopa dyskonta (%)' : 'Discount rate (%)'}</label>
            <input id="roi-policy-discount-rate" type="number" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} className={FIELD_CLASS} data-testid="roi-policy-discount-rate" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-policy-tax-treatment">{isPolish ? 'Traktowanie podatkowe' : 'Tax treatment'}</label>
            <select id="roi-policy-tax-treatment" value={taxTreatment} onChange={(e) => setTaxTreatment(e.target.value as RoiTaxTreatment | '')} className={FIELD_CLASS} data-testid="roi-policy-tax-treatment">
              <option value="">—</option>
              {ROI_TAX_TREATMENTS.map((t) => (
                <option key={t} value={t}>{roiTaxTreatmentLabel(t, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-policy-inflation-rate">{isPolish ? 'Stopa inflacji (%)' : 'Inflation rate (%)'}</label>
            <input id="roi-policy-inflation-rate" type="number" value={inflationRate} onChange={(e) => setInflationRate(e.target.value)} className={FIELD_CLASS} data-testid="roi-policy-inflation-rate" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-policy-rounding">{isPolish ? 'Polityka zaokrągleń' : 'Rounding policy'}</label>
            <select id="roi-policy-rounding" value={roundingPolicy} onChange={(e) => setRoundingPolicy(e.target.value as RoiRoundingPolicy)} className={FIELD_CLASS} data-testid="roi-policy-rounding">
              {ROI_ROUNDING_POLICIES.map((r) => (
                <option key={r} value={r}>{roiRoundingPolicyLabel(r, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-policy-confidence">{isPolish ? 'Pewność' : 'Confidence'}</label>
            <select id="roi-policy-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as RoiConfidenceLevel | '')} className={FIELD_CLASS} data-testid="roi-policy-confidence">
              <option value="">—</option>
              {ROI_CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{roiConfidenceLabel(c, isPolish)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-policy-required-metrics">
            {isPolish ? 'Wymagane metryki (rozdzielone przecinkiem)' : 'Required metrics (comma-separated)'}
          </label>
          <input
            id="roi-policy-required-metrics"
            value={requiredMetrics}
            onChange={(e) => setRequiredMetrics(e.target.value)}
            placeholder={isPolish ? 'np. npv, irr, payback' : 'e.g. npv, irr, payback'}
            className={FIELD_CLASS}
            data-testid="roi-policy-required-metrics"
          />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-policy-notes">{isPolish ? 'Notatki' : 'Notes'}</label>
          <textarea id="roi-policy-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-policy-notes" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-policy-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
          <input id="roi-policy-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-policy-owner" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-policy-reason">{isPolish ? 'Notatka do audytu (opcjonalnie)' : 'Audit note (optional)'}</label>
          <textarea id="roi-policy-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-policy-reason" />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-policy-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiCalculationPolicyEditModal;
