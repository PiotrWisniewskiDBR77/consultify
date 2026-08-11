import type { EffectivenessSnapshot } from './effectivenessClosure.js';
import { assertGateQuorumReceipt } from './gateSignoff.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export type ClosureFollowUp =
  | { kind: 'TASK_REF'; taskId: string; version: number }
  | { kind: 'OWNED_ITEM'; itemId: string; description: string; ownerId: string; dueAt: string };
export interface ClosureCase {
  closureCaseId: string;
  initiativeId: string;
  executionCaseId: string;
  effectivenessSnapshotRef: { snapshotId: string; version: number };
  requesterId: string;
  authorityId: string;
  status: 'PENDING' | 'CLOSED' | 'RETURNED' | 'CORRECTIVE' | 'CANCELED';
  lessons: string[];
  lineageRefs: Array<{ ref: string; version: number }>;
  followUps: ClosureFollowUp[];
  retention: {
    classification: string;
    policyRef: { ref: string; version: number };
    legalHold: boolean;
  };
  rationale: string | null;
  closureSnapshotId: string | null;
  requestedAt: string;
  decidedAt: string | null;
}
export interface ClosureSnapshotV2 {
  snapshotId: string;
  closureCaseId: string;
  initiativeId: string;
  executionCaseId: string;
  effectivenessSnapshotRef: { snapshotId: string; version: number };
  effectivenessOutcome: EffectivenessSnapshot['outcome'];
  lessons: string[];
  lineageRefs: Array<{ ref: string; version: number }>;
  followUps: ClosureFollowUp[];
  retention: ClosureCase['retention'];
  closedBy: string;
  closedAt: string;
  rationale: string;
}

async function validateFollowUps(tx: any, org: string, followUps: ClosureFollowUp[]) {
  if (!followUps.length)
    throw new MaterialCommandValidationError('Mandatory closure follow-up required');
  for (const item of followUps) {
    if (item.kind === 'OWNED_ITEM') {
      if (
        !item.itemId.trim() ||
        !item.description.trim() ||
        !item.ownerId.trim() ||
        !Number.isFinite(Date.parse(item.dueAt))
      )
        throw new MaterialCommandValidationError('Owned follow-up requires owner and dueAt');
    } else {
      const task = await tx.getRelatedAggregateForUpdate<any>(org, 'execution_task', item.taskId);
      if (!task || task.version !== item.version)
        throw new MaterialCommandValidationError('Exact canonical follow-up Task required');
    }
  }
}

export async function requestClosureCase(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    initiativeId: string;
    executionCaseId: string;
    expectedInitiativeVersion: number;
    expectedExecutionCaseVersion: number;
    effectivenessSnapshotRef: { snapshotId: string; version: number };
    authorityId: string;
    lessons: string[];
    lineageRefs: Array<{ ref: string; version: number }>;
    followUps: ClosureFollowUp[];
    retention: ClosureCase['retention'];
  }>
): Promise<MaterialCommandResult<ClosureCase>> {
  if (envelope.aggregateType !== 'closure_case' || envelope.commandType !== 'closure.request')
    throw new MaterialCommandValidationError('Invalid Closure request');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    const initiative = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'initiative',
      p.initiativeId
    );
    const execution = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'execution_case',
      p.executionCaseId
    );
    const effectiveness = await tx.getRelatedAggregateForUpdate<EffectivenessSnapshot>(
      envelope.organizationId,
      'effectiveness_snapshot',
      p.effectivenessSnapshotRef.snapshotId
    );
    if (
      !initiative ||
      initiative.version !== p.expectedInitiativeVersion ||
      initiative.payload.lifecycleState !== 'EFFECTIVENESS_REVIEWED' ||
      initiative.payload.effectivenessSnapshotId !== p.effectivenessSnapshotRef.snapshotId ||
      !execution ||
      execution.version !== p.expectedExecutionCaseVersion ||
      execution.payload.initiativeId !== p.initiativeId ||
      !effectiveness ||
      effectiveness.version !== p.effectivenessSnapshotRef.version ||
      effectiveness.payload.initiativeId !== p.initiativeId
    )
      throw new MaterialCommandValidationError(
        'Exact reviewed Initiative, Execution Case and Effectiveness Snapshot required'
      );
    if (
      !p.lessons.length ||
      !p.lineageRefs.length ||
      !p.retention.classification.trim() ||
      !p.retention.policyRef.ref ||
      p.retention.policyRef.version < 1 ||
      !p.authorityId.trim()
    )
      throw new MaterialCommandValidationError(
        'Lessons, lineage, retention and authority are required'
      );
    await validateFollowUps(tx, envelope.organizationId, p.followUps);
    const closure: ClosureCase = {
      closureCaseId: envelope.aggregateId,
      initiativeId: p.initiativeId,
      executionCaseId: p.executionCaseId,
      effectivenessSnapshotRef: p.effectivenessSnapshotRef,
      requesterId: envelope.actorId,
      authorityId: p.authorityId,
      status: 'PENDING',
      lessons: p.lessons,
      lineageRefs: p.lineageRefs,
      followUps: p.followUps,
      retention: p.retention,
      rationale: null,
      closureSnapshotId: null,
      requestedAt: new Date().toISOString(),
      decidedAt: null,
    };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `INITIATIVE_CLOSURE_CASE:${envelope.aggregateId}`,
      sourceType: 'initiative',
      sourceId: p.initiativeId,
      sourceVersion: initiative.version,
      targetType: 'closure_case',
      targetId: envelope.aggregateId,
      payload: { status: 'PENDING' },
    });
    return {
      mutation: closure,
      response: closure,
      eventType: 'closure.requested',
      eventPayload: closure,
      auditPayload: closure,
    };
  });
}

