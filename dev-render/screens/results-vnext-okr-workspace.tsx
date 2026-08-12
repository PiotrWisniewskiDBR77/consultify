/**
 * RN-G3 lane `okr` full-tool task (2026-08-11) — visual QA harness for the
 * FULL OKR tool (`OkrSetWorkspace`): Overview/Objectives & Key
 * Results/Alignment/Conversations & Support/Review & Reflection/History.
 *
 * Unlike `results-vnext-okr-objectives.tsx` (which mounts presenter
 * functions directly to dodge live `fetch()`), the workspace's new tabs
 * (Overview/Alignment/Support/Review & Reflection/History) call the REAL
 * API client functions inline inside the view components — there is no
 * pure-presenter split for them. So this harness stubs `window.fetch`
 * itself (same established pattern as
 * `dev-render/screens/assessment-initiatives-panel.tsx`) and mounts the
 * REAL `OkrSetWorkspace` component, exercising the real fetch/state code,
 * not a re-implementation.
 *
 * URL params:
 *   &tab=overview|objectives|alignment|support|review|history (informational
 *     only — the workspace's own tab state starts at "overview"; use
 *     `shot.mjs --click` to switch tabs for a screenshot, this param just
 *     documents which tab a given screenshot run is meant to land on)
 *   &setStatus=draft|submitted|changes_requested|approved|active|review|closed|cancelled
 *   &asOwner=1   pretend the current user IS the Set owner (self-review/
 *     approve-gate screenshots) — default 0 (current user is a third party,
 *     shows every lifecycle button's disabled-with-reason state)
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OkrSetWorkspace } from '../../src/components/ResultsVNext/okr/OkrSetWorkspace';
import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';

const MOCK_SET_ID = 'okr-set-5';
const OWNER_ID = 'user-anna-kowalska';
const REVIEWER_ID = 'user-tomasz-nowak';

const params = new URLSearchParams(window.location.search);
const setStatus = (params.get('setStatus') || 'active') as OkrSetDto['status'];
const asOwner = params.get('asOwner') === '1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockSet(status: OkrSetDto['status']): OkrSetDto {
  return {
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'individual',
    scopeId: OWNER_ID,
    ownerUserId: OWNER_ID,
    reviewerUserId: REVIEWER_ID,
    title: 'Wdrożyć MES na 3 liniach produkcyjnych',
    status,
    submittedBy: OWNER_ID,
    submittedAt: '2026-06-01T09:00:00Z',
    approvedBy: REVIEWER_ID,
    approvedAt: '2026-06-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: status === 'changes_requested' ? 'Cel 2 nie ma jeszcze drugiego Kluczowego Rezultatu.' : null,
    currentVersion: 3,
    approvedVersion: 2,
    latestApprovedSnapshotId: 'snap-5-v2',
    overallProgress: '0.625',
    overallConfidence: 'medium',
    attentionState: 'watch',
    lastCheckinAt: '2026-08-05T09:00:00Z',
    nextCheckinDueAt: '2026-08-19T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 9,
    createdBy: OWNER_ID,
    createdAt: '2026-06-01T09:00:00Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-05T09:00:00Z',
  };
}

// Two calculable KRs under obj-1 — kept consistent with obj-1's own
// `progressCalcReason` ("equal_average over 2 calculable key result(s) (of
// 2 total)") so the "Key Results" count column never contradicts the
// reason text next to it (same defect class fixed in
// `results-vnext-okr-objectives.tsx` per this task's own coordinator note).
const MOCK_KEY_RESULTS_OBJ1 = [
  {
    keyResultId: 'kr-1',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: OWNER_ID,
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
    createdBy: OWNER_ID,
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    keyResultId: 'kr-4',
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: REVIEWER_ID,
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
    createdBy: REVIEWER_ID,
    createdAt: '2026-06-05T09:00:00Z',
    updatedBy: REVIEWER_ID,
    updatedAt: '2026-08-07T09:00:00Z',
  },
];

const MOCK_OBJECTIVES = [
  {
    objectiveId: 'obj-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: OWNER_ID,
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
    createdBy: OWNER_ID,
    createdAt: '2026-06-02T09:00:00Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-05T09:00:00Z',
    approvedAt: '2026-06-05T09:00:00Z',
    keyResults: MOCK_KEY_RESULTS_OBJ1,
  },
  {
    objectiveId: 'obj-2',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    ownerUserId: REVIEWER_ID,
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
    createdBy: REVIEWER_ID,
    createdAt: '2026-06-10T09:00:00Z',
    updatedBy: REVIEWER_ID,
    updatedAt: '2026-08-01T09:00:00Z',
    approvedAt: '2026-06-12T09:00:00Z',
    keyResults: [],
  },
];

const MOCK_ALIGNMENTS_OUT = [
  {
    alignmentId: 'align-1',
    organizationId: 'org-1',
    sourceObjectiveId: 'obj-1',
    targetObjectiveId: 'obj-company-1',
    relation: 'contributes_to',
    rationale: 'Automatyzacja linii 1 wspiera firmowy cel redukcji przestojów o 20%.',
    status: 'accepted',
    sourceCycleId: 'cycle-fy26-h2',
    targetCycleId: 'cycle-fy26-h2',
    proposedBy: OWNER_ID,
    proposedAt: '2026-06-20T09:00:00Z',
    respondedBy: REVIEWER_ID,
    respondedAt: '2026-06-21T09:00:00Z',
    responseReason: null,
    removedBy: null,
    removedAt: null,
    rowVersion: 2,
    createdAt: '2026-06-20T09:00:00Z',
    updatedAt: '2026-06-21T09:00:00Z',
  },
];
const MOCK_ALIGNMENTS_IN = [
  {
    alignmentId: 'align-2',
    organizationId: 'org-1',
    sourceObjectiveId: 'obj-team-3',
    targetObjectiveId: 'obj-1',
    relation: 'contributes_to',
    rationale: 'Zespół utrzymania ruchu wspiera cel automatyzacji linii 1.',
    status: 'proposed',
    sourceCycleId: 'cycle-fy26-h2',
    targetCycleId: 'cycle-fy26-h2',
    proposedBy: 'user-krzysztof-lis',
    proposedAt: '2026-08-01T09:00:00Z',
    respondedBy: null,
    respondedAt: null,
    responseReason: null,
    removedBy: null,
    removedAt: null,
    rowVersion: 1,
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  },
];

const MOCK_REVIEWS = [
  {
    reviewId: 'review-self-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    reviewType: 'self',
    reviewerUserId: OWNER_ID,
    status: 'submitted',
    outcome: null,
    comments: [],
    reviewedSetVersion: 3,
    submittedBy: OWNER_ID,
    submittedAt: '2026-08-10T09:00:00Z',
    decidedBy: null,
    decidedAt: null,
    rowVersion: 1,
    createdBy: OWNER_ID,
    createdAt: '2026-08-10T09:00:00Z',
    updatedBy: OWNER_ID,
    updatedAt: '2026-08-10T09:00:00Z',
  },
  {
    reviewId: 'review-manager-1',
    setId: MOCK_SET_ID,
    organizationId: 'org-1',
    reviewType: 'manager',
    reviewerUserId: REVIEWER_ID,
    status: 'submitted',
    outcome: null,
    comments: [{ level: 'set', targetId: MOCK_SET_ID, text: 'Dobry postęp, dopilnuj celu 2.', createdAt: '2026-08-10T10:00:00Z', createdBy: REVIEWER_ID }],
    reviewedSetVersion: 3,
    submittedBy: REVIEWER_ID,
    submittedAt: '2026-08-10T10:00:00Z',
    decidedBy: null,
    decidedAt: null,
    rowVersion: 1,
    createdBy: REVIEWER_ID,
    createdAt: '2026-08-10T10:00:00Z',
    updatedBy: REVIEWER_ID,
    updatedAt: '2026-08-10T10:00:00Z',
  },
];

const MOCK_SUPPORT_REQUESTS = [
  {
    requestId: 'sr-1',
    organizationId: 'org-1',
    setId: MOCK_SET_ID,
    objectiveId: 'obj-2',
    keyResultId: null,
    kind: 'support_request',
    body: 'Potrzebujemy wsparcia automatyka do kalibracji czujników na linii 2.',
    originCheckInId: null,
    status: 'open',
    assignedToUserId: REVIEWER_ID,
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    dismissedReason: null,
    decisionLinkId: null,
    recognitionVisibility: null,
    rowVersion: 1,
    createdBy: OWNER_ID,
    createdAt: '2026-08-08T09:00:00Z',
    updatedAt: '2026-08-08T09:00:00Z',
  },
  {
    requestId: 'sr-2',
    organizationId: 'org-1',
    setId: MOCK_SET_ID,
    objectiveId: 'obj-1',
    keyResultId: null,
    kind: 'recognition',
    body: 'Świetna robota przy podłączeniu czujników PLC!',
    originCheckInId: null,
    status: null,
    assignedToUserId: null,
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null,
    dismissedReason: null,
    decisionLinkId: null,
    recognitionVisibility: 'team',
    rowVersion: 1,
    createdBy: REVIEWER_ID,
    createdAt: '2026-08-06T09:00:00Z',
    updatedAt: '2026-08-06T09:00:00Z',
  },
  {
    requestId: 'sr-3',
    organizationId: 'org-1',
    setId: MOCK_SET_ID,
    objectiveId: 'obj-2',
    keyResultId: null,
    kind: 'support_request',
    body: 'Czy budżet na dodatkowe czujniki jest zatwierdzony?',
    originCheckInId: null,
    status: 'resolved',
    assignedToUserId: REVIEWER_ID,
    acknowledgedBy: REVIEWER_ID,
    acknowledgedAt: '2026-08-03T09:00:00Z',
    resolvedBy: REVIEWER_ID,
    resolvedAt: '2026-08-04T09:00:00Z',
    resolutionNote: 'Budżet zatwierdzony na FY26 Q3.',
    dismissedReason: null,
    decisionLinkId: 'dl-1',
    recognitionVisibility: null,
    rowVersion: 2,
    createdBy: OWNER_ID,
    createdAt: '2026-08-02T09:00:00Z',
    updatedAt: '2026-08-04T09:00:00Z',
  },
];

const MOCK_DECISION_LINK = {
  linkId: 'dl-1',
  organizationId: 'org-1',
  setId: MOCK_SET_ID,
  supportRequestId: 'sr-3',
  objectiveId: 'obj-2',
  keyResultId: null,
  decisionId: 'dec-77',
  requestedDecision: 'Zatwierdzenie budżetu na dodatkowe czujniki PLC',
  impactOfDelay: 'Opóźnienie linii 2 o 2 tygodnie.',
  desiredDate: '2026-08-15',
  resolutionAcknowledged: true,
  resolutionAcknowledgedBy: OWNER_ID,
  resolutionAcknowledgedAt: '2026-08-04T09:30:00Z',
  requestedBy: OWNER_ID,
  requestedAt: '2026-08-02T09:00:00Z',
  rowVersion: 1,
  decisionStatus: 'approved',
  decisionRationale: 'Budżet dostępny w rezerwie operacyjnej.',
  decisionDecidedAt: '2026-08-04T09:00:00Z',
};

const MOCK_HISTORY_ENTRIES = [
  { kind: 'event', eventId: 'evt-1', sequence: '10', eventType: 'okr_set.submitted', actorUserId: OWNER_ID, actorEffectiveRole: 'member', occurredAt: '2026-08-01T09:00:00Z', reason: null, payload: {} },
  { kind: 'event', eventId: 'evt-2', sequence: '11', eventType: 'okr_set.approved', actorUserId: REVIEWER_ID, actorEffectiveRole: 'admin', occurredAt: '2026-08-02T09:00:00Z', reason: null, payload: {} },
  {
    kind: 'material_change',
    versionId: 'ver-1',
    versionNumber: 2,
    fieldName: 'title',
    beforeValue: 'Wdrożyć MES na 2 liniach',
    afterValue: 'Wdrożyć MES na 3 liniach produkcyjnych',
    reason: 'Rozszerzono zakres o linię 3 po akceptacji budżetu.',
    requestedBy: OWNER_ID,
    requestedAt: '2026-07-15T09:00:00Z',
  },
];

const MOCK_SNAPSHOTS = [
  { snapshotId: 'snap-5-v1', setId: MOCK_SET_ID, sequenceNumber: 1, approvedBy: REVIEWER_ID, approvedAt: '2026-06-05T09:00:00Z', contentHash: 'hash-v1' },
  { snapshotId: 'snap-5-v2', setId: MOCK_SET_ID, sequenceNumber: 2, approvedBy: REVIEWER_ID, approvedAt: '2026-08-02T09:00:00Z', contentHash: 'hash-v2' },
];

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __OKR_WORKSPACE_FETCH__?: boolean };
if (!g.__OKR_WORKSPACE_FETCH__) {
  g.__OKR_WORKSPACE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  // Mirror the component's own initial `set` (incl. `asOwner` override) so
  // a lifecycle transition's response doesn't silently revert `ownerUserId`
  // back to the un-overridden mock — the fetch stub's mutable copy must
  // start from the SAME state the screen renders first, not a fresh one.
  let currentSet = mockSet(setStatus);
  if (asOwner) currentSet.ownerUserId = 'user-current';

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (!url.includes('/api/vnext/results/okr/')) {
        return realFetch(input as RequestInfo, init);
      }

      // Objectives (nested KR list — empty here, workspace's own Objectives
      // tab reuses the ALREADY-QA'd `results-vnext-okr-objectives.tsx` mock
      // data path in its own real usage; this harness only needs enough for
      // the Overview/Alignment/Support/Review/History tabs to render).
      if (url.match(/\/sets\/[^/]+\/objectives$/) && method === 'GET') {
        return jsonResponse({ objectives: MOCK_OBJECTIVES });
      }

      // Set lifecycle transitions — echo back an updated set.
      const transitionMatch = url.match(/\/sets\/([^/]+)\/(submit|approve|request-changes|activate|open-review|cancel|close|final-score)$/);
      if (transitionMatch && method === 'POST') {
        const [, , action] = transitionMatch;
        const nextStatus: Record<string, OkrSetDto['status']> = {
          submit: 'submitted',
          approve: 'approved',
          'request-changes': 'changes_requested',
          activate: 'active',
          'open-review': 'review',
          cancel: 'cancelled',
          close: 'closed',
          'final-score': currentSet.status,
        };
        currentSet = { ...currentSet, status: nextStatus[action] ?? currentSet.status, rowVersion: currentSet.rowVersion + 1 };
        if (action === 'approve') return jsonResponse({ outcome: 'applied', set: currentSet, snapshot: MOCK_SNAPSHOTS[1] });
        if (action === 'final-score') return jsonResponse({ outcome: 'applied', set: currentSet, scoredObjectives: [{ objectiveId: 'obj-1', finalScore: '0.82', scoringModelUnsupported: false }] });
        return jsonResponse({ outcome: 'applied', set: currentSet });
      }
      if (url.match(/\/sets\/[^/]+\/carry-forward$/) && method === 'POST') {
        const carried = { ...currentSet, setId: 'okr-set-carried', status: 'draft' as const, rowVersion: 1, carriedFromSetId: currentSet.setId };
        return jsonResponse({ sourceSet: currentSet, carriedSet: carried, created: true });
      }

      // Alignments
      if (url.match(/\/objectives\/[^/]+\/alignments\?direction=outgoing/) && method === 'GET') {
        return jsonResponse({ alignments: MOCK_ALIGNMENTS_OUT });
      }
      if (url.match(/\/objectives\/[^/]+\/alignments\?direction=incoming/) && method === 'GET') {
        return jsonResponse({ alignments: MOCK_ALIGNMENTS_IN });
      }
      if (url.match(/\/objectives\/[^/]+\/alignments$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', alignment: { ...MOCK_ALIGNMENTS_OUT[0], alignmentId: `align-${Date.now()}`, status: 'proposed' }, created: true }, 201);
      }
      if (url.match(/\/alignments\/[^/]+\/(accept|reject|remove)$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', alignment: { ...MOCK_ALIGNMENTS_IN[0], status: 'accepted' } });
      }

      // Reviews
      if (url.match(/\/sets\/[^/]+\/reviews$/) && method === 'GET') {
        return jsonResponse({ reviews: MOCK_REVIEWS });
      }
      if (url.match(/\/reviews\/(self|manager)\/submit$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', review: MOCK_REVIEWS[0] });
      }
      if (url.match(/\/reviews\/manager\/(approve|request-changes)$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', review: { ...MOCK_REVIEWS[1], status: 'approved' } });
      }
      if (url.match(/\/reviews\/(self|manager)\/comments$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', review: MOCK_REVIEWS[1] });
      }

      // Reflection
      if (url.match(/\/objectives\/[^/]+\/reflection$/) && method === 'POST') {
        return jsonResponse({
          outcome: 'applied',
          reflection: { reflectionId: 'refl-1', setId: MOCK_SET_ID, objectiveId: 'obj-1', organizationId: 'org-1', status: 'draft', finalScore: null, scoringModelUnsupported: false, finalScorePayload: null, scoringPolicyVersionId: null, scoredBy: null, scoredAt: null, whatWorked: null, whatDidNotWork: null, why: null, learning: null, nextCycleChange: null, disposition: null, finalizedBy: null, finalizedAt: null, rowVersion: 1, createdBy: OWNER_ID, createdAt: '2026-08-10T09:00:00Z', updatedBy: null, updatedAt: '2026-08-10T09:00:00Z' },
        });
      }

      // History + snapshots
      if (url.match(/\/sets\/[^/]+\/history/) && method === 'GET') {
        return jsonResponse({ entries: MOCK_HISTORY_ENTRIES, nextCursor: null });
      }
      if (url.match(/\/sets\/[^/]+\/approval-snapshots$/) && method === 'GET') {
        return jsonResponse({ snapshots: MOCK_SNAPSHOTS });
      }

      // Support / recognition / comments / decision links
      if (url.match(/\/sets\/[^/]+\/support-requests/) && method === 'GET') {
        return jsonResponse({ supportRequests: MOCK_SUPPORT_REQUESTS });
      }
      if (url.match(/\/objectives\/[^/]+\/(comments|recognition|support-requests)$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', supportRequest: MOCK_SUPPORT_REQUESTS[0] }, 201);
      }
      if (url.match(/\/support-requests\/[^/]+\/acknowledge$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', supportRequest: { ...MOCK_SUPPORT_REQUESTS[0], status: 'acknowledged' } });
      }
      if (url.match(/\/support-requests\/[^/]+\/resolve$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', supportRequest: { ...MOCK_SUPPORT_REQUESTS[0], status: 'resolved' } });
      }
      if (url.match(/\/support-requests\/[^/]+\/dismiss$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', supportRequest: { ...MOCK_SUPPORT_REQUESTS[0], status: 'dismissed' } });
      }
      if (url.match(/\/support-requests\/[^/]+\/request-decision$/) && method === 'POST') {
        return jsonResponse({ outcome: 'applied', supportRequest: MOCK_SUPPORT_REQUESTS[0], decisionLink: MOCK_DECISION_LINK }, 201);
      }
      if (url.match(/\/support-requests\/[^/]+\/decision-link$/) && method === 'GET') {
        return jsonResponse({ decisionLink: MOCK_DECISION_LINK });
      }
    } catch {
      /* fall through to real fetch */
    }
    return realFetch(input as RequestInfo, init);
  };
}

const ResultsVNextOkrWorkspaceScreen: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [set, setSet] = useState<OkrSetDto>(() => {
    const initial = mockSet(setStatus);
    if (asOwner) initial.ownerUserId = 'user-current';
    return initial;
  });
  const [backToSetsClicked, setBackToSetsClicked] = useState(false);

  if (backToSetsClicked) {
    return (
      <div className="h-screen bg-c-bg text-c-text flex items-center justify-center">
        <p className="text-sm text-c-text-secondary">
          {isPolish
            ? 'Wrócono z pełnego narzędzia OKR (onBackToSets). Ten harness nie ma rejestru do pokazania — zobacz results-vnext-okr-registry.'
            : 'Returned from the OKR full tool (onBackToSets). This harness has no registry to show — see results-vnext-okr-registry.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <OkrSetWorkspace
        set={set}
        isPolish={isPolish}
        setsLabel={isPolish ? 'Zestawy OKR' : 'OKR sets'}
        onBackToSets={() => setBackToSetsClicked(true)}
        onSetChanged={(updated) => setSet(updated)}
      />
    </div>
  );
};

export default ResultsVNextOkrWorkspaceScreen;
