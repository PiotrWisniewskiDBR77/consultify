/**
 * OkrProgramsPage — RN-G3 lane `okr` (2026-08-11), the Program admin
 * surface (`/results/okr/programs`), OWN top-level route per the task
 * brief's "Program i Cykl to OSOBNE zarządzane powierzchnie" decision — NOT
 * a tab of `OkrSetWorkspace`. Draft/publish only (create -> edit draft ->
 * publish) — see `okrAdminApi.ts`'s header for why suspend/retire are not
 * built (no server route exists for either).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Blocks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { TableColumn, TableRow } from '@/components/standard';
import { EmptyState } from '@/components/shared/states';
import { Modal, StatusChip } from '@/components/ui/primitives';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import { isResultsVNextFlagEnabled } from '../resultsVNextFeatureFlags';
import { toUserFacingErrorMessage } from '../shared/errorMessage';
import {
  createOkrProgram,
  editOkrProgramDraft,
  listOkrPrograms,
  newOkrAdminIdempotencyKey,
  OKR_CHECKIN_FREQUENCIES,
  OKR_CONFIDENCE_MODELS,
  OKR_CYCLE_MODELS,
  OKR_OBJECTIVE_CONFIDENCE_MODELS,
  OKR_OBJECTIVE_ROLLUP_MODELS,
  OKR_SCORING_MODELS,
  OKR_VISIBILITY_DEFAULTS,
  OkrAdminApiError,
  publishOkrProgram,
  type OkrCheckinFrequency,
  type OkrConfidenceModel,
  type OkrCycleModel,
  type OkrObjectiveConfidenceModel,
  type OkrObjectiveRollupModel,
  type OkrProgramDto,
  type OkrProgramPolicyFields,
  type OkrScoringModel,
  type OkrVisibilityDefault,
} from './okrAdminApi';

// #211 (rewizja 2026-09-02) — słownik etykiet warstwy prezentacji dla
// technicznych wartości polityki programu (`quarterly`, `zero_to_one`,
// `equal_average`, `OPEN_ORG`, ...). Wartość techniczna zostaje w danych
// (DTO, <option value>); to tłumaczy WYŁĄCZNIE to, co widzi użytkownik.
// Jedno miejsce, użyte w tabeli, panelu podglądu i formularzu — żadna z
// tych trzech renderek nie tłumaczy osobno.
function okrLabel<T extends string>(dict: Record<T, { pl: string; en: string }>, value: T, isPolish: boolean): string {
  return isPolish ? dict[value].pl : dict[value].en;
}

const OKR_CYCLE_MODEL_LABEL: Record<OkrCycleModel, { pl: string; en: string }> = {
  quarterly: { pl: 'Kwartalny', en: 'Quarterly' },
  trimester: { pl: 'Trymestralny', en: 'Trimester' },
  half_year: { pl: 'Półroczny', en: 'Half-year' },
  annual: { pl: 'Roczny', en: 'Annual' },
  custom: { pl: 'Niestandardowy', en: 'Custom' },
};
const OKR_CHECKIN_FREQUENCY_LABEL: Record<OkrCheckinFrequency, { pl: string; en: string }> = {
  weekly: { pl: 'Co tydzień', en: 'Weekly' },
  biweekly: { pl: 'Co dwa tygodnie', en: 'Biweekly' },
  monthly: { pl: 'Co miesiąc', en: 'Monthly' },
  custom: { pl: 'Niestandardowa', en: 'Custom' },
};
const OKR_SCORING_MODEL_LABEL: Record<OkrScoringModel, { pl: string; en: string }> = {
  zero_to_one: { pl: 'Skala 0–1', en: 'Zero to one' },
  percentage: { pl: 'Procentowy', en: 'Percentage' },
  categories: { pl: 'Kategorie', en: 'Categories' },
  custom: { pl: 'Niestandardowy', en: 'Custom' },
};
const OKR_OBJECTIVE_ROLLUP_MODEL_LABEL: Record<OkrObjectiveRollupModel, { pl: string; en: string }> = {
  equal_average: { pl: 'Średnia równa', en: 'Equal average' },
  weighted_average: { pl: 'Średnia ważona', en: 'Weighted average' },
  manual: { pl: 'Ręczny', en: 'Manual' },
  none: { pl: 'Brak', en: 'None' },
};
const OKR_CONFIDENCE_MODEL_LABEL: Record<OkrConfidenceModel, { pl: string; en: string }> = {
  high_medium_low: { pl: 'Wysoka / średnia / niska', en: 'High / medium / low' },
  numeric: { pl: 'Liczbowy', en: 'Numeric' },
  custom: { pl: 'Niestandardowy', en: 'Custom' },
};
const OKR_OBJECTIVE_CONFIDENCE_MODEL_LABEL: Record<OkrObjectiveConfidenceModel, { pl: string; en: string }> = {
  lowest_kr: { pl: 'Najniższy KR', en: 'Lowest KR' },
  owner_selected: { pl: 'Wybór właściciela', en: 'Owner selected' },
  custom: { pl: 'Niestandardowy', en: 'Custom' },
};
const OKR_VISIBILITY_DEFAULT_LABEL: Record<OkrVisibilityDefault, { pl: string; en: string }> = {
  OPEN_ORG: { pl: 'Cała organizacja', en: 'Open org' },
  SCOPE: { pl: 'Zakres', en: 'Scope' },
  MANAGEMENT_CHAIN: { pl: 'Łańcuch zarządzania', en: 'Management chain' },
  PRIVATE: { pl: 'Prywatna', en: 'Private' },
  RESTRICTED_ACL: { pl: 'Ograniczona (ACL)', en: 'Restricted (ACL)' },
};

const PROGRAM_STATUS_TONE: Record<OkrProgramDto['status'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  active: 'success',
  suspended: 'warning',
  retired: 'danger',
};
const PROGRAM_STATUS_LABEL: Record<OkrProgramDto['status'], { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  active: { pl: 'Aktywny', en: 'Active' },
  suspended: { pl: 'Zawieszony', en: 'Suspended' },
  retired: { pl: 'Wycofany', en: 'Retired' },
};

function withId(row: OkrProgramDto): OkrProgramDto & { id: string } {
  return { ...row, id: row.programId };
}

const DEFAULT_POLICY: OkrProgramPolicyFields = {
  cycleModel: 'quarterly',
  annualDirectionEnabled: false,
  objectiveMinRecommended: 1,
  objectiveMaxRecommended: 3,
  krMinRequired: 2,
  krMaxRecommended: null,
  checkinFrequency: 'weekly',
  approvalRequired: true,
  scoringModel: 'zero_to_one',
  objectiveRollupModel: 'equal_average',
  confidenceEnabled: true,
  confidenceModel: 'high_medium_low',
  objectiveConfidenceModel: 'lowest_kr',
  visibilityDefault: 'OPEN_ORG',
  committedVsAspirationalEnabled: false,
  managerReviewRequired: true,
  selfReviewRequired: true,
  reflectionRequiredForClose: false,
  recognitionEnabled: true,
};

const OkrProgramsPageContent: React.FC<{ isPolish: boolean }> = ({ isPolish }) => {
  const [programs, setPrograms] = useState<OkrProgramDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formName, setFormName] = useState('');
  const [formPolicy, setFormPolicy] = useState<OkrProgramPolicyFields>(DEFAULT_POLICY);
  const [formTarget, setFormTarget] = useState<OkrProgramDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOkrPrograms()
      .then((rows) => setPrograms(rows))
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = (programs ?? []).find((p) => p.programId === selectedId) ?? null;
  const rows: TableRow[] = (programs ?? []).map(withId);

  const openCreate = () => {
    setFormMode('create');
    setFormName('');
    setFormPolicy(DEFAULT_POLICY);
    setFormTarget(null);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (p: OkrProgramDto) => {
    setFormMode('edit');
    setFormName(p.name);
    setFormPolicy(p);
    setFormTarget(p);
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = () => {
    setBusy(true);
    setFormError(null);
    const idempotencyKey = newOkrAdminIdempotencyKey();
    const req =
      formMode === 'create'
        ? createOkrProgram({ name: formName.trim(), ...formPolicy, idempotencyKey })
        : formTarget
          ? editOkrProgramDraft(formTarget.programId, { expectedVersion: formTarget.rowVersion, name: formName.trim(), ...formPolicy, idempotencyKey })
          : Promise.reject(new Error('missing target'));
    req
      .then(() => {
        setFormOpen(false);
        load();
      })
      .catch((err) => setFormError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setBusy(false));
  };

  const publish = (p: OkrProgramDto) => {
    setError(null);
    publishOkrProgram(p.programId, { expectedVersion: p.rowVersion, idempotencyKey: newOkrAdminIdempotencyKey() })
      .then(() => load())
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)));
  };

  const columns: TableColumn[] = [
    { id: 'name', label: isPolish ? 'Nazwa' : 'Name', width: '260px', sortable: true, render: (r: OkrProgramDto) => <span className="text-sm font-medium text-c-text">{r.name}</span> },
    {
      id: 'status',
      label: 'Status',
      width: '150px',
      filterable: true,
      filterOptions: (['draft', 'active', 'suspended', 'retired'] as const).map((s) => ({ value: s, label: isPolish ? PROGRAM_STATUS_LABEL[s].pl : PROGRAM_STATUS_LABEL[s].en })),
      render: (r: OkrProgramDto) => <StatusChip label={isPolish ? PROGRAM_STATUS_LABEL[r.status].pl : PROGRAM_STATUS_LABEL[r.status].en} tone={PROGRAM_STATUS_TONE[r.status]} />,
    },
    { id: 'cycleModel', label: isPolish ? 'Model cyklu' : 'Cycle model', width: '140px', render: (r: OkrProgramDto) => <span className="text-sm text-c-text-secondary">{okrLabel(OKR_CYCLE_MODEL_LABEL, r.cycleModel, isPolish)}</span> },
    { id: 'scoringModel', label: isPolish ? 'Model oceny' : 'Scoring model', width: '150px', render: (r: OkrProgramDto) => <span className="text-sm text-c-text-secondary">{okrLabel(OKR_SCORING_MODEL_LABEL, r.scoringModel, isPolish)}</span> },
    { id: 'krMinRequired', label: isPolish ? 'Min. KR' : 'Min KR', width: '90px', align: 'right', render: (r: OkrProgramDto) => <span className="tabular-nums text-sm text-c-text">{r.krMinRequired}</span> },
  ];

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs: [{ label: isPolish ? 'Wyniki' : 'Results' }, { label: isPolish ? 'OKR' : 'OKR' }, { label: isPolish ? 'Programy' : 'Programs' }],
          breadcrumbCta: { label: isPolish ? 'Nowy program' : 'New program', onClick: openCreate, testId: 'okr-program-create-cta' },
        }}
        table={{
          columns,
          data: rows,
          persistKey: 'results-vnext.okr-programs',
          loading,
          error,
          onRetry: load,
          selectedRowId: selectedId,
          onRowClick: (row) => setSelectedId(String(row.programId)),
          empty:
            !loading && !error && rows.length === 0
              ? { title: isPolish ? 'Brak programów OKR' : 'No OKR programs', description: isPolish ? 'Utwórz pierwszy program OKR.' : 'Create the first OKR program.', actionLabel: isPolish ? 'Nowy program' : 'New program', onAction: openCreate }
              : undefined,
          rowMenu: (row) => {
            const p = row as unknown as OkrProgramDto;
            return {
              primary: [{ id: 'open', label: isPolish ? 'Otwórz' : 'Open', onClick: () => setSelectedId(p.programId) }],
              universalHandlers: {
                preview: () => setSelectedId(p.programId),
                edit: p.status === 'draft' ? () => openEdit(p) : undefined,
                editNote: p.status !== 'draft' ? (isPolish ? 'Tylko szkic można edytować.' : 'Only a draft may be edited.') : undefined,
              },
              statusTransitions:
                p.status === 'draft'
                  ? [{ id: 'publish', label: isPolish ? 'Publikuj' : 'Publish', onClick: () => publish(p) }]
                  : [{ id: 'publish', label: isPolish ? 'Publikuj' : 'Publish', disabled: true, note: isPolish ? 'Program nie jest szkicem.' : 'Program is not a draft.' }],
            };
          },
        }}
        preview={
          selected
            ? {
                title: selected.name,
                onClose: () => setSelectedId(null),
                meta: { pills: [{ label: isPolish ? PROGRAM_STATUS_LABEL[selected.status].pl : PROGRAM_STATUS_LABEL[selected.status].en, tone: PROGRAM_STATUS_TONE[selected.status] }] },
                details: {
                  propertyLabel: isPolish ? 'Właściwość' : 'Property',
                  valueLabel: isPolish ? 'Wartość' : 'Value',
                  properties: [
                    { id: 'cycleModel', label: isPolish ? 'Model cyklu' : 'Cycle model', value: okrLabel(OKR_CYCLE_MODEL_LABEL, selected.cycleModel, isPolish) },
                    { id: 'checkinFrequency', label: isPolish ? 'Częstość check-in' : 'Check-in frequency', value: okrLabel(OKR_CHECKIN_FREQUENCY_LABEL, selected.checkinFrequency, isPolish) },
                    { id: 'krMinRequired', label: isPolish ? 'Min. Kluczowych Rezultatów' : 'Min Key Results', value: selected.krMinRequired },
                    { id: 'scoringModel', label: isPolish ? 'Model oceny' : 'Scoring model', value: okrLabel(OKR_SCORING_MODEL_LABEL, selected.scoringModel, isPolish) },
                    { id: 'objectiveRollupModel', label: isPolish ? 'Model agregacji celu' : 'Objective rollup model', value: okrLabel(OKR_OBJECTIVE_ROLLUP_MODEL_LABEL, selected.objectiveRollupModel, isPolish) },
                    { id: 'confidenceModel', label: isPolish ? 'Model pewności' : 'Confidence model', value: okrLabel(OKR_CONFIDENCE_MODEL_LABEL, selected.confidenceModel, isPolish) },
                    { id: 'visibilityDefault', label: isPolish ? 'Domyślna widoczność' : 'Default visibility', value: okrLabel(OKR_VISIBILITY_DEFAULT_LABEL, selected.visibilityDefault, isPolish) },
                    { id: 'approvalRequired', label: isPolish ? 'Wymaga akceptacji' : 'Approval required', value: selected.approvalRequired ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
                    { id: 'managerReviewRequired', label: isPolish ? 'Wymaga oceny managera' : 'Manager review required', value: selected.managerReviewRequired ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
                    { id: 'selfReviewRequired', label: isPolish ? 'Wymaga samooceny' : 'Self-review required', value: selected.selfReviewRequired ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
                    { id: 'reflectionRequiredForClose', label: isPolish ? 'Refleksja wymagana do zamknięcia' : 'Reflection required to close', value: selected.reflectionRequiredForClose ? (isPolish ? 'Tak' : 'Yes') : (isPolish ? 'Nie' : 'No') },
                    { id: 'activePolicyVersionId', label: isPolish ? 'Wersja polityki' : 'Policy version', value: selected.activePolicyVersionId ?? '—' },
                  ],
                },
                relations: [],
                /*
                 * 2026-09-05 (runda 3 odbioru, `results-vnext-okr-admin`, uwaga
                 * właściciela): panel podglądu programu kończył się na sekcji
                 * „Powiązania" — BEZ paska akcji na dole — bo `actions` było
                 * `undefined` dla każdego programu, który nie jest szkicem (a
                 * jedyny realny program na stagingu jest opublikowany). Panel
                 * Kart wyników KPI obok ma pasek, więc różnica była widoczna
                 * gołym okiem. Teraz pasek jest ZAWSZE, a w nim wyłącznie
                 * akcje, które ten ekran potrafi wykonać:
                 *   · Publikuj (`publishOkrProgram`) — tylko dla szkicu,
                 *   · Edytuj szkic (`editOkrProgramDraft`) — tylko dla szkicu,
                 *   · Cykle OKR — nawigacja do istniejącej powierzchni cykli,
                 *   · Kopiuj identyfikator — do schowka.
                 * Zawieś/Wycofaj świadomie POMINIĘTE: `okrAdminApi.ts` mówi
                 * wprost, że serwer nie ma dla nich trasy (patrz nagłówek
                 * tego pliku) — martwy przycisk byłby gorszy niż jego brak.
                 */
                actions: {
                  resolutions:
                    selected.status === 'draft'
                      ? [{ id: 'publish', variant: 'positive', label: isPolish ? 'Publikuj' : 'Publish', onClick: () => publish(selected) }]
                      : undefined,
                  informational: [
                    ...(selected.status === 'draft'
                      ? [{ id: 'edit-draft', variant: 'neutral' as const, label: isPolish ? 'Edytuj szkic' : 'Edit draft', onClick: () => openEdit(selected) }]
                      : []),
                    { id: 'cycles', variant: 'neutral' as const, label: isPolish ? 'Cykle OKR' : 'OKR cycles', onClick: () => navigate('/results/okr/cycles') },
                    {
                      id: 'copy-id',
                      variant: 'neutral' as const,
                      label: isPolish ? 'Kopiuj identyfikator' : 'Copy identifier',
                      onClick: () => void navigator.clipboard?.writeText(selected.programId),
                    },
                  ],
                },
              }
            : null
        }
      />

      <Modal
        open={formOpen}
        onClose={busy ? () => {} : () => setFormOpen(false)}
        title={formMode === 'create' ? (isPolish ? 'Nowy program OKR' : 'New OKR program') : isPolish ? 'Edytuj szkic programu' : 'Edit program draft'}
        size="lg"
        preventOverlayClose={busy}
        preventEscapeClose={busy}
        footer={
          <>
            <button type="button" onClick={() => setFormOpen(false)} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
              {isPolish ? 'Wstecz' : 'Back'}
            </button>
            <button
              type="button"
              disabled={busy || !formName.trim()}
              onClick={submitForm}
              data-testid="okr-program-form-submit"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-c-border-strong bg-c-text px-4 text-sm font-medium text-c-surface hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : isPolish ? 'Zapisz' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5" htmlFor="okr-program-name">
              {isPolish ? 'Nazwa' : 'Name'}
            </label>
            <input
              id="okr-program-name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              data-testid="okr-program-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['cycleModel', isPolish ? 'Model cyklu' : 'Cycle model', OKR_CYCLE_MODELS, OKR_CYCLE_MODEL_LABEL],
                ['checkinFrequency', isPolish ? 'Częstość check-in' : 'Check-in frequency', OKR_CHECKIN_FREQUENCIES, OKR_CHECKIN_FREQUENCY_LABEL],
                ['scoringModel', isPolish ? 'Model oceny' : 'Scoring model', OKR_SCORING_MODELS, OKR_SCORING_MODEL_LABEL],
                ['objectiveRollupModel', isPolish ? 'Model agregacji celu' : 'Objective rollup model', OKR_OBJECTIVE_ROLLUP_MODELS, OKR_OBJECTIVE_ROLLUP_MODEL_LABEL],
                ['confidenceModel', isPolish ? 'Model pewności' : 'Confidence model', OKR_CONFIDENCE_MODELS, OKR_CONFIDENCE_MODEL_LABEL],
                ['objectiveConfidenceModel', isPolish ? 'Model pewności celu' : 'Objective confidence model', OKR_OBJECTIVE_CONFIDENCE_MODELS, OKR_OBJECTIVE_CONFIDENCE_MODEL_LABEL],
                ['visibilityDefault', isPolish ? 'Domyślna widoczność' : 'Default visibility', OKR_VISIBILITY_DEFAULTS, OKR_VISIBILITY_DEFAULT_LABEL],
              ] as const
            ).map(([field, label, options, labelDict]) => (
              <div key={field}>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">{label}</label>
                <select
                  value={formPolicy[field] as string}
                  onChange={(e) => setFormPolicy((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="w-full h-8 rounded-lg border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  {options.map((o) => (
                    <option key={o} value={o}>
                      {okrLabel(labelDict as Record<string, { pl: string; en: string }>, o, isPolish)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-c-text-muted mb-1">{isPolish ? 'Min. Kluczowych Rezultatów' : 'Min Key Results'}</label>
              <input
                type="number"
                min={0}
                value={formPolicy.krMinRequired}
                onChange={(e) => setFormPolicy((prev) => ({ ...prev, krMinRequired: Number(e.target.value) }))}
                className="w-full h-8 rounded-lg border border-c-border bg-c-surface px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['approvalRequired', isPolish ? 'Wymaga akceptacji' : 'Approval required'],
                ['confidenceEnabled', isPolish ? 'Pewność włączona' : 'Confidence enabled'],
                ['annualDirectionEnabled', isPolish ? 'Kierunek roczny włączony' : 'Annual direction enabled'],
                ['committedVsAspirationalEnabled', isPolish ? 'Rozróżnienie committed/aspirational' : 'Committed vs aspirational'],
                ['managerReviewRequired', isPolish ? 'Wymaga oceny managera' : 'Manager review required'],
                ['selfReviewRequired', isPolish ? 'Wymaga samooceny' : 'Self-review required'],
                ['reflectionRequiredForClose', isPolish ? 'Refleksja wymagana do zamknięcia' : 'Reflection required to close'],
                ['recognitionEnabled', isPolish ? 'Uznania włączone' : 'Recognition enabled'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-xs text-c-text">
                <input
                  type="checkbox"
                  checked={formPolicy[field] as boolean}
                  onChange={(e) => setFormPolicy((prev) => ({ ...prev, [field]: e.target.checked }))}
                  className="h-4 w-4 rounded border-c-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                />
                {label}
              </label>
            ))}
          </div>
          {formError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
              <span>{formError}</span>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
};

export const OkrProgramsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isPolish = !!i18n.language?.startsWith('pl');
  const enabled = isResultsVNextFlagEnabled('okrRegistry');

  if (!enabled) {
    return (
      <div className="h-full flex items-center justify-center p-6" data-testid="results-vnext-okr-programs-disabled">
        <EmptyState
          variant="new"
          icon={Blocks}
          title={isPolish ? 'Programy OKR — jeszcze nie włączone' : 'OKR Programs — not yet enabled'}
          description={isPolish ? 'Ta powierzchnia jest w budowie. Wróć później albo poproś administratora o dostęp za flagą.' : 'This surface is still being built. Check back later, or ask an administrator for flag access.'}
          compact
        />
      </div>
    );
  }

  return <OkrProgramsPageContent isPolish={isPolish} />;
};

export default OkrProgramsPage;

export { OkrAdminApiError };
