/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres';

const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day214 chat-draft adoption via production ApiGateway and real PostgreSQL', () => {
  const run = randomUUID();
  const organizationId = `day214-gateway-org-${run}`;
  const userId = `day214-gateway-user-${run}`;
  const projectId = `day214-gateway-project-${run}`;
  const blockedId = `day214-gateway-blocked-${run}`;
  const readyId = `day214-gateway-ready-${run}`;
  let app: Express;
  let pool: Pool;
  let authorization = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,'Day214 Gateway')`, [
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
       VALUES($1,$2,$3,'unused','Day','214','ADMIN','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [`day214-gateway-member-${run}`, organizationId, userId]
    );
    await pool.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Day214')`, [
      projectId,
      organizationId,
    ]);
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role)
       VALUES($1,$2,$3,'INITIATIVE_OWNER')`,
      [`day214-gateway-project-member-${run}`, projectId, userId]
    );
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,name,title,problem_statement,source_type,source_id)
       VALUES($1,$2,'Blocked','Blocked','Measured problem','teresa_chat',$1)`,
      [blockedId, organizationId]
    );
    await pool.query(
      `INSERT INTO initiatives
       (id,organization_id,project_id,name,title,problem_statement,source_type,source_id,owner_execution_id)
       VALUES($1,$2,$3,'Ready','Ready','Measured problem','teresa_chat',$1,$4)`,
      [readyId, organizationId, projectId, userId]
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    authorization = `Bearer ${jwt.sign(
      { id: userId, organizationId, email: `${userId}@example.test`, role: 'ADMIN' },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    )}`;
    const { ApiGateway } = await import('../../../server/src/Gateway.js');
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  const auth = () => ({ Authorization: authorization, 'x-organization-id': organizationId });
  const body = (initiativeId: string, requestId: string) => ({
    chatInitiativeId: initiativeId,
    expectedVersion: 0,
    clientRequestId: requestId,
    projectId,
    visibility: 'PROJECT',
    initiativeOwnerId: userId,
  });

  it('binds the route proof to the complete realDB/auth feature environment', () => {
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');
    expect(process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT).toBe('true');
  });

  it('keeps the new route fail-closed while its dedicated flag is OFF', async () => {
    const previous = process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT;
    process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT = 'false';
    try {
      const response = await request(app)
        .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
        .set(auth())
        .send(body(readyId, `day214-gateway-flag-off-${run}`));
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'FEATURE_DISABLED' } });
    } finally {
      process.env.ENABLE_TERESA_ADOPT_CHAT_DRAFT = previous;
    }
  });

  it('rejects a direct POST that bypasses the card while the draft is blocked', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set(auth())
      .send(body(blockedId, `day214-gateway-blocked-${run}`));
    expect(response.status, JSON.stringify(response.body)).toBe(400);
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [organizationId, blockedId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 0, receipts: 0 });
  });

  it('returns 201, one SQL receipt, canonical readback and definition readiness', async () => {
    const created = await request(app)
      .post('/api/initiatives/runtime-v1/adoptions/chat-draft')
      .set(auth())
      .send(body(readyId, `day214-gateway-ready-${run}`));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      status: 'APPLIED',
      response: { initiativeId: readyId, lifecycleState: 'REGISTERED_DRAFT' },
    });
    const canonical = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${readyId}`)
      .set(auth());
    expect(canonical.status, JSON.stringify(canonical.body)).toBe(200);
    expect(canonical.body).toMatchObject({
      initiative: { initiativeId: readyId, lifecycleState: 'REGISTERED_DRAFT' },
    });
    const readiness = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${readyId}/gates/definition/readiness`)
      .set(auth());
    expect(readiness.status, JSON.stringify(readiness.body)).toBe(200);
    expect(readiness.body.readiness).toMatch(/^(NOT_READY|BLOCKED)$/);
    expect(Array.isArray(readiness.body.findings)).toBe(true);
    expect(new Set(readiness.body.findings.map((finding: any) => finding.cardKey)).size).toBe(8);
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_id=$2) aggregates,
        (SELECT count(*)::int FROM flow_teresa_chat_draft_adoptions WHERE organization_id=$1 AND chat_initiative_id=$2) receipts`,
      [organizationId, readyId]
    );
    expect(counts.rows[0]).toEqual({ aggregates: 1, receipts: 1 });
  });
});
