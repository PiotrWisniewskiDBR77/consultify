import type {
  AssessmentOutput,
  EvidenceCompleteness,
  EvidenceLocator,
  Finding,
  OutputLineage,
} from '../types';
import { createAssessmentOutput, type CreateAssessmentOutputInput } from '../assessmentOutput';

export function makeEvidence(overrides: Partial<EvidenceLocator> = {}): EvidenceLocator {
  return {
    evidenceId: overrides.evidenceId ?? `ev-${Math.random().toString(36).slice(2, 8)}`,
    evidenceType: 'document',
    strength: 'E2',
    locator: 'vault://doc/1',
    title: 'Process manual',
    ...overrides,
  };
}

export function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: overrides.id ?? `finding-${Math.random().toString(36).slice(2, 8)}`,
    unitId: 'axis-1.criterion-1',
    unitName: 'Data ownership',
    currentLevel: 2,
    targetLevel: 4,
    gap: 2,
    supportingEvidence: [makeEvidence()],
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

export function makeEvidenceCompleteness(
  overrides: Partial<EvidenceCompleteness> = {}
): EvidenceCompleteness {
  return {
    totalUnits: 10,
    unitsWithAcceptedEvidence: 8,
    unitsMissingEvidence: 2,
    completenessRatio: 0.8,
    ...overrides,
  };
}

export function makeLineage(overrides: Partial<OutputLineage> = {}): OutputLineage {
  return {
    sourceSessionId: 'session-1',
    sourceRevisionOfSessionId: null,
    revisionOfOutputId: null,
    supersededByOutputId: null,
    ...overrides,
  };
}

export function makeOutputInput(
  overrides: Partial<CreateAssessmentOutputInput> = {}
): CreateAssessmentOutputInput {
  const findings = overrides.findings ?? [makeFinding()];
  return {
    id: overrides.id ?? 'output-1',
    organizationId: 'org-1',
    module: 'assessment',
    methodology: { methodPackId: 'drd', version: '1.0.0' },
    scope: 'Full DRD assessment, all seven axes.',
    snapshotId: 'snapshot-1',
    current: { 'axis-1.criterion-1': 2 },
    target: { 'axis-1.criterion-1': 4 },
    gap: { 'axis-1.criterion-1': 2 },
    aggregation: {
      byGroup: { 'axis-1': 2 },
      mappingVersion: '1.0.0',
      rule: 'weighted-mean',
      excluded: {},
    },
    visualModel: { kind: 'matrix', dataRef: { 'axis-1.criterion-1': 2 } },
    evidenceCompleteness: makeEvidenceCompleteness(),
    limitations: ['Only self-reported evidence for axis 4.'],
    findings,
    prioritisationResult: null,
    lineage: makeLineage(),
    version: 1,
    createdAt: '2026-08-13T10:00:00.000Z',
    frozenAt: '2026-08-13T10:00:00.000Z',
    ...overrides,
  };
}

export function makeOutput(overrides: Partial<CreateAssessmentOutputInput> = {}): AssessmentOutput {
  return createAssessmentOutput(makeOutputInput(overrides));
}
