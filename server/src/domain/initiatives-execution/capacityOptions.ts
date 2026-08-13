import type { CapacityScenario } from './capacityScenario.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PlanScenario } from './planScenario.js';
type Knowledge = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
type Range = {
  low: number | null;
  base: number | null;
  high: number | null;
  unit: string;
  knowledgeState: Knowledge;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  sourceRefs: Array<{ ref: string; version: number }>;
};
export interface CapacityOption {
  optionId: string;
  kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY';
  assumptions: Array<{
    assumption: string;
    ownerId: string;
    sourceRef: { ref: string; version: number };
    knowledgeState: Knowledge;
  }>;
  affectedMemberships: Array<{ initiativeId: string; membershipVersion: number }>;
  affectedPeriods: string[];
  affectedResources: Array<{ resourceRef: string; version: number }>;
  impact: { date: Range; scope: Range; cost: Range; risk: Range };
  rationale: string;
}
export interface CapacityOptionsComparison {
  comparisonId: string;
  planRef: { scenarioId: string; version: number };
  capacityRef: { scenarioId: string; version: number };
  status: 'DRAFT' | 'SELECTED';
  options: CapacityOption[];
  selectedOptionId: string | null;
  nextGovernedInput: {
    kind: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';
    optionId: string;
    comparisonId: string;
    comparisonVersion: number;
  } | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export const hasPublishedScenarioStatus = (
  scenario: Pick<PlanScenario, 'status'> | Pick<CapacityScenario, 'status'>
) => scenario.status === 'PUBLISHED';
export function capacityOptionFindings(o: CapacityOption) {
  const f: string[] = [];
  for (const [name, r] of Object.entries(o.impact)) {
    if (r.knowledgeState === 'UNKNOWN' || r.knowledgeState === 'UNCONFIRMED') {
      if (r.low !== null || r.base !== null || r.high !== null)
        f.push(`${name.toUpperCase()}_UNKNOWN_MUST_NOT_HAVE_NUMERIC_ZERO_OR_VALUES`);
    } else if (
      r.low === null ||
      r.base === null ||
      r.high === null ||
      r.low > r.base ||
      r.base > r.high
    )
      f.push(`${name.toUpperCase()}_RANGE_INVALID`);
  }
  if (o.assumptions.some((a) => !a.ownerId || !a.sourceRef.ref || !a.sourceRef.version))
    f.push('ASSUMPTION_LINEAGE_MISSING');
  return f;
}
export async function createCapacityOptions(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    planRef: CapacityOptionsComparison['planRef'];
    capacityRef: CapacityOptionsComparison['capacityRef'];
    options: CapacityOption[];
  }>
): Promise<MaterialCommandResult<CapacityOptionsComparison>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload,
      plan = await tx.getRelatedAggregateForUpdate<PlanScenario>(
        envelope.organizationId,
        'plan_scenario',
        p.planRef.scenarioId
      ),
      capacity = await tx.getRelatedAggregateForUpdate<CapacityScenario>(
        envelope.organizationId,
        'capacity_scenario',
        p.capacityRef.scenarioId
      );
    if (
      !plan ||
      plan.version !== p.planRef.version ||
      !hasPublishedScenarioStatus(plan.payload) ||
      !capacity ||
      capacity.version !== p.capacityRef.version ||
      !hasPublishedScenarioStatus(capacity.payload) ||
      capacity.payload.planScenarioId !== p.planRef.scenarioId ||
      capacity.payload.planScenarioVersion !== p.planRef.version
    )
      throw new MaterialCommandValidationError(
        'Exact published Plan and Capacity scenarios required'
      );
    const kinds = p.options.map((o) => o.kind).sort();
    if (
      p.options.length !== 3 ||
      kinds.join(',') !== 'ADD_CAPACITY,RESEQUENCE,SCOPE_SPLIT' ||
      new Set(p.options.map((o) => o.optionId)).size !== 3
    )
      throw new MaterialCommandValidationError(
        'Exactly three distinct canonical capacity options required'
      );
    const findings = p.options.flatMap((o) => capacityOptionFindings(o));
    if (findings.length)
      throw new MaterialCommandValidationError(`Capacity option invalid: ${findings.join(',')}`);
    const now = new Date().toISOString(),
      v: CapacityOptionsComparison = {
        comparisonId: envelope.aggregateId,
        planRef: p.planRef,
        capacityRef: p.capacityRef,
        status: 'DRAFT',
        options: p.options,
        selectedOptionId: null,
        nextGovernedInput: null,
        createdBy: envelope.actorId,
        createdAt: now,
        updatedAt: now,
      };
    return {
      mutation: v,
      response: v,
      eventType: 'capacity-options.created',
      eventPayload: v,
      auditPayload: v,
    };
  });
}
export async function selectCapacityOption(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    optionId: string;
    nextKind: 'MATERIAL_CHANGE' | 'SCHEDULE_DECISION';
  }>
): Promise<MaterialCommandResult<CapacityOptionsComparison>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<CapacityOptionsComparison>(
      envelope.organizationId,
      'capacity_options',
      envelope.aggregateId
    );
    if (
      !c ||
      c.status !== 'DRAFT' ||
      !c.options.some((o) => o.optionId === envelope.payload.optionId)
    )
      throw new MaterialCommandValidationError('Draft comparison and valid option required');
    const plan = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'plan_scenario',
        c.planRef.scenarioId
      ),
      capacity = await tx.getRelatedAggregateForUpdate<any>(
        envelope.organizationId,
        'capacity_scenario',
        c.capacityRef.scenarioId
      );
    if (
      !plan ||
      plan.version !== c.planRef.version ||
      !capacity ||
      capacity.version !== c.capacityRef.version
    )
      throw new MaterialCommandValidationError('Scenario snapshots became stale');
    const next = {
      ...c,
      status: 'SELECTED' as const,
      selectedOptionId: envelope.payload.optionId,
      nextGovernedInput: {
        kind: envelope.payload.nextKind,
        optionId: envelope.payload.optionId,
        comparisonId: c.comparisonId,
        comparisonVersion: envelope.expectedVersion + 1,
      },
      updatedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: 'capacity-options.selected-draft-input',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
