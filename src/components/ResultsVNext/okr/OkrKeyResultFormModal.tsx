/**
 * OkrKeyResultFormModal — create + edit form for a Key Result under one
 * Objective. Fields = exactly `CreateOkrKeyResultSchema`/
 * `UpdateOkrKeyResultSchema` (`resultsVnextOkr.validators.ts` L422-486),
 * INCLUDING the two `.refine()` cross-field rules on create (currency
 * required for `measurementType==='currency'`; rangeMin/rangeMax required
 * for `direction==='maintain_range'`) — replicated here as client-side
 * hints so the user sees them before submit, but the server's own message
 * is still what's shown on a 409 (never silently swallowed by a client
 * check that might drift from the real schema).
 *
 * MVP-supported `measurementType` only (`numeric`/`percentage`/`currency`/
 * `binary`) — `milestone`/`custom` are schema-permitted but command-layer
 * rejected (`okrKeyResultCommands.ts` L84), so this form never offers them.
 *
 * `confidence`/`confidenceNumericValue` ARE editable here (unlike the
 * Objective form) — `updateKeyResult`/`createKeyResult` do not gate them
 * behind a Cycle policy the way Objective confidence is gated; the server
 * still validates `confidenceNumericValue` is present when
 * `confidence==='numeric'` (both schemas' own `.refine()`), replicated
 * client-side as a hint.
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type {
  OkrKeyResultConfidence,
  OkrKeyResultDirection,
  OkrKeyResultDto,
  OkrKeyResultMeasurementType,
  OkrKeyResultSourceType,
} from './okrObjectiveApi';

export interface OkrKeyResultFormValues {
  ownerUserId: string;
  title: string;
  description: string | null;
  measurementType: OkrKeyResultMeasurementType;
  unit: string | null;
  currency: string | null;
  baselineValue: number | null;
  targetValue: number | null;
  startValue: number | null;
  currentValue: number | null;
  direction: OkrKeyResultDirection;
  rangeMin: number | null;
  rangeMax: number | null;
  confidence: OkrKeyResultConfidence | null;
  confidenceNumericValue: number | null;
  sourceType: OkrKeyResultSourceType;
  sourceReference: string | null;
  weight: number | null;
  reason: string | null;
}

export interface OkrKeyResultFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: OkrKeyResultDto | null;
  onClose: () => void;
  onSubmit: (values: OkrKeyResultFormValues) => void;
  isPolish: boolean;
  currentUserId: string | null;
  /** Set when the owning Set is not `draft`/`changes_requested` — modal
   * still opens, submit stays disabled with this reason (TRIADA §C3). */
  blockedReason?: string | null;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'];

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

function toNumOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export const OkrKeyResultFormModal: React.FC<OkrKeyResultFormModalProps> = ({
  open,
  mode,
  initial = null,
  onClose,
  onSubmit,
  isPolish,
  currentUserId,
  blockedReason = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [measurementType, setMeasurementType] = useState<OkrKeyResultMeasurementType>('numeric');
  const [unit, setUnit] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [baselineValue, setBaselineValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [startValue, setStartValue] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [direction, setDirection] = useState<OkrKeyResultDirection>('increase');
  const [rangeMin, setRangeMin] = useState('');
  const [rangeMax, setRangeMax] = useState('');
  const [confidence, setConfidence] = useState<OkrKeyResultConfidence | ''>('');
  const [confidenceNumericValue, setConfidenceNumericValue] = useState('');
  const [sourceType, setSourceType] = useState<OkrKeyResultSourceType>('manual');
  const [sourceReference, setSourceReference] = useState('');
  const [weight, setWeight] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setMeasurementType(initial?.measurementType ?? 'numeric');
    setUnit(initial?.unit ?? '');
    setCurrency(initial?.currency ?? 'PLN');
    setBaselineValue(initial?.baselineValue ?? '');
    setTargetValue(initial?.targetValue ?? '');
    setStartValue(initial?.startValue ?? '');
    setCurrentValue(initial?.currentValue ?? '');
    setDirection(initial?.direction ?? 'increase');
    setRangeMin(initial?.rangeMin ?? '');
    setRangeMax(initial?.rangeMax ?? '');
    setConfidence(initial?.confidence ?? '');
    setConfidenceNumericValue(initial?.confidenceNumericValue ?? '');
    setSourceType(initial?.sourceType ?? 'manual');
    setSourceReference(initial?.sourceReference ?? '');
    setWeight(initial?.weight ?? '');
    setReason('');
    setTouched(false);
  }, [open, initial]);

  const titleError = touched && !title.trim();
  const currencyError = touched && measurementType === 'currency' && !currency.trim();
  const rangeError = touched && direction === 'maintain_range' && (rangeMin.trim() === '' || rangeMax.trim() === '');
  const confidenceNumericError = touched && confidence === 'numeric' && confidenceNumericValue.trim() === '';
  const ownerMissing = mode === 'create' && !currentUserId;
  const ownerUserId = mode === 'edit' ? (initial?.ownerUserId ?? currentUserId ?? '') : currentUserId ?? '';

  const submitDisabled = busy || ownerMissing || !!blockedReason;

  const handleSubmit = () => {
    setTouched(true);
    if (!title.trim() || !ownerUserId) return;
    if (measurementType === 'currency' && !currency.trim()) return;
    if (direction === 'maintain_range' && (rangeMin.trim() === '' || rangeMax.trim() === '')) return;
    if (confidence === 'numeric' && confidenceNumericValue.trim() === '') return;
    onSubmit({
      ownerUserId,
      title: title.trim(),
      description: description.trim() || null,
      measurementType,
      unit: unit.trim() || null,
      currency: measurementType === 'currency' ? currency.trim() : currency.trim() || null,
      baselineValue: toNumOrNull(baselineValue),
      targetValue: toNumOrNull(targetValue),
      startValue: toNumOrNull(startValue),
      currentValue: toNumOrNull(currentValue),
      direction,
      rangeMin: direction === 'maintain_range' ? toNumOrNull(rangeMin) : null,
      rangeMax: direction === 'maintain_range' ? toNumOrNull(rangeMax) : null,
      confidence: confidence || null,
      confidenceNumericValue: confidence === 'numeric' ? toNumOrNull(confidenceNumericValue) : null,
      sourceType,
      sourceReference: sourceReference.trim() || null,
      weight: toNumOrNull(weight),
      reason: reason.trim() || null,
    });
  };

  const isEdit = mode === 'edit';

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isEdit ? (isPolish ? 'Edytuj Kluczowy Rezultat' : 'Edit Key Result') : isPolish ? 'Nowy Kluczowy Rezultat' : 'New Key Result'}
      description={
        isEdit
          ? isPolish
            ? 'Zmiany zapiszą się natychmiast, a postęp zostanie przeliczony.'
            : 'Changes save immediately and progress is recomputed.'
          : isPolish
            ? 'Zapisze się jako prawdziwy Kluczowy Rezultat pod tym celem.'
            : 'Saves as a real Key Result under this objective.'
      }
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
            disabled={submitDisabled}
            data-testid="okr-kr-form-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isEdit ? <Save size={16} /> : <Plus size={16} />}
            <span>
              {busy
                ? isPolish
                  ? 'Zapisywanie…'
                  : 'Saving…'
                : isEdit
                  ? isPolish
                    ? 'Zapisz zmiany'
                    : 'Save changes'
                  : isPolish
                    ? 'Utwórz Kluczowy Rezultat'
                    : 'Create Key Result'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {blockedReason ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-kr-form-blocked"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
            <span>{blockedReason}</span>
          </div>
        ) : null}
        <div>
          <label className={LABEL_CLASS} htmlFor="okr-kr-title">
            {isPolish ? 'Tytuł Kluczowego Rezultatu' : 'Key Result title'}
          </label>
          <input
            id="okr-kr-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD_CLASS}
            data-testid="okr-kr-title"
            aria-invalid={titleError || undefined}
          />
          {titleError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Tytuł jest wymagany' : 'Title is required'}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-measurement">
              {isPolish ? 'Typ pomiaru' : 'Measurement type'}
            </label>
            <select
              id="okr-kr-measurement"
              value={measurementType}
              onChange={(e) => setMeasurementType(e.target.value as OkrKeyResultMeasurementType)}
              className={FIELD_CLASS}
              data-testid="okr-kr-measurement"
            >
              <option value="numeric">{isPolish ? 'Liczbowy' : 'Numeric'}</option>
              <option value="percentage">{isPolish ? 'Procentowy' : 'Percentage'}</option>
              <option value="currency">{isPolish ? 'Walutowy' : 'Currency'}</option>
              <option value="binary">{isPolish ? 'Binarny (tak/nie)' : 'Binary (yes/no)'}</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-direction">
              {isPolish ? 'Geometria' : 'Geometry'}
            </label>
            <select
              id="okr-kr-direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as OkrKeyResultDirection)}
              className={FIELD_CLASS}
              data-testid="okr-kr-direction"
            >
              <option value="increase">{isPolish ? 'Wzrost' : 'Increase'}</option>
              <option value="decrease">{isPolish ? 'Spadek' : 'Decrease'}</option>
              <option value="reach">{isPolish ? 'Osiągnięcie wartości' : 'Reach'}</option>
              <option value="maintain_range">{isPolish ? 'Utrzymanie zakresu' : 'Maintain range'}</option>
              <option value="binary">{isPolish ? 'Binarny (tak/nie)' : 'Binary (yes/no)'}</option>
            </select>
          </div>
        </div>

        {measurementType === 'currency' ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-currency">
              {isPolish ? 'Waluta' : 'Currency'}
            </label>
            <select
              id="okr-kr-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-currency"
              aria-invalid={currencyError || undefined}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {currencyError ? (
              <p className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Waluta jest wymagana dla typu „walutowy"' : 'Currency is required for "currency" measurement type'}
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-unit">
              {isPolish ? 'Jednostka (opcjonalnie)' : 'Unit (optional)'}
            </label>
            <input
              id="okr-kr-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={isPolish ? 'np. szt., %, dni' : 'e.g. pcs, %, days'}
              className={FIELD_CLASS}
              data-testid="okr-kr-unit"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-baseline">
              {isPolish ? 'Wartość bazowa' : 'Baseline value'}
            </label>
            <input
              id="okr-kr-baseline"
              type="number"
              value={baselineValue}
              onChange={(e) => setBaselineValue(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-baseline"
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-target">
              {isPolish ? 'Wartość docelowa' : 'Target value'}
            </label>
            <input
              id="okr-kr-target"
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-target"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-start">
              {isPolish ? 'Wartość startowa' : 'Start value'}
            </label>
            <input
              id="okr-kr-start"
              type="number"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-start"
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-current">
              {isPolish ? 'Wartość bieżąca' : 'Current value'}
            </label>
            <input
              id="okr-kr-current"
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-current"
            />
          </div>
        </div>

        {direction === 'maintain_range' ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="okr-kr-range-min">
                {isPolish ? 'Zakres — min' : 'Range — min'}
              </label>
              <input
                id="okr-kr-range-min"
                type="number"
                value={rangeMin}
                onChange={(e) => setRangeMin(e.target.value)}
                className={FIELD_CLASS}
                data-testid="okr-kr-range-min"
                aria-invalid={rangeError || undefined}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="okr-kr-range-max">
                {isPolish ? 'Zakres — max' : 'Range — max'}
              </label>
              <input
                id="okr-kr-range-max"
                type="number"
                value={rangeMax}
                onChange={(e) => setRangeMax(e.target.value)}
                className={FIELD_CLASS}
                data-testid="okr-kr-range-max"
                aria-invalid={rangeError || undefined}
              />
            </div>
            {rangeError ? (
              <p className="col-span-2 text-[11px] text-c-danger">
                {isPolish
                  ? 'Min i max zakresu są wymagane dla geometrii „utrzymanie zakresu"'
                  : 'Range min and max are required for "maintain range" geometry'}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-confidence">
              {isPolish ? 'Pewność (opcjonalnie)' : 'Confidence (optional)'}
            </label>
            <select
              id="okr-kr-confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as OkrKeyResultConfidence | '')}
              className={FIELD_CLASS}
              data-testid="okr-kr-confidence"
            >
              <option value="">{isPolish ? '— brak —' : '— none —'}</option>
              <option value="high">{isPolish ? 'Wysoka' : 'High'}</option>
              <option value="medium">{isPolish ? 'Średnia' : 'Medium'}</option>
              <option value="low">{isPolish ? 'Niska' : 'Low'}</option>
              <option value="numeric">{isPolish ? 'Liczbowa' : 'Numeric'}</option>
            </select>
          </div>
          {confidence === 'numeric' ? (
            <div>
              <label className={LABEL_CLASS} htmlFor="okr-kr-confidence-numeric">
                {isPolish ? 'Wartość pewności' : 'Confidence value'}
              </label>
              <input
                id="okr-kr-confidence-numeric"
                type="number"
                value={confidenceNumericValue}
                onChange={(e) => setConfidenceNumericValue(e.target.value)}
                className={FIELD_CLASS}
                data-testid="okr-kr-confidence-numeric"
                aria-invalid={confidenceNumericError || undefined}
              />
              {confidenceNumericError ? (
                <p className="mt-1 text-[11px] text-c-danger">
                  {isPolish ? 'Wymagane, gdy pewność = „liczbowa"' : 'Required when confidence = "numeric"'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-source-type">
              {isPolish ? 'Źródło' : 'Source'}
            </label>
            <select
              id="okr-kr-source-type"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as OkrKeyResultSourceType)}
              className={FIELD_CLASS}
              data-testid="okr-kr-source-type"
            >
              <option value="manual">{isPolish ? 'Ręczny' : 'Manual'}</option>
              <option value="import">{isPolish ? 'Import' : 'Import'}</option>
              <option value="connector">{isPolish ? 'Konektor' : 'Connector'}</option>
              <option value="mcp">MCP</option>
              <option value="calculated">{isPolish ? 'Wyliczany' : 'Calculated'}</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="okr-kr-weight">
              {isPolish ? 'Waga (opcjonalnie)' : 'Weight (optional)'}
            </label>
            <input
              id="okr-kr-weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={FIELD_CLASS}
              data-testid="okr-kr-weight"
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-kr-source-reference">
            {isPolish ? 'Odniesienie źródła (opcjonalnie)' : 'Source reference (optional)'}
          </label>
          <input
            id="okr-kr-source-reference"
            value={sourceReference}
            onChange={(e) => setSourceReference(e.target.value)}
            placeholder={isPolish ? 'wolny tekst, bez powiązania z KPI' : 'free text, not linked to any KPI'}
            className={FIELD_CLASS}
            data-testid="okr-kr-source-reference"
          />
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-kr-description">
            {isPolish ? 'Opis (opcjonalnie)' : 'Description (optional)'}
          </label>
          <textarea
            id="okr-kr-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-kr-description"
          />
        </div>

        <div>
          <div className={LABEL_CLASS}>{isPolish ? 'Właściciel' : 'Owner'}</div>
          {ownerMissing ? (
            <p className="text-[12px] text-c-danger" role="alert">
              {isPolish
                ? 'Nie udało się ustalić Twojego identyfikatora użytkownika — zaloguj się ponownie.'
                : 'Could not resolve your user id — please sign in again.'}
            </p>
          ) : (
            <p className="text-sm text-c-text-secondary">
              <span className="font-mono text-c-text-muted text-[12px]">{ownerUserId}</span>
            </p>
          )}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="okr-kr-reason">
            {isPolish ? 'Notatka o zmianie (opcjonalnie)' : 'Change note (optional)'}
          </label>
          <textarea
            id="okr-kr-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="okr-kr-reason"
          />
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-kr-form-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrKeyResultFormModal;
