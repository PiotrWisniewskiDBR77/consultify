import { recomputeTaskMilestones } from './executionMilestone.js';
import type { ExecutionDecision, ExecutionTask } from './executionWork.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
type Assignment = {
  status: 'OFFERED' | 'ACCEPTED' | 'DECLINED';
  offeredAt: string;
  respondedAt: string | null;
  reason: string | null;
};
type HardenedTask = ExecutionTask & {
  assignment?: Assignment;
  overdue?: boolean;
  escalation?: { level: 'WARNING' | 'CRITICAL'; reason: string; escalatedAt: string; by: string };
  canceledAt?: string;
  cancelReason?: string;
  reopenedAt?: string;
  reopenReason?: string;
};
type HardenedDecision = ExecutionDecision & {
  overdue?: boolean;
  escalation?: { level: 'WARNING' | 'CRITICAL'; reason: string; escalatedAt: string; by: string };
  canceledAt?: string;
  cancelReason?: string;
  reopenedAt?: string;
  reopenReason?: string;
};
async function parent(
  tx: MaterialCommandTransaction,
  org: string,
  p: { expectedCaseVersion: number },
  item: { executionCaseId: string; initiativeId: string }
) {
  const c = await tx.getRelatedAggregateForUpdate<any>(org, 'execution_case', item.executionCaseId);
  if (
    !c ||
    c.version !== p.expectedCaseVersion ||
    c.payload.initiativeId !== item.initiativeId ||
    c.payload.state !== 'ACTIVE'
  )
    throw new MaterialCommandValidationError('Exact active parent Case version required');
  await tx.persistRelatedAggregate(
    org,
    'execution_case',
    item.executionCaseId,
    c.version,
    c.version + 1,
    { ...c.payload, rollup: { ...(c.payload.rollup ?? {}), refreshedAt: new Date().toISOString() } }
  );
}
type TaskAction = {
  expectedCaseVersion: number;
  action:
    | 'OFFER_ASSIGNMENT'
    | 'ACCEPT_ASSIGNMENT'
    | 'DECLINE_ASSIGNMENT'
    | 'ESCALATE'
    | 'REOPEN'
    | 'CANCEL';
  reason: string;
  level?: 'WARNING' | 'CRITICAL';
};
export async function transitionCanonicalTask(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<TaskAction>
): Promise<MaterialCommandResult<HardenedTask>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const t = await tx.getAggregatePayload<HardenedTask>(
      envelope.organizationId,
      'execution_task',
      envelope.aggregateId
    );
    if (!t) throw new MaterialCommandValidationError('Canonical Task not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: HardenedTask;
    if (p.action === 'OFFER_ASSIGNMENT') {
      if (envelope.actorId !== t.ownerId || ['COMPLETED', 'CANCELED'].includes(t.status))
        throw new MaterialCommandValidationError('Task owner offers active assignment');
      next = {
        ...t,
        assignment: { status: 'OFFERED', offeredAt: now, respondedAt: null, reason: null },
      };
    } else if (p.action === 'ACCEPT_ASSIGNMENT' || p.action === 'DECLINE_ASSIGNMENT') {
      if (envelope.actorId !== t.assigneeId || t.assignment?.status !== 'OFFERED')
        throw new MaterialCommandValidationError('Named assignee must respond to current offer');
      if (p.action === 'DECLINE_ASSIGNMENT' && !p.reason.trim())
        throw new MaterialCommandValidationError('Assignment decline reason required');
      next = {
        ...t,
        assignment: {
          ...t.assignment,
          status: p.action === 'ACCEPT_ASSIGNMENT' ? 'ACCEPTED' : 'DECLINED',
          respondedAt: now,
          reason: p.reason,
        },
      };
    } else if (p.action === 'ESCALATE') {
      if (
        envelope.actorId !== t.ownerId ||
        ['COMPLETED', 'CANCELED'].includes(t.status) ||
        Date.now() <= Math.min(Date.parse(t.slaAt), Date.parse(t.dueAt)) ||
        !p.reason.trim()
      )
        throw new MaterialCommandValidationError('Only overdue active Task can escalate');
      next = {
        ...t,
        overdue: true,
        escalation: {
          level: p.level ?? 'WARNING',
          reason: p.reason,
          escalatedAt: now,
          by: envelope.actorId,
        },
      };
    } else if (p.action === 'CANCEL') {
      if (envelope.actorId !== t.ownerId || !p.reason || t.status === 'CANCELED')
        throw new MaterialCommandValidationError('Task owner and cancellation reason required');
      next = { ...t, status: 'CANCELED', canceledAt: now, cancelReason: p.reason };
    } else {
      if (
        envelope.actorId !== t.ownerId ||
        !['COMPLETED', 'CANCELED'].includes(t.status) ||
        !p.reason
      )
        throw new MaterialCommandValidationError('Task owner may reopen terminal Task with reason');
      next = {
        ...t,
        status: t.blockerDecisionIds.length ? 'BLOCKED' : 'OPEN',
        completedAt: null,
        reopenedAt: now,
        reopenReason: p.reason,
      };
    }
    await parent(tx, envelope.organizationId, p, t);
    next.blastRadius = await recomputeTaskMilestones(tx, envelope.organizationId, next);
    return {
      mutation: next,
      response: next,
      eventType: `execution.task.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
type DecisionAction = {
  expectedCaseVersion: number;
  action: 'ESCALATE' | 'REOPEN' | 'CANCEL';
  reason: string;
  level?: 'WARNING' | 'CRITICAL';
};
export async function transitionCanonicalDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<DecisionAction>
): Promise<MaterialCommandResult<HardenedDecision>> {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const d = await tx.getAggregatePayload<HardenedDecision>(
      envelope.organizationId,
      'execution_decision',
      envelope.aggregateId
    );
    if (!d) throw new MaterialCommandValidationError('Canonical Decision not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: HardenedDecision;
    if (p.action === 'ESCALATE') {
      if (
        envelope.actorId !== d.authorityId ||
        d.status !== 'PENDING' ||
        Date.now() <= Date.parse(d.dueAt) ||
        !p.reason.trim()
      )
        throw new MaterialCommandValidationError('Only overdue pending Decision can escalate');
      next = {
        ...d,
        overdue: true,
        escalation: {
          level: p.level ?? 'WARNING',
          reason: p.reason,
          escalatedAt: now,
          by: envelope.actorId,
        },
      };
    } else if (p.action === 'CANCEL') {
      if (envelope.actorId !== d.authorityId || !p.reason || d.status === 'CANCELED')
        throw new MaterialCommandValidationError(
          'Decision authority and cancellation reason required'
        );
      next = { ...d, status: 'CANCELED', canceledAt: now, cancelReason: p.reason };
    } else {
      if (
        envelope.actorId !== d.authorityId ||
        !['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'RETURNED', 'CANCELED'].includes(
          d.status
        ) ||
        !p.reason
      )
        throw new MaterialCommandValidationError(
          'Decision authority reopens terminal Decision with reason'
        );
      next = {
        ...d,
        status: 'DRAFT',
        requesterId: null,
        rationale: null,
        conditions: [],
        decidedAt: null,
        reopenedAt: now,
        reopenReason: p.reason,
      };
    }
    await parent(tx, envelope.organizationId, p, d);
    return {
      mutation: next,
      response: next,
      eventType: `execution.decision.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export function workSlaState(
  item: { status: string; dueAt: string; slaAt?: string },
  now: number = Date.now()
) {
  if (
    [
      'COMPLETED',
      'CANCELED',
      'APPROVED',
      'CONDITIONALLY_APPROVED',
      'REJECTED',
      'RETURNED',
    ].includes(item.status)
  )
    return 'OK';
  const at = Math.min(Date.parse(item.dueAt), item.slaAt ? Date.parse(item.slaAt) : Infinity);
  return now > at ? 'OVERDUE' : 'OK';
}
