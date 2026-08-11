import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type TriState<T> =
  | { state: 'KNOWN' | 'ESTIMATED'; value: T; basis: string }
  | { state: 'UNKNOWN'; value: null; reason: string };
export type MembershipDisposition = 'INCLUDED' | 'CONDITIONAL' | 'DEFERRED' | 'EXCLUDED';
export interface PortfolioMembership {
  initiativeId: string;
  initiativeVersion: number;
  disposition: MembershipDisposition;
  scoreDecomposition: Record<string, number | null>;
  rank: number | null;
  rankOverride: null | {
    actorId: string;
    reason: string;
    previousRank: number | null;
    newRank: number;
  };
  coverage: TriState<number>;
  overlap: TriState<string[]>;
  roughDemand: TriState<{ unit: string; low: number; base: number; high: number }>;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  rationale: string;
}
export interface PortfolioScenario {
  scenarioId: string;
  scenarioVersion: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scope: { portfolioId: string; goalIds: string[]; asOf: string };
  model: { modelId: string; version: number };
  memberships: PortfolioMembership[];
  decompositionKeys: string[];
  createdBy: string;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  previousPublishedVersion: number | null;
}
type ScenarioPayload = { operation: 'CREATE' | 'UPDATE' | 'PUBLISH'; scenario: PortfolioScenario };

function validate(s: PortfolioScenario, actor: string) {
  if (
    !s.scenarioId.trim() ||
    !s.scope.portfolioId.trim() ||
    !s.model.modelId.trim() ||
    s.model.version < 1
  )
    throw new MaterialCommandValidationError(
      'Scenario identity, scope and model version are required'
    );
  if (new Set(s.memberships.map((m) => m.initiativeId)).size !== s.memberships.length)
    throw new MaterialCommandValidationError('Initiative membership must be unique');
  const ranks = s.memberships.map((m) => m.rank).filter((r): r is number => r !== null);
  if (new Set(ranks).size !== ranks.length)
    throw new MaterialCommandValidationError('Ranks must be unique');
  for (const m of s.memberships) {
    if (m.initiativeVersion < 1 || !m.rationale.trim())
      throw new MaterialCommandValidationError('Membership snapshot and rationale are required');
    if (m.rankOverride && (!m.rankOverride.reason.trim() || m.rankOverride.actorId !== actor))
      throw new MaterialCommandValidationError(
        'Rank override requires current actor and rationale'
      );
    if (
      m.roughDemand.state !== 'UNKNOWN' &&
      !(
        m.roughDemand.value.low <= m.roughDemand.value.base &&
        m.roughDemand.value.base <= m.roughDemand.value.high
      )
    )
      throw new MaterialCommandValidationError('Rough demand must satisfy low <= base <= high');
  }
}
export async function mutatePortfolioScenario(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ScenarioPayload>
): Promise<MaterialCommandResult<PortfolioScenario>> {
  if (
    envelope.commandType !== 'portfolio.scenario.mutate' ||
    envelope.aggregateType !== 'portfolio_scenario'
  )
    throw new MaterialCommandValidationError('Invalid Portfolio Scenario command');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const existing = await tx.getAggregatePayload<PortfolioScenario>(
      envelope.organizationId,
      'portfolio_scenario',
      envelope.aggregateId
    );
    const { operation } = envelope.payload;
    if (operation === 'CREATE' && existing)
      throw new MaterialCommandValidationError('Scenario already exists');
    if (operation !== 'CREATE' && !existing)
      throw new MaterialCommandValidationError('Scenario not found');
    if (operation === 'PUBLISH' && existing?.status !== 'DRAFT')
      throw new MaterialCommandValidationError('Only a DRAFT scenario can be published');
    const nextVersion = (existing?.scenarioVersion ?? 0) + 1;
    const input = envelope.payload.scenario;
    const next: PortfolioScenario = {
      ...input,
      scenarioId: envelope.aggregateId,
      scenarioVersion: nextVersion,
      status: operation === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT',
      createdBy: existing?.createdBy ?? envelope.actorId,
      updatedBy: envelope.actorId,
      publishedBy: operation === 'PUBLISH' ? envelope.actorId : null,
      publishedAt: operation === 'PUBLISH' ? new Date().toISOString() : null,
      previousPublishedVersion:
        existing?.status === 'PUBLISHED'
          ? existing.scenarioVersion
          : (existing?.previousPublishedVersion ?? null),
    };
    validate(next, envelope.actorId);
    if (existing) {
      const previousId = `${envelope.aggregateId}:v${existing.scenarioVersion}`;
      const previous = await tx.getRelatedAggregateForUpdate<PortfolioScenario>(
        envelope.organizationId,
        'portfolio_scenario_version',
        previousId
      );
      if (!previous || previous.version !== 1)
        throw new MaterialCommandValidationError('Previous Scenario version not found');
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'portfolio_scenario_version',
        previousId,
        1,
        2,
        { ...previous.payload, status: 'SUPERSEDED' }
      );
    }
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'portfolio_scenario_version',
      `${envelope.aggregateId}:v${nextVersion}`,
      0,
      1,
      next
    );
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `PORTFOLIO_SCENARIO_VERSION:${nextVersion}`,
      sourceType: 'portfolio_scenario',
      sourceId: envelope.aggregateId,
      sourceVersion: nextVersion,
      targetType: 'portfolio_scenario_version',
      targetId: `${envelope.aggregateId}:v${nextVersion}`,
      payload: { status: next.status },
    });
    for (const membership of next.memberships)
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `PORTFOLIO_SCENARIO_MEMBER:${nextVersion}:${membership.initiativeId}`,
        sourceType: 'portfolio_scenario',
        sourceId: envelope.aggregateId,
        sourceVersion: nextVersion,
        targetType: 'initiative',
        targetId: membership.initiativeId,
        payload: { disposition: membership.disposition, rank: membership.rank },
      });
    return {
      mutation: next,
      response: next,
      eventType: `portfolio.scenario.${operation.toLowerCase()}`,
      eventPayload: {
        scenarioId: next.scenarioId,
        scenarioVersion: nextVersion,
        status: next.status,
      },
      auditPayload: next,
    };
  });
}

export function diffPortfolioScenarios(from: PortfolioScenario, to: PortfolioScenario) {
  const a = new Map(from.memberships.map((m) => [m.initiativeId, m]));
  const b = new Map(to.memberships.map((m) => [m.initiativeId, m]));
  return [...new Set([...a.keys(), ...b.keys()])]
    .sort()
    .flatMap((id) =>
      JSON.stringify(a.get(id)) === JSON.stringify(b.get(id))
        ? []
        : [{ initiativeId: id, before: a.get(id) ?? null, after: b.get(id) ?? null }]
    );
}
