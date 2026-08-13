import { assertGateQuorumReceipt } from './gateSignoff.js';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
type Outcome = 'ACCEPT' | 'ACCEPT_WITH_EXPLICIT_GAPS' | 'RETURN_WITH_BLOCKERS';
interface Item {
  itemId: string;
  description: string;
  ownerId: string;
  dueAt: string;
}
interface Initiative {
  initiativeId: string;
  projectId: string;
  lifecycleState: string;
  handoffPackageId?: string;
  executionState?: string;
  executionCaseId?: string;
}
interface HandoffPackage {
  handoffPackageId: string;
  version: number;
  initiativeId: string;
  decisionId: string;
  executionManagerId: string;
  snapshot: Record<string, unknown>;
  portfolio: Record<string, unknown>;
  plan: Record<string, unknown>;
  capacity: Record<string, unknown>;
  commitmentVersions: Record<string, number>;
  createdAt: string;
}
export interface HandoffAcceptanceCase {
  decisionId: string;
  initiativeId: string;
  handoffPackageId: string;
  handoffPackageVersion: number;
  executionCaseId: string;
  requesterId: string;
  authorityId: string;
  status: 'PENDING' | Outcome;
  gaps: Item[];
  blockers: Item[];
  rationale: string | null;
  requestedAt: string;
  dueAt: string;
  decidedAt: string | null;
  rolloutChildren: { pilot: Array<Record<string, unknown>>; waves: Array<Record<string, unknown>> };
}
export function validateAccountableItems(items: Item[]) {
  return items.every(
    (i) =>
      i.itemId.trim() &&
      i.description.trim() &&
      i.ownerId.trim() &&
      Number.isFinite(Date.parse(i.dueAt))
  );
}
export async function requestHandoffAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    handoffPackageId: string;
    handoffPackageVersion: number;
    executionCaseId: string;
    authorityId: string;
    dueAt: string;
    rolloutChildren: {
      pilot: Array<Record<string, unknown>>;
      waves: Array<Record<string, unknown>>;
    };
  }>
): Promise<MaterialCommandResult<HandoffAcceptanceCase>> {
  if (
    envelope.commandType !== 'initiative.handoff.request' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Handoff Acceptance request');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const initiative = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (
      !initiative ||
      initiative.lifecycleState !== 'SCHEDULED' ||
      initiative.handoffPackageId !== envelope.payload.handoffPackageId
    )
      throw new MaterialCommandValidationError(
        'Scheduled Initiative and exact Handoff Package are required'
      );
    const pack = await tx.getRelatedAggregateForUpdate<HandoffPackage>(
      envelope.organizationId,
      'handoff_package',
      envelope.payload.handoffPackageId
    );
    if (
      !pack ||
      pack.version !== envelope.payload.handoffPackageVersion ||
      pack.payload.initiativeId !== envelope.aggregateId
    )
      throw new MaterialCommandValidationError('Exact frozen Handoff Package not found');
    if (pack.payload.executionManagerId !== envelope.payload.authorityId)
      throw new MaterialCommandValidationError(
        'Handoff authority must be the exact Execution Manager'
      );
    if (
      !envelope.payload.executionCaseId.trim() ||
      !Number.isFinite(Date.parse(envelope.payload.dueAt))
    )
      throw new MaterialCommandValidationError('Stable executionCaseId and dueAt are required');
    const d: HandoffAcceptanceCase = {
      decisionId: envelope.payload.decisionId,
      initiativeId: envelope.aggregateId,
      handoffPackageId: pack.payload.handoffPackageId,
      handoffPackageVersion: pack.version,
      executionCaseId: envelope.payload.executionCaseId,
      requesterId: envelope.actorId,
      authorityId: envelope.payload.authorityId,
      status: 'PENDING',
      gaps: [],
      blockers: [],
      rationale: null,
      requestedAt: new Date().toISOString(),
      dueAt: new Date(envelope.payload.dueAt).toISOString(),
      decidedAt: null,
      rolloutChildren: envelope.payload.rolloutChildren,
    };
    await tx.persistRelatedAggregate(envelope.organizationId, 'decision', d.decisionId, 0, 1, d);
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_HANDOFF_ACCEPTANCE:${d.decisionId}`,
      sourceType: 'initiative',
      sourceId: envelope.aggregateId,
      sourceVersion: envelope.expectedVersion,
      targetType: 'decision',
      targetId: d.decisionId,
      payload: { status: 'PENDING', handoffPackageId: d.handoffPackageId },
    });
    return {
      mutation: { ...initiative, executionState: 'HANDOFF_PENDING' },
      response: d,
      eventType: 'initiative.handoff.requested',
      eventPayload: d,
      auditPayload: d,
    };
  });
}
export async function decideHandoffAcceptance(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    decisionId: string;
    outcome: Outcome;
    gaps: Item[];
    blockers: Item[];
    rationale: string;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<HandoffAcceptanceCase & { executionCaseCreated: boolean }>> {
  if (
    envelope.commandType !== 'initiative.handoff.decide' ||
    envelope.aggregateType !== 'initiative'
  )
    throw new MaterialCommandValidationError('Invalid Handoff Acceptance decision');
  if (
    !envelope.payload.rationale.trim() ||
    !validateAccountableItems(envelope.payload.gaps) ||
    !validateAccountableItems(envelope.payload.blockers)
  )
    throw new MaterialCommandValidationError(
      'Rationale and accountable dated gaps/blockers are required'
    );
  if (envelope.payload.outcome === 'ACCEPT_WITH_EXPLICIT_GAPS' && !envelope.payload.gaps.length)
    throw new MaterialCommandValidationError('Explicit gaps are required');
  if (envelope.payload.outcome === 'RETURN_WITH_BLOCKERS' && !envelope.payload.blockers.length)
    throw new MaterialCommandValidationError('Blockers are required');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    await assertGateQuorumReceipt(tx, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'HANDOFF',
      decisionId: envelope.payload.decisionId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const initiative = await tx.getAggregatePayload<Initiative>(
      envelope.organizationId,
      'initiative',
      envelope.aggregateId
    );
    if (!initiative || initiative.lifecycleState !== 'SCHEDULED')
      throw new MaterialCommandValidationError('Initiative is not SCHEDULED');
    const stored = await tx.getRelatedAggregateForUpdate<HandoffAcceptanceCase>(
      envelope.organizationId,
      'decision',
      envelope.payload.decisionId
    );
    if (
      !stored ||
      stored.version !== 1 ||
      stored.payload.status !== 'PENDING' ||
      stored.payload.authorityId !== envelope.actorId
    )
      throw new MaterialCommandValidationError('Exact Execution Manager authority is required');
    const pack = await tx.getRelatedAggregateForUpdate<HandoffPackage>(
      envelope.organizationId,
      'handoff_package',
      stored.payload.handoffPackageId
    );
    if (
      !pack ||
      pack.version !== stored.payload.handoffPackageVersion ||
      initiative.handoffPackageId !== stored.payload.handoffPackageId
    )
      throw new MaterialCommandConflictError(
        'Handoff Package snapshot is stale',
        envelope.expectedVersion,
        envelope.expectedVersion
      );
    const accepted = envelope.payload.outcome !== 'RETURN_WITH_BLOCKERS';
    if (accepted) {
      const executionCase = {
        executionCaseId: stored.payload.executionCaseId,
        initiativeId: envelope.aggregateId,
        state: 'ACTIVE',
        executionManagerId: stored.payload.authorityId,
        handoffPackageId: stored.payload.handoffPackageId,
        handoffPackageVersion: stored.payload.handoffPackageVersion,
        acceptedBaseline: pack.payload.snapshot,
        portfolio: pack.payload.portfolio,
        plan: pack.payload.plan,
        capacity: pack.payload.capacity,
        commitmentVersions: pack.payload.commitmentVersions,
        gaps: envelope.payload.gaps,
        rolloutChildren: stored.payload.rolloutChildren,
        acceptedAt: new Date().toISOString(),
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'execution_case',
        stored.payload.executionCaseId,
        0,
        1,
        executionCase
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: 'INITIATIVE_EXECUTION_CASE',
        sourceType: 'initiative',
        sourceId: envelope.aggregateId,
        sourceVersion: envelope.expectedVersion,
        targetType: 'execution_case',
        targetId: stored.payload.executionCaseId,
        payload: { state: 'ACTIVE' },
      });
    }
    const decided = {
      ...stored.payload,
      status: envelope.payload.outcome,
      gaps: envelope.payload.gaps,
      blockers: envelope.payload.blockers,
      rationale: envelope.payload.rationale,
      decidedAt: new Date().toISOString(),
      executionCaseCreated: accepted,
    };
    await tx.persistRelatedAggregate(
      envelope.organizationId,
      'decision',
      stored.payload.decisionId,
      1,
      2,
      decided
    );
    return {
      mutation: {
        ...initiative,
        lifecycleState: accepted ? 'IN_EXECUTION' : 'SCHEDULED',
        executionState: accepted ? 'ACTIVE' : 'HANDOFF_PENDING',
        executionCaseId: accepted ? stored.payload.executionCaseId : undefined,
      },
      response: decided,
      eventType: `initiative.handoff.${envelope.payload.outcome.toLowerCase()}`,
      eventPayload: decided,
      auditPayload: decided,
    };
  });
}
