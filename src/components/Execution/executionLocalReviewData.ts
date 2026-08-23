/**
 * Deterministic local review dataset for the four detailed Execution surfaces.
 *
 * It mirrors the canonical runtime-v1 read envelopes. It is deliberately
 * unavailable in tests and production, and never replaces successful API data.
 */

export const executionLocalReviewEnabled =
  import.meta.env.DEV && import.meta.env.MODE !== 'test';

export const executionReviewCases = [
  {
    executionCaseId: 'review-exec-supply-chain',
    version: 4,
    initiativeId: 'demo-init-supply-chain',
    state: 'ACTIVE',
    executionManagerId: 'omar-haddad',
    handoffPackageId: 'handoff-supply-chain-v2',
    handoffPackageVersion: 2,
    updatedAt: '2026-08-23T11:30:00.000Z',
    title: 'Supply Chain Optimization — fala 1',
  },
  {
    executionCaseId: 'review-exec-ai-copilot',
    version: 3,
    initiativeId: 'demo-init-ai-copilot',
    state: 'AT_RISK',
    executionManagerId: 'lena-meyer',
    handoffPackageId: 'handoff-ai-copilot-v1',
    handoffPackageVersion: 1,
    updatedAt: '2026-08-23T10:15:00.000Z',
    title: 'Procurement AI Copilot — pilotaż',
  },
];

const workByCase: Record<string, any> = {
  'review-exec-supply-chain': {
    tasks: [
      {
        version: 3,
        taskId: 'task-supplier-data',
        title: 'Zweryfikować kompletność danych 20 kluczowych dostawców',
        description: 'Potwierdzić właścicieli, terminy dostaw i jakość danych źródłowych.',
        status: 'OPEN',
        assigneeId: 'anna-kowalska',
        dueAt: '2026-08-27T15:00:00.000Z',
        slaAt: '2026-08-26T15:00:00.000Z',
        evidenceRefs: ['supplier-quality-snapshot@2'],
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        milestoneIds: ['milestone-data-ready'],
      },
      {
        version: 2,
        taskId: 'task-demand-model',
        title: 'Skalibrować model prognozowania popytu',
        description: 'Porównać prognozę z ostatnimi 12 tygodniami sprzedaży.',
        status: 'BLOCKED',
        assigneeId: 'marek-nowak',
        dueAt: '2026-08-22T12:00:00.000Z',
        slaAt: '2026-08-21T12:00:00.000Z',
        evidenceRefs: [],
        blockerDecisionIds: ['decision-forecast-source'],
        dependencyTaskIds: ['task-supplier-data'],
        milestoneIds: ['milestone-pilot-ready'],
      },
      {
        version: 1,
        taskId: 'task-pilot-dashboard',
        title: 'Uruchomić dashboard pilotażu logistycznego',
        description: 'Udostępnić właścicielom operacyjnym widok KPI pilotażu.',
        status: 'OPEN',
        assigneeId: 'ewa-nowicka',
        dueAt: '2026-09-04T14:00:00.000Z',
        slaAt: '2026-09-03T14:00:00.000Z',
        evidenceRefs: ['dashboard-acceptance-criteria@1'],
        blockerDecisionIds: [],
        dependencyTaskIds: ['task-demand-model'],
        milestoneIds: ['milestone-pilot-ready'],
      },
    ],
    decisions: [
      {
        version: 2,
        decisionId: 'decision-forecast-source',
        title: 'Wybór kanonicznego źródła prognozy popytu',
        rationale: 'Dwa źródła podają rozbieżne wielkości o 14%.',
        status: 'PENDING',
        authorityId: 'piotr-wisniewski',
        dueAt: '2026-08-25T10:00:00.000Z',
        evidenceRefs: ['forecast-source-comparison@1'],
      },
    ],
  },
  'review-exec-ai-copilot': {
    tasks: [
      {
        version: 2,
        taskId: 'task-copilot-guardrails',
        title: 'Zatwierdzić guardraile odpowiedzi zakupowych',
        description: 'Przegląd reguł bezpieczeństwa i eskalacji do człowieka.',
        status: 'OPEN',
        assigneeId: 'katarzyna-wojcik',
        dueAt: '2026-08-29T12:00:00.000Z',
        slaAt: '2026-08-28T12:00:00.000Z',
        evidenceRefs: ['copilot-red-team-results@3'],
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        milestoneIds: ['milestone-copilot-go-live'],
      },
      {
        version: 1,
        taskId: 'task-user-pilot',
        title: 'Przeprowadzić pilotaż z pięcioma kupcami',
        description: 'Zebrać czas przygotowania briefu i ocenę jakości rekomendacji.',
        status: 'OPEN',
        assigneeId: 'tomasz-lewandowski',
        dueAt: '2026-09-08T16:00:00.000Z',
        slaAt: '2026-09-07T16:00:00.000Z',
        evidenceRefs: [],
        blockerDecisionIds: [],
        dependencyTaskIds: ['task-copilot-guardrails'],
        milestoneIds: ['milestone-copilot-go-live'],
      },
    ],
    decisions: [
      {
        version: 1,
        decisionId: 'decision-copilot-scope',
        title: 'Zakres kategorii zakupowych w pilotażu',
        rationale: 'Ograniczyć ryzyko do dwóch kategorii o dobrych danych.',
        status: 'APPROVED',
        authorityId: 'piotr-wisniewski',
        dueAt: '2026-08-20T10:00:00.000Z',
        evidenceRefs: ['pilot-scope-decision@1'],
      },
    ],
  },
};

