/**
 * RN-G2 §G #25 — visual QA harness for the OKR Objectives/Key Results/
 * Check-ins drill-down (`OkrObjectivesView`/`OkrKeyResultsView`/
 * `OkrCheckInsView` + their presenter/form/dialog files). Mounts the REAL
 * `ResultsVNextRegistryShell` fed by the REAL presenter functions, and the
 * REAL form/dialog components, with mock data — NOT the View components
 * themselves, which do live `fetch()` calls with no backend available in
 * this harness (same reason `results-vnext-okr-registry.tsx` mounts
 * presenters directly rather than `ResultsOkrHub`).
 *
 * URL params:
 *   ?level=objectives|keyResults|checkIns   which drill level (default objectives)
 *   &setStatus=draft|submitted|changes_requested|approved|active|review|closed|cancelled
 *              drives the child-edit lock (draft/changes_requested = unlocked) — default draft
 *   &krStatus=not_started|on_track|at_risk|off_track|achieved|not_achieved|cancelled
 *              only affects `checkIns` level's record-check-in lock — default on_track
 *   &state=ready|loading|empty|error       top-level StandardTable state (default ready)
 *   &selected=<id|none>                    pre-select a row (default: first row)
 *   &modal=none|create|edit|cancel|record|correct   opens the given dialog (default none)
 *   &modalState=idle|saving|error|conflict  the open dialog's write state (default idle)
 *   &suggestion=trend|no_history|loading|failed   check-in record dialog's suggestion mock
 *     (only relevant when level=checkIns&modal=record)
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ResultsVNextRegistryShell } from '../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';
import type {
  OkrKeyResultDto,
  OkrObjectiveStatus,
  OkrObjectiveWithKeyResultsDto,
} from '../../src/components/ResultsVNext/okr/okrObjectiveApi';
import { getOkrSetChildEditLock } from '../../src/components/ResultsVNext/okr/okrObjectiveMappers';
import {
  buildOkrObjectiveColumns,
  buildOkrObjectivePreview,
  buildOkrObjectiveRowMenu,
} from '../../src/components/ResultsVNext/okr/okrObjectivePresenters';
import {
  buildOkrKeyResultColumns,
  buildOkrKeyResultPreview,
  buildOkrKeyResultRowMenu,
} from '../../src/components/ResultsVNext/okr/okrKeyResultPresenters';
import {
  buildOkrCheckInColumns,
  buildOkrCheckInPreview,
  buildOkrCheckInRowMenu,
} from '../../src/components/ResultsVNext/okr/okrCheckInPresenters';
import { OkrObjectiveFormModal } from '../../src/components/ResultsVNext/okr/OkrObjectiveFormModal';
import { OkrKeyResultFormModal } from '../../src/components/ResultsVNext/okr/OkrKeyResultFormModal';
import { OkrCancelDialog } from '../../src/components/ResultsVNext/okr/OkrCancelDialog';
import { OkrCheckInRecordDialog } from '../../src/components/ResultsVNext/okr/OkrCheckInRecordDialog';
import { OkrCheckInCorrectDialog } from '../../src/components/ResultsVNext/okr/OkrCheckInCorrectDialog';
import type { OkrCheckInDto, OkrSuggestNextCheckInValue } from '../../src/components/ResultsVNext/okr/okrCheckInApi';
import type { StandardBreadcrumb, TableRow } from '../../src/components/standard';

const MOCK_SET_ID = 'okr-set-5';

function mockSet(status: OkrObjectiveStatus | string): OkrSetDto {
  return {
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'individual',
    scopeId: 'user-anna-kowalska',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: 'user-tomasz-nowak',
    title: 'Wdrożyć MES na 3 liniach produkcyjnych',
    status: status as OkrSetDto['status'],
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-06-01T09:00:00Z',
    approvedBy: 'user-tomasz-nowak',
    approvedAt: '2026-06-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-5-v1',
    overallProgress: '0.625',
    overallConfidence: 'medium',
    attentionState: 'watch',
    lastCheckinAt: '2026-08-05T09:00:00Z',
    nextCheckinDueAt: '2026-08-19T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 9,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
  };
}

// ── Mock Objectives — spans: real progress, `not_calculable` progress (KR
//    geometry degenerate, reason persisted), `null` progress from a
//    DELIBERATE `rollup_model_none` policy (never shown as `not_calculable`
//    — see `okrObjectiveMappers.ts`'s own doc comment), progress >100%
//    (legitimate overachievement, never clamped), and a cancelled Objective.
const MOCK_OBJECTIVES: OkrObjectiveWithKeyResultsDto[] = [
  {
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    title: 'Uruchomić linię MES-1 w pełnej automatyzacji',
    description: 'Wdrożenie pełnego monitoringu produkcji na linii 1.',
    rationale: 'Linia 1 generuje najwięcej przestojów nieplanowanych.',
    ambitionType: 'committed',
    status: 'active',
    progress: '0.82',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'equal_average over 2 calculable key result(s) (of 2 total)',
    confidence: 'high',
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: "lowest_kr: categorical confidence, worst of 2 key result(s) (high > medium > low, never averaged)",
    sortOrder: 0,
    rowVersion: 5,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
    approvedAt: '2026-06-05T09:00:00Z',
    keyResults: [],
  },
  {
    objectiveId: 'obj-2',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-tomasz-nowak',
    title: 'Zredukować przestoje planowane na liniach 2 i 3',
    description: null,
    rationale: null,
    ambitionType: 'standard',
    status: 'at_risk',
    progress: null,
    progressCalcPolicyVersionId: 'policy-1',
    // `not_calculable:`-prefixed — the honest 3rd state, distinct from "—".
    progressCalcReason: 'not_calculable: every key result under this objective is itself not_calculable',
    confidence: null,
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: 'not_calculable: no key result under this objective has a confidence value set yet',
    sortOrder: 1,
    rowVersion: 3,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-06-10T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-08-01T09:00:00Z',
    approvedAt: '2026-06-12T09:00:00Z',
    keyResults: [],
  },
  {
    objectiveId: 'obj-3',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    title: 'Zwiększyć przepustowość linii 3 ponad plan',
    description: null,
    rationale: null,
    ambitionType: 'aspirational',
    status: 'active',
    // >100% — legitimate overachievement, never clamped (§-IO item 2).
    progress: '1.32',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'equal_average over 1 calculable key result(s) (of 1 total)',
    confidence: 'high',
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: 'lowest_kr: categorical confidence, worst of 1 key result(s) (high > medium > low, never averaged)',
    sortOrder: 2,
    rowVersion: 7,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-15T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-06T09:00:00Z',
    approvedAt: '2026-06-16T09:00:00Z',
    keyResults: [],
  },
  {
    objectiveId: 'obj-4',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-tomasz-nowak',
    title: 'Wdrożyć raportowanie zmianowe (bez rollupu — decyzja polityki)',
    description: null,
    rationale: null,
    ambitionType: 'standard',
    status: 'draft',
    // `null` progress from a DELIBERATE policy, not a broken calculation —
    // must render as "—", never as the `not_calculable` chip.
    progress: null,
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'rollup_model_none: objective_rollup_model is "none" — Objective progress is intentionally not rolled up',
    confidence: null,
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: null,
    sortOrder: 3,
    rowVersion: 1,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-07-20T09:00:00Z',
    updatedBy: null,
    updatedAt: '2026-07-20T09:00:00Z',
    approvedAt: null,
    keyResults: [],
  },
  {
    objectiveId: 'obj-5',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    title: 'Pilotaż czujników IoT na linii 1 (anulowany)',
    description: null,
    rationale: null,
    ambitionType: 'aspirational',
    status: 'cancelled',
    progress: null,
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'not_calculable: objective has no non-cancelled key results to roll up',
    confidence: null,
    confidenceNumericValue: null,
    confidenceCalcPolicyVersionId: 'policy-1',
    confidenceCalcReason: null,
    sortOrder: 4,
    rowVersion: 4,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-20T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-07-15T09:00:00Z',
    approvedAt: null,
    keyResults: [],
  },
];

// ── Mock Key Results — under `obj-1`, spans real progress, `not_calculable`,
//    `maintain_range` (out-of-range, distance shown), >100% overachievement.
const MOCK_KEY_RESULTS: OkrKeyResultDto[] = [
  {
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    title: 'Podłączyć 12 czujników PLC do systemu MES',
    description: 'Instalacja i kalibracja czujników na stanowiskach 1-12.',
    measurementType: 'numeric',
    unit: 'czujniki',
    currency: null,
    baselineValue: '0',
    targetValue: '12',
    startValue: '0',
    currentValue: '10',
    direction: 'increase',
    rangeMin: null,
    rangeMax: null,
    progress: '0.8333333333',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'increase: (current_value - baseline_value) / (target_value - baseline_value)',
    outOfRangeDistance: null,
    confidence: 'high',
    confidenceNumericValue: null,
    status: 'on_track',
    sourceType: 'manual',
    sourceReference: null,
    weight: '1',
    rowVersion: 6,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    keyResultId: 'kr-2',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-tomasz-nowak',
    title: 'Utrzymać wskaźnik OEE linii 1 w zakresie 85-95%',
    description: null,
    measurementType: 'percentage',
    unit: '%',
    currency: null,
    baselineValue: null,
    targetValue: null,
    startValue: null,
    currentValue: '78',
    direction: 'maintain_range',
    rangeMin: '85',
    rangeMax: '95',
    progress: '0',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: '§-IO ruling: maintain_range out-of-range = 0.0 (magnitude recorded separately in outOfRangeDistance, never folded into progress)',
    outOfRangeDistance: '7',
    confidence: 'low',
    confidenceNumericValue: null,
    status: 'at_risk',
    sourceType: 'manual',
    sourceReference: null,
    weight: '1',
    rowVersion: 9,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    keyResultId: 'kr-3',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    title: 'Wdrożyć alerty przestojów w czasie rzeczywistym',
    description: null,
    measurementType: 'binary',
    unit: null,
    currency: null,
    baselineValue: null,
    targetValue: null,
    startValue: null,
    currentValue: null,
    direction: 'binary',
    rangeMin: null,
    rangeMax: null,
    progress: null,
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'not_calculable: binary geometry requires current_value',
    outOfRangeDistance: null,
    confidence: null,
    confidenceNumericValue: null,
    status: 'not_started',
    sourceType: 'manual',
    sourceReference: null,
    weight: '2',
    rowVersion: 1,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-07-01T09:00:00Z',
    updatedBy: null,
    updatedAt: '2026-07-01T09:00:00Z',
  },
  {
    keyResultId: 'kr-4',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: 'user-tomasz-nowak',
    title: 'Przeszkolić operatorów z nowego panelu MES',
    description: null,
    measurementType: 'numeric',
    unit: 'osoby',
    currency: null,
    baselineValue: '0',
    targetValue: '20',
    startValue: '0',
    currentValue: '26',
    direction: 'increase',
    rangeMin: null,
    rangeMax: null,
    // >100% — legitimate overachievement (more people trained than the target).
    progress: '1.3',
    progressCalcPolicyVersionId: 'policy-1',
    progressCalcReason: 'increase: (current_value - baseline_value) / (target_value - baseline_value)',
    outOfRangeDistance: null,
    confidence: 'high',
    confidenceNumericValue: null,
    status: 'achieved',
    sourceType: 'manual',
    sourceReference: null,
    weight: '1',
    rowVersion: 11,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-06-05T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-08-07T09:00:00Z',
  },
];

// ── Mock Check-ins — under `kr-1`, spans a correction chain and honest
//    `calculatedProgress` (real value / null — never `not_calculable`, see
//    `okrCheckInMappers.ts`'s own doc comment for why that branch is
//    unreachable at the check-in level).
const MOCK_CHECK_INS: OkrCheckInDto[] = [
  {
    checkInId: 'checkin-1',
    organizationId: 'org-1',
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    cadenceOccurrenceId: 'occ-2026-w28',
    previousValue: '8',
    newValue: '9',
    calculatedProgress: '0.75',
    ownerDeclaredStatus: 'on_track',
    systemSuggestedStatus: 'on_track',
    confidence: 'high',
    confidenceNumericValue: null,
    note: 'Podłączono czujnik nr 9, kalibracja zakończona bez problemów.',
    blocker: null,
    supportRequested: null,
    evidenceRefs: [],
    correctionOfCheckInId: null,
    correctionReason: null,
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-07-15T09:00:00Z',
  },
  {
    checkInId: 'checkin-2',
    organizationId: 'org-1',
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    cadenceOccurrenceId: 'occ-2026-w30',
    previousValue: '9',
    newValue: '10',
    calculatedProgress: '0.8333333333',
    ownerDeclaredStatus: 'on_track',
    systemSuggestedStatus: 'on_track',
    confidence: 'high',
    confidenceNumericValue: null,
    note: 'Czujnik 10 podłączony, testy w toku.',
    blocker: 'Brak dostępu do panelu sterowania w oknie serwisowym.',
    supportRequested: 'Potrzebne wsparcie automatyka na 2h.',
    evidenceRefs: [],
    correctionOfCheckInId: null,
    correctionReason: null,
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-07-29T09:00:00Z',
  },
  {
    checkInId: 'checkin-3',
    organizationId: 'org-1',
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    cadenceOccurrenceId: 'occ-2026-w26',
    previousValue: '7',
    newValue: '8',
    // Honest `null` — no reason column exists on this row (see mapper doc).
    calculatedProgress: null,
    ownerDeclaredStatus: 'on_track',
    systemSuggestedStatus: null,
    confidence: 'medium',
    confidenceNumericValue: null,
    note: 'Wpis jakościowy, dane liczbowe zweryfikowane później korektą.',
    blocker: null,
    supportRequested: null,
    evidenceRefs: [],
    correctionOfCheckInId: null,
    correctionReason: null,
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-07-01T09:00:00Z',
  },
  {
    checkInId: 'checkin-4',
    organizationId: 'org-1',
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    cadenceOccurrenceId: 'occ-2026-w26',
    previousValue: '7',
    newValue: '7',
    calculatedProgress: '0.5833333333',
    ownerDeclaredStatus: 'at_risk',
    systemSuggestedStatus: 'at_risk',
    confidence: 'low',
    confidenceNumericValue: null,
    note: 'Korekta: pierwotny wpis pomylił numerację czujników, realna wartość bez zmian.',
    blocker: null,
    supportRequested: null,
    evidenceRefs: [],
    correctionOfCheckInId: 'checkin-3',
    correctionReason: 'Pierwotny wpis pomylił numerację czujników — realna wartość to 7, nie 8.',
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-07-02T09:00:00Z',
  },
];

const SUGGESTIONS: Record<string, OkrSuggestNextCheckInValue> = {
  trend: {
    suggestedValue: 11,
    basis: 'linear_trend',
    reason: 'linear_trend: average step 1 across 2 interval(s) of 3 prior check-in(s), projected from the most recent value 10',
  },
  no_history: {
    suggestedValue: null,
    basis: 'no_history',
    reason: 'no_history: exactly one prior check-in exists — at least two are required to compute a trend, never guessed from a single point',
  },
};

const params = new URLSearchParams(window.location.search);
const initialLevel = (params.get('level') as 'objectives' | 'keyResults' | 'checkIns') || 'objectives';
const initialSetStatus = params.get('setStatus') || 'draft';
const initialKrStatus = params.get('krStatus') || 'on_track';
const state = params.get('state') || 'ready';
const initialSelected = params.get('selected');
const initialModal = (params.get('modal') as 'none' | 'create' | 'edit' | 'cancel' | 'record' | 'correct') || 'none';
const modalState = params.get('modalState') || 'idle';
const suggestionParam = params.get('suggestion') || 'trend';

const ResultsVNextOkrObjectivesScreen: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  const [level] = useState(initialLevel);
  const set = useMemo(() => mockSet(initialSetStatus), []);
  const objectives = useMemo(() => (level === 'objectives' && state === 'empty' ? [] : MOCK_OBJECTIVES), [level]);
  const keyResults = useMemo(() => (level === 'keyResults' && state === 'empty' ? [] : MOCK_KEY_RESULTS), [level]);
  const krForCheckIns = useMemo(() => ({ ...MOCK_KEY_RESULTS[0]!, status: initialKrStatus as OkrKeyResultDto['status'] }), []);
  const checkIns = useMemo(() => (level === 'checkIns' && state === 'empty' ? [] : MOCK_CHECK_INS), [level]);

  const defaultSelected =
    level === 'objectives' ? MOCK_OBJECTIVES[0]?.objectiveId : level === 'keyResults' ? MOCK_KEY_RESULTS[0]?.keyResultId : MOCK_CHECK_INS[0]?.checkInId;
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected === 'none' ? null : (initialSelected ?? defaultSelected ?? null));

  const [modal] = useState(initialModal);
  const busy = modalState === 'saving';
  const errorMessage = modalState === 'error' ? (isPolish ? 'Serwer odrzucił żądanie.' : 'The server rejected the request.') : modalState === 'conflict' ? (isPolish ? 'Wersja rekordu jest nieaktualna (409).' : 'Record version is stale (409).') : null;
  const isConflict = modalState === 'conflict';

  const breadcrumbs: StandardBreadcrumb[] =
    level === 'objectives'
      ? [{ label: isPolish ? 'Zestawy OKR' : 'OKR sets' }, { label: set.title }]
      : level === 'keyResults'
        ? [{ label: isPolish ? 'Zestawy OKR' : 'OKR sets' }, { label: set.title }, { label: MOCK_OBJECTIVES[0]!.title }]
        : [
            { label: isPolish ? 'Zestawy OKR' : 'OKR sets' },
            { label: set.title },
            { label: MOCK_OBJECTIVES[0]!.title },
            { label: MOCK_KEY_RESULTS[0]!.title },
          ];

  const childLock = getOkrSetChildEditLock(set.status);

  const noop = () => {};

  let content: React.ReactElement;

  if (level === 'objectives') {
    const rows: TableRow[] = objectives.map((o) => ({ ...o, id: o.objectiveId }));
    const selected = objectives.find((o) => o.objectiveId === selectedId) ?? null;
    content = (
      <>
        <ResultsVNextRegistryShell
          domain="okr"
          moduleBar={{
            breadcrumbs,
            breadcrumbCta: {
              label: isPolish ? 'Nowy cel' : 'New objective',
              onClick: noop,
              locked: !!childLock,
              lockedReason: childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : undefined,
            },
          }}
          table={{
            columns: buildOkrObjectiveColumns(isPolish, set.status),
            data: rows,
            persistKey: 'results-vnext.okr-objectives.mock',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać celów — usługa zwróciła 503.' : 'Failed to load objectives — the service returned 503.') : null,
            onRetry: noop,
            empty: state === 'empty' ? { title: isPolish ? 'Brak celów' : 'No objectives', description: isPolish ? 'Ten zestaw nie ma jeszcze żadnego celu.' : 'This set has no objective yet.' } : undefined,
            selectedRowId: selectedId,
            onRowClick: (row) => setSelectedId(String(row.objectiveId)),
            rowMenu: (row) => buildOkrObjectiveRowMenu(row as unknown as OkrObjectiveWithKeyResultsDto, isPolish, set.status, { onPreview: (r) => setSelectedId(r.objectiveId), onOpenKeyResults: noop, onEdit: noop, onCancel: noop }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            state === 'ready' && selected
              ? buildOkrObjectivePreview(selected, { isPolish, parentSetStatus: set.status, onClose: () => setSelectedId(null), onOpenKeyResults: noop, onEdit: noop, onCancel: noop })
              : null
          }
        />
        <OkrObjectiveFormModal
          open={modal === 'create' || modal === 'edit'}
          mode={modal === 'edit' ? 'edit' : 'create'}
          initial={modal === 'edit' ? MOCK_OBJECTIVES[0] : null}
          onClose={noop}
          onSubmit={noop}
          isPolish={isPolish}
          currentUserId="user-anna-kowalska"
          blockedReason={childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : null}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
        <OkrCancelDialog
          open={modal === 'cancel'}
          entityTitle={MOCK_OBJECTIVES[0]!.title}
          entityKind="objective"
          isPolish={isPolish}
          onClose={noop}
          onSubmit={noop}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
      </>
    );
  } else if (level === 'keyResults') {
    const rows: TableRow[] = keyResults.map((k) => ({ ...k, id: k.keyResultId }));
    const selected = keyResults.find((k) => k.keyResultId === selectedId) ?? null;
    content = (
      <>
        <ResultsVNextRegistryShell
          domain="okr"
          moduleBar={{
            breadcrumbs,
            breadcrumbCta: {
              label: isPolish ? 'Nowy Kluczowy Rezultat' : 'New Key Result',
              onClick: noop,
              locked: !!childLock,
              lockedReason: childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : undefined,
            },
          }}
          table={{
            columns: buildOkrKeyResultColumns(isPolish, set.status),
            data: rows,
            persistKey: 'results-vnext.okr-key-results.mock',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać Kluczowych Rezultatów.' : 'Failed to load Key Results.') : null,
            onRetry: noop,
            empty: state === 'empty' ? { title: isPolish ? 'Brak Kluczowych Rezultatów' : 'No Key Results', description: isPolish ? 'Ten cel nie ma jeszcze KR.' : 'This objective has no Key Result yet.' } : undefined,
            selectedRowId: selectedId,
            onRowClick: (row) => setSelectedId(String(row.keyResultId)),
            rowMenu: (row) => buildOkrKeyResultRowMenu(row as unknown as OkrKeyResultDto, isPolish, set.status, { onPreview: (r) => setSelectedId(r.keyResultId), onOpenCheckIns: noop, onEdit: noop, onCancel: noop }),
            defaultSort: { columnId: 'updatedAt', direction: 'desc' },
          }}
          preview={
            state === 'ready' && selected
              ? buildOkrKeyResultPreview(selected, { isPolish, parentSetStatus: set.status, onClose: () => setSelectedId(null), onOpenCheckIns: noop, onEdit: noop, onCancel: noop })
              : null
          }
        />
        <OkrKeyResultFormModal
          open={modal === 'create' || modal === 'edit'}
          mode={modal === 'edit' ? 'edit' : 'create'}
          initial={modal === 'edit' ? MOCK_KEY_RESULTS[1] : null}
          onClose={noop}
          onSubmit={noop}
          isPolish={isPolish}
          currentUserId="user-anna-kowalska"
          blockedReason={childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : null}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
        <OkrCancelDialog
          open={modal === 'cancel'}
          entityTitle={MOCK_KEY_RESULTS[0]!.title}
          entityKind="keyResult"
          isPolish={isPolish}
          onClose={noop}
          onSubmit={noop}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
      </>
    );
  } else {
    const rows: TableRow[] = checkIns.map((c) => ({ ...c, id: c.checkInId }));
    const selected = checkIns.find((c) => c.checkInId === selectedId) ?? null;
    const checkInLock = krForCheckIns.status === 'cancelled' ? (isPolish ? 'Kluczowy Rezultat jest anulowany — check-iny nie są przyjmowane.' : 'The Key Result is cancelled — check-ins are not accepted.') : null;
    const suggestion: OkrSuggestNextCheckInValue | null | undefined =
      suggestionParam === 'loading' ? undefined : suggestionParam === 'failed' ? null : SUGGESTIONS[suggestionParam] ?? SUGGESTIONS.trend;
    content = (
      <>
        <ResultsVNextRegistryShell
          domain="okr"
          moduleBar={{
            breadcrumbs,
            breadcrumbCta: {
              label: isPolish ? 'Nowy check-in' : 'New check-in',
              onClick: noop,
              locked: !!checkInLock,
              lockedReason: checkInLock ?? undefined,
            },
          }}
          table={{
            columns: buildOkrCheckInColumns(isPolish),
            data: rows,
            persistKey: 'results-vnext.okr-check-ins.mock',
            loading: state === 'loading',
            error: state === 'error' ? (isPolish ? 'Nie udało się wczytać check-inów.' : 'Failed to load check-ins.') : null,
            onRetry: noop,
            empty: state === 'empty' ? { title: isPolish ? 'Brak check-inów' : 'No check-ins', description: isPolish ? 'Brak zarejestrowanych check-inów.' : 'No check-in recorded yet.' } : undefined,
            selectedRowId: selectedId,
            onRowClick: (row) => setSelectedId(String(row.checkInId)),
            rowMenu: (row) => buildOkrCheckInRowMenu(row as unknown as OkrCheckInDto, isPolish, { onPreview: (r) => setSelectedId(r.checkInId), onCorrect: noop }),
            defaultSort: { columnId: 'submittedAt', direction: 'desc' },
          }}
          preview={state === 'ready' && selected ? buildOkrCheckInPreview(selected, { isPolish, onClose: () => setSelectedId(null), onCorrect: noop }) : null}
        />
        <OkrCheckInRecordDialog
          open={modal === 'record'}
          keyResultTitle={krForCheckIns.title}
          isPolish={isPolish}
          onClose={noop}
          onSubmit={noop}
          suggestion={suggestion}
          blockedReason={checkInLock}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
        <OkrCheckInCorrectDialog
          open={modal === 'correct'}
          original={MOCK_CHECK_INS[0]!}
          isPolish={isPolish}
          onClose={noop}
          onSubmit={noop}
          busy={busy}
          errorMessage={errorMessage}
          isConflict={isConflict}
        />
      </>
    );
  }

  return <div className="h-screen bg-c-bg text-c-text">{content}</div>;
};

export default ResultsVNextOkrObjectivesScreen;
