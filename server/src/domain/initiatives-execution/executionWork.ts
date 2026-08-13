import { recomputeTaskMilestones } from './executionMilestone.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
interface Case {
  executionCaseId: string;
  initiativeId: string;
  state: string;
  rollup?: {
    tasksTotal: number;
    tasksCompleted: number;
    tasksBlocked: number;
    decisionsPending: number;
    decisionsDecided: number;
    refreshedAt: string;
  };
}
export interface ExecutionTask {
  taskId: string;
  executionCaseId: string;
  initiativeId: string;
  title: string;
  description: string;
  status: 'OPEN' | 'BLOCKED' | 'COMPLETED' | 'CANCELED';
  assigneeId: string;
  ownerId: string;
  dueAt: string;
  slaAt: string;
  evidenceRefs: string[];
  blockerDecisionIds: string[];
  dependencyTaskIds: string[];
  milestoneIds?: string[];
  blastRadius?: Array<{
    milestoneId: string;
    version: number;
    status: string;
    readiness: string;
    forecastVarianceDays: number | null;
    sourceVersions: { executionCaseVersion: number; baselineVersion: number };
  }>;
  createdAt: string;
  completedAt: string | null;
}
export interface ExecutionDecision {
  decisionId: string;
  executionCaseId: string;
  initiativeId: string;
  title: string;
  status:
    | 'DRAFT'
    | 'PENDING'
    | 'APPROVED'
    | 'CONDITIONALLY_APPROVED'
    | 'REJECTED'
    | 'RETURNED'
    | 'CANCELED';
  options: Array<{ optionId: string; label: string }>;
  authorityId: string;
  requesterId: string | null;
  dueAt: string;
  rationale: string | null;
  conditions: string[];
  followUpTaskId: string | null;
  createdAt: string;
  decidedAt: string | null;
}
type RollupDelta = Partial<
  Record<
    'tasksTotal' | 'tasksCompleted' | 'tasksBlocked' | 'decisionsPending' | 'decisionsDecided',
    number
  >
