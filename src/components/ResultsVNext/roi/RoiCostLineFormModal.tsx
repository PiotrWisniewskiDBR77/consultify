/**
 * RoiCostLineFormModal — create/edit form for ROI Case cost lines
 * (`POST`/`PATCH .../cost-lines[/:costLineId]`, RN_G2_UI_SCOPE.md §G #13
 * second half). Same one-component-two-modes convention as
 * `RoiAssumptionFormModal.tsx` — `AddCostLineSchema`/`UpdateCostLineSchema`
 * are the same shape (`UpdateCostLineSchema = AddCostLineSchema.partial()
 * .extend({expectedVersion})`).
 *
 * Fields = exactly `AddCostLineSchema`
 * (`resultsVnextRoiEconomicModel.validators.ts` L134-150), no more.
 * `category`/`label`/`amount`/`currency`/`timingType` are REQUIRED — a cost
 * line is always a real amount in a real currency, unlike a benefit line
 * (which may be non-financial). Currency options mirror the same fixed ISO
 * list `RoiCaseCreateModal.tsx` already uses (not invented here).
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { AddRoiCostLineInput, RoiConfidenceLevel, RoiCostLine, RoiRecurrenceCadence, RoiTimingType } from './roiCaseDetailApi';
import { ROI_CONFIDENCE_LEVELS, ROI_RECURRENCE_CADENCES, ROI_TIMING_TYPES } from './roiCaseDetailApi';
import { roiConfidenceLabel, roiRecurrenceCadenceLabel, roiTimingTypeLabel } from './roiCaseDetailMappers';

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'];

export interface RoiCostLineFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (values: AddRoiCostLineInput) => void;
  isPolish: boolean;
  costLine?: RoiCostLine | null;
  /** Case's own currency — prefills a NEW cost line's currency field only
   * (`mode: 'create'`); an existing line keeps whatever currency it was
   * saved with. */
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

