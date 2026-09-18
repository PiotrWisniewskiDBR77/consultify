/** DEC-485. Pure read model: never writes a plan, grants authority, or computes a second score. */
export type WorkRiskScope = { organizationId: string; projectId: string };
export type WorkRiskObservation = WorkRiskScope & {
  sourceType: 'task' | 'initiative' | 'milestone' | 'report' | 'manager_action' | 'delay_signal';
  sourceId: string;
  initiativeId: string | null;
  workState: 'planned' | 'active' | 'blocked' | 'done' | 'cancelled';
  baselineImpact: 'task' | 'within_initiative' | 'approved_baseline' | 'unknown';
  measuredLevel: 0 | 1 | 2 | 3 | null;
  reasonCode: string | null;
  observedAt: string | null;
  evidenceRef: string | null;
  generatedBy: 'system' | 'manager' | 'ai';
  acceptedByUserId?: string | null;
};
export type WorkRiskRecord = WorkRiskObservation & {
  riskState: 'none' | 'watch' | 'amber' | 'red' | 'UNKNOWN';
  decisionLevel: 1 | 2 | 3 | null;
  requiresHumanReview: boolean;
  missingEvidence: string[];
};
function assertScope(scope: WorkRiskScope) {
  if (!scope.organizationId?.trim() || !scope.projectId?.trim()) {
    throw new Error('WORK_RISK_SCOPE_REQUIRED');
  }
}
export function classifyWorkRisk(scope: WorkRiskScope, input: WorkRiskObservation): WorkRiskRecord {
  assertScope(scope);
  assertScope(input);
  if (scope.organizationId !== input.organizationId || scope.projectId !== input.projectId) {
    throw new Error('WORK_RISK_SCOPE_MISMATCH');
  }
  if (!input.sourceId?.trim()) throw new Error('WORK_RISK_SOURCE_REQUIRED');
  const missingEvidence: string[] = [];
  if (input.measuredLevel == null || ![0, 1, 2, 3].includes(input.measuredLevel))
    missingEvidence.push('measured_level');
  if (!input.observedAt || !Number.isFinite(Date.parse(input.observedAt)))
    missingEvidence.push('observed_at');
  if (!input.evidenceRef?.trim()) missingEvidence.push('evidence_ref');
  if (!input.reasonCode?.trim()) missingEvidence.push('reason_code');
  const requiresHumanReview = input.generatedBy === 'ai' && !input.acceptedByUserId?.trim();
  if (requiresHumanReview) missingEvidence.push('human_review');
  const decisionLevel =
    ({ task: 1, within_initiative: 2, approved_baseline: 3 } as const)[
      input.baselineImpact as 'task' | 'within_initiative' | 'approved_baseline'
    ] ?? null;
  return {
    ...input,
    riskState: missingEvidence.length
      ? 'UNKNOWN'
      : (['none', 'watch', 'amber', 'red'] as const)[input.measuredLevel!],
    decisionLevel,
    requiresHumanReview,
    missingEvidence,
  };
}
export function buildWorkRiskReadModel(
  scope: WorkRiskScope,
  observations: readonly WorkRiskObservation[]
) {
  assertScope(scope);
  // Filter before classifying: foreign entities cannot leak through output or trace.
  const records = observations
    .filter(
      (row) => row.organizationId === scope.organizationId && row.projectId === scope.projectId
    )
    .map((row) => classifyWorkRisk(scope, row));
  return {
    ...scope,
    total: records.length,
    measured: records.filter((row) => row.riskState !== 'UNKNOWN').length,
    records,
  };
}