>;
async function caseAndRollup(
  tx: MaterialCommandTransaction,
  org: string,
  caseId: string,
  initiativeId: string,
  expectedCaseVersion: number,
  delta: RollupDelta
) {
  const found = await tx.getRelatedAggregateForUpdate<Case>(org, 'execution_case', caseId);
  if (
    !found ||
    found.version !== expectedCaseVersion ||
    found.payload.initiativeId !== initiativeId ||
    found.payload.state !== 'ACTIVE'
  )
    throw new MaterialCommandValidationError('Exact active Execution Case version is required');
  const base = found.payload.rollup ?? {
    tasksTotal: 0,
    tasksCompleted: 0,
    tasksBlocked: 0,
    decisionsPending: 0,
    decisionsDecided: 0,
    refreshedAt: new Date(0).toISOString(),
  };
  const rollup = { ...base, refreshedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(delta))
    rollup[k as keyof Omit<typeof rollup, 'refreshedAt'>] = Math.max(
      0,
      ((base[k as keyof typeof base] as number) ?? 0) + (v ?? 0)
    );
  await tx.persistRelatedAggregate(
    org,
    'execution_case',
    caseId,
    expectedCaseVersion,
    expectedCaseVersion + 1,
    { ...found.payload, rollup }
  );
  return rollup;
}
export function deriveTaskStatus(
  blockerDecisionIds: string[],
  completed = false
): ExecutionTask['status'] {
  return completed ? 'COMPLETED' : blockerDecisionIds.length ? 'BLOCKED' : 'OPEN';
}
export async function createExecutionTask(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<ExecutionTask, 'taskId' | 'status' | 'createdAt' | 'completedAt'> & {
      expectedCaseVersion: number;
    }
  >
): Promise<MaterialCommandResult<ExecutionTask>> {
  if (
    envelope.commandType !== 'execution.task.create' ||
    envelope.aggregateType !== 'execution_task'
  )
    throw new MaterialCommandValidationError('Invalid Task create');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    if (
      !p.executionCaseId ||
      !p.initiativeId ||
      !p.title.trim() ||
      !p.assigneeId ||
      !p.ownerId ||
      !Number.isFinite(Date.parse(p.dueAt)) ||
      !Number.isFinite(Date.parse(p.slaAt))
    )
      throw new MaterialCommandValidationError('Task ownership and SLA are required');
    const status = deriveTaskStatus(p.blockerDecisionIds);
    await caseAndRollup(
      tx,
      envelope.organizationId,
      p.executionCaseId,
      p.initiativeId,
      p.expectedCaseVersion,
      { tasksTotal: 1, tasksBlocked: status === 'BLOCKED' ? 1 : 0 }
    );
    const task: ExecutionTask = {
      taskId: envelope.aggregateId,
      ...p,
      status,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    delete (task as any).expectedCaseVersion;
    task.blastRadius = await recomputeTaskMilestones(tx, envelope.organizationId, task);
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `EXECUTION_CASE_TASK:${task.taskId}`,
      sourceType: 'execution_case',
      sourceId: task.executionCaseId,
      sourceVersion: p.expectedCaseVersion + 1,
      targetType: 'execution_task',
      targetId: task.taskId,
      payload: { initiativeId: task.initiativeId, status },
    });
    return {
      mutation: task,
      response: task,
      eventType: 'execution.task.created',
      eventPayload: task,
      auditPayload: task,
    };
  });
}
export async function updateExecutionTask(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    expectedCaseVersion: number;
    patch: Partial<
      Pick<
        ExecutionTask,
        | 'title'
        | 'description'
        | 'assigneeId'
        | 'ownerId'
        | 'dueAt'
        | 'slaAt'
        | 'evidenceRefs'
        | 'blockerDecisionIds'
        | 'dependencyTaskIds'
        | 'milestoneIds'
      >
    >;
  }>
): Promise<MaterialCommandResult<ExecutionTask>> {
  if (
    envelope.commandType !== 'execution.task.update' ||
    envelope.aggregateType !== 'execution_task'
  )
    throw new MaterialCommandValidationError('Invalid Task update');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const task = await tx.getAggregatePayload<ExecutionTask>(
      envelope.organizationId,
      'execution_task',
      envelope.aggregateId
    );
    if (!task || task.status === 'COMPLETED')
      throw new MaterialCommandValidationError('Open Task is required');
    if (envelope.payload.patch.assigneeId && envelope.payload.patch.assigneeId !== task.assigneeId)
      throw new MaterialCommandValidationError(
        'Assignee change requires governed assignment offer'
      );
    const next = { ...task, ...envelope.payload.patch };
    next.status = deriveTaskStatus(next.blockerDecisionIds);
    await caseAndRollup(
      tx,
      envelope.organizationId,
      task.executionCaseId,
      task.initiativeId,
      envelope.payload.expectedCaseVersion,
      { tasksBlocked: (next.status === 'BLOCKED' ? 1 : 0) - (task.status === 'BLOCKED' ? 1 : 0) }
    );
    next.blastRadius = await recomputeTaskMilestones(tx, envelope.organizationId, next);
    return {
      mutation: next,
      response: next,
      eventType: 'execution.task.updated',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export async function completeExecutionTask(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ expectedCaseVersion: number; evidenceRefs: string[] }>
): Promise<MaterialCommandResult<ExecutionTask>> {
  if (
    envelope.commandType !== 'execution.task.complete' ||
    envelope.aggregateType !== 'execution_task'
  )
    throw new MaterialCommandValidationError('Invalid Task completion');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const task = await tx.getAggregatePayload<ExecutionTask>(
      envelope.organizationId,
      'execution_task',
      envelope.aggregateId
    );
    if (
      !task ||
      task.status === 'COMPLETED' ||
      ((task as any).assignment && (task as any).assignment.status !== 'ACCEPTED') ||
      task.blockerDecisionIds.length ||
      !envelope.payload.evidenceRefs.length
    )
      throw new MaterialCommandValidationError(
        'Unblocked Task and completion evidence are required'
      );
    await caseAndRollup(
      tx,
      envelope.organizationId,
      task.executionCaseId,
      task.initiativeId,
      envelope.payload.expectedCaseVersion,
      { tasksCompleted: 1 }
    );
    const next = {
      ...task,
      status: 'COMPLETED' as const,
      evidenceRefs: envelope.payload.evidenceRefs,
      completedAt: new Date().toISOString(),
    };
    next.blastRadius = await recomputeTaskMilestones(tx, envelope.organizationId, next);
    return {
      mutation: next,
      response: next,
      eventType: 'execution.task.completed',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export async function createExecutionDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<
      ExecutionDecision,
      | 'decisionId'
      | 'status'
      | 'requesterId'
      | 'rationale'
      | 'conditions'
      | 'followUpTaskId'
      | 'createdAt'
      | 'decidedAt'
    > & { expectedCaseVersion: number }
  >
): Promise<MaterialCommandResult<ExecutionDecision>> {
  if (
    envelope.commandType !== 'execution.decision.create' ||
    envelope.aggregateType !== 'execution_decision'
  )
    throw new MaterialCommandValidationError('Invalid Decision create');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    if (p.options.length < 2 || !p.authorityId || !Number.isFinite(Date.parse(p.dueAt)))
      throw new MaterialCommandValidationError('Decision options, authority and SLA are required');
    await caseAndRollup(
      tx,
      envelope.organizationId,
      p.executionCaseId,
      p.initiativeId,
      p.expectedCaseVersion,
      {}
    );
    const d: ExecutionDecision = {
      decisionId: envelope.aggregateId,
      ...p,
      status: 'DRAFT',
      requesterId: null,
      rationale: null,
      conditions: [],
      followUpTaskId: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    delete (d as any).expectedCaseVersion;
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `EXECUTION_CASE_DECISION:${d.decisionId}`,
      sourceType: 'execution_case',
      sourceId: d.executionCaseId,
      sourceVersion: p.expectedCaseVersion + 1,
      targetType: 'execution_decision',
      targetId: d.decisionId,
      payload: { initiativeId: d.initiativeId, status: 'DRAFT' },
    });
    return {
      mutation: d,
      response: d,
      eventType: 'execution.decision.created',
      eventPayload: d,
      auditPayload: d,
    };
  });
}
export async function requestExecutionDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ expectedCaseVersion: number }>
): Promise<MaterialCommandResult<ExecutionDecision>> {
  if (
    envelope.commandType !== 'execution.decision.request' ||
    envelope.aggregateType !== 'execution_decision'
  )
    throw new MaterialCommandValidationError('Invalid Decision request');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const d = await tx.getAggregatePayload<ExecutionDecision>(
      envelope.organizationId,
      'execution_decision',
      envelope.aggregateId
    );
    if (!d || d.status !== 'DRAFT' || d.authorityId === envelope.actorId)
      throw new MaterialCommandValidationError(
        'Draft Decision and independent authority are required'
      );
    await caseAndRollup(
      tx,
      envelope.organizationId,
      d.executionCaseId,
      d.initiativeId,
      envelope.payload.expectedCaseVersion,
      { decisionsPending: 1 }
    );
    const next = { ...d, status: 'PENDING' as const, requesterId: envelope.actorId };
    return {
      mutation: next,
      response: next,
      eventType: 'execution.decision.requested',
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export async function decideExecutionDecision(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{
    expectedCaseVersion: number;
    outcome: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED' | 'RETURNED';
    rationale: string;
    conditions: string[];
    followUpTask: null | {
      taskId: string;
      title: string;
      description: string;
      assigneeId: string;
      ownerId: string;
      dueAt: string;
      slaAt: string;
      evidenceRefs: string[];
      dependencyTaskIds: string[];
    };
  }>
): Promise<MaterialCommandResult<ExecutionDecision>> {
  if (
    envelope.commandType !== 'execution.decision.decide' ||
    envelope.aggregateType !== 'execution_decision'
  )
    throw new MaterialCommandValidationError('Invalid Decision decide');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const d = await tx.getAggregatePayload<ExecutionDecision>(
      envelope.organizationId,
      'execution_decision',
      envelope.aggregateId
    );
    if (
      !d ||
      d.status !== 'PENDING' ||
      d.authorityId !== envelope.actorId ||
      !envelope.payload.rationale.trim()
    )
      throw new MaterialCommandValidationError('Named pending Decision and rationale are required');
    if (
      envelope.payload.outcome === 'CONDITIONALLY_APPROVED' &&
      (!envelope.payload.conditions.length || !envelope.payload.followUpTask)
    )
      throw new MaterialCommandValidationError(
        'Conditional Decision requires conditions and follow-up Task'
      );
    const creates = Boolean(envelope.payload.followUpTask);
    await caseAndRollup(
      tx,
      envelope.organizationId,
      d.executionCaseId,
      d.initiativeId,
      envelope.payload.expectedCaseVersion,
      { decisionsPending: -1, decisionsDecided: 1, tasksTotal: creates ? 1 : 0 }
    );
    let followUpTaskId: string | null = null;
    if (envelope.payload.followUpTask) {
      const f = envelope.payload.followUpTask;
      followUpTaskId = f.taskId;
      const task: ExecutionTask = {
        taskId: f.taskId,
        executionCaseId: d.executionCaseId,
        initiativeId: d.initiativeId,
        title: f.title,
        description: f.description,
        status: 'OPEN',
        assigneeId: f.assigneeId,
        ownerId: f.ownerId,
        dueAt: f.dueAt,
        slaAt: f.slaAt,
        evidenceRefs: f.evidenceRefs,
        blockerDecisionIds: [],
        dependencyTaskIds: f.dependencyTaskIds,
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await tx.persistRelatedAggregate(
        envelope.organizationId,
        'execution_task',
        task.taskId,
        0,
        1,
        task
      );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `EXECUTION_CASE_TASK:${task.taskId}`,
        sourceType: 'execution_case',
        sourceId: d.executionCaseId,
        sourceVersion: envelope.payload.expectedCaseVersion + 1,
        targetType: 'execution_task',
        targetId: task.taskId,
        payload: {
          initiativeId: d.initiativeId,
          status: 'OPEN',
          createdByDecisionId: d.decisionId,
        },
      });
    }
    const next = {
      ...d,
      status: envelope.payload.outcome,
      rationale: envelope.payload.rationale,
      conditions: envelope.payload.conditions,
      followUpTaskId,
      decidedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: `execution.decision.${next.status.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
