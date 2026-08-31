/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL ?? '';
// Both repository Vitest configs overwrite DB_TYPE with sqlite after reading
// the command environment. Restore the separately named, explicit Day 164
// request before any database/application module is dynamically imported.
process.env.DB_TYPE = process.env.DAY164_EFFECTIVE_DB_TYPE ?? process.env.DB_TYPE;

describe('Day 164 agent execution through production ApiGateway, real PostgreSQL and Redis', () => {
  const run = randomUUID();
  const organizationId = `day164-org-${run}`;
  const userId = `day164-user-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';
  let stopWorker: (() => Promise<void>) | undefined;
  let closeQueue: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'Day 164')`, [organizationId]);
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,first_name,last_name,role,status)
       VALUES ($1,$2,$3,'unused','Day','164','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [`day164-member-${run}`, organizationId, userId]
    );

    const { default: config } = await import('../../config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    const runtime = await import('../aiWorkerRuntime.js');
    await runtime.startAiTasksWorker(process.env);
    stopWorker = runtime.stopAiTasksWorker;
    const { default: queue } = await import('../../queues/aiQueue.js');
    closeQueue = async () => queue.close();
  }, 120_000);

  afterAll(async () => {
    await stopWorker?.();
    await closeQueue?.();
    if (!pool) return;
    // The attempt ledger is intentionally append-only. Preserve all Day 164
    // evidence in this disposable database and remove it with the owned
    // container after the report is complete.
    await pool.end();
  }, 60_000);

  it('does not close the durable receipt as SUCCEEDED while the plan awaits approval', async () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    expect(process.env.MOCK_REDIS).toBe('false');
    // FIX-174 (ERRATA ODBIOR_174 pkt 4, Z31): this line was pinned to the
    // exact dev-machine URL ('postgresql://postgres:cx@127.0.0.1:6052/cx164'
    // — machine "164"), which fails this test — the only guard on this
    // receipt-closing semantics — on every OTHER machine it is run from.
    // `assertRealPostgresTestEnvironment()` above already proves, via a live
    // `SELECT version()`/`current_database()` round trip, that this is a
    // real, unmocked, non-forbidden PostgreSQL. Here we only pin the SHAPE
    // (a local Postgres URL, not a mock/placeholder string), so the test
    // passes against any local database on any machine.
    expect(databaseUrl).toMatch(/^postgresql:\/\/[^/]+@(127\.0\.0\.1|localhost):\d+\/[^/]+$/);
    expect(databaseUrl.toLowerCase()).not.toContain('mock');

    const headers = { Authorization: authorization, 'x-organization-id': organizationId };
    const created = await request(app)
      .post('/api/ai/agent-plan')
      .set(headers)
      .send({
        title: 'Day 164 local execution proof',
        draft: true,
        steps: [
          {
            toolName: 'generate_report_section',
            toolInput: {
              section_title: 'Day 164',
              section_type: 'analysis',
              format: 'bullet_points',
            },
          },
        ],
      });
    console.info(
      `DAY164_CREATE_HTTP status=${created.status} body=${JSON.stringify(created.body)}`
    );
    expect(created.status).toBe(201);
    expect(created.body.dispatch).toBe('deferred');
    const planId = String(created.body.plan.id);

    const started = await request(app)
      .post(`/api/ai/agent-plan/${planId}/run`)
      .set(headers)
      .send({ idempotencyKey: `day164-${run}` });
    console.info(`DAY164_RUN_HTTP status=${started.status} body=${JSON.stringify(started.body)}`);
    expect(started.status).toBe(200);
    expect(started.body.dispatch).toBe('enqueued');

    let receiptRows: Record<string, unknown>[] = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      receiptRows = (
        await pool.query(
          `SELECT receipt_id,organization_id,user_id,plan_id,dispatch_key,bull_job_id,
                  status,attempt_count,last_error_code,lease_owner,lease_expires_at,completed_at
             FROM ai_agent_job_receipts WHERE organization_id=$1 ORDER BY created_at`,
          [organizationId]
        )
      ).rows;
      if (['SUCCEEDED', 'FAILED'].includes(String(receiptRows[0]?.status || ''))) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const attemptRows = (
      await pool.query(
        `SELECT receipt_id,attempt_no,event_type,worker_id,error_code,created_at
           FROM ai_agent_job_attempts WHERE receipt_id=$1 ORDER BY created_at,attempt_id`,
        [receiptRows[0]?.receipt_id]
      )
    ).rows;
    const planRows = (
      await pool.query(
        `SELECT id,status,total_steps,completed_steps,current_step_index,result_summary,error_message
           FROM ai_agent_plans WHERE id=$1`,
        [planId]
      )
    ).rows;
    const stepRows = (
      await pool.query(
        `SELECT plan_id,step_index,tool_name,status,requires_approval,result_json,error_message,duration_ms
           FROM ai_agent_plan_steps WHERE plan_id=$1 ORDER BY step_index`,
        [planId]
      )
    ).rows;
    console.info(`DAY164_RECEIPTS ${JSON.stringify(receiptRows)}`);
    console.info(`DAY164_ATTEMPTS ${JSON.stringify(attemptRows)}`);
    console.info(`DAY164_PLANS ${JSON.stringify(planRows)}`);
    console.info(`DAY164_STEPS ${JSON.stringify(stepRows)}`);

    expect(receiptRows).toHaveLength(1);
    expect(planRows[0]).toMatchObject({
      status: 'awaiting_approval',
      total_steps: 1,
      completed_steps: 0,
    });
    expect(stepRows[0]).toMatchObject({
      tool_name: 'generate_report_section',
      status: 'awaiting_approval',
      requires_approval: true,
    });

    // RED contract: the worker currently returns normally at the approval
    // checkpoint, and finishAgentTask therefore records a false success.
    expect(receiptRows[0]).not.toMatchObject({ status: 'SUCCEEDED' });
    expect(attemptRows.map((row) => row.event_type)).not.toContain('SUCCEEDED');
  }, 30_000);
});
