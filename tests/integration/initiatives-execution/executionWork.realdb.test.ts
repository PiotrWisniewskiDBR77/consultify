import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  completeExecutionTask,
  createExecutionDecision,
  createExecutionTask,
  decideExecutionDecision,
  requestExecutionDecision,
  updateExecutionTask,
} from '../../../server/src/domain/initiatives-execution/executionWork';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Execution Work canonical Task and Decision realDB', () => {
  const pool = new Pool({ connectionString: url, max: 4 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie072',
    caseId = 'case-ie072',
    initiativeId = 'initiative-ie072';
  const env = (
    type: string,
    id: string,
    actor: string,
    version: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: version,
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,20,$3::jsonb),($1,'execution_case',$4,1,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: 'p1',
          lifecycleState: 'IN_EXECUTION',
          executionCaseId: caseId,
        }),
        caseId,
        JSON.stringify({ executionCaseId: caseId, initiativeId, state: 'ACTIVE' }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  it('keeps same IDs across Case/Praca/My Work, blocks Task by Decision and creates one conditional follow-up on retry', async () => {
    await createExecutionDecision(
      uow,
      env(
        'execution_decision',
        'decision-1',
        'owner',
        0,
        'd-create',
        'execution.decision.create',
        {
          expectedCaseVersion: 1,
          executionCaseId: caseId,
          initiativeId,
          title: 'Select recovery option',
          options: [
            { optionId: 'a', label: 'A' },
            { optionId: 'b', label: 'B' },
          ],
          authorityId: 'authority',
          dueAt: '2026-08-20T12:00:00Z',
        },
        true
      )
    );
    await requestExecutionDecision(
      uow,
      env(
        'execution_decision',
        'decision-1',
        'owner',
        1,
        'd-request',
        'execution.decision.request',
        { expectedCaseVersion: 2 }
      )
    );
    await createExecutionTask(
      uow,
      env(
        'execution_task',
        'task-blocked',
        'owner',
        0,
        't-create',
        'execution.task.create',
        {
          expectedCaseVersion: 3,
          executionCaseId: caseId,
          initiativeId,
          title: 'Implement option',
          description: 'Blocked pending decision',
          assigneeId: 'worker',
          ownerId: 'owner',
          dueAt: '2026-08-25T12:00:00Z',
          slaAt: '2026-08-24T12:00:00Z',
          evidenceRefs: [],
          blockerDecisionIds: ['decision-1'],
          dependencyTaskIds: [],
        },
        true
      )
    );
    expect((await reader.listMyExecutionWork(org, 'worker')).tasks).toEqual([
      expect.objectContaining({
        taskId: 'task-blocked',
        status: 'BLOCKED',
        executionCaseId: caseId,
        initiativeId,
      }),
    ]);
    expect((await reader.listMyExecutionWork(org, 'authority')).decisions).toEqual([
      expect.objectContaining({ decisionId: 'decision-1', status: 'PENDING' }),
    ]);
    const decisionPayload = {
      expectedCaseVersion: 4,
      outcome: 'CONDITIONALLY_APPROVED' as const,
      rationale: 'Approve with verification',
      conditions: ['Verify result'],
      followUpTask: {
        taskId: 'task-followup',
        title: 'Verify result',
        description: 'Evidence follow-up',
        assigneeId: 'worker',
        ownerId: 'owner',
        dueAt: '2026-08-30T12:00:00Z',
        slaAt: '2026-08-29T12:00:00Z',
        evidenceRefs: [],
        dependencyTaskIds: ['task-blocked'],
      },
    };
    await decideExecutionDecision(
      uow,
      env(
        'execution_decision',
        'decision-1',
        'authority',
        2,
        'd-decide',
        'execution.decision.decide',
        decisionPayload
      )
    );
    const replay = await decideExecutionDecision(
      uow,
      env(
        'execution_decision',
        'decision-1',
        'authority',
        2,
        'd-decide',
        'execution.decision.decide',
        decisionPayload
      )
    );
    expect(replay.status).toBe('REPLAYED');
    expect(
      (await reader.listExecutionTasks(org, caseId)).filter(
        (t: any) => t.taskId === 'task-followup'
      )
    ).toHaveLength(1);
    await updateExecutionTask(
      uow,
      env('execution_task', 'task-blocked', 'owner', 1, 't-unblock', 'execution.task.update', {
        expectedCaseVersion: 5,
        patch: { blockerDecisionIds: [] },
      })
    );
    await completeExecutionTask(
      uow,
      env('execution_task', 'task-blocked', 'worker', 2, 't-complete', 'execution.task.complete', {
        expectedCaseVersion: 6,
        evidenceRefs: ['artifact:completion:1'],
      })
    );
    const work = {
      tasks: await reader.listExecutionTasks(org, caseId),
      decisions: await reader.listExecutionDecisions(org, caseId),
    };
    expect(work.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskId: 'task-blocked', status: 'COMPLETED' }),
        expect.objectContaining({ taskId: 'task-followup', status: 'OPEN' }),
      ])
    );
    expect(work.decisions).toEqual([
      expect.objectContaining({
        decisionId: 'decision-1',
        status: 'CONDITIONALLY_APPROVED',
        followUpTaskId: 'task-followup',
      }),
    ]);
    const parent = await reader.findExecutionCase(org, caseId);
    expect(parent?.detail.rollup).toMatchObject({
      tasksTotal: 2,
      tasksCompleted: 1,
      tasksBlocked: 0,
      decisionsPending: 0,
      decisionsDecided: 1,
    });
    expect(await reader.listExecutionTasks('foreign-org', caseId)).toEqual([]);
    expect(await reader.listExecutionDecisions('foreign-org', caseId)).toEqual([]);
  });
});
