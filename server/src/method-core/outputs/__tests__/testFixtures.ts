import type { FreezeOutputInput, OutputFindingInput } from '../MethodOutputService.js';

export function makeFindingInput(overrides: Partial<OutputFindingInput> = {}): OutputFindingInput {
  return {
    unitId: 'axis-1.criterion-1',
    unitName: 'Data ownership',
    currentLevel: 2,
    targetLevel: 4,
    gap: 2,
    supportingEvidence: [
      { evidenceId: 'ev-1', evidenceType: 'document', strength: 'E2', locator: 'vault://doc/1' },
    ],
    contradictingEvidence: [],
    businessMeaning: 'Data ownership is unclear across teams.',
    rootCauseHypothesis: 'No accountable owner assigned per data domain.',
    riskOrOpportunity: 'Decisions stall waiting for data clarification.',
    recommendation: 'Assign a data owner per domain.',
    prerequisite: null,
    expectedOutcome: 'Faster decision cycles once ownership is assigned.',
    kpiProposal: null,
    confidence: 'medium',
    priorityRationale: 'Blocks three downstream initiatives.',
    sourceLocators: ['question:q-1', 'answer:a-1'],
    ...overrides,
  };
}

export function makeFreezeInput(overrides: Partial<FreezeOutputInput> = {}): FreezeOutputInput {
  return {
    organizationId: 'org-1',
    sessionId: 'session-1',
    snapshotId: 'snapshot-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '1.0.0',
    scope: 'Full DRD assessment, all seven axes.',
    current: { 'axis-1.criterion-1': 2 },
    target: { 'axis-1.criterion-1': 4 },
    gap: { 'axis-1.criterion-1': 2 },
    aggregation: { byGroup: { 'axis-1': 2 }, mappingVersion: '1.0.0', rule: 'weighted-mean', excluded: {} },
    visualModel: { kind: 'matrix', dataRef: {} },
    evidenceCompleteness: { totalUnits: 10, unitsWithAcceptedEvidence: 8, unitsMissingEvidence: 2, completenessRatio: 0.8 },
    limitations: ['Only self-reported evidence for axis 4.'],
    findings: [makeFindingInput()],
    prioritisationResult: null,
    revisionOfOutputId: null,
    sourceRevisionOfSessionId: null,
    ...overrides,
  };
}
