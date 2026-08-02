import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const RUN_DB = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const itDB = RUN_DB ? it : it.skip;

const problemRows = vi.hoisted(() => [] as any[]);
vi.mock('../../server/src/services/v8/managerProblemsService.js', () => ({
  getManagerProblems: vi.fn(async () => problemRows),
}));

import { executeManagerProblemAction } from '../../server/src/services/v8/managerActionExecutionService.js';

describe('MW-12 Manager action ownership and atomic audit (real Postgres)', () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const suffix = randomUUID();
  const orgId = `org-mw12-${suffix}`;
  const actorId = `user-mw12-${suffix}`;
  const successTaskId = `task-mw12-ok-${suffix}`;
  const rollbackTaskId = `task-mw12-rollback-${suffix}`;
  const triggerName = `mw12_audit_fail_${suffix.replaceAll('-', '_')}`;
  const functionName = `${triggerName}_fn`;

  beforeAll(async () => {
    if (!RUN_DB) return;
    await client.connect();
    await client.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'MW-12 acceptance', 'enterprise', 'active')`,
      [orgId]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'not-used', 'ADMIN', 'active')`,
      [actorId, orgId, `${actorId}@local.test`]
    );
    for (const taskId of [successTaskId, rollbackTaskId]) {
      await client.query(
        `INSERT INTO tasks (id, organization_id, title, status, due_date)
         VALUES ($1, $2, 'MW-12 overdue task', 'TODO', DATE '2026-01-01')`,
        [taskId, orgId]
      );
    }
  });

  afterAll(async () => {
    if (!RUN_DB) return;
    await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON manager_action_audit_log`).catch(() => {});
    await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`).catch(() => {});
    await client.query(`DELETE FROM manager_action_audit_log WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM tasks WHERE organization_id = $1`, [orgId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [actorId]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await client.end();
  });

  function selectProblem(taskId: string) {
    problemRows.splice(0, problemRows.length, {
      id: `aq-task-overdue-${taskId}`,
      severity: 'warning',
      problemType: 'overdue_task',
      title: 'Overdue task',
      rootCause: 'Past due date',
      sourceEntityType: 'TASK',
      sourceEntityId: taskId,
      sourceEntityName: 'MW-12 overdue task',
      ownerId: actorId,
      ownerName: 'Manager',
      daysOverdue: 10,
      impactCount: 0,
      affectedEntities: [],
      actions: [{ id: 'replan', label: 'Replan' }],
      meta: {},
    });
    return problemRows[0].id as string;
  }

  itDB('commits the task mutation and actor-owned audit together, with durable read-back', async () => {
    const problemId = selectProblem(successTaskId);
    const result = await executeManagerProblemAction({
      organizationId: orgId,
      userId: actorId,
      laneId: 'action-queue',
      problemId,
      actionId: 'replan',
    });

    expect(result.changedEntities).toEqual([{ entityType: 'TASK', entityId: successTaskId }]);
    const task = await client.query(`SELECT due_date FROM tasks WHERE id = $1`, [successTaskId]);
    const audit = await client.query(
      `SELECT organization_id, entity_type, entity_id, action, user_id
         FROM manager_action_audit_log
        WHERE organization_id = $1 AND entity_id = $2`,
      [orgId, successTaskId]
    );
    expect(task.rows[0].due_date).not.toBeNull();
    expect(audit.rows).toEqual([
      expect.objectContaining({
        organization_id: orgId,
        entity_type: 'TASK',
        entity_id: successTaskId,
        action: 'manager_replan',
        user_id: actorId,
      }),
    ]);
  });

  itDB('rolls the task mutation back and returns no false success when the audit write fails', async () => {
    await client.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.entity_id = '${rollbackTaskId}' THEN
          RAISE EXCEPTION 'MW12 forced audit failure';
        END IF;
        RETURN NEW;
      END $$
    `);
    await client.query(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON manager_action_audit_log
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `);

    const before = await client.query(`SELECT due_date FROM tasks WHERE id = $1`, [rollbackTaskId]);
    const problemId = selectProblem(rollbackTaskId);
    await expect(
      executeManagerProblemAction({
        organizationId: orgId,
        userId: actorId,
        laneId: 'action-queue',
        problemId,
        actionId: 'replan',
      })
    ).rejects.toThrow(/MW12 forced audit failure/);

    const after = await client.query(`SELECT due_date FROM tasks WHERE id = $1`, [rollbackTaskId]);
    const audit = await client.query(
      `SELECT id FROM manager_action_audit_log WHERE organization_id = $1 AND entity_id = $2`,
      [orgId, rollbackTaskId]
    );
    expect(after.rows[0].due_date.toISOString()).toBe(before.rows[0].due_date.toISOString());
    expect(audit.rows).toHaveLength(0);
  });

  itDB('fails closed for a stale/cross-tenant entity instead of auditing a mutation that changed zero rows', async () => {
    const foreignTaskId = `foreign-${rollbackTaskId}`;
    const problemId = selectProblem(foreignTaskId);
    await expect(
      executeManagerProblemAction({
        organizationId: orgId,
        userId: actorId,
        laneId: 'action-queue',
        problemId,
        actionId: 'replan',
      })
    ).rejects.toThrow(/expected exactly one changed row, got 0/);

    const audit = await client.query(
      `SELECT id FROM manager_action_audit_log WHERE organization_id = $1 AND entity_id = $2`,
      [orgId, foreignTaskId]
    );
    expect(audit.rows).toHaveLength(0);
  });
});
