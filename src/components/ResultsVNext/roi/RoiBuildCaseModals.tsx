/**
 * ROI Case FULL TOOL — Build Case phase write modals: Scenario create/edit
 * (`AddScenarioSchema`/`UpdateScenarioSchema`), Scenario override create
 * (`SetScenarioOverrideSchema`), Calculation run trigger
 * (`CreateRoiCalculationRunSchema`), KPI evidence link add
 * (`AddBenefitEvidenceLinkSchema`). One file, four small components — same
 * "group modals by phase, not one file per endpoint" compression the task
 * brief's file-count budget requires; each component is still a PURE,
 * independently-testable presentational form, same convention as
 * `RoiAssumptionFormModal.tsx`.
 *
 * `kpiId`/`pinnedKpiDefinitionVersionId` are free-text UUID fields, not a
 * picker — `kpiApi.ts`/KPI search endpoints are outside this package's
 * allowlist (KPI domain is a different track), so there is no sanctioned
 * way to look up a KPI from here. Honest simplification, not an omission.
 */
import { AlertTriangle, Link2, Play, Plus, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

import {
  ROI_EVIDENCE_LINK_PURPOSES,
  ROI_SCENARIO_TYPES,
  type AddRoiBenefitEvidenceLinkInput,
  type AddRoiScenarioInput,
  type CreateRoiCalculationRunInput,
  type RoiEvidenceLinkPurpose,
  type RoiScenario,
  type RoiScenarioType,
  type SetRoiScenarioOverrideInput,
} from './roiCaseFullToolApi';
import { roiEvidenceLinkPurposeLabel, roiScenarioTypeLabel } from './roiCaseFullToolMappers';

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
// Scenario form (create/edit)
// ==========================================================================

export interface RoiScenarioFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  scenario?: RoiScenario | null;
  onClose: () => void;
  onSubmit: (values: AddRoiScenarioInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const RoiScenarioFormModal: React.FC<RoiScenarioFormModalProps> = ({
  open, mode, scenario = null, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [scenarioType, setScenarioType] = useState<RoiScenarioType>('custom');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = mode === 'edit' ? scenario : null;
    setScenarioType(s?.scenarioType ?? 'custom');
    setLabel(s?.label ?? '');
    setDescription(s?.description ?? '');
    setTouched(false);
  }, [open, mode, scenario]);

  const labelError = touched && !label.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!label.trim()) return;
    onSubmit({ scenarioType, label: label.trim(), description: description.trim() || null, reason: null });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={mode === 'create' ? (isPolish ? 'Nowy scenariusz' : 'New scenario') : (isPolish ? 'Edytuj scenariusz' : 'Edit scenario')}
      size="md"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
          <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-scenario-form-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
            {mode === 'create' ? <Plus size={16} /> : <Save size={16} />}
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : mode === 'create' ? (isPolish ? 'Dodaj scenariusz' : 'Add scenario') : (isPolish ? 'Zapisz' : 'Save')}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-scenario-type">{isPolish ? 'Typ scenariusza' : 'Scenario type'}</label>
          <select id="roi-scenario-type" value={scenarioType} disabled={mode === 'edit'} onChange={(e) => setScenarioType(e.target.value as RoiScenarioType)} className={FIELD_CLASS} data-testid="roi-scenario-type">
            {ROI_SCENARIO_TYPES.map((t) => (<option key={t} value={t}>{roiScenarioTypeLabel(t, isPolish)}</option>))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-scenario-label">{isPolish ? 'Nazwa' : 'Label'}</label>
          <input id="roi-scenario-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={FIELD_CLASS} data-testid="roi-scenario-label" aria-invalid={labelError || undefined} />
          {labelError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Nazwa jest wymagana' : 'Label is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-scenario-description">{isPolish ? 'Opis' : 'Description'}</label>
          <textarea id="roi-scenario-description" value={description} onChange={(e) => setDescription(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-scenario-description" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-scenario-form-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Scenario override form (create)
// ==========================================================================

export interface RoiScenarioOverrideFormModalProps {
  open: boolean;
  scenarioLabel: string;
  /** Loaded case line-item options — targetId picker sources from what the
   * workspace already has in memory (assumptions/cost/benefit lines), not a
   * new fetch. */
  targetOptions: { targetType: 'assumption' | 'cost_line' | 'benefit_line'; targetId: string; label: string }[];
  onClose: () => void;
  onSubmit: (values: Omit<SetRoiScenarioOverrideInput, 'expectedVersion'>) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const RoiScenarioOverrideFormModal: React.FC<RoiScenarioOverrideFormModalProps> = ({
  open, scenarioLabel, targetOptions, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [targetId, setTargetId] = useState('');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetId(targetOptions[0]?.targetId ?? '');
    setOverrideValue('');
    setOverrideAmount('');
    setNote('');
    setTouched(false);
  }, [open, targetOptions]);

  const targetError = touched && !targetId;
  const selected = targetOptions.find((o) => o.targetId === targetId);

  const handleSubmit = () => {
    setTouched(true);
    if (!targetId || !selected) return;
    onSubmit({
      targetType: selected.targetType,
      targetId,
      overrideValue: overrideValue.trim() === '' ? null : Number(overrideValue),
      overrideAmount: overrideAmount.trim() === '' ? null : Number(overrideAmount),
      note: note.trim() || null,
      reason: null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowe nadpisanie' : 'New override'}
      description={isPolish ? `Scenariusz: ${scenarioLabel}` : `Scenario: ${scenarioLabel}`}
      size="md"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
          <button type="button" onClick={handleSubmit} disabled={busy || targetOptions.length === 0} data-testid="roi-scenario-override-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Plus size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Dodaj nadpisanie' : 'Add override')}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {targetOptions.length === 0 ? (
          <p className="text-sm text-c-text-muted">{isPolish ? 'Brak założeń/kosztów/korzyści do nadpisania w tej sprawie.' : 'No assumptions/cost/benefit lines to override in this case.'}</p>
        ) : (
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-override-target">{isPolish ? 'Pozycja do nadpisania' : 'Target line item'}</label>
            <select id="roi-override-target" value={targetId} onChange={(e) => setTargetId(e.target.value)} className={FIELD_CLASS} data-testid="roi-override-target" aria-invalid={targetError || undefined}>
              {targetOptions.map((o) => (<option key={`${o.targetType}:${o.targetId}`} value={o.targetId}>{o.label}</option>))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-override-value">{isPolish ? 'Nadpisana wartość' : 'Override value'}</label>
            <input id="roi-override-value" type="number" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} className={FIELD_CLASS} data-testid="roi-override-value" />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-override-amount">{isPolish ? 'Nadpisana kwota' : 'Override amount'}</label>
            <input id="roi-override-amount" type="number" value={overrideAmount} onChange={(e) => setOverrideAmount(e.target.value)} className={FIELD_CLASS} data-testid="roi-override-amount" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-override-note">{isPolish ? 'Notatka' : 'Note'}</label>
          <textarea id="roi-override-note" value={note} onChange={(e) => setNote(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-override-note" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-scenario-override-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// Calculation run trigger
// ==========================================================================

export interface RoiCalculationRunTriggerModalProps {
  open: boolean;
  scenarios: RoiScenario[];
  onClose: () => void;
  onSubmit: (values: CreateRoiCalculationRunInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const RoiCalculationRunTriggerModal: React.FC<RoiCalculationRunTriggerModalProps> = ({
  open, scenarios, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [scenarioId, setScenarioId] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setScenarioId('');
    setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowy przebieg kalkulacji' : 'New calculation run'}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
          <button type="button" onClick={() => onSubmit({ scenarioId: scenarioId || null, reason: reason.trim() || null })} disabled={busy} data-testid="roi-calc-run-trigger-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Play size={16} />
            <span>{busy ? (isPolish ? 'Uruchamianie…' : 'Running…') : (isPolish ? 'Uruchom kalkulację' : 'Run calculation')}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-calc-run-scenario">{isPolish ? 'Scenariusz (opcjonalnie — puste = bazowy)' : 'Scenario (optional — blank = baseline)'}</label>
          <select id="roi-calc-run-scenario" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={FIELD_CLASS} data-testid="roi-calc-run-scenario">
            <option value="">{isPolish ? 'Bazowy (bez scenariusza)' : 'Baseline (no scenario)'}</option>
            {scenarios.map((s) => (<option key={s.scenarioId} value={s.scenarioId}>{s.label}</option>))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-calc-run-reason">{isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}</label>
          <textarea id="roi-calc-run-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-calc-run-reason" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-calc-run-trigger-error" />
      </div>
    </Modal>
  );
};

// ==========================================================================
// KPI evidence link (add)
// ==========================================================================

export interface RoiKpiEvidenceLinkFormModalProps {
  open: boolean;
  benefitLineLabel: string;
  onClose: () => void;
  onSubmit: (values: AddRoiBenefitEvidenceLinkInput) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RoiKpiEvidenceLinkFormModal: React.FC<RoiKpiEvidenceLinkFormModalProps> = ({
  open, benefitLineLabel, onClose, onSubmit, isPolish, busy = false, errorMessage = null, isConflict = false,
}) => {
  const [kpiId, setKpiId] = useState('');
  const [pinnedVersionId, setPinnedVersionId] = useState('');
  const [expectedUnit, setExpectedUnit] = useState('');
  const [purpose, setPurpose] = useState<RoiEvidenceLinkPurpose>('primary_evidence');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKpiId('');
    setPinnedVersionId('');
    setExpectedUnit('');
    setPurpose('primary_evidence');
    setNotes('');
    setTouched(false);
  }, [open]);

  const kpiIdError = touched && !UUID_RE.test(kpiId.trim());
  const versionError = touched && !UUID_RE.test(pinnedVersionId.trim());

  const handleSubmit = () => {
    setTouched(true);
    if (!UUID_RE.test(kpiId.trim()) || !UUID_RE.test(pinnedVersionId.trim())) return;
    onSubmit({
      kpiId: kpiId.trim(),
      pinnedKpiDefinitionVersionId: pinnedVersionId.trim(),
      expectedUnit: expectedUnit.trim() || null,
      purpose,
      notes: notes.trim() || null,
      reason: null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Nowy dowód KPI' : 'New KPI evidence link'}
      description={isPolish ? `Pozycja korzyści: ${benefitLineLabel}` : `Benefit line: ${benefitLineLabel}`}
      size="md"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>{isPolish ? 'Anuluj' : 'Cancel'}</button>
          <button type="button" onClick={handleSubmit} disabled={busy} data-testid="roi-kpi-evidence-link-submit" className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>
            <Link2 size={16} />
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : (isPolish ? 'Powiąż KPI' : 'Link KPI')}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[12px] text-c-text-muted">
          {isPolish
            ? 'Brak wyszukiwarki KPI w tym pakiecie (domena KPI to osobny tor) — wpisz identyfikatory ręcznie.'
            : 'No KPI picker in this package (KPI domain is a separate track) — enter identifiers manually.'}
        </p>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-evidence-kpi-id">{isPolish ? 'ID KPI (UUID)' : 'KPI ID (UUID)'}</label>
          <input id="roi-evidence-kpi-id" autoFocus value={kpiId} onChange={(e) => setKpiId(e.target.value)} className={FIELD_CLASS} data-testid="roi-evidence-kpi-id" aria-invalid={kpiIdError || undefined} />
          {kpiIdError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagany prawidłowy UUID' : 'A valid UUID is required'}</p> : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-evidence-version-id">{isPolish ? 'ID przypiętej wersji definicji KPI (UUID)' : 'Pinned KPI definition version ID (UUID)'}</label>
          <input id="roi-evidence-version-id" value={pinnedVersionId} onChange={(e) => setPinnedVersionId(e.target.value)} className={FIELD_CLASS} data-testid="roi-evidence-version-id" aria-invalid={versionError || undefined} />
          {versionError ? <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'Wymagany prawidłowy UUID' : 'A valid UUID is required'}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-evidence-purpose">{isPolish ? 'Cel' : 'Purpose'}</label>
            <select id="roi-evidence-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as RoiEvidenceLinkPurpose)} className={FIELD_CLASS} data-testid="roi-evidence-purpose">
              {ROI_EVIDENCE_LINK_PURPOSES.map((p) => (<option key={p} value={p}>{roiEvidenceLinkPurposeLabel(p, isPolish)}</option>))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="roi-evidence-unit">{isPolish ? 'Oczekiwana jednostka' : 'Expected unit'}</label>
            <input id="roi-evidence-unit" value={expectedUnit} onChange={(e) => setExpectedUnit(e.target.value)} className={FIELD_CLASS} data-testid="roi-evidence-unit" />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="roi-evidence-notes">{isPolish ? 'Notatki' : 'Notes'}</label>
          <textarea id="roi-evidence-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={TEXTAREA_CLASS} data-testid="roi-evidence-notes" />
        </div>
        <ErrorBanner message={errorMessage} isConflict={isConflict} isPolish={isPolish} testId="roi-kpi-evidence-link-error" />
      </div>
    </Modal>
  );
};
