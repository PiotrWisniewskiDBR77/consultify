import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import { createExecutionMilestone } from '../../../server/src/domain/initiatives-execution/executionMilestone';
import {
  completeExecutionTask,
  createExecutionTask,
  updateExecutionTask,
} from '../../../server/src/domain/initiatives-execution/executionWork';
import { transitionCanonicalTask } from '../../../server/src/domain/initiatives-execution/executionWorkHardening';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('ACO-37 Execution Milestone blast radius realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-aco37',
    caseId = 'case-aco37',
    initiativeId = 'initiative-aco37',
    milestoneId = 'milestone-aco37',
    taskId = 'task-aco37';
  const env = (
    type: string,
    id: string,
    v: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: 'owner',
    aggregateType: type,
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'execution-work',
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,7,$3::jsonb),($1,'execution_case',$4,1,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, projectId: 'p1', lifecycleState: 'IN_EXECUTION' }),
        caseId,
        JSON.stringify({
          executionCaseId: caseId,
          initiativeId,
          state: 'ACTIVE',
          handoffPackageId: 'baseline-1',
          handoffPackageVersion: 2,
          acceptedBaseline: { scope: 'pilot' },
        }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  it('projects blocked blast radius and recomputes complete/reopen without inventing forecast', async () => {
    const milestoneCommand = env(
      'execution_milestone',
      milestoneId,
      0,
      'm-create',
      'execution.milestone.create',
      {
        executionCaseId: caseId,
        initiativeId,
        baselineRef: { ref: 'baseline-1', version: 2 },
        title: 'Pilot go-live',
        ownerId: 'owner',
        targetAt: '2026-09-10T00:00:00Z',
        forecastAt: '2026-09-12T00:00:00Z',
        evidenceRefs: ['baseline:e1'],
        sourceVersions: { executionCaseVersion: 1, baselineVersion: 2 },
      },
      true
    );
    expect((await createExecutionMilestone(uow, milestoneCommand)).status).toBe('APPLIED');
    expect((await createExecutionMilestone(uow, milestoneCommand)).status).toBe('REPLAYED');
    await createExecutionTask(
      uow,
      env(
        'execution_task',
        taskId,
        0,
        't-create',
        'execution.task.create',
        {
          expectedCaseVersion: 1,
          executionCaseId: caseId,
          initiativeId,
          title: 'Pilot cutover',
          description: '',
          assigneeId: 'assignee',
          ownerId: 'owner',
          dueAt: '2026-09-09T00:00:00Z',
          slaAt: '2026-09-08T00:00:00Z',
          evidenceRefs: [],
          blockerDecisionIds: ['go-no-go'],
          dependencyTaskIds: [],
          milestoneIds: [milestoneId],
        },
        true
      )
    );
    let task = (await reader.listExecutionTasks(org, caseId))[0] as any;
    expect(task).toMatchObject({
      status: 'BLOCKED',
      blastRadius: [
        {
          milestoneId,
          version: 2,
          status: 'AT_RISK',
          readiness: 'BLOCKED',
          forecastVarianceDays: 2,
          sourceVersions: { executionCaseVersion: 1, baselineVersion: 2 },
        },
      ],
    });
    expect((await reader.listMyExecutionWork(org, 'owner')).tasks[0]).toMatchObject({
      taskId,
      blastRadius: [{ milestoneId, status: 'AT_RISK' }],
    });
    await updateExecutionTask(
      uow,
      env('execution_task', taskId, 1, 'unblock', 'execution.task.update', {
        expectedCaseVersion: 2,
        patch: { blockerDecisionIds: [] },
      })
    );
    await completeExecutionTask(
      uow,
      env('execution_task', taskId, 2, 'complete', 'execution.task.complete', {
        expectedCaseVersion: 3,
        evidenceRefs: ['acceptance:e1'],
      })
    );
    expect((await reader.listExecutionMilestones(org, caseId))[0]).toMatchObject({
      version: 4,
      status: 'ACHIEVED',
      readiness: 'COMPLETE',
      forecastAt: '2026-09-12T00:00:00Z',
    });
    await transitionCanonicalTask(
      uow,
      env('execution_task', taskId, 3, 'reopen', 'execution.task.transition', {
        expectedCaseVersion: 4,
        action: 'REOPEN',
        reason: 'Acceptance defect',
      })
    );
    expect((await reader.listExecutionMilestones(org, caseId))[0]).toMatchObject({
      version: 5,
      status: 'READY',
      readiness: 'READY',
      forecastAt: '2026-09-12T00:00:00Z',
      forecastVarianceDays: 2,
    });
    const evidence = await pool.query<{ audits: string; outbox: string }>(
      `SELECT
        (SELECT count(*) FROM ie_audit_events WHERE organization_id=$1)::text AS audits,
        (SELECT count(*) FROM ie_outbox_events WHERE organization_id=$1)::text AS outbox`,
      [org]
    );
    expect(Number(evidence.rows[0].audits)).toBeGreaterThanOrEqual(5);
    expect(Number(evidence.rows[0].outbox)).toBeGreaterThanOrEqual(5);
    expect(await reader.listExecutionMilestones('foreign', caseId)).toEqual([]);
  });
});