export async function decideClosureCase(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    outcome: 'CLOSE' | 'RETURN' | 'CORRECTIVE' | 'CANCEL';
    rationale: string;
    snapshotId: string;
    expectedInitiativeVersion: number;
    expectedExecutionCaseVersion: number;
    governanceQuorumRequired?: boolean;
    governanceQuorumRef?: { quorumId: string; version: number; receiptId: string };
  }>
): Promise<MaterialCommandResult<ClosureCase>> {
  if (envelope.aggregateType !== 'closure_case' || envelope.commandType !== 'closure.decide')
    throw new MaterialCommandValidationError('Invalid Closure decision');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const c = await tx.getAggregatePayload<ClosureCase>(
      envelope.organizationId,
      'closure_case',
      envelope.aggregateId
    );
    if (
      !c ||
      c.status !== 'PENDING' ||
      envelope.actorId !== c.authorityId ||
      envelope.actorId === c.requesterId ||
      !envelope.payload.rationale.trim()
    )
      throw new MaterialCommandValidationError(
        'Independent pending Closure authority and rationale required'
      );
    await assertGateQuorumReceipt(tx, envelope.organizationId, {
      required: envelope.payload.governanceQuorumRequired,
      gate: 'CLOSURE',
      decisionId: c.closureCaseId,
      policyId: envelope.policyId,
      policyVersion: envelope.policyVersion,
      quorumRef: envelope.payload.governanceQuorumRef,
    });
    const effectiveness = await tx.getRelatedAggregateForUpdate<EffectivenessSnapshot>(
      envelope.organizationId,
      'effectiveness_snapshot',
      c.effectivenessSnapshotRef.snapshotId
    );
    const initiative = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'initiative',
      c.initiativeId
    );
    const execution = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'execution_case',
      c.executionCaseId
    );
    if (
      !effectiveness ||
      effectiveness.version !== c.effectivenessSnapshotRef.version ||
      !initiative ||
      initiative.version !== envelope.payload.expectedInitiativeVersion ||
      initiative.payload.lifecycleState !== 'EFFECTIVENESS_REVIEWED' ||
      !execution ||
      execution.version !== envelope.payload.expectedExecutionCaseVersion
    )
      throw new MaterialCommandValidationError('Closure sources are stale');
    const now = new Date().toISOString();
    let snapshotId: string | null = null;
    if (envelope.payload.outcome === 'CLOSE') {
      if (c.retention.legalHold)
        throw new MaterialCommandValidationError('Active legal hold blocks Closure');
      if (!envelope.payload.snapshotId.trim())
        throw new MaterialCommandValidationError('Closure snapshot identity required');
      const snapshot: ClosureSnapshotV2 = {
        snapshotId: envelope.payload.snapshotId,
        closureCaseId: c.closureCaseId,
        initiativeId: c.initiativeId,
        executionCaseId: c.executionCaseId,
        effectivenessSnapshotRef: c.effectivenessSnapshotRef,
        effectivenessOutcome: effectiveness.payload.outcome,
        lessons: c.lessons,
        lineageRefs: c.lineageRefs,
        followUps: c.followUps,
        retention: c.retention,
        closedBy: envelope.actorId,
        closedAt: now,
        rationale: envelope.payload.rationale,
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'closure_snapshot',
        snapshot.snapshotId,
        0,
        1,
        snapshot
      );
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'initiative',
        c.initiativeId,
        initiative.version,
        initiative.version + 1,
        { ...initiative.payload, lifecycleState: 'CLOSED', closureSnapshotId: snapshot.snapshotId }
      );
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'execution_case',
        c.executionCaseId,
        execution.version,
        execution.version + 1,
        { ...execution.payload, state: 'CLOSED', closureSnapshotId: snapshot.snapshotId }
      );
      snapshotId = snapshot.snapshotId;
    }
    const status: ClosureCase['status'] =
      envelope.payload.outcome === 'CLOSE'
        ? 'CLOSED'
        : envelope.payload.outcome === 'RETURN'
          ? 'RETURNED'
          : envelope.payload.outcome === 'CORRECTIVE'
            ? 'CORRECTIVE'
            : 'CANCELED';
    const next = {
      ...c,
      status,
      rationale: envelope.payload.rationale,
      closureSnapshotId: snapshotId,
      decidedAt: now,
    };
    return {
      mutation: next,
      response: next,
      eventType: `closure.${envelope.payload.outcome.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
