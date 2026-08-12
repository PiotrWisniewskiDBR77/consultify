/**
 * KpiDraftFormModal — RN-G5 create/edit form for `POST /api/vnext/results/kpi`
 * (`createKpiDraft`) and `PUT /:kpiId/draft` (`editKpiDraft`), the first two
 * steps of the KPI gold flow (`RN-E2E-KPI-001`,
 * `docs/product/results-vnext/06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`
 * §6) that had NO UI entry point anywhere before this package (see
 * `kpiApi.ts`'s RN-G5 header note).
 *
 * PURE presentational, same convention `RoiCaseCreateModal.tsx` established
 * for this codebase (`Modal` primitive, caller supplies data + write
 * behaviour, never fetches/writes itself) — the same component renders both
 * the live `ResultsKpiRegistryPage.tsx` and the dev-render QA harness.
 *
 * Fields = exactly `CreateKpiDraftSchema`/`EditKpiDraftSchema`
 * (`server/src/validators/resultsVnextKpi.validators.ts`), no more:
 * `kpiCode` (create-only, immutable after creation — `editDraft` has no
 * field for it, it lives on `rvn_kpi_definitions` not the version) · `name`
 * (required) · `description`/`unit` (optional) · `targetGeometry` (required,
 * one of the 6 `KPI_TARGET_GEOMETRIES`) · the geometry-specific numeric
 * bounds, shown/hidden per geometry using the EXACT field set
 * `targetGeometryEvaluator.ts` reads for that geometry (verified by reading
 * that file, not guessed) — showing an irrelevant bound field would invite
 * filling in a number the evaluator never looks at · `reason` (optional
 * audit note, both modes).
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import { KPI_TARGET_GEOMETRIES, type KpiTargetGeometry } from './kpiApi';

export interface KpiDraftFormValues {
  kpiCode: string;
  name: string;
  description: string | null;
  unit: string | null;
  targetGeometry: KpiTargetGeometry;
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  warningLow: number | null;
  warningHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  binarySuccessValue: number | null;
  formulaText: string | null;
  reason: string | null;
}

export interface KpiDraftFormInitialValues {
  kpiCode?: string;
  name?: string;
  description?: string | null;
  unit?: string | null;
  targetGeometry?: KpiTargetGeometry;
  targetValue?: number | null;
  targetMin?: number | null;
  targetMax?: number | null;
  warningLow?: number | null;
  warningHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
  binarySuccessValue?: number | null;
  formulaText?: string | null;
  /** RN-G6 UI fix (task 3) — the KPI's real current owner (`KpiDefinitionDto.
   * ownerUserId`, edit mode only — this DTO lives on the parent KPI row, not
   * the definition version this form otherwise edits). Read-only display
   * only, see the "Owner" block below for why there is no picker. */
  ownerUserId?: string | null;
}

export interface KpiDraftFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (values: KpiDraftFormValues) => void;
  isPolish: boolean;
  initialValues?: KpiDraftFormInitialValues;
  /** RN-G6 UI fix (task 3) — current user id, shown as the informational
   * "Owner: You" line in create mode (mirrors `RoiCaseCreateModal.tsx`'s
   * owner line). Only informational — `createKpiDraft` deliberately does not
   * accept an `ownerUserId` override (see `kpiApi.ts`'s own doc comment on
   * that function: the route defaults it to the caller, and there is no
   * generally-available "list org members" endpoint a normal member could
   * use to populate a picker for anyone else). */
  currentUserId?: string | null;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const GEOMETRY_LABEL: Record<KpiTargetGeometry, { pl: string; en: string }> = {
  threshold_min: { pl: 'Próg minimalny (im więcej, tym lepiej)', en: 'Minimum threshold (higher is better)' },
  threshold_max: { pl: 'Próg maksymalny (im mniej, tym lepiej)', en: 'Maximum threshold (lower is better)' },
  range: { pl: 'Przedział', en: 'Range' },
  exact: { pl: 'Wartość dokładna', en: 'Exact value' },
  binary: { pl: 'Zero-jedynkowy (spełniony/niespełniony)', en: 'Binary (met/not met)' },
  custom: { pl: 'Niestandardowy (formuła, bez oceny automatycznej)', en: 'Custom (formula, no automatic evaluation)' },
};

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

function toNumberOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function numOrEmpty(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export const KpiDraftFormModal: React.FC<KpiDraftFormModalProps> = ({
  open,
  mode,
  onClose,
  onSubmit,
  isPolish,
  initialValues,
  currentUserId = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [kpiCode, setKpiCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [targetGeometry, setTargetGeometry] = useState<KpiTargetGeometry>('threshold_min');
  const [targetValue, setTargetValue] = useState('');
  const [targetMin, setTargetMin] = useState('');
  const [targetMax, setTargetMax] = useState('');
  const [warningLow, setWarningLow] = useState('');
  const [warningHigh, setWarningHigh] = useState('');
  const [criticalLow, setCriticalLow] = useState('');
  const [criticalHigh, setCriticalHigh] = useState('');
  const [binarySuccessValue, setBinarySuccessValue] = useState('');
  const [formulaText, setFormulaText] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset (create) / prefill (edit) on every open — same convention as
  // `RoiCaseCreateModal.tsx` ("a second open shows the previous attempt's
  // leftovers" bug it fixed).
  useEffect(() => {
    if (!open) return;
    setKpiCode(initialValues?.kpiCode ?? '');
    setName(initialValues?.name ?? '');
    setDescription(initialValues?.description ?? '');
    setUnit(initialValues?.unit ?? '');
    setTargetGeometry(initialValues?.targetGeometry ?? 'threshold_min');
    setTargetValue(numOrEmpty(initialValues?.targetValue));
    setTargetMin(numOrEmpty(initialValues?.targetMin));
    setTargetMax(numOrEmpty(initialValues?.targetMax));
    setWarningLow(numOrEmpty(initialValues?.warningLow));
    setWarningHigh(numOrEmpty(initialValues?.warningHigh));
    setCriticalLow(numOrEmpty(initialValues?.criticalLow));
    setCriticalHigh(numOrEmpty(initialValues?.criticalHigh));
    setBinarySuccessValue(numOrEmpty(initialValues?.binarySuccessValue));
    setFormulaText(initialValues?.formulaText ?? '');
    setReason('');
    setTouched(false);
  }, [open, initialValues]);

  const codeError = mode === 'create' && touched && !kpiCode.trim();
  const nameError = touched && !name.trim();

  // Submit stays CLICKABLE with empty required fields — same fix
  // `RoiCaseCreateModal.tsx` documents (a `disabled` button never fires
  // `onClick`, which would make the per-field messages unreachable). Only
  // `busy` disables it.
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (!name.trim()) return;
    if (mode === 'create' && !kpiCode.trim()) return;
    onSubmit({
      kpiCode: kpiCode.trim(),
      name: name.trim(),
      description: description.trim() || null,
      unit: unit.trim() || null,
      targetGeometry,
      targetValue: toNumberOrNull(targetValue),
      targetMin: toNumberOrNull(targetMin),
      targetMax: toNumberOrNull(targetMax),
      warningLow: toNumberOrNull(warningLow),
      warningHigh: toNumberOrNull(warningHigh),
      criticalLow: toNumberOrNull(criticalLow),
      criticalHigh: toNumberOrNull(criticalHigh),
      binarySuccessValue: toNumberOrNull(binarySuccessValue),
      formulaText: formulaText.trim() || null,
      reason: reason.trim() || null,
    });
  };

  const title =
    mode === 'create' ? (isPolish ? 'Nowy KPI' : 'New KPI') : isPolish ? 'Edytuj szkic KPI' : 'Edit KPI draft';
  const description2 =
    mode === 'create'
      ? isPolish
        ? 'Zapisze się jako prawdziwy szkic (wersja 1, Draft) w rejestrze KPI.'
        : 'Saves as a real draft (version 1, Draft) in the KPI registry.'
      : isPolish
        ? 'Zmiany dotyczą wyłącznie bieżącej, nie zatwierdzonej jeszcze wersji definicji.'
        : 'Changes apply only to the current, not-yet-approved definition version.';

  const numberField = (
    id: string,
    label: string,
    value: string,
    setValue: (v: string) => void,
    testId: string
  ) => (
    <div>
      <label className={LABEL_CLASS} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={FIELD_CLASS}
        data-testid={testId}
        step="any"
      />
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description2}
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
            data-testid="kpi-draft-form-submit"
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
                    ? 'Utwórz szkic'
                    : 'Create draft'
                  : isPolish
                    ? 'Zapisz zmiany'
                    : 'Save changes'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {mode === 'create' ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-draft-code">
              {isPolish ? 'Kod KPI' : 'KPI code'}
            </label>
            <input
              id="kpi-draft-code"
              autoFocus
              value={kpiCode}
              onChange={(e) => setKpiCode(e.target.value)}
              placeholder={isPolish ? 'np. OEE-LINIA-PAKOWANIA' : 'e.g. OEE-PACKAGING-LINE'}
              className={FIELD_CLASS}
              data-testid="kpi-draft-code"
              aria-invalid={codeError || undefined}
              aria-describedby={codeError ? 'kpi-draft-code-error' : undefined}
            />
            {codeError ? (
              <p id="kpi-draft-code-error" className="mt-1 text-[11px] text-c-danger">
                {isPolish ? 'Kod KPI jest wymagany' : 'KPI code is required'}
              </p>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-draft-name">
            {isPolish ? 'Nazwa' : 'Name'}
          </label>
          <input
            id="kpi-draft-name"
            autoFocus={mode === 'edit'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isPolish ? 'np. OEE linii pakowania' : 'e.g. Packaging line OEE'}
            className={FIELD_CLASS}
            data-testid="kpi-draft-name"
            aria-invalid={nameError || undefined}
            aria-describedby={nameError ? 'kpi-draft-name-error' : undefined}
          />
          {nameError ? (
            <p id="kpi-draft-name-error" className="mt-1 text-[11px] text-c-danger">
              {isPolish ? 'Nazwa jest wymagana' : 'Name is required'}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-draft-unit">
              {isPolish ? 'Jednostka' : 'Unit'}
            </label>
            <input
              id="kpi-draft-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={isPolish ? 'np. %' : 'e.g. %'}
              className={FIELD_CLASS}
              data-testid="kpi-draft-unit"
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-draft-geometry">
              {isPolish ? 'Geometria celu' : 'Target geometry'}
            </label>
            <select
              id="kpi-draft-geometry"
              value={targetGeometry}
              onChange={(e) => setTargetGeometry(e.target.value as KpiTargetGeometry)}
              className={FIELD_CLASS}
              data-testid="kpi-draft-geometry"
            >
              {KPI_TARGET_GEOMETRIES.map((g) => (
                <option key={g} value={g}>
                  {isPolish ? GEOMETRY_LABEL[g].pl : GEOMETRY_LABEL[g].en}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-draft-description">
            {isPolish ? 'Opis (opcjonalnie)' : 'Description (optional)'}
          </label>
          <textarea
            id="kpi-draft-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-draft-description"
          />
        </div>

        {/* Geometry-specific bounds — exactly the fields
            `targetGeometryEvaluator.ts` reads for this geometry. */}
        {targetGeometry === 'threshold_min' ? (
          <div className="grid grid-cols-3 gap-3">
            {numberField('kpi-draft-target-value', isPolish ? 'Próg (min.)' : 'Threshold (min)', targetValue, setTargetValue, 'kpi-draft-target-value')}
            {numberField('kpi-draft-warning-low', isPolish ? 'Ostrzeżenie od' : 'Warning from', warningLow, setWarningLow, 'kpi-draft-warning-low')}
            {numberField('kpi-draft-critical-low', isPolish ? 'Krytyczne od' : 'Critical from', criticalLow, setCriticalLow, 'kpi-draft-critical-low')}
          </div>
        ) : null}
        {targetGeometry === 'threshold_max' ? (
          <div className="grid grid-cols-3 gap-3">
            {numberField('kpi-draft-target-value', isPolish ? 'Próg (maks.)' : 'Threshold (max)', targetValue, setTargetValue, 'kpi-draft-target-value')}
            {numberField('kpi-draft-warning-high', isPolish ? 'Ostrzeżenie do' : 'Warning up to', warningHigh, setWarningHigh, 'kpi-draft-warning-high')}
            {numberField('kpi-draft-critical-high', isPolish ? 'Krytyczne do' : 'Critical up to', criticalHigh, setCriticalHigh, 'kpi-draft-critical-high')}
          </div>
        ) : null}
        {targetGeometry === 'range' ? (
          <div className="grid grid-cols-2 gap-3">
            {numberField('kpi-draft-target-min', isPolish ? 'Cel od' : 'Target from', targetMin, setTargetMin, 'kpi-draft-target-min')}
            {numberField('kpi-draft-target-max', isPolish ? 'Cel do' : 'Target to', targetMax, setTargetMax, 'kpi-draft-target-max')}
            {numberField('kpi-draft-warning-low', isPolish ? 'Ostrzeżenie od' : 'Warning from', warningLow, setWarningLow, 'kpi-draft-warning-low')}
            {numberField('kpi-draft-warning-high', isPolish ? 'Ostrzeżenie do' : 'Warning to', warningHigh, setWarningHigh, 'kpi-draft-warning-high')}
          </div>
        ) : null}
        {targetGeometry === 'exact' ? (
          <div className="grid grid-cols-2 gap-3">
            {numberField('kpi-draft-target-value', isPolish ? 'Wartość dokładna' : 'Exact value', targetValue, setTargetValue, 'kpi-draft-target-value')}
            {numberField('kpi-draft-warning-low', isPolish ? 'Tolerancja od' : 'Tolerance from', warningLow, setWarningLow, 'kpi-draft-warning-low')}
            {numberField('kpi-draft-warning-high', isPolish ? 'Tolerancja do' : 'Tolerance to', warningHigh, setWarningHigh, 'kpi-draft-warning-high')}
            {numberField('kpi-draft-critical-low', isPolish ? 'Krytyczne od' : 'Critical from', criticalLow, setCriticalLow, 'kpi-draft-critical-low')}
            {numberField('kpi-draft-critical-high', isPolish ? 'Krytyczne do' : 'Critical to', criticalHigh, setCriticalHigh, 'kpi-draft-critical-high')}
          </div>
        ) : null}
        {targetGeometry === 'binary' ? (
          <div className="grid grid-cols-2 gap-3">
            {numberField(
              'kpi-draft-binary-success',
              isPolish ? 'Wartość sukcesu (0 lub 1)' : 'Success value (0 or 1)',
              binarySuccessValue,
              setBinarySuccessValue,
              'kpi-draft-binary-success'
            )}
          </div>
        ) : null}
        {targetGeometry === 'custom' ? (
          <div>
            <label className={LABEL_CLASS} htmlFor="kpi-draft-formula">
              {isPolish ? 'Formuła (opis, bez oceny automatycznej)' : 'Formula (description, no automatic evaluation)'}
            </label>
            <textarea
              id="kpi-draft-formula"
              value={formulaText}
              onChange={(e) => setFormulaText(e.target.value)}
              className={TEXTAREA_CLASS}
              data-testid="kpi-draft-formula"
            />
          </div>
        ) : null}

        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-draft-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="kpi-draft-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isPolish ? 'Kontekst zmiany…' : 'Context for this change…'}
            className={TEXTAREA_CLASS}
            data-testid="kpi-draft-reason"
          />
        </div>

        {/* RN-G6 UI fix (task 3) — read-only, not a picker: `createKpiDraft`
            deliberately does not accept an owner override (see this file's
            `currentUserId` prop doc comment), and there is no write endpoint
            for changing an existing KPI's owner either — showing the real
            value here closes the "no owner field anywhere" gap honestly,
            without fabricating an edit affordance the backend cannot honor. */}
        <div>
          <div className={LABEL_CLASS}>{isPolish ? 'Właściciel' : 'Owner'}</div>
          {mode === 'create' ? (
            <p className="text-sm text-c-text-secondary">
              {currentUserId ? (
                <>
                  {isPolish ? 'Ty' : 'You'}{' '}
                  <span className="font-mono text-c-text-muted text-[12px]">({currentUserId})</span>
                </>
              ) : isPolish ? (
                'Zostanie ustalony przez serwer.'
              ) : (
                'Will be resolved by the server.'
              )}
            </p>
          ) : (
            <p className="text-sm text-c-text-secondary">
              {initialValues?.ownerUserId ? (
                <span className="font-mono text-c-text-muted text-[12px]">{initialValues.ownerUserId}</span>
              ) : (
                '—'
              )}{' '}
              <span className="text-c-text-muted text-[11px]">
                {isPolish ? '(nie do zmiany z tego formularza)' : '(not changeable from this form)'}
              </span>
            </p>
          )}
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="kpi-draft-form-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default KpiDraftFormModal;
