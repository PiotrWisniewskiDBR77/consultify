/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const artifactPath =
  process.env.DAY207_REALDB_ARTIFACT ||
  '/private/tmp/cx-day207-write-proposal-artefakty/day207-realdb.json';

describe('Day207 WRITE proposal — ApiGateway/JWT/Postgres', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let authorization = '';
  let actionId = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.INTERNAL_TOOLS_ENABLED = 'true';
    process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS = 'test.invalid';
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
    // Fresh Day207 migration replay exposes a pre-existing schema drift: the
    // policy engine reads this column but the baseline does not create it.
    // Keep the product guard untouched (Z12); make the disposable fixture
    // explicit and report the drift instead of silently mocking the policy.
    await pool.query(
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance_settings TEXT DEFAULT '{}'`
    );
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$1,'active')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `day207-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id)
       VALUES($1,$2,'Day207 proposal project','active',$3)`,
      [projectId, organizationId, userId]
    );
    await pool.query(
      `INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`,
      [projectId]
    );
    await pool.query(
      `INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level)
       VALUES($1,$2,'Day207 policy','ASSISTED','ASSISTED')`,
      [randomUUID(), organizationId]
    );
    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId,
        organization_id: organizationId,
        role: 'OWNER',
        email: `day207-${userId}@test.invalid`,
      },
      config.JWT_SECRET,
      { expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 30_000);

  afterAll(async () => {
    await pool.query(
      `DELETE FROM ai_run_events WHERE run_id IN
       (SELECT run_id FROM ai_run_ledger WHERE organization_id=$1)`,
      [organizationId]
    );
    await pool.query(`DELETE FROM ai_run_ledger WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ai_actions WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM project_ai_settings WHERE project_id=$1`, [projectId]);
    await pool.query(`DELETE FROM ai_policies WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM projects WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('injected create_task call persists only a pending proposal', async () => {
    const { default: executor } = await import('../../server/src/services/aiActionExecutor.js');
    const before = await pool.query(
      `SELECT count(*)::int AS count FROM tasks WHERE organization_id=$1`,
      [organizationId]
    );
    const proposal = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Day207 approved task', description: 'RealPG proof' },
      userId,
      organizationId,
      projectId,
    });
    actionId = proposal.actionId;
    const action = await pool.query(
      `SELECT id,status,action_type,draft_content FROM ai_actions WHERE id=$1`,
      [actionId]
    );
    const afterProposal = await pool.query(
      `SELECT count(*)::int AS count FROM tasks WHERE organization_id=$1`,
      [organizationId]
    );
    expect(proposal).toMatchObject({ success: true, requiresApproval: true, status: 'PENDING' });
    expect(action.rows[0]).toMatchObject({ status: 'PENDING', action_type: 'CREATE_DRAFT_TASK' });
    expect(afterProposal.rows[0].count).toBe(before.rows[0].count);
  });

  // FIX-207 pkt 1 (ODBIOR_207.md): before this fix, real HTTP approve+execute
  // wrote a real row into legacy `tasks` (proven by the audit's own run of
  // this exact test). The fix retires that silent legacy INSERT — there is
  // no canonical Runtime-v1 writer for a standalone My Work task today (see
  // aiActionExecutor.ts:_executeCreateTask), so execution now fails closed
  // and `tasks` stays untouched. This test asserts the new, honest contract:
  // approval still succeeds, execution reports failure, and no legacy row
  // is ever created — over real Postgres, real HTTP, real JWT.
  it('real HTTP approval succeeds but execution fails closed — no canonical writer, no legacy row', async () => {
    const approve = await request(app)
      .patch(`/api/ai/actions/${actionId}/approve`)
      .set('Authorization', authorization)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body).toMatchObject({ success: true, status: 'APPROVED' });

    const execute = await request(app)
      .post(`/api/ai/actions/${actionId}/execute`)
      .set('Authorization', authorization)
      .send({});
    expect(execute.status).toBe(200);
    expect(execute.body).toMatchObject({ success: false, status: 'FAILED' });
    expect(execute.body.error).toMatch(/canonical Runtime-v1 writer/);

    const taskReadback = await pool.query(
      `SELECT id,title,status,source FROM tasks WHERE organization_id=$1 AND project_id=$2`,
      [organizationId, projectId]
    );
    const actionReadback = await pool.query(
      `SELECT id,status,approved_by,approved_at,executed_at FROM ai_actions WHERE id=$1`,
      [actionId]
    );
    const ledgerReadback = await pool.query(
      `SELECT event_type,status FROM ai_run_events WHERE action_id=$1 ORDER BY created_at,id`,
      [actionId]
    );
    expect(taskReadback.rows).toHaveLength(0);
    expect(actionReadback.rows[0]).toMatchObject({ status: 'FAILED', approved_by: userId });
    expect(ledgerReadback.rows.map((row) => row.event_type)).toEqual(
      expect.arrayContaining([
        'proposal_pending_review',
        'proposal_approved',
        'execution_started',
        'execution_failed',
      ])
    );
    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          coordinates: { database: '127.0.0.1:6147', gateway: 'in-process ApiGateway', jwt: true },
          note: 'FIX-207 pkt 1: execution now fails closed — no canonical Runtime-v1 writer wired for a standalone My Work task; legacy `tasks` INSERT retired.',
          http: {
            approve: { method: 'PATCH', path: `/api/ai/actions/${actionId}/approve`, status: approve.status },
            execute: { method: 'POST', path: `/api/ai/actions/${actionId}/execute`, status: execute.status },
          },
          action: actionReadback.rows[0],
          tasks: taskReadback.rows,
          ledger: ledgerReadback.rows,
        },
        null,
        2
      )
    );
  });
});