const milestonesByCase: Record<string, any> = {
  'review-exec-supply-chain': {
    items: [
      {
        milestoneId: 'milestone-data-ready', version: 2,
        executionCaseId: 'review-exec-supply-chain', initiativeId: 'demo-init-supply-chain',
        baselineRef: { ref: 'handoff-supply-chain-v2', version: 2 },
        title: 'Dane dostawców gotowe', ownerId: 'anna-kowalska',
        targetAt: '2026-08-28T16:00:00.000Z', forecastAt: '2026-08-30T16:00:00.000Z',
        status: 'AT_RISK', readiness: 'CONDITIONALLY_READY', forecastVarianceDays: 2,
        evidenceRefs: ['supplier-quality-snapshot@2'],
        sourceVersions: { executionCaseVersion: 4, baselineVersion: 2 },
      },
      {
        milestoneId: 'milestone-pilot-ready', version: 1,
        executionCaseId: 'review-exec-supply-chain', initiativeId: 'demo-init-supply-chain',
        baselineRef: { ref: 'handoff-supply-chain-v2', version: 2 },
        title: 'Pilotaż logistyczny gotowy', ownerId: 'omar-haddad',
        targetAt: '2026-09-08T16:00:00.000Z', forecastAt: '2026-09-12T16:00:00.000Z',
        status: 'AT_RISK', readiness: 'BLOCKED', forecastVarianceDays: 4,
        evidenceRefs: [], sourceVersions: { executionCaseVersion: 4, baselineVersion: 2 },
      },
    ],
  },
  'review-exec-ai-copilot': {
    items: [
      {
        milestoneId: 'milestone-copilot-go-live', version: 1,
        executionCaseId: 'review-exec-ai-copilot', initiativeId: 'demo-init-ai-copilot',
        baselineRef: { ref: 'handoff-ai-copilot-v1', version: 1 },
        title: 'Pilotaż AI Copilot uruchomiony', ownerId: 'lena-meyer',
        targetAt: '2026-09-10T16:00:00.000Z', forecastAt: '2026-09-10T16:00:00.000Z',
        status: 'READY', readiness: 'READY', forecastVarianceDays: 0,
        evidenceRefs: ['copilot-red-team-results@3'],
        sourceVersions: { executionCaseVersion: 3, baselineVersion: 1 },
      },
    ],
  },
};

