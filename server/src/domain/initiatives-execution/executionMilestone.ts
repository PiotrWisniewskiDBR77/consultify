import type { ExecutionTask } from './executionWork.js';
import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface ExecutionMilestone {
  milestoneId: string;
  executionCaseId: string;
  initiativeId: string;
  baselineRef: { ref: string; version: number };
  title: string;
  ownerId: string;
  targetAt: string | null;
  forecastAt: string | null;
  status: 'PLANNED' | 'READY' | 'AT_RISK' | 'ACHIEVED';
  readiness: 'UNKNOWN' | 'READY' | 'BLOCKED' | 'COMPLETE';
  forecastVarianceDays: number | null;
  evidenceRefs: string[];
  linkedTaskIds: string[];
  sourceVersions: { executionCaseVersion: number; baselineVersion: number };
  updatedAt: string;
}

export const milestoneForecastVariance = (target: string | null, forecast: string | null) =>
  target && forecast ? Math.round((Date.parse(forecast) - Date.parse(target)) / 86_400_000) : null;
export function deriveMilestoneReadiness(statuses: string[]) {
  const readiness: ExecutionMilestone['readiness'] = statuses.some(
    (s) => s === 'BLOCKED' || s === 'CANCELED'
  )
    ? 'BLOCKED'
    : statuses.length > 0 && statuses.every((s) => s === 'COMPLETED')
      ? 'COMPLETE'
      : statuses.some((s) => s === 'UNKNOWN') || statuses.length === 0
        ? 'UNKNOWN'
        : 'READY';
  const status: ExecutionMilestone['status'] =
    readiness === 'BLOCKED'
      ? 'AT_RISK'
      : readiness === 'COMPLETE'
        ? 'ACHIEVED'
        : readiness === 'READY'
          ? 'READY'
          : 'PLANNED';
  return { readiness, status };
}

export async function createExecutionMilestone(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<
      ExecutionMilestone,
      | 'milestoneId'
      | 'status'
      | 'readiness'
      | 'forecastVarianceDays'
      | 'linkedTaskIds'
      | 'updatedAt'
    >
  >
): Promise<MaterialCommandResult<ExecutionMilestone>> {
  if (
    envelope.aggregateType !== 'execution_milestone' ||
    envelope.commandType !== 'execution.milestone.create'
  )
    throw new MaterialCommandValidationError('Invalid Execution Milestone create');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    const c = await tx.getRelatedAggregateForUpdate<any>(
      envelope.organizationId,
      'execution_case',
      p.executionCaseId
    );
    if (
      !c ||
      c.version !== p.sourceVersions.executionCaseVersion ||
      c.payload.initiativeId !== p.initiativeId ||
      c.payload.state !== 'ACTIVE'
    )
      throw new MaterialCommandValidationError('Exact active Execution Case required');
    if (
      c.payload.handoffPackageId !== p.baselineRef.ref ||
      c.payload.handoffPackageVersion !== p.baselineRef.version
    )
      throw new MaterialCommandValidationError('Exact accepted Execution baseline is required');
    if (
      !p.title.trim() ||
      !p.ownerId.trim() ||
      !p.baselineRef.ref.trim() ||
      p.baselineRef.version !== p.sourceVersions.baselineVersion
    )
      throw new MaterialCommandValidationError('Exact baseline and Milestone ownership required');
    for (const value of [p.targetAt, p.forecastAt])
      if (value !== null && !Number.isFinite(Date.parse(value)))
        throw new MaterialCommandValidationError('Milestone date is invalid');
    const milestone: ExecutionMilestone = {
      ...p,
      milestoneId: envelope.aggregateId,
      status: 'PLANNED',
      readiness: 'UNKNOWN',
      forecastVarianceDays: milestoneForecastVariance(p.targetAt, p.forecastAt),
      linkedTaskIds: [],
      updatedAt: new Date().toISOString(),
    };
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `EXECUTION_CASE_MILESTONE:${milestone.milestoneId}`,
      sourceType: 'execution_case',
      sourceId: milestone.executionCaseId,
      sourceVersion: c.version,
      targetType: 'execution_milestone',
      targetId: milestone.milestoneId,
      payload: { baselineRef: milestone.baselineRef },
    });
    return {
      mutation: milestone,
      response: milestone,
      eventType: 'execution.milestone.created',
      eventPayload: milestone,
      auditPayload: milestone,
    };
  });
}

export async function recomputeTaskMilestones(
  tx: MaterialCommandTransaction,
  organizationId: string,
  task: ExecutionTask
): Promise<
  Array<{
    milestoneId: string;
    version: number;
    status: string;
    readiness: string;
    forecastVarianceDays: number | null;
    sourceVersions: ExecutionMilestone['sourceVersions'];
  }>
> {
  const refs = [];
  for (const milestoneId of task.milestoneIds ?? []) {
    const relationAlreadyClaimed = task.blastRadius?.some(
      (reference) => reference.milestoneId === milestoneId
    );
    const found = await tx.getRelatedAggregateForUpdate<ExecutionMilestone>(
      organizationId,
      'execution_milestone',
      milestoneId
    );
    if (
      !found ||
      found.payload.executionCaseId !== task.executionCaseId ||
      found.payload.initiativeId !== task.initiativeId
    )
      throw new MaterialCommandValidationError('Task references an invalid Execution Milestone');
    const linkedTaskIds = [...new Set([...found.payload.linkedTaskIds, task.taskId])];
    const statuses: string[] = [];
    for (const taskId of linkedTaskIds) {
      if (taskId === task.taskId) statuses.push(task.status);
      else {
        const linked = await tx.getAggregatePayload<ExecutionTask>(
          organizationId,
          'execution_task',
          taskId
        );
        statuses.push(linked?.status ?? 'UNKNOWN');
      }
    }
    const { readiness, status } = deriveMilestoneReadiness(statuses);
    const next = {
      ...found.payload,
      linkedTaskIds,
      readiness,
      status,
      forecastVarianceDays: milestoneForecastVariance(
        found.payload.targetAt,
        found.payload.forecastAt
      ),
      updatedAt: new Date().toISOString(),
    };
    await tx.persistRelatedAggregate(
      organizationId,
      'execution_milestone',
      milestoneId,
      found.version,
      found.version + 1,
      next
    );
    if (!relationAlreadyClaimed)
      await tx.claimRelation({
        organizationId,
        relationType: `MILESTONE_TASK:${milestoneId}:${task.taskId}`,
        sourceType: 'execution_milestone',
        sourceId: milestoneId,
        sourceVersion: found.version + 1,
        targetType: 'execution_task',
        targetId: task.taskId,
        payload: { status: task.status, readiness },
      });
    refs.push({
      milestoneId,
      version: found.version + 1,
      status,
      readiness,
      forecastVarianceDays: next.forecastVarianceDays,
      sourceVersions: next.sourceVersions,
    });
  }
  return refs;
}
