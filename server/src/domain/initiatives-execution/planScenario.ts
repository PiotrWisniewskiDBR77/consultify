import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import type { PortfolioScenario } from './portfolioScenario.js';

export interface PlannedWindow {
  initiativeId: string;
  initiativeVersion: number;
  earliest: string | null;
  target: string | null;
  latest: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  rationale: string;
  dependencySnapshot: string[];
  constraintSnapshot: Array<{ constraintId: string; state: 'KNOWN' | 'UNKNOWN'; detail: string }>;
}
export interface PlanScenario {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  portfolioScenarioId: string;
  portfolioScenarioVersion: number;
  windowUnit: string;
  timezone: string;
  periods: Array<{ periodId: string; start: string; end: string }>;
  windows: PlannedWindow[];
  assumptions: string[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
}
type Payload = { operation: 'CREATE' | 'UPDATE' | 'PUBLISH'; scenario: PlanScenario };
const date = (v: string | null) => (v === null ? null : Date.parse(v));
export function validatePlanScenario(s: PlanScenario) {
  if (!s.scenarioId.trim() || !s.portfolioScenarioId.trim() || s.portfolioScenarioVersion < 1)
    throw new MaterialCommandValidationError('Plan and Portfolio Scenario identity are required');
  if (!s.windowUnit.trim() || !s.timezone.trim() || !s.periods.length)
    throw new MaterialCommandValidationError('Plan time basis is required');
  const periodIds = new Set<string>();
  let previousEnd: string | null = null;
  for (const period of s.periods) {
    if (
      !period.periodId.trim() ||
      periodIds.has(period.periodId) ||
      !Number.isFinite(Date.parse(period.start)) ||
      !Number.isFinite(Date.parse(period.end)) ||
      period.start >= period.end ||
      (previousEnd !== null && previousEnd > period.start)
    )
      throw new MaterialCommandValidationError('Plan periods are invalid or overlapping');
    periodIds.add(period.periodId);
    previousEnd = period.end;
  }
  if (new Set(s.windows.map((w) => w.initiativeId)).size !== s.windows.length)
    throw new MaterialCommandValidationError('Planned Initiative membership must be unique');
  const ids = new Set(s.windows.map((w) => w.initiativeId));
  const edges = new Map(
    s.windows.map((w) => [w.initiativeId, w.dependencySnapshot.filter((d) => ids.has(d))])
  );
  for (const w of s.windows) {
    const values = [date(w.earliest), date(w.target), date(w.latest)];
    if (values.some((v) => v !== null && !Number.isFinite(v)))
      throw new MaterialCommandValidationError('Planned window contains an invalid date');
    const [a, b, c] = values;
    if (
      (a !== null && b !== null && a > b) ||
      (b !== null && c !== null && b > c) ||
      (a !== null && c !== null && a > c)
    )
      throw new MaterialCommandValidationError(
        'Planned window must satisfy earliest <= target <= latest'
      );
    if (!w.rationale.trim())
      throw new MaterialCommandValidationError('Window rationale is required');
    const horizonStart = Date.parse(s.periods[0].start);
    const horizonEnd = Date.parse(s.periods[s.periods.length - 1].end);
    if (values.some((value) => value !== null && (value < horizonStart || value > horizonEnd)))
      throw new MaterialCommandValidationError('Planned window falls outside Plan periods');
  }
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    for (const d of edges.get(id) ?? []) if (visit(d)) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  };
  if ([...ids].some(visit))
    throw new MaterialCommandValidationError('Plan dependency cycle detected');
}
export function diffPlanScenarios(from: PlanScenario, to: PlanScenario) {
  const a = new Map(from.windows.map((w) => [w.initiativeId, w]));
  const b = new Map(to.windows.map((w) => [w.initiativeId, w]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .flatMap((id) =>
      JSON.stringify(a.get(id)) === JSON.stringify(b.get(id))
        ? []
        : [{ initiativeId: id, before: a.get(id) ?? null, after: b.get(id) ?? null }]
    );
}
export async function mutatePlanScenario(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Payload>
): Promise<MaterialCommandResult<PlanScenario>> {
  if (envelope.commandType !== 'plan.scenario.mutate' || envelope.aggregateType !== 'plan_scenario')
    throw new MaterialCommandValidationError('Invalid Plan Scenario command');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const existing = await tx.getAggregatePayload<PlanScenario>(
      envelope.organizationId,
      'plan_scenario',
      envelope.aggregateId
    );
    const op = envelope.payload.operation;
    if (op === 'CREATE' && existing)
      throw new MaterialCommandValidationError('Plan Scenario already exists');
    if (op !== 'CREATE' && !existing)
      throw new MaterialCommandValidationError('Plan Scenario not found');
    if (op === 'PUBLISH' && existing?.status !== 'DRAFT')
      throw new MaterialCommandValidationError('Only a DRAFT Plan Scenario can be published');
    const input = envelope.payload.scenario;
    validatePlanScenario(input);
    const portfolio = await tx.getRelatedAggregateForUpdate<PortfolioScenario>(
      envelope.organizationId,
      'portfolio_scenario',
      input.portfolioScenarioId
    );
    if (
      !portfolio ||
      portfolio.payload.status !== 'PUBLISHED' ||
      portfolio.payload.scenarioVersion !== input.portfolioScenarioVersion
    ) {
      if (op === 'PUBLISH')
        throw new MaterialCommandConflictError(
          'Published Portfolio Scenario snapshot is stale',
          envelope.expectedVersion,
          envelope.expectedVersion
        );
      throw new MaterialCommandValidationError('Exact published Portfolio Scenario not found');
    }
    const eligible = new Set(
      portfolio.payload.memberships
        .filter((m) => m.disposition === 'INCLUDED' || m.disposition === 'CONDITIONAL')
        .map((m) => m.initiativeId)
    );
    for (const w of input.windows) {
      if (!eligible.has(w.initiativeId))
        throw new MaterialCommandValidationError(
          'Plan membership is not approved by Portfolio Scenario'
        );
      const initiative = await tx.getRelatedAggregateForUpdate<{ lifecycleState: string }>(
        envelope.organizationId,
        'initiative',
        w.initiativeId
      );
      if (
        !initiative ||
        initiative.payload.lifecycleState !== 'APPROVED_BACKLOG' ||
        initiative.version !== w.initiativeVersion
      )
        throw new MaterialCommandValidationError(
          'Only exact APPROVED_BACKLOG Initiative snapshots may be planned'
        );
    }
    const v = (existing?.scenarioVersion ?? 0) + 1;
    const next: PlanScenario = {
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
      const previousId = `${envelope.aggregateId}:v${existing.scenarioVersion}`;
      const previous = await tx.getRelatedAggregateForUpdate<PlanScenario>(
        envelope.organizationId,
        'plan_scenario_version',
        previousId
      );
      if (!previous || previous.version !== 1)
        throw new MaterialCommandValidationError('Previous Plan version not found');
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'plan_scenario_version',
        previousId,
        1,
        2,
        { ...previous.payload, status: 'SUPERSEDED' }
      );
    }
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'plan_scenario_version',
      `${envelope.aggregateId}:v${v}`,
      0,
      1,
      next
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `PLAN_SCENARIO_PORTFOLIO:${v}`,
      sourceType: 'plan_scenario',
      sourceId: envelope.aggregateId,
      sourceVersion: v,
      targetType: 'portfolio_scenario_version',
      targetId: `${next.portfolioScenarioId}:v${next.portfolioScenarioVersion}`,
      payload: { status: next.status },
    });
    for (const w of next.windows)
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `PLAN_SCENARIO_MEMBER:${v}:${w.initiativeId}`,
        sourceType: 'plan_scenario',
        sourceId: envelope.aggregateId,
        sourceVersion: v,
        targetType: 'initiative',
        targetId: w.initiativeId,
        payload: {
          window: { earliest: w.earliest, target: w.target, latest: w.latest },
          confidence: w.confidence,
        },
      });
    return {
      mutation: next,
      response: next,
      eventType: `plan.scenario.${op.toLowerCase()}`,
      eventPayload: {
        scenarioId: next.scenarioId,
        scenarioVersion: v,
        status: next.status,
        portfolioScenarioId: next.portfolioScenarioId,
        portfolioScenarioVersion: next.portfolioScenarioVersion,
        windowUnit: next.windowUnit,
        timezone: next.timezone,
        periods: next.periods,
      },
      auditPayload: next,
    };
  });
}
