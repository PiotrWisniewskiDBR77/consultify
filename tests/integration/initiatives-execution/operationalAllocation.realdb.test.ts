import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  proposeOperationalAllocation,
  transitionOperationalAllocation,
} from '../../../server/src/domain/initiatives-execution/operationalAllocation';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Operational Allocation realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie073',
    executionCaseId = 'case-ie073',
    initiativeId = 'initiative-ie073',
    taskId = 'task-ie073',
    allocationId = 'allocation-ie073';
  const basis = {
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: 'w1', start: '2026-08-10T00:00:00.000Z', end: '2026-08-17T00:00:00.000Z' },
    ],
  };
  const ref = {
    ref: 'evidence-1',
    version: 1,
    knowledgeState: 'KNOWN' as const,
    confidence: 'HIGH' as const,
    asOf: '2026-08-10T00:00:00.000Z',
    reason: null,
  };
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3::jsonb),($1,'execution_case',$4,1,$5::jsonb),($1,'execution_task',$6,1,$7::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'IN_EXECUTION' }),
        executionCaseId,
        JSON.stringify({ executionCaseId, initiativeId, state: 'ACTIVE', rollup: {} }),
        taskId,
        JSON.stringify({ taskId, executionCaseId, initiativeId, status: 'OPEN' }),
      ]
    );
  });
  afterAll(async () => pool.end());
  const envelope = (
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    payload: any,
    createIfMissing = false
  ) => ({
    organizationId: org,
    actorId,
    aggregateType: 'operational_allocation',
    aggregateId: allocationId,
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: 'operational-allocation',
    policyVersion: 1,
    commandType: createIfMissing
      ? 'operational-allocation.propose'
      : 'operational-allocation.transition',
    createIfMissing,
    payload,
  });
  it('runs propose/request/assignee/RM flow with canonical readback, exact parent rollup and replay safety', async () => {
    await proposeOperationalAllocation(
      uow,
      envelope(
        'planner',
        0,
        'propose',
        {
          expectedCaseVersion: 1,
          expectedTaskVersion: 1,
          executionCaseId,
          initiativeId,
          taskId,
          assigneeId: 'worker',
          resourceManagerId: 'rm',
          timeBasis: basis,
          demand: { unit: 'FTE', low: 0.5, base: 1, high: 1.5, knowledgeState: 'ESTIMATED' },
          availabilityRef: ref,
          calendarRef: ref,
          remainingEstimateRef: ref,
          skillRequirements: ['delivery'],
          costRef: { ref: 'cost-model', version: 2 },
        },
        true
      ) as any
    );
    expect(await reader.listMyOperationalAllocations(org, 'worker')).toEqual([]);
    const transition = (
      actor: string,
      version: number,
      caseVersion: number,
      taskVersion: number,
      key: string,
      action: string
    ) =>
      transitionOperationalAllocation(
        uow,
        envelope(actor, version, key, {
          expectedCaseVersion: caseVersion,
          expectedTaskVersion: taskVersion,
          action,
          rationale: key,
          conditions: [],
          expectedTimeBasis: basis,
        }) as any
      );
    await transition('planner', 1, 2, 2, 'request', 'REQUEST');
    expect(await reader.listMyOperationalAllocations(org, 'worker')).toEqual([
      expect.objectContaining({ allocationId, status: 'REQUESTED' }),
    ]);
    await transition('worker', 2, 3, 3, 'accept', 'ASSIGNEE_ACCEPT');
    expect(await reader.listMyOperationalAllocations(org, 'rm')).toEqual([
      expect.objectContaining({ allocationId, status: 'ASSIGNEE_ACCEPTED' }),
    ]);
    const confirmed = await transition('rm', 3, 4, 4, 'confirm', 'RM_CONFIRM');
    const replay = await transition('rm', 3, 4, 4, 'confirm', 'RM_CONFIRM');
    expect(confirmed.status).toBe('APPLIED');
    expect(replay.status).toBe('REPLAYED');
    expect(await reader.listOperationalAllocations(org, executionCaseId)).toEqual([
      expect.objectContaining({
        allocationId,
        taskId,
        status: 'CONFIRMED',
        costRef: { ref: 'cost-model', version: 2 },
      }),
    ]);
    expect(await reader.listOperationalAllocations('foreign', executionCaseId)).toEqual([]);
    const parent = await reader.findExecutionCase(org, executionCaseId);
    expect(parent?.detail.rollup).toMatchObject({
      allocationsProposed: 1,
      allocationsConfirmed: 1,
    });
    const task = (await reader.listExecutionTasks(org, executionCaseId))[0] as any;
    expect(task).toMatchObject({ allocationId, allocationStatus: 'CONFIRMED' });
    const evidence = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox,
        (SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$1 AND target_id=$2) relations`,
      [org, allocationId]
    );
    expect(evidence.rows[0]).toMatchObject({ receipts: 4, audits: 4, outbox: 4, relations: 1 });
  });
  it('fails closed at activation when critical evidence remains UNKNOWN', async () => {
    const unknown = {
      ...ref,
      ref: null,
      version: null,
      knowledgeState: 'UNKNOWN' as const,
      confidence: 'UNKNOWN' as const,
    };
    await proposeOperationalAllocation(
      uow,
      envelope(
        'planner',
        0,
        'p-unknown',
        {
          expectedCaseVersion: 1,
          expectedTaskVersion: 1,
          executionCaseId,
          initiativeId,
          taskId,
          assigneeId: 'worker',
          resourceManagerId: 'rm',
          timeBasis: basis,
          demand: { unit: 'FTE', low: null, base: null, high: null, knowledgeState: 'UNKNOWN' },
          availabilityRef: unknown,
          calendarRef: ref,
          remainingEstimateRef: ref,
          skillRequirements: ['delivery'],
          costRef: null,
        },
        true
      ) as any
    );
    const transition = (
      actor: string,
      version: number,
      caseVersion: number,
      taskVersion: number,
      key: string,
      action: string
    ) =>
      transitionOperationalAllocation(
        uow,
        envelope(actor, version, key, {
          expectedCaseVersion: caseVersion,
          expectedTaskVersion: taskVersion,
          action,
          rationale: key,
          conditions: [],
          expectedTimeBasis: basis,
        }) as any
      );
    await transition('planner', 1, 2, 2, 'r-unknown', 'REQUEST');
    await transition('worker', 2, 3, 3, 'a-unknown', 'ASSIGNEE_ACCEPT');
    await expect(transition('rm', 3, 4, 4, 'c-unknown', 'RM_CONFIRM')).rejects.toThrow(
      'EVIDENCE_MISSING'
    );
    expect(await reader.listOperationalAllocations(org, executionCaseId)).toEqual([
      expect.objectContaining({
        status: 'ASSIGNEE_ACCEPTED',
        demand: expect.objectContaining({ base: null }),
      }),
    ]);
  });
});
