import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
type Knowledge = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED';
type Ref = {
  ref: string | null;
  version: number | null;
  knowledgeState: Knowledge;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  asOf: string;
  reason: string | null;
};
export interface OperationalAllocation {
  allocationId: string;
  executionCaseId: string;
  initiativeId: string;
  taskId: string;
  assigneeId: string;
  resourceManagerId: string;
  status:
    | 'PROPOSED'
    | 'REQUESTED'
    | 'ASSIGNEE_ACCEPTED'
    | 'ASSIGNEE_DECLINED'
    | 'CONFIRMED'
    | 'CONDITIONALLY_CONFIRMED'
    | 'DECLINED';
  timeBasis: {
    windowUnit: string;
    timezone: string;
    periods: Array<{ periodId: string; start: string; end: string }>;
  };
  demand: {
    unit: string;
    low: number | null;
    base: number | null;
    high: number | null;
    knowledgeState: Knowledge;
  };
  availabilityRef: Ref;
  calendarRef: Ref;
  remainingEstimateRef: Ref;
  skillRequirements: string[];
  costRef: { ref: string; version: number } | null;
  conditions: string[];
  rationale: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AllocationAssessment {
  state: 'READY' | 'PARTIAL' | 'EVIDENCE_MISSING';
  findings: string[];
}
export function simulateOperationalAllocation(
  a: Pick<
    OperationalAllocation,
    | 'timeBasis'
    | 'demand'
    | 'availabilityRef'
    | 'calendarRef'
    | 'remainingEstimateRef'
    | 'skillRequirements'
  >,
  expected: {
    windowUnit: string;
    timezone: string;
    periods: Array<{ periodId: string; start: string; end: string }>;
  }
): AllocationAssessment {
  const findings: string[] = [];
  if (
    a.timeBasis.windowUnit !== expected.windowUnit ||
    a.timeBasis.timezone !== expected.timezone ||
    a.timeBasis.periods.length !== expected.periods.length ||
    a.timeBasis.periods.some((period, index) => {
      const expectedPeriod = expected.periods[index];
      return (
        !expectedPeriod ||
        period.periodId !== expectedPeriod.periodId ||
        period.start !== expectedPeriod.start ||
        period.end !== expectedPeriod.end
      );
    })
  )
    findings.push('TIME_BASIS_MISMATCH');
  for (const [name, ref] of Object.entries({
    availability: a.availabilityRef,
    calendar: a.calendarRef,
    remainingEstimate: a.remainingEstimateRef,
  }))
    if (
      !ref.ref ||
      !ref.version ||
      Number.isNaN(Date.parse(ref.asOf)) ||
      ['UNKNOWN', 'UNCONFIRMED'].includes(ref.knowledgeState)
    )
      findings.push(`${name.toUpperCase()}_EVIDENCE_MISSING`);
  if (
    a.demand.knowledgeState === 'UNKNOWN' ||
    a.demand.low === null ||
    a.demand.base === null ||
    a.demand.high === null
  )
    findings.push('DEMAND_EVIDENCE_MISSING');
  else if (a.demand.low > a.demand.base || a.demand.base > a.demand.high)
    findings.push('DEMAND_RANGE_INVALID');
  if (!a.skillRequirements.length) findings.push('SKILL_REQUIREMENTS_MISSING');
  return {
    state: findings.some((f) => f.includes('MISSING'))
      ? 'EVIDENCE_MISSING'
      : findings.length
        ? 'PARTIAL'
        : 'READY',
    findings,
  };
}
async function parents(
  tx: MaterialCommandTransaction,
  org: string,
  a: { allocationId: string; executionCaseId: string; initiativeId: string; taskId: string },
  caseVersion: number,
  taskVersion: number,
  status: string
) {
  const c = await tx.getRelatedAggregateForUpdate<any>(org, 'execution_case', a.executionCaseId),
    t = await tx.getRelatedAggregateForUpdate<any>(org, 'execution_task', a.taskId);
  if (
    !c ||
    c.version !== caseVersion ||
    c.payload.initiativeId !== a.initiativeId ||
    !t ||
    t.version !== taskVersion ||
    t.payload.executionCaseId !== a.executionCaseId
  )
    throw new MaterialCommandValidationError('Exact Execution Case and Task versions are required');
  const old = String(t.payload.allocationStatus ?? '');
  const rollup = c.payload.rollup ?? {};
  const confirmed =
    (rollup.allocationsConfirmed ?? 0) +
    (status.includes('CONFIRMED') && !old.includes('CONFIRMED') ? 1 : 0);
  await tx.persistRelatedAggregate(
    org,
    'execution_case',
    a.executionCaseId,
    caseVersion,
    caseVersion + 1,
    {
      ...c.payload,
      rollup: {
        ...rollup,
        allocationsConfirmed: confirmed,
        allocationsProposed: (rollup.allocationsProposed ?? 0) + (old ? 0 : 1),
        refreshedAt: new Date().toISOString(),
      },
    }
  );
  await tx.persistRelatedAggregate(org, 'execution_task', a.taskId, taskVersion, taskVersion + 1, {
    ...t.payload,
    allocationStatus: status,
    allocationId: (a as any).allocationId,
  });
}
type ParentVersions = { expectedCaseVersion: number; expectedTaskVersion: number };
export async function proposeOperationalAllocation(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    Omit<
      OperationalAllocation,
      'allocationId' | 'status' | 'conditions' | 'rationale' | 'createdAt' | 'updatedAt'
    > &
      ParentVersions
  >
): Promise<MaterialCommandResult<OperationalAllocation>> {
  if (
    envelope.commandType !== 'operational-allocation.propose' ||
    envelope.aggregateType !== 'operational_allocation'
  )
    throw new MaterialCommandValidationError('Invalid allocation proposal');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    await parents(
      tx,
      envelope.organizationId,
      { ...p, allocationId: envelope.aggregateId },
      p.expectedCaseVersion,
      p.expectedTaskVersion,
      'PROPOSED'
    );
    const now = new Date().toISOString();
    const a: OperationalAllocation = {
      ...p,
      allocationId: envelope.aggregateId,
      status: 'PROPOSED',
      conditions: [],
      rationale: null,
      createdAt: now,
      updatedAt: now,
    };
    delete (a as any).expectedCaseVersion;
    delete (a as any).expectedTaskVersion;
    await tx.claimRelation({
      organizationId: envelope.organizationId,
      relationType: `EXECUTION_TASK_ALLOCATION:${a.allocationId}`,
      sourceType: 'execution_task',
      sourceId: a.taskId,
      sourceVersion: p.expectedTaskVersion + 1,
      targetType: 'operational_allocation',
      targetId: a.allocationId,
      payload: { executionCaseId: a.executionCaseId, status: a.status },
    });
    return {
      mutation: a,
      response: a,
      eventType: 'operational-allocation.proposed',
      eventPayload: a,
      auditPayload: a,
    };
  });
}
async function transition(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    ParentVersions & {
      action:
        | 'REQUEST'
        | 'ASSIGNEE_ACCEPT'
        | 'ASSIGNEE_DECLINE'
        | 'RM_CONFIRM'
        | 'RM_CONDITIONAL'
        | 'RM_DECLINE';
      rationale: string;
      conditions: string[];
      expectedTimeBasis: OperationalAllocation['timeBasis'];
    }
  >
) {
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const a = await tx.getAggregatePayload<OperationalAllocation>(
      envelope.organizationId,
      'operational_allocation',
      envelope.aggregateId
    );
    if (!a) throw new MaterialCommandValidationError('Allocation not found');
    const map: any = {
      REQUEST: 'REQUESTED',
      ASSIGNEE_ACCEPT: 'ASSIGNEE_ACCEPTED',
      ASSIGNEE_DECLINE: 'ASSIGNEE_DECLINED',
      RM_CONFIRM: 'CONFIRMED',
      RM_CONDITIONAL: 'CONDITIONALLY_CONFIRMED',
      RM_DECLINE: 'DECLINED',
    };
    const nextStatus = map[envelope.payload.action] as OperationalAllocation['status'];
    if (envelope.payload.action === 'REQUEST' && a.status !== 'PROPOSED')
      throw new MaterialCommandValidationError('Only PROPOSED allocation can be requested');
    if (
      envelope.payload.action.startsWith('ASSIGNEE_') &&
      (a.status !== 'REQUESTED' || a.assigneeId !== envelope.actorId)
    )
      throw new MaterialCommandValidationError('Named assignee response is required');
    if (
      envelope.payload.action.startsWith('RM_') &&
      (a.status !== 'ASSIGNEE_ACCEPTED' || a.resourceManagerId !== envelope.actorId)
    )
      throw new MaterialCommandValidationError(
        'Resource Manager authority after assignee acceptance is required'
      );
    if (['RM_CONFIRM', 'RM_CONDITIONAL'].includes(envelope.payload.action)) {
      const assessment = simulateOperationalAllocation(a, envelope.payload.expectedTimeBasis);
      if (assessment.state !== 'READY')
        throw new MaterialCommandValidationError(`Allocation activation ${assessment.state}`);
      if (envelope.payload.action === 'RM_CONDITIONAL' && !envelope.payload.conditions.length)
        throw new MaterialCommandValidationError('Conditional confirmation requires conditions');
    }
    await parents(
      tx,
      envelope.organizationId,
      a,
      envelope.payload.expectedCaseVersion,
      envelope.payload.expectedTaskVersion,
      nextStatus
    );
    const next = {
      ...a,
      status: nextStatus,
      conditions: envelope.payload.conditions,
      rationale: envelope.payload.rationale,
      updatedAt: new Date().toISOString(),
    };
    return {
      mutation: next,
      response: next,
      eventType: `operational-allocation.${nextStatus.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
export async function transitionOperationalAllocation(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<
    ParentVersions & {
      action:
        | 'REQUEST'
        | 'ASSIGNEE_ACCEPT'
        | 'ASSIGNEE_DECLINE'
        | 'RM_CONFIRM'
        | 'RM_CONDITIONAL'
        | 'RM_DECLINE';
      rationale: string;
      conditions: string[];
      expectedTimeBasis: OperationalAllocation['timeBasis'];
    }
  >
): Promise<MaterialCommandResult<OperationalAllocation>> {
  if (
    envelope.commandType !== 'operational-allocation.transition' ||
    envelope.aggregateType !== 'operational_allocation'
  )
    throw new MaterialCommandValidationError('Invalid allocation transition');
  return transition(uow, envelope);
}
