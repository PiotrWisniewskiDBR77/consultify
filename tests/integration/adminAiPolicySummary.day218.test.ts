/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import { ApiGateway } from '../../server/src/Gateway.js';
import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('Day 218 AI policy summary through ApiGateway and PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations (id, name, plan, status, is_active) VALUES ($1,$2,'enterprise','active',1)`, [organizationId, `day218-${organizationId}`]);
    await sql.query(`INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) VALUES ($1,$2,$3,'x','Day','218','ADMIN','active')`, [userId, organizationId, `${userId}@test.invalid`]);
    await sql.query(`INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')`, [randomUUID(), organizationId, userId]);
    authorization = `Bearer ${jwt.sign({ id: userId, userId, email: `${userId}@test.invalid`, organizationId, organization_id: organizationId, role: 'ADMIN' }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    if (!sql) return;
    await sql.query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    await sql.end();
  });

  it('returns real policy fields and changes them after independent SQL mutation', async () => {
    await sql.query(`INSERT INTO ai_policies (id, organization_id, name, policy_type, policy_level, max_policy_level, internet_enabled, audit_required, is_active) VALUES ($1,$2,'day218','organization','ASSISTED','AUTOPILOT',1,1,1)`, [randomUUID(), organizationId]);
    await sql.query(`INSERT INTO organization_ai_settings (organization_id, context_policy_json) VALUES ($1,$2)`, [organizationId, JSON.stringify({ piiRedaction: 'on' })]);
    await sql.query(`INSERT INTO llm_org_policies (id, organization_id, mode, review_state, internet_enabled, audit_required) VALUES ($1,$2,'governed','APPROVED',1,1)`, [randomUUID(), organizationId]);

    const first = await request(app).get('/api/admin/ai/summary').set('Authorization', authorization);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.summary).toMatchObject({
      governanceSummary: { currentLevel: 'ASSISTED', internetEnabled: true, auditRequired: true },
      contextPolicy: { piiRedaction: 'on' },
      llmPolicy: { mode: 'governed', review_state: 'APPROVED' },
      statuses: { governance: 'ok', context: 'ok', llm: 'ok' },
    });

    await sql.query(`UPDATE ai_policies SET policy_level = 'PROACTIVE' WHERE organization_id = $1`, [organizationId]);
    await sql.query(`UPDATE organization_ai_settings SET context_policy_json = $2 WHERE organization_id = $1`, [organizationId, JSON.stringify({ piiRedaction: 'off' })]);
    const second = await request(app).get('/api/admin/ai/summary').set('Authorization', authorization);
    expect(second.status).toBe(200);
    expect(second.body.summary.governanceSummary.currentLevel).toBe('PROACTIVE');
    expect(second.body.summary.contextPolicy.piiRedaction).toBe('off');
  });

  it('reports ok with a null LLM value when the table exists but the organization has no row', async () => {
    await sql.query('DELETE FROM llm_org_policies WHERE organization_id = $1', [organizationId]);
    const response = await request(app).get('/api/admin/ai/summary').set('Authorization', authorization);
    expect(response.status).toBe(200);
    expect(response.body.summary.llmPolicy).toBeNull();
    expect(response.body.summary.statuses.llm).toBe('ok');
  });

  it('reports unavailable instead of an honest empty state when the LLM policy query fails', async () => {
    await sql.query('DROP TABLE llm_org_policies');
    const response = await request(app).get('/api/admin/ai/summary').set('Authorization', authorization);
    expect(response.status).toBe(200);
    expect(response.body.summary.llmPolicy).toBeNull();
    expect(response.body.summary.statuses.llm).toBe('unavailable');
  });
});
