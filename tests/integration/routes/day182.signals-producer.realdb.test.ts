/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import config from '../../../server/src/config/Config.js';
import { runDeterministicForOrganization } from '../../../server/src/jobs/workSignalProducerJob.js';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const organizationId = 'w3-chat-owner-org-v1';
const userId = 'w3-chat-owner-user-v1';
const initiativeId = 'day182-initiative-no-baseline';
const taskId = 'day182-task-overdue';
const pool = new Pool({ connectionString: databaseUrl });
const app = express();

app.use(express.json());
ApiGateway.getInstance().initializeRoutes(app);

const token = jwt.sign(
  {
    id: userId,
    userId,
    email: 'owner.chat@consultify.local',
    organizationId,
    organization_id: organizationId,
    role: 'OWNER',
    permissions: ['*'],
  },
  config.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: '10m' }
);

describe.skipIf(!enabled)('day182 deterministic signal producer real path', NO_RETRY, () => {
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    await pool.query(
      `INSERT INTO initiatives(id, organization_id, name, status, owner_execution_id)
       VALUES($1, $2, 'Day 182 initiative without baseline', 'DRAFT', $3)`,
      [initiativeId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO tasks(id, organization_id, title, status, assignee_id, due_date, updated_at)
       VALUES($1, $2, 'Day 182 overdue task', 'todo', $3, now() - interval '8 days', now())`,
      [taskId, organizationId, userId]
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM work_signals WHERE organization_id=$1 AND subject_id=ANY($2)`, [
      organizationId,
      [initiativeId, taskId],
    ]);
    await pool.query(`DELETE FROM tasks WHERE id=$1`, [taskId]);
    await pool.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
    await pool.end();
    const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('OFF records ON_DEMAND as SKIPPED_DISABLED and CRON writes no ledger row', async () => {
    const previous = process.env.ENABLE_SIGNAL_PRODUCER;
    delete process.env.ENABLE_SIGNAL_PRODUCER;
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM work_signal_runs WHERE organization_id=$1 AND trigger='CRON'`,
      [organizationId]
    );
    const onDemand = await runDeterministicForOrganization({ organizationId, trigger: 'ON_DEMAND' });
    const cron = await runDeterministicForOrganization({ organizationId, trigger: 'CRON' });
    const persisted = await pool.query(
      `SELECT trigger, status FROM work_signal_runs WHERE organization_id=$1 AND run_id=$2`,
      [organizationId, onDemand.runId]
    );
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM work_signal_runs WHERE organization_id=$1 AND trigger='CRON'`,
      [organizationId]
    );
    expect(onDemand.status).toBe('SKIPPED_DISABLED');
    expect(cron.status).toBe('SKIPPED_DISABLED');
    expect(persisted.rows).toEqual([{ trigger: 'ON_DEMAND', status: 'SKIPPED_DISABLED' }]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    if (previous === undefined) delete process.env.ENABLE_SIGNAL_PRODUCER;
    else process.env.ENABLE_SIGNAL_PRODUCER = previous;
  });

  it('ON creates deterministic signals and a completed durable run', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    const result = await runDeterministicForOrganization({ organizationId, trigger: 'ON_DEMAND' });
    expect(result.status).toBe('PARTIAL');
    expect(result.rulesEvaluated).toBe(8);
    expect(result.signalsOpened).toBeGreaterThanOrEqual(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('Legacy execution signal adapter failed'),
      expect.stringContaining('Legacy execution signal adapter failed'),
    ]);
    const run = await pool.query(
      `SELECT status, trigger, rules_evaluated FROM work_signal_runs
       WHERE organization_id=$1 AND run_id=$2`,
      [organizationId, result.runId]
    );
    expect(run.rows).toEqual([{ status: 'PARTIAL', trigger: 'ON_DEMAND', rules_evaluated: 8 }]);
    const signals = await pool.query(
      `SELECT rule_id, subject_id, status FROM work_signals
       WHERE organization_id=$1 AND subject_id=ANY($2) ORDER BY rule_id`,
      [organizationId, [initiativeId, taskId]]
    );
    expect(signals.rows).toEqual(
      expect.arrayContaining([
        { rule_id: 'exec.initiative.no_baseline', subject_id: initiativeId, status: 'OPEN' },
        { rule_id: 'exec.task.overdue', subject_id: taskId, status: 'OPEN' },
      ])
    );
  });

  it('signed JWT reaches the mounted feed through the real ApiGateway', async () => {
    process.env.ENABLE_SIGNAL_PRODUCER = 'true';
    const response = await request(app)
      .get('/api/signals')
      .set('Authorization', `Bearer ${token}`)
      .set('accept-language', 'pl');
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.producerEnabled).toBe(true);
    expect(response.body.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: taskId,
          source: expect.objectContaining({ ruleId: 'exec.task.overdue' }),
        }),
      ])
    );
  });

  it('records the initiative audience mismatch instead of claiming it is visible to OWNER', async () => {
    const response = await request(app)
      .get('/api/signals')
      .set('Authorization', `Bearer ${token}`)
      .set('accept-language', 'pl');
    const initiative = response.body.signals.find(
      (signal: { entityId: string }) => signal.entityId === initiativeId
    );
    expect(initiative).toBeUndefined();
    const persisted = await pool.query(
      `SELECT audience_user_id, audience_role FROM work_signals
       WHERE organization_id=$1 AND subject_id=$2 AND rule_id='exec.initiative.no_baseline'`,
      [organizationId, initiativeId]
    );
    expect(persisted.rows).toEqual([{ audience_user_id: userId, audience_role: 'PROJECT_MANAGER' }]);
  });
});
