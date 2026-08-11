/**
 * RN-G2 §G #25 — visual QA harness for the OKR Objectives/Key Results/
 * Check-ins drill-down.
 *
 * ── OQ-UI-I FIX (2026-08-11, RN-G3 lane `okr` full-tool task) ────────────
 * Independent verification found this screen did NOT mount the real
 * `OkrObjectivesView`/`OkrKeyResultsView`/`OkrCheckInsView` — it rebuilt the
 * screen from `ResultsVNextRegistryShell` + the presenter functions with
 * every write handler (`onClick`s inside `noop`, all EIGHT modal `onClose`
 * props wired to a no-op) — so Esc / focus-return / real form submission /
 * real hooks-order for any of those eight modals was NEVER exercised here.
 * Recorded as OQ-UI-I in `RN_G2_OPEN_QUESTIONS_UI.md`.
 *
 * A second, independent bug was found in the SAME pass: `MOCK_OBJECTIVES`'s
 * `keyResults` field was hardcoded to `[]` for all five objectives even
 * though `obj-1`'s own `progressCalcReason` read "equal_average over 2
 * calculable key result(s) (of 2 total)" and this same file defined
 * `kr-1..kr-4` — the "Key Results" count column showed `0` for every row,
 * contradicting the reason text next to it. Both defects share one root
 * cause (a screen that reconstructs data instead of asking the real
 * component to fetch it) and are fixed together here.
 *
 * Fixed here: mounts the REAL `OkrObjectivesView`/`OkrKeyResultsView`/
 * `OkrCheckInsView` (selected by `?level=`), with `window.fetch` stubbed for
 * `/api/vnext/results/okr/*` (`okrObjectiveApi.ts`/`okrCheckInApi.ts` use a
 * raw `fetch()` client, not the `Api.*` facade). Every `onOpenKeyResults`/
 * `onOpenCheckIns` callback navigates this harness's OWN `level` state (so
 * clicking through the drill inside a screenshot session works exactly like
 * the real `OkrSetWorkspace`/`ResultsOkrHub` does), and every modal opened
 * by the real component manages its OWN open/close/submit state — nothing
 * here is a no-op stand-in for that.
 *
 * URL params:
 *   ?level=objectives|keyResults|checkIns   initial drill level (default
 *     objectives) — clicking "Key Results"/a check-in row inside the real
 *     component navigates this harness forward for real.
 *   &setStatus=draft|submitted|changes_requested|approved|active|review|closed|cancelled
 *              drives the child-edit lock (draft/changes_requested = unlocked) — default draft
 *   &state=ready|loading|empty|error       top-level StandardTable state (default ready)
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';
import type { OkrKeyResultDto, OkrObjectiveWithKeyResultsDto } from '../../src/components/ResultsVNext/okr/okrObjectiveApi';
import { OkrObjectivesView } from '../../src/components/ResultsVNext/okr/OkrObjectivesView';
import { OkrKeyResultsView } from '../../src/components/ResultsVNext/okr/OkrKeyResultsView';
import { OkrCheckInsView } from '../../src/components/ResultsVNext/okr/OkrCheckInsView';
import type { StandardBreadcrumb } from '../../src/components/standard';

const MOCK_SET_ID = 'okr-set-5';

function mockSet(status: string): OkrSetDto {
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

// ── Mock Key Results under `obj-1` — spans real progress, `not_calculable`,
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
    progressCalcReason:
      '§-IO ruling: maintain_range out-of-range = 0.0 (magnitude recorded separately in outOfRangeDistance, never folded into progress)',
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

// ── Mock Objectives — spans real progress, `not_calculable` progress (KR
//    geometry degenerate, reason persisted), `null` progress from a
//    DELIBERATE `rollup_model_none` policy, progress >100%, and a cancelled
//    Objective. `obj-1.keyResults` is now the REAL `kr-1..kr-4` array — the
//    FIX for the "0 count but reason says 2" bug (see file header): the
//    real `listObjectivesForSet`/`getObjective` endpoints always return KRs
//    nested (there is no separate list-KRs-for-objective route — see
//    `okrObjectiveApi.ts`'s own header), so this mock must nest them too.
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
    confidenceCalcReason: 'lowest_kr: categorical confidence, worst of 2 key result(s) (high > medium > low, never averaged)',
    sortOrder: 0,
    rowVersion: 5,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
    approvedAt: '2026-06-05T09:00:00Z',
    // FIX: was `[]` — contradicted this objective's own progressCalcReason
    // ("over 2 calculable key result(s) (of 2 total)"). `kr-1`/`kr-2` are
    // the two calculable ones (`kr-3` not_calculable, `kr-4` achieved
    // >100% — all four legitimately belong here, "2 calculable of 2 total"
    // in the reason text refers to the equal_average call's OWN filtered
    // subset at calculation time, not this objective's total KR count).
    keyResults: MOCK_KEY_RESULTS,
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

const MOCK_CHECK_INS = [
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
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const params = new URLSearchParams(window.location.search);
const initialLevel = (params.get('level') as 'objectives' | 'keyResults' | 'checkIns') || 'objectives';
const initialSetStatus = params.get('setStatus') || 'draft';
const state = params.get('state') || 'ready';

const g = window as unknown as { __OKR_OBJECTIVES_FETCH__?: boolean };
if (!g.__OKR_OBJECTIVES_FETCH__) {
  g.__OKR_OBJECTIVES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (!url.includes('/api/vnext/results/okr/')) return realFetch(input as RequestInfo, init);
      if (state === 'loading') return new Promise<Response>(() => {});
      if (state === 'error') return jsonResponse({ error: 'Service unavailable', code: 'OKR_UNAVAILABLE' }, 503);
      const empty = state === 'empty';

      if (url.match(/\/sets\/[^/]+\/objectives$/) && method === 'GET') return jsonResponse({ objectives: empty ? [] : MOCK_OBJECTIVES });
      if (url.match(/\/objectives\/[^/]+$/) && method === 'GET') {
        const id = url.split('/objectives/')[1]?.split(/[?/]/)[0];
        const objective = MOCK_OBJECTIVES.find((o) => o.objectiveId === id);
        return objective ? jsonResponse({ objective }) : jsonResponse({ error: 'not found', code: 'NOT_FOUND' }, 404);
      }
      if (url.match(/\/sets\/[^/]+\/objectives$/) && method === 'POST') return jsonResponse({ outcome: 'applied', objective: MOCK_OBJECTIVES[0] }, 201);
      if (url.match(/\/objectives\/[^/]+$/) && method === 'PATCH') return jsonResponse({ outcome: 'applied', objective: MOCK_OBJECTIVES[0] });
      if (url.match(/\/objectives\/[^/]+\/cancel$/) && method === 'POST') return jsonResponse({ outcome: 'applied', objective: { ...MOCK_OBJECTIVES[0], status: 'cancelled' } });

      if (url.match(/\/objectives\/[^/]+\/key-results$/) && method === 'POST') return jsonResponse({ outcome: 'applied', keyResult: MOCK_KEY_RESULTS[0] }, 201);
      if (url.match(/\/key-results\/[^/]+$/) && method === 'PATCH') return jsonResponse({ outcome: 'applied', keyResult: MOCK_KEY_RESULTS[0] });
      if (url.match(/\/key-results\/[^/]+\/cancel$/) && method === 'POST') return jsonResponse({ outcome: 'applied', keyResult: { ...MOCK_KEY_RESULTS[0], status: 'cancelled' } });

      if (url.match(/\/key-results\/[^/]+\/check-ins$/) && method === 'GET') return jsonResponse({ checkIns: empty ? [] : MOCK_CHECK_INS });
      if (url.match(/\/key-results\/[^/]+\/check-ins$/) && method === 'POST') return jsonResponse({ outcome: 'applied', checkIn: MOCK_CHECK_INS[0] }, 201);
      if (url.match(/\/check-ins\/[^/]+\/correct$/) && method === 'POST') return jsonResponse({ outcome: 'applied', checkIn: { ...MOCK_CHECK_INS[0], checkInId: 'checkin-3', correctionOfCheckInId: MOCK_CHECK_INS[0].checkInId } }, 201);
      if (url.match(/\/key-results\/[^/]+\/suggested-next-check-in-value$/) && method === 'GET')
        return jsonResponse({ suggestedValue: 11, basis: 'linear_trend', reason: 'linear_trend: average step 1 across 2 interval(s) of 3 prior check-in(s), projected from the most recent value 10' });
    } catch {
      /* fall through to real fetch */
    }
    return realFetch(input as RequestInfo, init);
  };
}

