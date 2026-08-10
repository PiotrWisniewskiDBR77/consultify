/**
 * RoiBenefitLineFormModal — create/edit form for ROI Case benefit lines
 * (`POST`/`PATCH .../benefit-lines[/:benefitLineId]`, RN_G2_UI_SCOPE.md
 * §G #14). Same one-component-two-modes convention as
 * `RoiCostLineFormModal.tsx`/`RoiAssumptionFormModal.tsx`.
 *
 * Fields = exactly `AddBenefitLineSchema`
 * (`resultsVnextRoiEconomicModel.validators.ts` L166-186), no more.
 * UNLIKE a cost line, `amount`/`currency` are OPTIONAL here — a benefit can
 * be genuinely non-financial (`isFinancial: false`, e.g. "improved employee
 * satisfaction"), in which case amount/currency stay honestly `null`
 * (`HonestValueCell` renders that "—", never a fabricated `0`) rather than
 * this form inventing a placeholder amount to satisfy a UI that assumed
 * every benefit has a number.
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { AddRoiBenefitLineInput, RoiBenefitLine, RoiConfidenceLevel, RoiRecurrenceCadence, RoiTimingType } from './roiCaseDetailApi';
import { ROI_CONFIDENCE_LEVELS, ROI_RECURRENCE_CADENCES, ROI_TIMING_TYPES } from './roiCaseDetailApi';
import { roiConfidenceLabel, roiRecurrenceCadenceLabel, roiTimingTypeLabel } from './roiCaseDetailMappers';

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'];

export interface RoiBenefitLineFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (values: AddRoiBenefitLineInput) => void;
  isPolish: boolean;
  benefitLine?: RoiBenefitLine | null;
  defaultCurrency: string;
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
const CHECKBOX_LABEL_CLASS = 'flex items-center gap-2 text-sm text-c-text select-none';

export const RoiBenefitLineFormModal: React.FC<RoiBenefitLineFormModalProps> = ({
  open,
  mode,
  onClose,
  onSubmit,
  isPolish,
  benefitLine = null,
  defaultCurrency,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isFinancial, setIsFinancial] = useState(true);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [timingType, setTimingType] = useState<RoiTimingType>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [recurrenceStart, setRecurrenceStart] = useState('');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [recurrenceCadence, setRecurrenceCadence] = useState<RoiRecurrenceCadence | ''>('');
  const [rampPeriods, setRampPeriods] = useState('');
  const [doubleCountingGroup, setDoubleCountingGroup] = useState('');
  const [doubleCountingNote, setDoubleCountingNote] = useState('');
  const [confidence, setConfidence] = useState<RoiConfidenceLevel | ''>('');
  const [source, setSource] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const b = mode === 'edit' ? benefitLine : null;
    setCategory(b?.category ?? '');
    setLabel(b?.label ?? '');
    setDescription(b?.description ?? '');
    setIsFinancial(b?.isFinancial ?? true);
    setAmount(b?.amount !== null && b?.amount !== undefined ? String(b.amount) : '');
    setCurrency(b?.currency ?? defaultCurrency);
    setTimingType(b?.timingType ?? 'one_time');
    setOneTimeDate(b?.oneTimePeriodDate?.slice(0, 10) ?? '');
    setRecurrenceStart(b?.recurrenceStartDate?.slice(0, 10) ?? '');
    setRecurrenceEnd(b?.recurrenceEndDate?.slice(0, 10) ?? '');
    setRecurrenceCadence(b?.recurrenceCadence ?? '');
    setRampPeriods(b?.rampPeriods !== null && b?.rampPeriods !== undefined ? String(b.rampPeriods) : '');
    setDoubleCountingGroup(b?.doubleCountingGroup ?? '');
    setDoubleCountingNote(b?.doubleCountingResolutionNote ?? '');
    setConfidence(b?.confidence ?? '');
    setSource(b?.source ?? '');
    setOwnerUserId(b?.ownerUserId ?? '');
    setReason('');
    setTouched(false);
  }, [open, mode, benefitLine, defaultCurrency]);

  const categoryError = touched && !category.trim();
  const labelError = touched && !label.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!category.trim() || !label.trim()) return;
    onSubmit({
      category: category.trim(),
      label: label.trim(),
      description: description.trim() || null,
      isFinancial,
      amount: isFinancial && amount.trim() !== '' ? Number(amount) : null,
      currency: isFinancial && currency ? currency : null,
      timingType,
      oneTimePeriodDate: timingType === 'one_time' ? oneTimeDate || null : null,
      recurrenceStartDate: timingType === 'recurring' ? recurrenceStart || null : null,
      recurrenceEndDate: timingType === 'recurring' ? recurrenceEnd || null : null,
      recurrenceCadence: timingType === 'recurring' ? recurrenceCadence || null : null,
      rampPeriods: rampPeriods.trim() === '' ? null : Math.trunc(Number(rampPeriods)),
      doubleCountingGroup: doubleCountingGroup.trim() || null,
      doubleCountingResolutionNote: doubleCountingNote.trim() || null,
      confidence: confidence || null,
      source: source.trim() || null,
      ownerUserId: ownerUserId.trim() || null,
      reason: reason.trim() || null,
    });
  };

  const title = mode === 'create' ? (isPolish ? 'Nowa pozycja korzyści' : 'New benefit line') : (isPolish ? 'Edytuj pozycję korzyści' : 'Edit benefit line');

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
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
            data-testid="roi-benefit-line-form-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {mode === 'create' ? <Plus size={16} /> : <Save size={16} />}
            <span>
              {busy
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : mode === 'create'
                  ? isPolish
                    ? 'Dodaj korzyść'
                    : 'Add benefit line'
                  : isPolish
                    ? 'Zapisz korzyść'
                    : 'Save benefit line'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-category">{isPolish ? 'Kategoria' : 'Category'}</label>
            <input id="roi-benefit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-category" aria-invalid={categoryError || undefined} />
            {categoryError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Kategoria jest wymagana' : 'Category is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-label">{isPolish ? 'Nazwa pozycji' : 'Benefit line label'}</label>
            <input id="roi-benefit-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-label" aria-invalid={labelError || undefined} />
            {labelError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Nazwa jest wymagana' : 'Label is required'}</p> : null}
          </div>
        </div>
        <label className={CHECKBOX_LABEL_CLASS}>
          <input type="checkbox" checked={isFinancial} onChange={(e) => setIsFinancial(e.target.checked)} data-testid="roi-benefit-is-financial" />
          {isPolish ? 'Korzyść finansowa (ma kwotę)' : 'Financial benefit (has an amount)'}
        </label>
        {isFinancial ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-benefit-amount">{isPolish ? 'Kwota' : 'Amount'}</label>
              <input id="roi-benefit-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-amount" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-benefit-currency">{isPolish ? 'Waluta' : 'Currency'}</label>
              <select id="roi-benefit-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-currency">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-benefit-timing-type">{isPolish ? 'Typ harmonogramu' : 'Timing type'}</label>
          <select id="roi-benefit-timing-type" value={timingType} onChange={(e) => setTimingType(e.target.value as RoiTimingType)} className={FIELD_CLASS} data-testid="roi-benefit-timing-type">
            {ROI_TIMING_TYPES.map((t) => (
              <option key={t} value={t}>{roiTimingTypeLabel(t, isPolish)}</option>
            ))}
          </select>
        </div>
        {timingType === 'one_time' ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-one-time-date">{isPolish ? 'Data' : 'Date'}</label>
            <input id="roi-benefit-one-time-date" type="date" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-one-time-date" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-benefit-recurrence-start">{isPolish ? 'Początek' : 'Start'}</label>
              <input id="roi-benefit-recurrence-start" type="date" value={recurrenceStart} onChange={(e) => setRecurrenceStart(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-recurrence-start" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-benefit-recurrence-end">{isPolish ? 'Koniec' : 'End'}</label>
              <input id="roi-benefit-recurrence-end" type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-recurrence-end" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-benefit-cadence">{isPolish ? 'Cykl' : 'Cadence'}</label>
              <select id="roi-benefit-cadence" value={recurrenceCadence} onChange={(e) => setRecurrenceCadence(e.target.value as RoiRecurrenceCadence | '')} className={FIELD_CLASS} data-testid="roi-benefit-cadence">
                <option value="">—</option>
                {ROI_RECURRENCE_CADENCES.map((c) => (
                  <option key={c} value={c}>{roiRecurrenceCadenceLabel(c, isPolish)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-ramp">{isPolish ? 'Okresy narastania' : 'Ramp periods'}</label>
            <input id="roi-benefit-ramp" type="number" step="1" min="1" value={rampPeriods} onChange={(e) => setRampPeriods(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-ramp" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-double-counting-group">{isPolish ? 'Grupa podwójnego liczenia' : 'Double-counting group'}</label>
            <input id="roi-benefit-double-counting-group" value={doubleCountingGroup} onChange={(e) => setDoubleCountingGroup(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-double-counting-group" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-confidence">{isPolish ? 'Pewność' : 'Confidence'}</label>
            <select id="roi-benefit-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as RoiConfidenceLevel | '')} className={FIELD_CLASS} data-testid="roi-benefit-confidence">
              <option value="">—</option>
              {ROI_CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{roiConfidenceLabel(c, isPolish)}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-benefit-double-counting-note">{isPolish ? 'Rozstrzygnięcie podwójnego liczenia' : 'Double-counting resolution note'}</label>
          <textarea id="roi-benefit-double-counting-note" value={doubleCountingNote} onChange={(e) => setDoubleCountingNote(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-benefit-double-counting-note" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-benefit-description">{isPolish ? 'Opis' : 'Description'}</label>
          <textarea id="roi-benefit-description" value={description} onChange={(e) => setDescription(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-benefit-description" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-source">{isPolish ? 'Źródło' : 'Source'}</label>
            <input id="roi-benefit-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-source" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-benefit-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
            <input id="roi-benefit-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-benefit-owner" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-benefit-reason">{isPolish ? 'Notatka do audytu (opcjonalnie)' : 'Audit note (optional)'}</label>
          <textarea id="roi-benefit-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-benefit-reason" />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-benefit-line-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiBenefitLineFormModal;
