/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../../config/Config.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('CODEX1 — charakterystyka rozjazdu dwoch magazynow inicjatyw', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  const title = `CODEX1 charakterystyka ${randomUUID()}`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'CODEX1 org',
    ]);
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name,owner_id) VALUES($1,$2,$3,$4)`, [
      projectId,
      organizationId,
      'CODEX1 project',
      userId,
    ]);
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_outbox_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_audit_events WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_command_receipts WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM project_members WHERE project_id=$1`, [projectId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('uses the explicitly selected PostgreSQL engine', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('CHARAKTERYSTYKA PRZED E2 — zapis UI tworzy agregat kanoniczny', async () => {
    const sourceId = `manual-hub-${randomUUID()}`;
    const submitted = await request(app)
      .post('/api/initiatives/runtime-v1/source-proposals')
      .set('Authorization', authorization)
      .send({
        proposalId,
        expectedVersion: 0,
        clientRequestId: `submit-${randomUUID()}`,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        provenance: {
          system: 'consultify.initiatives-hub',
          recordType: 'manual-initiative-proposal',
          capturedAt: new Date().toISOString(),
          evidenceRefs: [`consultify://initiatives/source-proposals/${proposalId}`],
        },
        title,
        problem: 'Dowod rozjazdu magazynow',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        initiativeOwnerId: userId,
        visibility: 'PROJECT',
      });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);

    const response = await request(app)
      .post('/api/initiatives/runtime-v1/registrations')
      .set('Authorization', authorization)
      .send({
        initiativeId,
        expectedVersion: 0,
        clientRequestId: `register-${randomUUID()}`,
        proposalId,
        proposalVersion: 1,
        sourceType: 'MANUAL_HUB',
        sourceId,
        sourceVersion: 1,
        title,
        problem: 'Dowod rozjazdu magazynow',
        proposedOutcome: null,
        priority: 'MEDIUM',
        projectId,
        visibility: 'PROJECT',
        initiativeOwnerId: userId,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    const count = await sql.query(
      `SELECT count(*)::int AS count FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('CHARAKTERYSTYKA PRZED E2 — lista runtime-v1 widzi rekord', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/initiatives')
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.initiatives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ initiative: expect.objectContaining({ initiativeId, title }) }),
      ])
    );
  });

  it('CHARAKTERYSTYKA PRZED E2 — lista zastana nie widzi rekordu', async () => {
    const response = await request(app).get('/api/initiatives').set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(initiativeId);
  });

  it('CHARAKTERYSTYKA PRZED E2 — tabela zastana nie zawiera rekordu', async () => {
    const count = await sql.query(`SELECT count(*)::int AS count FROM initiatives WHERE id=$1`, [
      initiativeId,
    ]);
    expect(count.rows[0].count).toBe(0);
  });

  it('CHARAKTERYSTYKA PRZED E2 — karta zastana zwraca 404', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(404);
  });

  it('CHARAKTERYSTYKA PRZED E2 — KPI zastane zwracaja 404', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}/kpis`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(404);
  });

  it('CHARAKTERYSTYKA PRZED E2 — kamienie korzystaja z istniejacego fallbacku', async () => {
    const response = await request(app)
      .get(`/api/initiatives/${initiativeId}/milestones`)
      .set('Authorization', authorization);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
  });
});
