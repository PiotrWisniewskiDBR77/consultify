import type { CapacityScenario } from './capacityScenario.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
export type CommitmentStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CONDITIONALLY_CONFIRMED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'SUPERSEDED';
export interface ResourceCommitment {
  commitmentId: string;
  capacityScenarioId: string;
  capacityScenarioVersion: number;
  assignmentId: string;
  initiativeId: string;
  resourceManagerId: string;
  assigneeId: string;
  status: CommitmentStatus;
  conditions: string[];
  expiresAt: string;
  requestedAt: string;
  assigneeAcceptedAt: string | null;
  decidedAt: string | null;
  policyOverrideDecisionId: string | null;
  rationale: string | null;
}
export async function requestResourceCommitment(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    capacityScenarioId: string;
    capacityScenarioVersion: number;
    assignmentId: string;
    initiativeId: string;
    resourceManagerId: string;
    assigneeId: string;
    expiresAt: string;
  }>
): Promise<MaterialCommandResult<ResourceCommitment>> {
  if (
    envelope.commandType !== 'resource.commitment.request' ||
    envelope.aggregateType !== 'resource_commitment'
  )
    throw new MaterialCommandValidationError('Invalid commitment request');
  if (
    envelope.actorId !== envelope.payload.resourceManagerId ||
    !Number.isFinite(Date.parse(envelope.payload.expiresAt))
  )
    throw new MaterialCommandValidationError('Resource Manager and expiry are required');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const scenario = await tx.getRelatedAggregateForUpdate<CapacityScenario>(
      envelope.organizationId,
      'capacity_scenario',
      envelope.payload.capacityScenarioId
    );
    if (
      !scenario ||
      scenario.payload.status !== 'PUBLISHED' ||
      scenario.payload.scenarioVersion !== envelope.payload.capacityScenarioVersion
    )
      throw new MaterialCommandValidationError('Exact published Capacity Scenario not found');
    const assignment = scenario.payload.proposedAssignments.find(
      (a) =>
        a.assignmentId === envelope.payload.assignmentId &&
        a.initiativeId === envelope.payload.initiativeId
    );
    if (!assignment) throw new MaterialCommandValidationError('Proposed assignment not found');
    const c: ResourceCommitment = {
      commitmentId: envelope.aggregateId,
      ...envelope.payload,
      status: 'REQUESTED',
      conditions: [],
      requestedAt: new Date().toISOString(),
      assigneeAcceptedAt: null,
      decidedAt: null,
      policyOverrideDecisionId: null,
      rationale: null,
    };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: 'RESOURCE_COMMITMENT_CAPACITY',
      sourceType: 'resource_commitment',
      sourceId: envelope.aggregateId,
      sourceVersion: 1,
      targetType: 'capacity_scenario_version',
      targetId: `${c.capacityScenarioId}:v${c.capacityScenarioVersion}`,
      payload: { assignmentId: c.assignmentId },
    });
    return {
      mutation: c,
      response: c,
      eventType: 'resource.commitment.requested',
      eventPayload: c,
      auditPayload: c,
    };
  });
}
export async function acceptResourceCommitment(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Record<string, never>>
): Promise<MaterialCommandResult<ResourceCommitment>> {
  if (
    envelope.commandType !== 'resource.commitment.accept' ||
    envelope.aggregateType !== 'resource_commitment'
  )
    throw new MaterialCommandValidationError('Invalid commitment acceptance');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<ResourceCommitment>(
      envelope.organizationId,
      'resource_commitment',
      envelope.aggregateId
    );
    if (!c || c.status !== 'REQUESTED' || c.assigneeId !== envelope.actorId)
      throw new MaterialCommandValidationError('Named assignee acceptance is required');
    if (Date.parse(c.expiresAt) <= Date.now())
      throw new MaterialCommandValidationError('Commitment request expired');
    const next = { ...c, assigneeAcceptedAt: new Date().toISOString() };
    return {
      mutation: next,
      response: next,
      eventType: 'resource.commitment.assignee-accepted',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export async function decideResourceCommitment(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    outcome: Exclude<CommitmentStatus, 'REQUESTED'>;
    conditions: string[];
    rationale: string;
    policyOverrideDecisionId: string | null;
  }>
): Promise<MaterialCommandResult<ResourceCommitment>> {
  if (
    envelope.commandType !== 'resource.commitment.decide' ||
    envelope.aggregateType !== 'resource_commitment'
  )
    throw new MaterialCommandValidationError('Invalid commitment decision');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<ResourceCommitment>(
      envelope.organizationId,
      'resource_commitment',
      envelope.aggregateId
    );
    if (!c || c.status !== 'REQUESTED' || c.resourceManagerId !== envelope.actorId)
      throw new MaterialCommandValidationError(
        'Pending commitment and Resource Manager authority are required'
      );
    if (
      ['CONFIRMED', 'CONDITIONALLY_CONFIRMED'].includes(envelope.payload.outcome) &&
      !c.assigneeAcceptedAt &&
      !envelope.payload.policyOverrideDecisionId
    )
      throw new MaterialCommandValidationError(
        'Assignee acceptance or policy override Decision is required'
      );
    if (
      envelope.payload.outcome === 'CONDITIONALLY_CONFIRMED' &&
      !envelope.payload.conditions.length
    )
      throw new MaterialCommandValidationError('Conditional confirmation requires conditions');
    const next: ResourceCommitment = {
      ...c,
      status: envelope.payload.outcome,
      conditions: envelope.payload.conditions,
      rationale: envelope.payload.rationale,
      policyOverrideDecisionId: envelope.payload.policyOverrideDecisionId,
      decidedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: `resource.commitment.${next.status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
