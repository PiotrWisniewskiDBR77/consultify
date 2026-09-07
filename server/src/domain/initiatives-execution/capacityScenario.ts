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
/**
 * P15-K5 (DEC-421, §4.2 pkt 1): WYMIAR ROLI w mocy. Do K4 `periods[].demand/.supply`
 * były skalarami na okres, więc „arkusz okres × rola" nie istniał w modelu, a luka
 * jednej roli chowała się w sumie (pomiar 07.09: 12 luk przy 5 zaplanowanych
 * tygodniach). Linie ról są DODATKIEM: skalary zostają i są SUMĄ linii, dzięki
 * czemu `planSolver` i `capacityOptionsAdvisor` liczą jak przedtem, a analizy
 * sprzed K5 (bez `roles`) walidują się bez zmian.
 *
 * `null` znaczy „Nieznane", NIGDY zero — zero to twierdzenie o braku popytu/podaży.
 */
export type RoleSupplySource = 'RESOURCE_PLAN' | 'MANUAL' | 'UNKNOWN';
export type RoleDemandSource = 'PLAN' | 'MANUAL' | 'UNKNOWN';
export interface CapacityRoleLine {
  roleId: string;
  roleLabel: string;
  demand: number | null;
  supply: number | null;
  supplySource: RoleSupplySource;
  demandSource: RoleDemandSource;
}
export interface CapacityPeriod {
  periodId: string;
  start: string;
  end: string;
  demand: CapacityRange;
  supply: CapacityRange;
  roles?: CapacityRoleLine[];
}

/** Suma linii ról: `total` liczy tylko znane wartości, `known` mówi czy jakakolwiek była. */
export function sumRoleLines(
  roles: CapacityRoleLine[] | undefined,
  field: 'demand' | 'supply'
): { total: number | null; contributing: CapacityRoleLine[] } {
  const contributing = (roles ?? []).filter((role) => role[field] !== null);
  if (!contributing.length) return { total: null, contributing: [] };
  const total = contributing.reduce((sum, role) => sum + (role[field] as number), 0);
  return { total: Math.round(total * 1000) / 1000, contributing };
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
  name?: string | null;
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
/**
 * Linie ról muszą być spójne z okresem: unikalna rola, wartości ≥ 0, a skalar okresu
 * = SUMA znanych linii. Bez tej reguły ręczna korekta w arkuszu mogłaby zapisać
 * podaż roli, której nie widzi ani solver, ani doradca (skalary są ich wejściem).
 */
function roleLines(period: CapacityPeriod) {
  if (!period.roles) return;
  const seen = new Set<string>();
  for (const role of period.roles) {
    if (!role.roleId.trim() || !role.roleLabel.trim())
      throw new MaterialCommandValidationError('Capacity role line requires role identity');
    if (seen.has(role.roleId))
      throw new MaterialCommandValidationError('Capacity role must be unique within a period');
    seen.add(role.roleId);
    for (const field of ['demand', 'supply'] as const) {
      const value = role[field];
      if (value !== null && (!Number.isFinite(value) || value < 0))
        throw new MaterialCommandValidationError('Capacity role value must be zero or greater');
    }
    if (role.demand === null && role.demandSource !== 'UNKNOWN')
      throw new MaterialCommandValidationError('Unknown role demand must declare UNKNOWN source');
    if (role.supply === null && role.supplySource !== 'UNKNOWN')
      throw new MaterialCommandValidationError('Unknown role supply must declare UNKNOWN source');
  }
  for (const field of ['demand', 'supply'] as const) {
    const { total } = sumRoleLines(period.roles, field);
    const scalar = period[field].base;
    if (total === null) {
      if (scalar !== null)
        throw new MaterialCommandValidationError(
          'Period scalar must stay UNKNOWN when no role line is known'
        );
      continue;
    }
    if (scalar === null || Math.abs(scalar - total) > 0.001)
      throw new MaterialCommandValidationError('Period scalar must equal the sum of role lines');
  }
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
    roleLines(p);
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
      relationType: 'CAPACITY_SCENARIO_PLAN',
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
