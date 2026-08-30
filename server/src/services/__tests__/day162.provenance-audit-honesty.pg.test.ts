/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('day162 provenance and audit honesty — real PostgreSQL', { retry: 0 }, () => {
  const tag = randomUUID();
  const organizationId = `day162-org-${tag}`;
  const userId = `day162-user-${tag}`;
  const historicalActionId = `day162-history-action-${tag}`;
  const historicalRunId = `day162-history-run-${tag}`;
  const historicalEventId = `day162-history-event-${tag}`;
  const actionIds: string[] = [];
  const taskIds: string[] = [];
  let pool: Pool;
  let historicalHashBefore: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, 'Day 162', 'enterprise', 'active')`,
      [organizationId]
    );
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1, $2, $3, 'unused', 'OWNER', 'active')`,
      [userId, organizationId, `${userId}@test.local`]
    );
    await pool.query(
      `INSERT INTO ai_actions
         (id, user_id, organization_id, action_type, payload, draft_content, status)
       VALUES ($1, $2, $3, 'HISTORICAL', '{}', '{}', 'EXECUTED')`,
      [historicalActionId, userId, organizationId]
    );
    await pool.query(
      `INSERT INTO ai_run_ledger
         (run_id, action_id, trigger, user_id, organization_id, tool, status, audit)
       VALUES ($1, $2, 'historical', $3, $4, 'HISTORICAL', 'audited', $5)`,
      [
        historicalRunId,
        historicalActionId,
        userId,
        organizationId,
        JSON.stringify({ rollbackStatus: 'rollback_available', historical: true }),
      ]
    );
    await pool.query(
      `INSERT INTO ai_run_events
         (id, run_id, action_id, event_type, actor_user_id, status, details)
       VALUES ($1, $2, $3, 'historical_event', $4, 'audited', $5)`,
      [
        historicalEventId,
        historicalRunId,
        historicalActionId,
        userId,
        JSON.stringify({ rollbackStatus: 'rollback_available', historical: true }),
      ]
    );
    historicalHashBefore = (
      await pool.query<{ hash: string }>(
        `SELECT md5(l.audit || '|' || e.details || '|' || l.status || '|' || e.status) AS hash
           FROM ai_run_ledger l
           JOIN ai_run_events e ON e.run_id = l.run_id
          WHERE l.run_id = $1 AND e.id = $2`,
        [historicalRunId, historicalEventId]
      )
    ).rows[0].hash;
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM notifications WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM tasks WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM decisions WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id = $1`, [organizationId]);
    await pool.query(`DELETE FROM ai_run_events WHERE action_id = ANY($1::text[])`, [
      [...actionIds, historicalActionId],
    ]);
    await pool.query(`DELETE FROM ai_run_ledger WHERE action_id = ANY($1::text[])`, [
      [...actionIds, historicalActionId],
    ]);
    await pool.query(`DELETE FROM ai_actions WHERE id = ANY($1::text[])`, [
      [...actionIds, historicalActionId],
    ]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
    await pool.end();
  });

  async function approvedAction(actionType: string, draftContent: Record<string, unknown>) {
    const id = `day162-action-${randomUUID()}`;
    actionIds.push(id);
    await pool.query(
      `INSERT INTO ai_actions
         (id, user_id, organization_id, action_type, payload, draft_content, status)
       VALUES ($1, $2, $3, $4, '{}', $5, 'APPROVED')`,
      [id, userId, organizationId, actionType, JSON.stringify(draftContent)]
    );
    return id;
  }

  it('writes honest rollback_unavailable for two executed action types and preserves history', async () => {
    const [{ default: AIActionExecutor }, { ACTION_TYPES }] = await Promise.all([
      import('../aiActionExecutor.js'),
      import('../aiActionExecutor.js'),
    ]);
    const taskActionId = await approvedAction(ACTION_TYPES.CREATE_DRAFT_TASK, {
      title: `Day 162 task ${tag}`,
      description: 'provenance evidence',
    });
    const decisionActionId = await approvedAction(ACTION_TYPES.CREATE_DRAFT_DECISION, {
      title: `Day 162 decision ${tag}`,
      description: 'audit evidence',
      type: 'OTHER',
    });

    const taskResult = await AIActionExecutor.executeAction(taskActionId, userId);
    const decisionResult = await AIActionExecutor.executeAction(decisionActionId, userId);
    expect(taskResult.success).toBe(true);
    expect(decisionResult.success).toBe(true);
    taskIds.push(String(taskResult.result.taskId));

    const ledger = await pool.query<{ action_id: string; rollback_status: string }>(
      `SELECT action_id, audit::jsonb->>'rollbackStatus' AS rollback_status
         FROM ai_run_ledger WHERE action_id = ANY($1::text[]) ORDER BY action_id`,
      [[taskActionId, decisionActionId]]
    );
    const events = await pool.query<{ action_id: string; rollback_status: string }>(
      `SELECT action_id, details::jsonb->>'rollbackStatus' AS rollback_status
         FROM ai_run_events
        WHERE action_id = ANY($1::text[]) AND event_type = 'execution_succeeded'
        ORDER BY action_id`,
      [[taskActionId, decisionActionId]]
    );
    console.info('DAY162_SELECT_AI_RUN_LEDGER', JSON.stringify(ledger.rows));
    console.info('DAY162_SELECT_AI_RUN_EVENTS', JSON.stringify(events.rows));
    expect(ledger.rows.map((row) => row.rollback_status)).toEqual([
      'rollback_unavailable',
      'rollback_unavailable',
    ]);
    expect(events.rows.map((row) => row.rollback_status)).toEqual([
      'rollback_unavailable',
      'rollback_unavailable',
    ]);

    const historical = await pool.query<{ count: number; hash: string }>(
      `SELECT count(*)::int AS count,
              md5(max(l.audit) || '|' || max(e.details) || '|' || max(l.status) || '|' || max(e.status)) AS hash
         FROM ai_run_ledger l
         JOIN ai_run_events e ON e.run_id = l.run_id
        WHERE l.run_id = $1 AND e.id = $2`,
      [historicalRunId, historicalEventId]
    );
    expect(historical.rows[0]).toEqual({ count: 1, hash: historicalHashBefore });
  });

  it('stores source=ai through both autonomous AI task executors', async () => {
    const { TaskExecutor } = await import('../../ai/actionExecutors/taskExecutor.js');
    const result = await TaskExecutor.execute(
      { title: `Day 162 task executor ${tag}` },
      { userId, organizationId }
    );
    expect(result.success).toBe(true);
    const executorTaskId = String((result.result as { taskId: string }).taskId);
    taskIds.push(executorTaskId);

    const rows = await pool.query<{ id: string; source: string }>(
      `SELECT id, source FROM tasks WHERE id = ANY($1::text[]) ORDER BY id`,
      [taskIds]
    );
    console.info('DAY162_SELECT_TASK_SOURCE', JSON.stringify(rows.rows));
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.map((row) => row.source)).toEqual(['ai', 'ai']);
  });
});
