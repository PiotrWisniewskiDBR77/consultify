import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PlanScenario } from './planScenario.js';
export type KnowledgeState = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
export interface CapacityRange {
  knowledgeState: KnowledgeState;
  low: number | null;
  base: number | null;
  high: number | null;
  sourceRef: string | null;
  sourceVersion: number | null;
  asOf: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  ownerId: string;
  reason: string | null;
}
export interface CapacityPeriod {
  periodId: string;
  start: string;
  end: string;
  demand: CapacityRange;
  supply: CapacityRange;
}
export interface ProposedAssignment {
  assignmentId: string;
  initiativeId: string;
  resourceOrRoleId: string;
  periodIds: string[];
  demand: CapacityRange;
  rationale: string;
}
export interface CapacityScenario {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  planScenarioId: string;
  planScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: CapacityPeriod[];
  constraints: Array<{
    constraintId: string;
    state: KnowledgeState;
    detail: string;
    ownerId: string;
  }>;
  proposedAssignments: ProposedAssignment[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
}
type Payload = { operation: 'CREATE' | 'UPDATE' | 'PUBLISH'; scenario: CapacityScenario };
function range(r: CapacityRange) {
  if (!r.ownerId.trim() || !Number.isFinite(Date.parse(r.asOf)))
    throw new MaterialCommandValidationError('Capacity source owner and asOf are required');
  if (r.knowledgeState === 'UNKNOWN') {
    if (r.low !== null || r.base !== null || r.high !== null || !r.reason?.trim())
      throw new MaterialCommandValidationError('UNKNOWN capacity must remain null with reason');
    return;
  }
  if (r.low === null || r.base === null || r.high === null || r.low > r.base || r.base > r.high)
    throw new MaterialCommandValidationError('Capacity range must satisfy low <= base <= high');
  if (!r.sourceRef || !r.sourceVersion)
    throw new MaterialCommandValidationError('Known capacity range requires versioned source');
}
export function validateCapacityScenario(s: CapacityScenario) {
  if (
    !s.windowUnit.trim() ||
    !s.timezone.trim() ||
    !s.planScenarioId.trim() ||
    s.planScenarioVersion < 1
  )
    throw new MaterialCommandValidationError('Plan identity and time basis are required');
  const periodIds = new Set<string>();
  let previousEnd = '';
  for (const p of s.periods) {
    if (
      periodIds.has(p.periodId) ||
      !Number.isFinite(Date.parse(p.start)) ||
      !Number.isFinite(Date.parse(p.end)) ||
      p.start >= p.end ||
      previousEnd > p.start
    )
      throw new MaterialCommandValidationError('Capacity periods are invalid or overlapping');
    periodIds.add(p.periodId);
    previousEnd = p.end;
    range(p.demand);
    range(p.supply);
  }
  for (const a of s.proposedAssignments) {
    if (!a.rationale.trim() || a.periodIds.some((p) => !periodIds.has(p)))
      throw new MaterialCommandValidationError('Proposed assignment references an invalid period');
    range(a.demand);
  }
}
export async function mutateCapacityScenario(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Payload>
): Promise<MaterialCommandResult<CapacityScenario>> {
  if (
    envelope.commandType !== 'capacity.scenario.mutate' ||
    envelope.aggregateType !== 'capacity_scenario'
  )
    throw new MaterialCommandValidationError('Invalid Capacity Scenario command');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const existing = await tx.getAggregatePayload<CapacityScenario>(
      envelope.organizationId,
      'capacity_scenario',
      envelope.aggregateId
    );
    const op = envelope.payload.operation;
    if (op === 'CREATE' && existing)
      throw new MaterialCommandValidationError('Capacity Scenario exists');
    if (op !== 'CREATE' && !existing)
      throw new MaterialCommandValidationError('Capacity Scenario not found');
    if (op === 'PUBLISH' && existing?.status !== 'DRAFT')
      throw new MaterialCommandValidationError('Only DRAFT Capacity Scenario may publish');
    const input = envelope.payload.scenario;
    validateCapacityScenario(input);
    const plan = await tx.getRelatedAggregateForUpdate<PlanScenario>(
      envelope.organizationId,
      'plan_scenario',
      input.planScenarioId
    );
    if (
      !plan ||
      plan.payload.status !== 'PUBLISHED' ||
      plan.payload.scenarioVersion !== input.planScenarioVersion
    ) {
      if (op === 'PUBLISH')
        throw new MaterialCommandConflictError(
          'Published Plan Scenario snapshot is stale',
          envelope.expectedVersion,
          envelope.expectedVersion
        );
      throw new MaterialCommandValidationError('Exact published Plan Scenario not found');
    }
    const planBasis = plan.payload;
    if (!planBasis.windowUnit || !planBasis.timezone || !Array.isArray(planBasis.periods))
      throw new MaterialCommandValidationError('Published Plan lacks canonical time basis');
    const capacityPeriods = input.periods.map(({ periodId, start, end }) => ({
      periodId,
      start,
      end,
    }));
    const samePeriods =
      Array.isArray(planBasis.periods) &&
      planBasis.periods.length === capacityPeriods.length &&
      planBasis.periods.every(
        (period, index) =>
          period.periodId === capacityPeriods[index].periodId &&
          period.start === capacityPeriods[index].start &&
          period.end === capacityPeriods[index].end
      );
    if (
      planBasis.windowUnit !== input.windowUnit ||
      planBasis.timezone !== input.timezone ||
      !samePeriods
    )
      throw new MaterialCommandValidationError(
        'Capacity windowUnit, timezone and periods must exactly match the published Plan'
      );
    const v = (existing?.scenarioVersion ?? 0) + 1;
    const next: CapacityScenario = {
      ...input,
      scenarioId: envelope.aggregateId,
      scenarioVersion: v,
      status: op === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT',
      createdBy: existing?.createdBy ?? envelope.actorId,
      updatedBy: envelope.actorId,
      publishedBy: op === 'PUBLISH' ? envelope.actorId : null,
      publishedAt: op === 'PUBLISH' ? new Date().toISOString() : null,
    };
    if (existing) {
      const pid = `${envelope.aggregateId}:v${existing.scenarioVersion}`;
      const previous = await tx.getRelatedAggregateForUpdate<CapacityScenario>(
        envelope.organizationId,
        'capacity_scenario_version',
        pid
      );
      if (!previous || previous.version !== 1)
        throw new MaterialCommandValidationError('Previous Capacity version missing');
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'capacity_scenario_version',
        pid,
        1,
        2,
        { ...previous.payload, status: 'SUPERSEDED' }
      );
    }
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'capacity_scenario_version',
      `${envelope.aggregateId}:v${v}`,
      0,
      1,
      next
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `CAPACITY_SCENARIO_PLAN:${v}`,
      sourceType: 'capacity_scenario',
      sourceId: envelope.aggregateId,
      sourceVersion: v,
      targetType: 'plan_scenario_version',
      targetId: `${next.planScenarioId}:v${next.planScenarioVersion}`,
      payload: { windowUnit: next.windowUnit, timezone: next.timezone, status: next.status },
    });
    return {
      mutation: next,
      response: next,
      eventType: `capacity.scenario.${op.toLowerCase()}`,
      eventPayload: { scenarioId: next.scenarioId, scenarioVersion: v, status: next.status },
      auditPayload: next,
    };
  });
}