const allocationsByCase: Record<string, any> = {
  'review-exec-supply-chain': { items: [
    {
      version: 2, allocationId: 'alloc-anna-data', status: 'CONFIRMED',
      assigneeId: 'anna-kowalska', assigneeName: 'Anna Kowalska', teamName: 'Data & Operations',
      taskId: 'task-supplier-data', initiativeId: 'demo-init-supply-chain',
      timeBasis: { window: '24–30 sie 2026', windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
      availability: { knowledgeState: 'KNOWN', value: 32 }, demand: { knowledgeState: 'KNOWN', value: 24 },
      remainingDemand: { knowledgeState: 'KNOWN', value: 8 }, load: { low: 0.72, high: 0.78 },
      skillMatch: { state: 'MATCH', label: 'Bardzo dobre' }, cost: { knowledgeState: 'KNOWN', value: '6 400 PLN' },
      conflict: { state: 'NONE' }, freshness: 'CURRENT', nextAction: 'Monitoruj realizację',
      availabilityRef: { ref: 'calendar-anna-w35', version: 2, knowledgeState: 'KNOWN' },
      calendarRef: { ref: 'calendar-anna-w35', version: 2, knowledgeState: 'KNOWN' },
      remainingEstimateRef: { ref: 'estimate-supplier-data', version: 1, knowledgeState: 'KNOWN' },
    },
    {
      version: 1, allocationId: 'alloc-marek-demand', status: 'REQUESTED',
      assigneeId: 'marek-nowak', assigneeName: 'Marek Nowak', teamName: 'Data Science',
      taskId: 'task-demand-model', initiativeId: 'demo-init-supply-chain',
      timeBasis: { window: '24–30 sie 2026', windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
      availability: { knowledgeState: 'KNOWN', value: 28 }, demand: { knowledgeState: 'KNOWN', value: 38 },
      remainingDemand: { knowledgeState: 'KNOWN', value: -10 }, load: { low: 1.28, high: 1.42 },
      skillMatch: { state: 'MATCH', label: 'Dobre' }, cost: { knowledgeState: 'PARTIAL' },
      assessment: { state: 'OVERALLOCATED' }, conflict: { state: 'CAPACITY_CONFLICT' },
      freshness: 'CURRENT', nextAction: 'Podejmij decyzję o przesunięciu 10 h',
      availabilityRef: { ref: 'calendar-marek-w35', version: 1, knowledgeState: 'KNOWN' },
      calendarRef: { ref: 'calendar-marek-w35', version: 1, knowledgeState: 'KNOWN' },
      remainingEstimateRef: { ref: 'estimate-demand-model', version: 1, knowledgeState: 'KNOWN' },
    },
  ] },
  'review-exec-ai-copilot': { items: [
    {
      version: 1, allocationId: 'alloc-katarzyna-guardrails', status: 'ASSIGNEE_ACCEPTED',
      assigneeId: 'katarzyna-wojcik', assigneeName: 'Katarzyna Wójcik', teamName: 'AI Governance',
      taskId: 'task-copilot-guardrails', initiativeId: 'demo-init-ai-copilot',
      timeBasis: { window: '24–30 sie 2026', windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
      availability: { knowledgeState: 'KNOWN', value: 24 }, demand: { knowledgeState: 'KNOWN', value: 20 },
      remainingDemand: { knowledgeState: 'KNOWN', value: 4 }, load: { low: 0.8, high: 0.9 },
      skillMatch: { state: 'MATCH', label: 'Eksperckie' }, cost: { knowledgeState: 'KNOWN', value: '7 200 PLN' },
      conflict: { state: 'NONE' }, freshness: 'CURRENT', nextAction: 'Potwierdź przydział',
    },
    {
      version: 1, allocationId: 'alloc-unassigned-pilot', status: 'PROPOSED',
      roleName: 'Analityk procesu zakupowego', teamName: 'Procurement',
      taskId: 'task-user-pilot', initiativeId: 'demo-init-ai-copilot',
      timeBasis: { window: '31 sie–6 wrz 2026', windowUnit: 'WEEK', timezone: 'Europe/Warsaw' },
      availability: { knowledgeState: 'UNKNOWN' }, demand: { knowledgeState: 'KNOWN', value: 16 },
      remainingDemand: { knowledgeState: 'UNKNOWN' }, load: { knowledgeState: 'UNKNOWN' },
      skillMatch: { state: 'UNKNOWN', label: 'Do potwierdzenia' }, cost: { knowledgeState: 'UNKNOWN' },
      conflict: { state: 'NOT_ASSESSED' }, freshness: 'UNKNOWN', nextAction: 'Wskaż osobę i potwierdź dostępność',
    },
  ] },
};

export const executionReviewSignals = [
  { signalId: 'signal-demand-model-delay', version: 2, ruleId: 'STALE_MILESTONE', projectId: 'demo-init-ai-copilot', sourceType: 'MILESTONE', sourceId: 'milestone-pilot-ready', sourceVersionKey: 'milestoneVersion', sourceVersion: 1, sourceVersions: { milestoneVersion: 1 }, snapshotRef: 'milestone-pilot-ready@1', fingerprint: 'stale-milestone:pilot-ready', severity: 'CRITICAL', occurrences: [{ evidenceRef: 'evidence-demand-model-blocker', occurredAt: '2026-08-23T08:00:00.000Z' }, { evidenceRef: 'evidence-demand-model-reminder', occurredAt: '2026-08-23T09:00:00.000Z' }, { evidenceRef: 'evidence-demand-model-escalation', occurredAt: '2026-08-23T10:30:00.000Z' }], updatedAt: '2026-08-23T10:30:00.000Z' },
  { signalId: 'signal-marek-overload', version: 1, ruleId: 'CAPACITY_CONFLICT', projectId: 'demo-init-supply-chain', sourceType: 'OPERATIONAL_ALLOCATION', sourceId: 'alloc-marek-demand', sourceVersionKey: 'allocationVersion', sourceVersion: 1, sourceVersions: { allocationVersion: 1 }, snapshotRef: 'alloc-marek-demand@1', fingerprint: 'capacity-conflict:marek-nowak', severity: 'WARNING', occurrences: [{ evidenceRef: 'evidence-capacity-baseline', occurredAt: '2026-08-23T09:15:00.000Z' }], updatedAt: '2026-08-23T09:15:00.000Z' },
];

export const executionReviewInterventions = [
  {
    interventionId: 'intervention-demand-recovery', version: 3, title: 'Plan naprawczy modelu prognozowania',
    status: 'PENDING_DECISION', ownerId: 'omar-haddad', authorityId: 'piotr-wisniewski',
    slaAt: '2026-08-25T12:00:00.000Z', verifyBy: '2026-08-30T12:00:00.000Z',
    hypotheses: ['Brak decyzji o źródle danych blokuje kalibrację modelu'],
    evidenceRefs: ['signal-demand-model-delay@2', 'forecast-source-comparison@1'],
    counterEvidenceRefs: [], unknowns: ['Czy dostawca danych usunie rozbieżność do 25 sierpnia?'],
    blastRadiusRefs: ['task-demand-model', 'milestone-pilot-ready'],
    options: [
      { optionId: 'do-nothing', label: 'Nie zmieniaj planu', impacts: ['Ryzyko opóźnienia pilotażu o 4–7 dni'], confidence: 'HIGH', reversibility: 'HIGH' },
      { optionId: 'parallel-validation', label: 'Równoległa walidacja obu źródeł', impacts: ['Dodatkowe 10 h pracy', 'Skrócenie opóźnienia o 3 dni'], confidence: 'MEDIUM', reversibility: 'HIGH' },
    ], selectedOptionId: 'parallel-validation',
  },
  {
    interventionId: 'intervention-capacity-rebalance', version: 2, title: 'Odciążenie Marka w tygodniu 35',
    status: 'DRAFT', ownerId: 'lena-meyer', authorityId: 'omar-haddad',
    slaAt: '2026-08-26T12:00:00.000Z', verifyBy: '2026-09-02T12:00:00.000Z',
    hypotheses: ['Przeniesienie walidacji danych uwolni 10 h krytycznej pojemności'],
    evidenceRefs: ['signal-marek-overload@1'], counterEvidenceRefs: [], unknowns: ['Dostępność zastępstwa'],
    blastRadiusRefs: ['alloc-marek-demand'], options: [], selectedOptionId: null,
  },
];

export const executionReviewReportDefinitions = [
  {
    definitionId: 'weekly-execution-pack', version: 4, currentVersion: 2, updatedAt: '2026-08-23T11:00:00.000Z',
    versions: [{ definitionVersion: 2, state: 'PUBLISHED', name: 'Weekly Execution Pack', purpose: 'Cotygodniowy przegląd postępu, blokad i decyzji', audience: ['PMO', 'Sponsorzy'], cadence: 'WEEKLY', scope: { type: 'EXECUTION', refs: executionReviewCases.map((item) => item.executionCaseId), projectIds: ['atelier-transformation'], generalBacklogAllowed: false }, ownerId: 'omar-haddad', approverId: 'piotr-wisniewski', access: { classification: 'INTERNAL', audienceRoles: ['SPONSOR', 'PMO'] }, redaction: { defaultState: 'REDACTED', rules: ['personal-cost'] }, freshnessThresholdMinutes: 1440, confidenceThreshold: 'MEDIUM', validationFindings: [] }],
  },
  {
    definitionId: 'capacity-utilization', version: 2, currentVersion: 1, updatedAt: '2026-08-22T15:00:00.000Z',
    versions: [{ definitionVersion: 1, state: 'VALIDATED', name: 'Capacity Utilization Report', purpose: 'Ocena obciążenia i konfliktów zasobowych', audience: ['PMO', 'Liderzy zespołów'], cadence: 'MONTHLY', scope: { type: 'EXECUTION', refs: executionReviewCases.map((item) => item.executionCaseId), projectIds: ['atelier-transformation'], generalBacklogAllowed: false }, ownerId: 'lena-meyer', approverId: 'piotr-wisniewski', access: { classification: 'INTERNAL', audienceRoles: ['PMO'] }, redaction: { defaultState: 'REDACTED', rules: ['personal-cost'] }, freshnessThresholdMinutes: 1440, confidenceThreshold: 'MEDIUM', validationFindings: [] }],
  },
];

export const executionReviewReportRuns = [
  {
    version: 3, reportRunId: 'run-weekly-2026-w34', status: 'APPROVED',
    definitionRef: { definitionId: 'weekly-execution-pack', version: 2 }, parentRunRef: null,
    audience: ['PMO', 'Sponsorzy'], scopeRefs: executionReviewCases.map((item) => item.executionCaseId),
    period: { start: '2026-08-17', end: '2026-08-23' }, asOf: '2026-08-23T11:00:00.000Z', contentHash: 'review-weekly-w34-v3',
    sources: executionReviewCases.map((item) => ({ sourceType: 'execution_case', sourceId: item.executionCaseId, version: item.version, capturedAt: '2026-08-23T11:00:00.000Z', freshness: 'CURRENT', accessState: 'REDACTED', confidence: 'HIGH', redactions: ['personal-cost'] })),
  },
  {
    version: 1, reportRunId: 'run-capacity-2026-08', status: 'FROZEN',
    definitionRef: { definitionId: 'capacity-utilization', version: 1 }, parentRunRef: null,
    audience: ['PMO', 'Liderzy zespołów'], scopeRefs: executionReviewCases.map((item) => item.executionCaseId),
    period: { start: '2026-08-01', end: '2026-08-31' }, asOf: '2026-08-23T10:00:00.000Z', contentHash: 'review-capacity-aug-v1',
    sources: [{ sourceType: 'operational_allocation', sourceId: 'alloc-marek-demand', version: 1, capturedAt: '2026-08-23T10:00:00.000Z', freshness: 'CURRENT', accessState: 'REDACTED', confidence: 'MEDIUM', redactions: ['personal-cost'] }],
  },
];

export const getExecutionReviewCase = (caseId: string) => {
  const item = executionReviewCases.find((entry) => entry.executionCaseId === caseId);
  if (!item) return null;
  return { executionCaseId: item.executionCaseId, version: item.version, detail: { initiativeId: item.initiativeId, state: item.state, handoffPackageId: item.handoffPackageId, handoffPackageVersion: item.handoffPackageVersion } };
};
export const getExecutionReviewWork = (caseId: string) => workByCase[caseId] ?? { tasks: [], decisions: [] };
export const getExecutionReviewMilestones = (caseId: string) => milestonesByCase[caseId] ?? { items: [] };
export const getExecutionReviewAllocations = (caseId: string) => allocationsByCase[caseId] ?? { items: [] };
