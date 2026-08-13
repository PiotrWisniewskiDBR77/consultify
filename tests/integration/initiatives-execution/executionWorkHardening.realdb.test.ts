import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  transitionCanonicalDecision,
  transitionCanonicalTask,
} from '../../../server/src/domain/initiatives-execution/executionWorkHardening';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Canonical Task Decision My Work hardening realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-ie042',
    caseId = 'case-ie042',
    initiativeId = 'initiative-ie042',
    taskId = 'task-ie042',
    decisionId = 'decision-ie042';
  const env = (type: string, id: string, actor: string, v: number, key: string, payload: any) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: 'execution-work',
    policyVersion: 1,
    commandType:
      type === 'execution_task' ? 'execution.task.transition' : 'execution.decision.transition',
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
    const task = {
        taskId,
        executionCaseId: caseId,
        initiativeId,
        title: 'Canonical task',
        description: '',
        status: 'OPEN',
        assigneeId: 'worker',
        ownerId: 'owner',
        dueAt: '2026-01-01T00:00:00.000Z',
        slaAt: '2026-01-01T00:00:00.000Z',
        evidenceRefs: [],
        blockerDecisionIds: [],
        dependencyTaskIds: [],
        createdAt: '2025-12-01T00:00:00.000Z',
        completedAt: null,
      },
      decision = {
        decisionId,
        executionCaseId: caseId,
        initiativeId,
        title: 'Canonical decision',
        status: 'APPROVED',
        options: [
          { optionId: 'a', label: 'A' },
          { optionId: 'b', label: 'B' },
        ],
        authorityId: 'authority',
        requesterId: 'owner',
        dueAt: '2026-01-01T00:00:00.000Z',
        rationale: 'Old',
        conditions: [],
        followUpTaskId: null,
        createdAt: '2025-12-01T00:00:00.000Z',
        decidedAt: '2025-12-02T00:00:00.000Z',
      };
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'execution_case',$2,1,$3::jsonb),($1,'execution_task',$4,1,$5::jsonb),($1,'execution_decision',$6,2,$7::jsonb)`,
      [
        org,
        caseId,
        JSON.stringify({
          executionCaseId: caseId,
          initiativeId,
          state: 'ACTIVE',
          rollup: { refreshedAt: '2025-01-01T00:00:00Z' },
        }),
        taskId,
        JSON.stringify(task),
        decisionId,
        JSON.stringify(decision),
      ]
    );
  });
  afterAll(async () => pool.end());
  it('offers/accepts/escalates/cancels/reopens with same canonical IDs and exact versions across read models', async () => {
    const task = (
        actor: string,
        v: number,
        caseV: number,
        key: string,
        action: string,
        reason = 'reason'
      ) =>
        transitionCanonicalTask(
          uow,
          env('execution_task', taskId, actor, v, key, {
            expectedCaseVersion: caseV,
            action,
            reason,
            level: 'CRITICAL',
          }) as any
        ),
      decision = (actor: string, v: number, caseV: number, key: string, action: string) =>
        transitionCanonicalDecision(
          uow,
          env('execution_decision', decisionId, actor, v, key, {
            expectedCaseVersion: caseV,
            action,
            reason: 'governed reason',
            level: 'CRITICAL',
          }) as any
        );
    await task('owner', 1, 1, 'offer', 'OFFER_ASSIGNMENT');
    const accepted = await task('worker', 2, 2, 'accept', 'ACCEPT_ASSIGNMENT'),
      replay = await task('worker', 2, 2, 'accept', 'ACCEPT_ASSIGNMENT');
    expect(replay.status).toBe('REPLAYED');
    await task('owner', 3, 3, 'escalate', 'ESCALATE', 'SLA breached');
    await task('owner', 4, 4, 'cancel', 'CANCEL', 'Work withdrawn');
    await task('owner', 5, 5, 'reopen', 'REOPEN', 'Scope restored');
    await decision('authority', 2, 6, 'decision-reopen', 'REOPEN');
    await decision('authority', 3, 7, 'decision-cancel', 'CANCEL');
    const detailTasks = await reader.listExecutionTasks(org, caseId),
      my = await reader.listMyExecutionWork(org, 'worker'),
      detailDecisions = await reader.listExecutionDecisions(org, caseId);
    expect(accepted.response).toEqual(
      expect.objectContaining({
        taskId,
        assignment: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    );
    expect(detailTasks).toEqual([
      expect.objectContaining({
        taskId,
        version: 6,
        status: 'OPEN',
        overdue: true,
        escalation: expect.objectContaining({ level: 'CRITICAL' }),
        reopenReason: 'Scope restored',
      }),
    ]);
    expect(my.tasks).toEqual([expect.objectContaining({ taskId, version: 6 })]);
    expect(detailDecisions).toEqual([
      expect.objectContaining({
        decisionId,
        version: 4,
        status: 'CANCELED',
        reopenReason: 'governed reason',
        cancelReason: 'governed reason',
      }),
    ]);
    expect(await reader.listExecutionTasks('foreign', caseId)).toEqual([]);
    const counts = await pool.query(
      `SELECT (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) tasks,(SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$3) decisions`,
      [org, taskId, decisionId]
    );
    expect(counts.rows[0]).toEqual({ tasks: 1, decisions: 1 });
  });
});
