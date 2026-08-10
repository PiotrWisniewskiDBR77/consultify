/**
 * DANE PRÓBNE — WYŁĄCZNIE dla harnessu zrzutowego (`podglad/`).
 *
 * NIE są importowane przez żaden plik produkcyjny — jedynym importerem jest
 * `podglad/main.tsx`, który nie wchodzi do bundla aplikacji (produkcyjnym
 * wejściem jest `index.html` w korzeniu repo → `src/index.tsx`).
 *
 * Powód istnienia (CLAUDE.md reguła #7): właściciel NIGDY nie jest pierwszym
 * testerem wizualnym. Zrzuty muszą powstać BEZ logowania i BEZ żywego
 * backendu, więc harness podstawia odpowiedzi `/api/v8/case-workspace/*`
 * o kształtach przepisanych 1:1 z `../types.ts`.
 *
 * Kształty pochodzą z typów, a te z serwisów domenowych — więc jeżeli backend
 * zmieni kontrakt, harness przestanie się kompilować razem z modułem.
 */

import type {
  CanonicalGraph,
  CaseActionProposal,
  CaseArtifactLink,
  CaseCoreView,
  CaseHistoryEvent,
  CasePlanVersion,
  CaseWait,
  PlanValidationResult,
  ValueMeasurement,
} from '../types';

const ORG = 'org-probna';
const ACTOR = 'user-probny';

