/**
 * RoiAssumptionFormModal — create/edit form for ROI Case assumptions
 * (`POST`/`PATCH .../assumptions[/:assumptionId]`, RN_G2_UI_SCOPE.md §G #13
 * first half). ONE component for both modes (`mode: 'create' | 'edit'`) —
 * the field set is identical (`AddAssumptionSchema`/`UpdateAssumptionSchema`
 * are the same shape, `UpdateAssumptionSchema = AddAssumptionSchema.partial()
 * .extend({expectedVersion})`, `resultsVnextRoiEconomicModel.validators.ts`
 * L103-122) — only the submit label/testid and whether an existing
 * `RoiAssumption` prefills the form differ.
 *
 * Fields = exactly `AddAssumptionSchema`, no more. `category`/`label` are
 * REQUIRED (server `min(1)`); every numeric/optional field submits an
 * explicit `null` when cleared, same "always-visible-form" reasoning as
 * `RoiBaselineEditModal.tsx`.
 */
import { AlertTriangle, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import type { AddRoiAssumptionInput, RoiAssumption, RoiConfidenceLevel } from './roiCaseDetailApi';
import { ROI_CONFIDENCE_LEVELS } from './roiCaseDetailApi';
import { roiConfidenceLabel } from './roiCaseDetailMappers';

export interface RoiAssumptionFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  onSubmit: (values: AddRoiAssumptionInput) => void;
  isPolish: boolean;
  /** Prefill for `mode: 'edit'` — ignored (form starts blank) for `'create'`. */
  assumption?: RoiAssumption | null;
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

export const RoiAssumptionFormModal: React.FC<RoiAssumptionFormModalProps> = ({
  open,
  mode,
  onClose,
  onSubmit,
  isPolish,
  assumption = null,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [category, setCategory] = useState('');
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState('');
  const [baseValue, setBaseValue] = useState('');
  const [downsideValue, setDownsideValue] = useState('');
  const [upsideValue, setUpsideValue] = useState('');
  const [confidence, setConfidence] = useState<RoiConfidenceLevel | ''>('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [source, setSource] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [sensitivityRank, setSensitivityRank] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const a = mode === 'edit' ? assumption : null;
    setCategory(a?.category ?? '');
    setLabel(a?.label ?? '');
    setUnit(a?.unit ?? '');
    setBaseValue(a?.baseValue !== null && a?.baseValue !== undefined ? String(a.baseValue) : '');
    setDownsideValue(a?.downsideValue !== null && a?.downsideValue !== undefined ? String(a.downsideValue) : '');
    setUpsideValue(a?.upsideValue !== null && a?.upsideValue !== undefined ? String(a.upsideValue) : '');
    setConfidence(a?.confidence ?? '');
    setEvidenceRef(a?.evidenceRef ?? '');
    setSource(a?.source ?? '');
    setOwnerUserId(a?.ownerUserId ?? '');
    setSensitivityRank(a?.sensitivityRank !== null && a?.sensitivityRank !== undefined ? String(a.sensitivityRank) : '');
    setNotes(a?.notes ?? '');
    setReason('');
    setTouched(false);
  }, [open, mode, assumption]);

  const categoryError = touched && !category.trim();
  const labelError = touched && !label.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!category.trim() || !label.trim()) return;
    onSubmit({
      category: category.trim(),
      label: label.trim(),
      unit: unit.trim() || null,
      baseValue: baseValue.trim() === '' ? null : Number(baseValue),
      downsideValue: downsideValue.trim() === '' ? null : Number(downsideValue),
      upsideValue: upsideValue.trim() === '' ? null : Number(upsideValue),
      confidence: confidence || null,
      evidenceRef: evidenceRef.trim() || null,
      source: source.trim() || null,
      ownerUserId: ownerUserId.trim() || null,
      sensitivityRank: sensitivityRank.trim() === '' ? null : Math.trunc(Number(sensitivityRank)),
      notes: notes.trim() || null,
      reason: reason.trim() || null,
    });
  };

  const title = mode === 'create' ? (isPolish ? 'Nowe założenie' : 'New assumption') : (isPolish ? 'Edytuj założenie' : 'Edit assumption');

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
            data-testid="roi-assumption-form-submit"
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
                    ? 'Dodaj założenie'
                    : 'Add assumption'
                  : isPolish
                    ? 'Zapisz założenie'
                    : 'Save assumption'}
            </span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-category">{isPolish ? 'Kategoria' : 'Category'}</label>
            <input id="roi-assumption-category" value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-category" aria-invalid={categoryError || undefined} />
            {categoryError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Kategoria jest wymagana' : 'Category is required'}</p> : null}
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-label">{isPolish ? 'Nazwa założenia' : 'Assumption label'}</label>
            <input id="roi-assumption-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-label" aria-invalid={labelError || undefined} />
            {labelError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Nazwa jest wymagana' : 'Label is required'}</p> : null}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-base">{isPolish ? 'Wartość bazowa' : 'Base value'}</label>
            <input id="roi-assumption-base" type="number" value={baseValue} onChange={(e) => setBaseValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-base" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-downside">{isPolish ? 'Pesymistyczna' : 'Downside'}</label>
            <input id="roi-assumption-downside" type="number" value={downsideValue} onChange={(e) => setDownsideValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-downside" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-upside">{isPolish ? 'Optymistyczna' : 'Upside'}</label>
            <input id="roi-assumption-upside" type="number" value={upsideValue} onChange={(e) => setUpsideValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-upside" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-unit">{isPolish ? 'Jednostka' : 'Unit'}</label>
            <input id="roi-assumption-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-unit" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-confidence">{isPolish ? 'Pewność' : 'Confidence'}</label>
            <select id="roi-assumption-confidence" value={confidence} onChange={(e) => setConfidence(e.target.value as RoiConfidenceLevel | '')} className={FIELD_CLASS} data-testid="roi-assumption-confidence">
              <option value="">—</option>
              {ROI_CONFIDENCE_LEVELS.map((c) => (
                <option key={c} value={c}>{roiConfidenceLabel(c, isPolish)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-sensitivity">{isPolish ? 'Ranga wrażliwości' : 'Sensitivity rank'}</label>
            <input id="roi-assumption-sensitivity" type="number" step="1" value={sensitivityRank} onChange={(e) => setSensitivityRank(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-sensitivity" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-owner">{isPolish ? 'Właściciel' : 'Owner'}</label>
            <input id="roi-assumption-owner" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-owner" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-evidence">{isPolish ? 'Dowód (referencja)' : 'Evidence ref'}</label>
            <input id="roi-assumption-evidence" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-evidence" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-assumption-source">{isPolish ? 'Źródło' : 'Source'}</label>
            <input id="roi-assumption-source" value={source} onChange={(e) => setSource(e.target.value)} className={FIELD_CLASS} data-testid="roi-assumption-source" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-assumption-notes">{isPolish ? 'Notatki' : 'Notes'}</label>
          <textarea id="roi-assumption-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-assumption-notes" />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-assumption-reason">{isPolish ? 'Notatka do audytu (opcjonalnie)' : 'Audit note (optional)'}</label>
          <textarea id="roi-assumption-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-assumption-reason" />
        </div>

        {errorMessage ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text" data-testid="roi-assumption-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>{isConflict ? (isPolish ? `Konflikt zapisu: ${errorMessage}` : `Write conflict: ${errorMessage}`) : errorMessage}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default RoiAssumptionFormModal;
