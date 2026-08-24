import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PlannedWindow, PlanScenario } from './planScenario.js';

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

const periodFor = (scenario: PlanScenario, index: number) =>
  scenario.periods[Math.min(index, scenario.periods.length - 1)];

function dependencyOrder(windows: PlannedWindow[]) {
  const byId = new Map(windows.map((window) => [window.initiativeId, window]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: PlannedWindow[] = [];
  const conflicts: string[] = [];
  const visit = (window: PlannedWindow) => {
    if (visited.has(window.initiativeId)) return;
    if (visiting.has(window.initiativeId)) {
      conflicts.push(`Dependency cycle: ${window.initiativeId}`);
      return;
    }
    visiting.add(window.initiativeId);
    for (const dependency of window.dependencySnapshot) {
      const source = byId.get(dependency);
      if (source) visit(source);
      else conflicts.push(`Missing dependency in plan: ${window.initiativeId} -> ${dependency}`);
    }
    visiting.delete(window.initiativeId);
    visited.add(window.initiativeId);
    ordered.push(window);
  };
  windows.forEach(visit);
  return { ordered, conflicts: [...new Set(conflicts)] };
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
    const { ordered, conflicts } = dependencyOrder(source.payload.windows);
    const changes = ordered.flatMap((window, index) => {
      const period = periodFor(source.payload, index);
      if (!period) return [];
      const after: PlannedWindow = {
        ...window,
        earliest: period.start,
        target: period.start,
        latest: period.end,
        confidence: conflicts.some((item) => item.includes(window.initiativeId))
          ? 'LOW'
          : window.confidence === 'UNKNOWN'
            ? 'MEDIUM'
            : window.confidence,
        rationale: `Dependency-aware proposal; human validation required. ${window.rationale}`,
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
        'One proposed target period per initiative; capacity is not inferred.',
        ...source.payload.assumptions,
      ],
      rationale: 'Canonical dependency-order analysis. No Plan or Initiative date was changed.',
      conflicts,
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
