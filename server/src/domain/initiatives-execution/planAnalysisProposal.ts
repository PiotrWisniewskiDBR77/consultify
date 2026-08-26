import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PlannedWindow, PlanScenario } from './planScenario.js';
import { solvePlanScenario } from './planSolver.js';

export interface PlanAnalysisProposal {
  proposalId: string;
  scenarioId: string;
  inputAggregateVersion: number;
  inputScenarioVersion: number;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
  assumptions: string[];
  rationale: string;
  conflicts: string[];
  changes: Array<{ initiativeId: string; before: PlannedWindow; after: PlannedWindow }>;
  requestedBy: string;
  reviewedBy: string | null;
  reviewRationale: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function createPlanAnalysisProposal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ scenarioId: string; inputAggregateVersion: number }>
): Promise<MaterialCommandResult<PlanAnalysisProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const source = await tx.getRelatedAggregateForUpdate<PlanScenario>(
      envelope.organizationId,
      'plan_scenario',
      envelope.payload.scenarioId
    );
    if (!source || source.version !== envelope.payload.inputAggregateVersion)
      throw new MaterialCommandValidationError('Exact Plan Scenario input version required');
    if (source.payload.status !== 'DRAFT')
      throw new MaterialCommandValidationError('Analysis proposals may target only a DRAFT Plan');
    const solved = solvePlanScenario(source.payload);
    const changes = solved.assignments.flatMap(({ window, periodId, rationale }) => {
      const period = source.payload.periods.find((candidate) => candidate.periodId === periodId);
      if (!period) return [];
      const withinPeriod = (value: string | null) =>
        value !== null && value >= period.start && value <= period.end;
      const after: PlannedWindow = {
        ...window,
        earliest:
          window.earliest && window.earliest > period.start ? window.earliest : period.start,
        target: withinPeriod(window.target) ? window.target : period.start,
        latest: window.latest && window.latest < period.end ? window.latest : period.end,
        confidence: solved.conflicts.some((item) => item.includes(window.initiativeId))
          ? 'LOW'
          : window.confidence === 'UNKNOWN'
            ? 'MEDIUM'
            : window.confidence,
        rationale: `${rationale} Human validation required. ${window.rationale}`,
      };
      return JSON.stringify(after) === JSON.stringify(window)
        ? []
        : [{ initiativeId: window.initiativeId, before: window, after }];
    });
    const now = new Date().toISOString();
    const proposal: PlanAnalysisProposal = {
      proposalId: envelope.aggregateId,
      scenarioId: source.payload.scenarioId,
      inputAggregateVersion: source.version,
      inputScenarioVersion: source.payload.scenarioVersion,
      status: 'PENDING_REVIEW',
      assumptions: [
        'Dependencies precede dependent initiatives.',
        'A deterministic solver selects one feasible target period per initiative.',
        ...solved.assumptions,
        ...source.payload.assumptions,
      ],
      rationale: 'Canonical deterministic plan analysis. No Plan or Initiative date was changed.',
      conflicts: solved.conflicts,
      changes,
      requestedBy: envelope.actorId,
      reviewedBy: null,
      reviewRationale: null,
      createdAt: now,
      reviewedAt: null,
    };
    return {
      mutation: proposal,
      response: proposal,
      eventType: 'plan-analysis.proposed',
      eventPayload: proposal,
      auditPayload: proposal,
    };
  });
}

export async function reviewPlanAnalysisProposal(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ outcome: 'ACCEPT' | 'REJECT'; rationale: string }>
): Promise<MaterialCommandResult<PlanAnalysisProposal>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const current = await tx.getAggregatePayload<PlanAnalysisProposal>(
      envelope.organizationId,
      'plan_analysis_proposal',
      envelope.aggregateId
    );
    if (!current || current.status !== 'PENDING_REVIEW')
      throw new MaterialCommandValidationError('Pending Plan analysis proposal required');
    if (!envelope.payload.rationale.trim())
      throw new MaterialCommandValidationError('Human review rationale required');
    const next: PlanAnalysisProposal = {
      ...current,
      status: envelope.payload.outcome === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      reviewedBy: envelope.actorId,
      reviewRationale: envelope.payload.rationale,
      reviewedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: `plan-analysis.${next.status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