export const RoiCostLineFormModal: React.FC<RoiCostLineFormModalProps> = ({
  open,
  mode,
  onClose,
  onSubmit,
  isPolish,
  costLine = null,
  defaultCurrency,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [timingType, setTimingType] = useState<RoiTimingType>('one_time');
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [recurrenceStart, setRecurrenceStart] = useState('');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  const [recurrenceCadence, setRecurrenceCadence] = useState<RoiRecurrenceCadence | ''>('');
  const [confidence, setConfidence] = useState<RoiConfidenceLevel | ''>('');
  const [source, setSource] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const c = mode === 'edit' ? costLine : null;
    setCategory(c?.category ?? '');
    setLabel(c?.label ?? '');
    setDescription(c?.description ?? '');
    setAmount(c ? String(c.amount) : '');
    setCurrency(c?.currency ?? defaultCurrency);
    setTimingType(c?.timingType ?? 'one_time');
    setOneTimeDate(c?.oneTimePeriodDate?.slice(0, 10) ?? '');
    setRecurrenceStart(c?.recurrenceStartDate?.slice(0, 10) ?? '');
    setRecurrenceEnd(c?.recurrenceEndDate?.slice(0, 10) ?? '');
    setRecurrenceCadence(c?.recurrenceCadence ?? '');
    setConfidence(c?.confidence ?? '');
    setSource(c?.source ?? '');
    setOwnerUserId(c?.ownerUserId ?? '');
    setReason('');
    setTouched(false);
  }, [open, mode, costLine, defaultCurrency]);

  const categoryError = touched && !category.trim();
  const labelError = touched && !label.trim();
  const amountError = touched && amount.trim() === '';

  const handleSubmit = () => {
    setTouched(true);
    if (!category.trim() || !label.trim() || amount.trim() === '') return;
    onSubmit({
      category: category.trim(),
      label: label.trim(),
      description: description.trim() || null,
      amount: Number(amount),
      currency,
      timingType,
      oneTimePeriodDate: timingType === 'one_time' ? oneTimeDate || null : null,
      recurrenceStartDate: timingType === 'recurring' ? recurrenceStart || null : null,
      recurrenceEndDate: timingType === 'recurring' ? recurrenceEnd || null : null,
      recurrenceCadence: timingType === 'recurring' ? recurrenceCadence || null : null,
      confidence: confidence || null,
      source: source.trim() || null,
      ownerUserId: ownerUserId.trim() || null,
      reason: reason.trim() || null,
    });
  };

  const title = mode === 'create' ? (isPolish ? 'Nowa pozycja kosztowa' : 'New cost line') : (isPolish ? 'Edytuj pozycję kosztową' : 'Edit cost line');

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
            data-testid="roi-cost-line-form-submit"
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
                    ? 'Dodaj koszt'
                    : 'Add cost line'
                  : isPolish
                    ? 'Zapisz koszt'
                    : 'Save cost line'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-category">{isPolish ? 'Kategoria' : 'Category'}</label>
            <input id="roi-cost-category" value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-category" aria-invalid={categoryError || undefined} />
            {categoryError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Kategoria jest wymagana' : 'Category is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-label">{isPolish ? 'Nazwa pozycji' : 'Cost line label'}</label>
            <input id="roi-cost-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-label" aria-invalid={labelError || undefined} />
            {labelError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Nazwa jest wymagana' : 'Label is required'}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-amount">{isPolish ? 'Kwota' : 'Amount'}</label>
            <input id="roi-cost-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-amount" aria-invalid={amountError || undefined} />
            {amountError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Kwota jest wymagana' : 'Amount is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-currency">{isPolish ? 'Waluta' : 'Currency'}</label>
            <select id="roi-cost-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-currency">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-timing-type">{isPolish ? 'Typ harmonogramu' : 'Timing type'}</label>
            <select id="roi-cost-timing-type" value={timingType} onChange={(e) => setTimingType(e.target.value as RoiTimingType)} className={FIELD_CLASS} data-testid="roi-cost-timing-type">
              {ROI_TIMING_TYPES.map((t) => (
                <option key={t} value={t}>{roiTimingTypeLabel(t, isPolish)}</option>
              ))}
            </select>
          </div>
        </div>
        {timingType === 'one_time' ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-one-time-date">{isPolish ? 'Data' : 'Date'}</label>
            <input id="roi-cost-one-time-date" type="date" value={oneTimeDate} onChange={(e) => setOneTimeDate(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-one-time-date" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-cost-recurrence-start">{isPolish ? 'Początek' : 'Start'}</label>
              <input id="roi-cost-recurrence-start" type="date" value={recurrenceStart} onChange={(e) => setRecurrenceStart(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-recurrence-start" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-cost-recurrence-end">{isPolish ? 'Koniec' : 'End'}</label>
              <input id="roi-cost-recurrence-end" type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-recurrence-end" />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="roi-cost-cadence">{isPolish ? 'Cykl' : 'Cadence'}</label>
              <select id="roi-cost-cadence" value={recurrenceCadence} onChange={(e) => setRecurrenceCadence(e.target.value as RoiRecurrenceCadence | '')} className={FIELD_CLASS} data-testid="roi-cost-cadence">
                <option value="">—</option>
                {ROI_RECURRENCE_CADENCES.map((c) => (
                  <option key={c} value={c}>{roiRecurrenceCadenceLabel(c, isPolish)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-cost-description">{isPolish ? 'Opis' : 'Description'}</label>
          <textarea id="roi-cost-description" value={description} onChange={(e) => setDescription(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-cost-description" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-confidence">{isPolish ? 'Pewność' : 'Confidence'}</label>
            <select id="roi-cost-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as RoiConfidenceLevel | '')} className={FIELD_CLASS} data-testid="roi-cost-confidence">
              <option value="">—</option>
              {ROI_CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{roiConfidenceLabel(c, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-source">{isPolish ? 'Źródło' : 'Source'}</label>
            <input id="roi-cost-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-source" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-cost-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
            <input id="roi-cost-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-cost-owner" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-cost-reason">{isPolish ? 'Notatka do audytu (opcjonalnie)' : 'Audit note (optional)'}</label>
          <textarea id="roi-cost-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-cost-reason" />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-cost-line-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiCostLineFormModal;