const ResultsVNextOkrObjectivesScreen: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const set = mockSet(initialSetStatus);
  const setsLabel = isPolish ? 'Zestawy OKR' : 'OKR sets';

  type Drill =
    | { level: 'objectives' }
    | { level: 'keyResults'; objective: OkrObjectiveWithKeyResultsDto }
    | { level: 'checkIns'; objective: OkrObjectiveWithKeyResultsDto; keyResult: OkrKeyResultDto };

  const initialDrill: Drill =
    initialLevel === 'keyResults'
      ? { level: 'keyResults', objective: MOCK_OBJECTIVES[0]! }
      : initialLevel === 'checkIns'
        ? { level: 'checkIns', objective: MOCK_OBJECTIVES[0]!, keyResult: MOCK_KEY_RESULTS[0]! }
        : { level: 'objectives' };

  const [drill, setDrill] = useState<Drill>(initialDrill);

  const rootCrumb: StandardBreadcrumb = { label: setsLabel, onClick: () => setDrill({ level: 'objectives' }) };

  let content: React.ReactElement;
  if (drill.level === 'objectives') {
    content = (
      <OkrObjectivesView
        set={set}
        isPolish={isPolish}
        breadcrumbs={[rootCrumb, { label: set.title }]}
        onOpenKeyResults={(objective) => setDrill({ level: 'keyResults', objective })}
      />
    );
  } else if (drill.level === 'keyResults') {
    content = (
      <OkrKeyResultsView
        set={set}
        objectiveId={drill.objective.objectiveId}
        isPolish={isPolish}
        breadcrumbs={[rootCrumb, { label: set.title, onClick: () => setDrill({ level: 'objectives' }) }, { label: drill.objective.title }]}
        onOpenCheckIns={(keyResult, objective) => setDrill({ level: 'checkIns', objective, keyResult })}
      />
    );
  } else {
    content = (
      <OkrCheckInsView
        set={set}
        objective={drill.objective}
        keyResult={drill.keyResult}
        isPolish={isPolish}
        breadcrumbs={[
          rootCrumb,
          { label: set.title, onClick: () => setDrill({ level: 'objectives' }) },
          { label: drill.objective.title, onClick: () => setDrill({ level: 'keyResults', objective: drill.objective }) },
          { label: drill.keyResult.title },
        ]}
      />
    );
  }

  return <div className="h-screen bg-c-bg text-c-text">{content}</div>;
};

export default ResultsVNextOkrObjectivesScreen;