function iso(daysAgo: number, hour = 9): string {
  const d = new Date('2026-08-10T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 15, 0, 0);
  return d.toISOString();
}

function baseCase(partial: Partial<CaseCoreView> & Pick<CaseCoreView, 'caseId'>): CaseCoreView {
  return {
    projectId: `proj-${partial.caseId}`,
    organizationId: ORG,
    caseProfile: 'STANDARD',
    governanceTier: 'STANDARD',
    autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
    autonomyPolicyRef: null,
    caseStatus: 'ACTIVE',
    contractedClosureType: 'DELIVERY_COMPLETED',
    deliveryStatus: 'PENDING',
    decisionStatus: 'NOT_APPLICABLE',
    implementationStatus: 'NOT_APPLICABLE',
    outcomeStatus: 'NOT_APPLICABLE',
    closureType: null,
    closedAt: null,
    closedByActorId: null,
    closureEvidenceRef: null,
    sponsorUserId: 'user-sponsor',
    acceptanceCriteriaRef: null,
    budgetPolicyRef: null,
    currentPlanVersionId: null,
    createdByActorId: ACTOR,
    version: 3,
    createdAt: iso(40),
    updatedAt: iso(2),
    completedAt: null,
    projectName: 'Zlecenie',
    projectDescription: null,
    projectOwnerId: 'user-owner',
    ...partial,
  };
}

export const CASES: CaseCoreView[] = [
  baseCase({
    caseId: 'zlc-2026-014',
    caseProfile: 'TRANSFORMATION',
    governanceTier: 'CONTROLLED',
    autonomyPolicy: 'ASK_MATERIAL_ACTIONS',
    caseStatus: 'ACTIVE',
    contractedClosureType: 'OUTCOME_VALIDATED',
    deliveryStatus: 'COMPLETED',
    decisionStatus: 'PENDING',
    implementationStatus: 'PENDING',
    outcomeStatus: 'PENDING',
    currentPlanVersionId: 'plan-014-3',
    projectName: 'Apator — skrócenie zamknięcia miesiąca',
    projectDescription:
      'Zamknięcie miesiąca finansowego skrócone z 9 do 4 dni roboczych, przy tej samej liczbie osób w zespole.',
    updatedAt: iso(0, 7),
  }),
  baseCase({
    caseId: 'zlc-2026-011',
    caseProfile: 'STANDARD',
    caseStatus: 'BLOCKED',
    contractedClosureType: 'DECISION_COMPLETED',
    deliveryStatus: 'COMPLETED',
    decisionStatus: 'PENDING',
    currentPlanVersionId: 'plan-011-2',
    projectName: 'Elkomtech — wybór dostawcy systemu MES',
    projectDescription:
      'Rekomendacja jednego dostawcy MES wraz z uzasadnieniem kosztowym, gotowa do decyzji zarządu.',
    governanceTier: 'CONTROLLED',
    updatedAt: iso(1, 16),
  }),
  baseCase({
    caseId: 'zlc-2026-009',
    caseProfile: 'LIGHT',
    governanceTier: 'LIGHTWEIGHT',
    autonomyPolicy: 'ASK_EACH_ACTION',
    caseStatus: 'DRAFT',
    contractedClosureType: 'DELIVERY_COMPLETED',
    deliveryStatus: 'PENDING',
    projectName: 'Vegas Sp. z o.o. — przegląd procesu ofertowania',
    projectDescription: 'Mapa procesu ofertowania i lista pięciu największych strat czasu.',
    updatedAt: iso(4, 11),
  }),
  baseCase({
    caseId: 'zlc-2026-007',
    caseProfile: 'MONITORING',
    caseStatus: 'ACTIVE',
    autonomyPolicy: 'EXECUTE_APPROVED_PLAN',
    contractedClosureType: 'OUTCOME_VALIDATED',
    deliveryStatus: 'COMPLETED',
    decisionStatus: 'COMPLETED',
    implementationStatus: 'PENDING',
    outcomeStatus: 'PENDING',
    currentPlanVersionId: 'plan-007-1',
    projectName: 'Oxford Group — nadzór nad wdrożeniem CRM',
    projectDescription: 'Comiesięczny pomiar adopcji CRM i reakcja na spadki poniżej progu.',
    updatedAt: iso(6, 13),
  }),
  baseCase({
    caseId: 'zlc-2026-003',
    caseProfile: 'STANDARD',
    caseStatus: 'CLOSED',
    contractedClosureType: 'IMPLEMENTATION_COMPLETED',
    deliveryStatus: 'COMPLETED',
    decisionStatus: 'COMPLETED',
    implementationStatus: 'COMPLETED',
    outcomeStatus: 'VALIDATED',
    closureType: 'IMPLEMENTATION_COMPLETED',
    closedAt: iso(12, 15),
    closedByActorId: ACTOR,
    projectName: 'Harvard Sp. z o.o. — standard raportu zarządczego',
    projectDescription: 'Jeden format raportu zarządczego wdrożony w czterech spółkach grupy.',
    completedAt: iso(12, 15),
    updatedAt: iso(12, 15),
  }),
  baseCase({
    caseId: 'zlc-2025-118',
    caseProfile: 'LIGHT',
    governanceTier: 'LIGHTWEIGHT',
    caseStatus: 'CANCELLED',
    contractedClosureType: 'COMPLETED_PARTIAL',
    deliveryStatus: 'PENDING',
    projectName: 'Nordkalk — audyt zakupów (wstrzymany)',
    projectDescription: 'Zlecenie wstrzymane na wniosek klienta po zmianie właściciela procesu.',
    updatedAt: iso(31, 10),
  }),
];

const GRAPH_014: CanonicalGraph = {
  schemaVersion: '1.0.0',
  graphId: 'graph-014-3',
  entryNodeIds: ['n-start'],
  terminalNodeIds: ['n-koniec'],
  nodes: [
    {
      nodeId: 'n-start',
      type: 'HUMAN_TASK',
      metadata: { label: 'Zebranie danych o zamknięciu miesiąca' },
    },
    {
      nodeId: 'n-analiza',
      type: 'CAPABILITY',
      effectClass: 'SAFE_ADDITIVE',
      metadata: { label: 'Analiza wąskich gardeł w harmonogramie' },
    },
    {
      nodeId: 'n-warsztat',
      type: 'HUMAN_TASK',
      metadata: { label: 'Warsztat z kontrolingiem' },
    },
    {
      nodeId: 'n-decyzja',
      type: 'DECISION_GATEWAY',
      metadata: { label: 'Decyzja o zakresie zmian' },
    },
    {
      nodeId: 'n-czekanie',
      type: 'TIMER_WAIT',
      metadata: { label: 'Odczekanie jednego cyklu zamknięcia' },
    },
    {
      nodeId: 'n-wdrozenie',
      type: 'CAPABILITY',
      effectClass: 'SENSITIVE_UPDATE',
      metadata: { label: 'Nowa instrukcja zamknięcia miesiąca' },
    },
    {
      nodeId: 'n-zbieg',
      type: 'PARALLEL_JOIN',
      metadata: { label: 'Zebranie obu ścieżek' },
    },
    {
      nodeId: 'n-koniec',
      type: 'HUMAN_TASK',
      metadata: { label: 'Potwierdzenie efektu przez sponsora' },
    },
  ],
  edges: [
    { edgeId: 'e1', sourceNodeId: 'n-start', targetNodeId: 'n-analiza', edgeType: 'SEQUENCE' },
    { edgeId: 'e2', sourceNodeId: 'n-analiza', targetNodeId: 'n-warsztat', edgeType: 'SEQUENCE' },
    { edgeId: 'e3', sourceNodeId: 'n-warsztat', targetNodeId: 'n-decyzja', edgeType: 'SEQUENCE' },
    {
      edgeId: 'e4',
      sourceNodeId: 'n-decyzja',
      targetNodeId: 'n-wdrozenie',
      edgeType: 'CONDITIONAL',
      conditionExpression: 'zakres = pelny',
    },
    {
      edgeId: 'e5',
      sourceNodeId: 'n-decyzja',
      targetNodeId: 'n-czekanie',
      edgeType: 'CONDITIONAL',
      conditionExpression: 'zakres = pilotaz',
    },
    { edgeId: 'e6', sourceNodeId: 'n-wdrozenie', targetNodeId: 'n-zbieg', edgeType: 'SEQUENCE' },
    { edgeId: 'e7', sourceNodeId: 'n-czekanie', targetNodeId: 'n-zbieg', edgeType: 'SEQUENCE' },
    { edgeId: 'e8', sourceNodeId: 'n-zbieg', targetNodeId: 'n-koniec', edgeType: 'SEQUENCE' },
  ],
  metadata: { origin: 'harness-podgladu' },
};

const GRAPH_011: CanonicalGraph = {
  schemaVersion: '1.0.0',
  graphId: 'graph-011-2',
  entryNodeIds: ['m-start'],
  terminalNodeIds: ['m-rekomendacja'],
  nodes: [
    { nodeId: 'm-start', type: 'HUMAN_TASK', metadata: { label: 'Zebranie wymagań produkcji' } },
    { nodeId: 'm-rfi', type: 'CAPABILITY', metadata: { label: 'Zapytanie do dostawców' } },
    { nodeId: 'm-ocena', type: 'CAPABILITY', metadata: { label: 'Porównanie ofert' } },
    {
      nodeId: 'm-rekomendacja',
      type: 'DECISION_GATEWAY',
      metadata: { label: 'Rekomendacja dla zarządu' },
    },
  ],
  edges: [
    { edgeId: 'me1', sourceNodeId: 'm-start', targetNodeId: 'm-rfi', edgeType: 'SEQUENCE' },
    { edgeId: 'me2', sourceNodeId: 'm-rfi', targetNodeId: 'm-ocena', edgeType: 'SEQUENCE' },
    {
      edgeId: 'me3',
      sourceNodeId: 'm-ocena',
      targetNodeId: 'm-rekomendacja',
      edgeType: 'SEQUENCE',
    },
  ],
};

export const PLAN_VERSIONS: Record<string, CasePlanVersion[]> = {
  'zlc-2026-014': [
    {
      casePlanVersionId: 'plan-014-3',
      caseId: 'zlc-2026-014',
      planNumber: 3,
      status: 'PUBLISHED',
      semanticGraph: GRAPH_014,
      graphDigest: 'sha256:7f2c19ab55e0d1c4',
      changeReason: 'Dodano ścieżkę pilotażu po warsztacie z kontrolingiem.',
      publishedAt: iso(9, 12),
      createdByActorId: ACTOR,
      version: 1,
      createdAt: iso(11, 12),
      updatedAt: iso(9, 12),
    },
  ],
  'zlc-2026-011': [
    {
      casePlanVersionId: 'plan-011-2',
      caseId: 'zlc-2026-011',
      planNumber: 2,
      status: 'PUBLISHED',
      semanticGraph: GRAPH_011,
      graphDigest: 'sha256:11ab77cc02fe9910',
      changeReason: null,
      publishedAt: iso(20, 10),
      createdByActorId: ACTOR,
      version: 1,
      createdAt: iso(22, 10),
      updatedAt: iso(20, 10),
    },
  ],
  'zlc-2026-007': [
    {
      casePlanVersionId: 'plan-007-1',
      caseId: 'zlc-2026-007',
      planNumber: 1,
      status: 'PUBLISHED',
      semanticGraph: GRAPH_011,
      graphDigest: 'sha256:33dd10aa77be4412',
      changeReason: null,
      publishedAt: iso(28, 10),
      createdByActorId: ACTOR,
      version: 1,
      createdAt: iso(29, 10),
      updatedAt: iso(28, 10),
    },
  ],
};

export const GRAPHS: Record<string, CanonicalGraph> = {
  'plan-014-3': GRAPH_014,
  'plan-011-2': GRAPH_011,
  'plan-007-1': GRAPH_011,
};

export const VALIDATIONS: Record<string, PlanValidationResult> = {
  'plan-014-3': { valid: true, blockers: [] },
  'plan-011-2': {
    valid: false,
    blockers: [
      {
        code: 'plan_required_input_unbound',
        detail: 'Krok „Porównanie ofert" nie ma źródła danych kosztowych.',
        severity: 'BLOCKING',
      },
    ],
  },
  'plan-007-1': { valid: true, blockers: [] },
};

export const WAITS: Record<string, CaseWait[]> = {
  'zlc-2026-014': [
    {
      waitId: 'wait-014-1',
      caseId: 'zlc-2026-014',
      runId: 'run-014-9',
      nodeRunId: 'nr-014-31',
      actionProposalId: null,
      waitType: 'HUMAN',
      status: 'ACTIVE',
      correlationKey: 'zlc-2026-014:sponsor-approval',
      expectedEventType: 'human.decision.recorded',
      dueAt: iso(-3, 12),
      timeoutAt: iso(-7, 12),
      satisfiedAt: null,
      version: 1,
      createdAt: iso(3, 9),
      updatedAt: iso(3, 9),
    },
    {
      waitId: 'wait-014-2',
      caseId: 'zlc-2026-014',
      runId: 'run-014-9',
      nodeRunId: 'nr-014-33',
      actionProposalId: null,
      waitType: 'TIMER',
      status: 'ACTIVE',
      correlationKey: 'zlc-2026-014:cykl-zamkniecia',
      expectedEventType: null,
      dueAt: iso(-12, 8),
      timeoutAt: null,
      satisfiedAt: null,
      version: 1,
      createdAt: iso(5, 8),
      updatedAt: iso(5, 8),
    },
    {
      waitId: 'wait-014-3',
      caseId: 'zlc-2026-014',
      runId: 'run-014-8',
      nodeRunId: 'nr-014-21',
      actionProposalId: null,
      waitType: 'DOMAIN_EVENT',
      status: 'SATISFIED',
      correlationKey: 'zlc-2026-014:dane-erp',
      expectedEventType: 'finance.period.closed',
      dueAt: null,
      timeoutAt: null,
      satisfiedAt: iso(8, 14),
      version: 2,
      createdAt: iso(14, 9),
      updatedAt: iso(8, 14),
    },
  ],
  'zlc-2026-011': [
    {
      waitId: 'wait-011-1',
      caseId: 'zlc-2026-011',
      runId: 'run-011-4',
      nodeRunId: 'nr-011-12',
      actionProposalId: 'prop-011-1',
      waitType: 'HUMAN',
      status: 'ACTIVE',
      correlationKey: 'zlc-2026-011:zarzad',
      expectedEventType: 'human.decision.recorded',
      dueAt: iso(2, 12),
      timeoutAt: iso(1, 12),
      satisfiedAt: null,
      version: 1,
      createdAt: iso(10, 9),
      updatedAt: iso(10, 9),
    },
  ],
};

export const PROPOSALS: Record<string, CaseActionProposal[]> = {
  'zlc-2026-014': [
    {
      actionProposalId: 'prop-014-7',
      caseId: 'zlc-2026-014',
      runId: 'run-014-9',
      nodeRunId: 'nr-014-30',
      status: 'PENDING_REVIEW',
      effectClass: 'SENSITIVE_UPDATE',
      previewRef: 'artifact://document/doc-instrukcja-zamkniecia',
      expiresAt: iso(-4, 12),
      proposerType: 'AGENT',
      createdByActorId: 'agent-teresa',
      version: 1,
      createdAt: iso(1, 10),
      updatedAt: iso(1, 10),
    },
    {
      actionProposalId: 'prop-014-6',
      caseId: 'zlc-2026-014',
      runId: 'run-014-9',
      nodeRunId: 'nr-014-27',
      status: 'EXECUTED',
      effectClass: 'SAFE_ADDITIVE',
      previewRef: 'artifact://table/tab-waskie-gardla',
      expiresAt: null,
      proposerType: 'AGENT',
      createdByActorId: 'agent-teresa',
      version: 4,
      createdAt: iso(9, 11),
      updatedAt: iso(8, 15),
    },
  ],
  'zlc-2026-011': [
    {
      actionProposalId: 'prop-011-1',
      caseId: 'zlc-2026-011',
      runId: 'run-011-4',
      nodeRunId: 'nr-011-12',
      status: 'PENDING_REVIEW',
      effectClass: 'GOVERNANCE_TRANSITION',
      previewRef: 'artifact://document/doc-rekomendacja-mes',
      expiresAt: iso(1, 12),
      proposerType: 'AGENT',
      createdByActorId: 'agent-teresa',
      version: 1,
      createdAt: iso(10, 9),
      updatedAt: iso(10, 9),
    },
  ],
};

export const MEASUREMENTS: Record<string, ValueMeasurement[]> = {
  'zlc-2026-014': [
    {
      measurementId: 'pom-014-1',
      caseId: 'zlc-2026-014',
      metricKey: 'dni_zamkniecia',
      metricName: 'Długość zamknięcia miesiąca',
      baselineValue: 9,
      baselineUnit: 'dni robocze',
      targetValue: 4,
      targetUnit: 'dni robocze',
      actualValue: 6,
      actualUnit: 'dni robocze',
      measurementStatus: 'PARTIAL',
      measurementDate: iso(5, 12),
      confidence: 'MEDIUM',
      attribution: 'Pomiar z systemu ERP, jeden pełny cykl po zmianie.',
      nextMeasurementDueAt: iso(-18, 12),
      evidenceRef: 'artifact://table/tab-pomiar-zamkniecia',
      createdAt: iso(5, 12),
    },
    {
      measurementId: 'pom-014-2',
      caseId: 'zlc-2026-014',
      metricKey: 'nadgodziny_kontroling',
      metricName: 'Nadgodziny w kontrolingu',
      baselineValue: 74,
      baselineUnit: 'godziny/miesiąc',
      targetValue: 30,
      targetUnit: 'godziny/miesiąc',
      actualValue: null,
      actualUnit: null,
      measurementStatus: 'EVIDENCE_MISSING',
      measurementDate: iso(5, 12),
      confidence: 'LOW',
      attribution: 'Brak danych kadrowych za ostatni miesiąc.',
      nextMeasurementDueAt: iso(-9, 12),
      evidenceRef: null,
      createdAt: iso(5, 12),
    },
  ],
  'zlc-2026-011': [],
};

export const ARTIFACT_LINKS: Record<string, CaseArtifactLink[]> = {
  'zlc-2026-014': [
    {
      linkId: 'link-014-1',
      caseId: 'zlc-2026-014',
      artifactType: 'document',
      artifactId: 'doc-instrukcja-zamkniecia',
      artifactRevision: 'rev-4',
      relation: 'DELIVERABLE',
      linkStatus: 'ACTIVE',
      isStale: false,
      staleReason: null,
      linkedAt: iso(2, 10),
      updatedAt: iso(1, 10),
    },
    {
      linkId: 'link-014-2',
      caseId: 'zlc-2026-014',
      artifactType: 'table',
      artifactId: 'tab-waskie-gardla',
      artifactRevision: 'rev-2',
      relation: 'DECISION_BASIS',
      linkStatus: 'ACTIVE',
      isStale: true,
      staleReason: 'Źródłowa tabela zmieniła się po podjęciu decyzji.',
      linkedAt: iso(8, 15),
      updatedAt: iso(3, 11),
    },
    {
      linkId: 'link-014-3',
      caseId: 'zlc-2026-014',
      artifactType: 'presentation',
      artifactId: 'deck-warsztat-kontroling',
      artifactRevision: null,
      relation: 'INPUT',
      linkStatus: 'ACTIVE',
      isStale: false,
      staleReason: null,
      linkedAt: iso(11, 9),
      updatedAt: iso(11, 9),
    },
  ],
  'zlc-2026-011': [],
};

export const HISTORY: Record<string, CaseHistoryEvent[]> = {
  'zlc-2026-014': [
    {
      eventId: 'ev-9',
      caseId: 'zlc-2026-014',
      eventType: 'case.proposal.submitted',
      actorId: 'agent-teresa',
      occurredAt: iso(1, 10),
      summary: 'Asystent zgłosił do zatwierdzenia nową instrukcję zamknięcia miesiąca.',
      globalSeq: 90211,
    },
    {
      eventId: 'ev-8',
      caseId: 'zlc-2026-014',
      eventType: 'case.measurement.recorded',
      actorId: ACTOR,
      occurredAt: iso(5, 12),
      summary: 'Zapisano pomiar: zamknięcie skrócone z 9 do 6 dni roboczych.',
      globalSeq: 90180,
    },
    {
      eventId: 'ev-7',
      caseId: 'zlc-2026-014',
      eventType: 'case.plan.published',
      actorId: ACTOR,
      occurredAt: iso(9, 12),
      summary: 'Zatwierdzono wersję 3 planu (dodana ścieżka pilotażu).',
      globalSeq: 90104,
    },
    {
      eventId: 'ev-6',
      caseId: 'zlc-2026-014',
      eventType: 'case.wait.satisfied',
      actorId: 'system',
      occurredAt: iso(8, 14),
      summary: 'Dane z ERP dotarły — oczekiwanie zamknięte.',
      globalSeq: 90099,
    },
  ],
  'zlc-2026-011': [
    {
      eventId: 'ev-11-2',
      caseId: 'zlc-2026-011',
      eventType: 'case.blocked',
      actorId: 'system',
      occurredAt: iso(1, 16),
      summary: 'Zlecenie zablokowane: brak decyzji zarządu po terminie.',
      globalSeq: 88012,
    },
  ],
};
