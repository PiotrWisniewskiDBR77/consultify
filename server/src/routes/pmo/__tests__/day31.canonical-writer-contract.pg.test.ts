/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../../config/Config.js';
import { v8FeatureGate } from '../../../middleware/v8FeatureGate.middleware.js';
import initiativesRoutes from '../initiatives.routes.js';
import v8Router from '../../v8/index.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('Day 31 canonical writer mounted contract', () => {
  const tag = randomUUID();
  const organizationId = `day31-gate-${tag}`;
  const userId = `day31-owner-${tag}`;
  const projectId = `day31-project-${tag}`;
  const initiativeId = `day31-initiative-${tag}`;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  let client: Client;
  let token = '';
  let app: express.Express;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [organizationId]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [`membership-${userId}`, organizationId, userId]
    );
    await client.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$1)`, [
      projectId,
      organizationId,
    ]);
    await client.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'initiative',$2,1,$3::jsonb)`,
      [organizationId, initiativeId, JSON.stringify({ initiativeId, projectId })]
    );

    token = jwt.sign(
      { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRoutes);
    app.use('/api/v8', v8FeatureGate, v8Router);
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      for (const table of [
        'ie_aggregate_relations',
        'ie_command_receipts',
        'ie_audit_events',
        'ie_outbox_events',
        'ie_aggregate_state',
      ]) {
        await client.query(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
      }
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
        organizationId,
      ]);
      await client.query(`DELETE FROM projects WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('mounts runtime reads instead of returning 404 without authentication', async () => {
    const response = await request(app).get('/api/initiatives/runtime-v1/execution-cases');
    expect([401, 403]).toContain(response.status);
  });

  it('serves all eight control KPI families for an active member', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/control-kpis?weekStart=2026-08-24')
      .set(auth());
    expect(response.status).toBe(200);
    expect(response.body.families).toHaveLength(8);
  });

  it('lets a runtime-v1 mutation reach the canonical writer', async () => {
    const response = await request(app)
      .post('/api/initiatives/runtime-v1/management-signals/ingest')
      .set(auth())
      .send({
        expectedVersion: 0,
        clientRequestId: `signal-${tag}`,
        ruleId: 'day31-mounted-contract',
        sourceType: 'initiative',
        sourceId: initiativeId,
        sourceVersions: { initiative: 1 },
        severity: 'WARNING',
        occurredAt: '2026-08-26T12:00:00.000Z',
        evidenceRef: `evidence-${tag}`,
      });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    expect(response.body.status).toBe('APPLIED');
    expect(response.body.code).not.toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');
  });

  it('keeps legacy mutations behind the 409 boundary', async () => {
    const response = await request(app)
      .post('/api/v8/execution-control/risk-signals/dismiss')
      .set(auth())
      .send({ signalId: `signal-${tag}` });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' });
  });

  it('keeps the budget-delete exception outside the 409 boundary', async () => {
    const response = await request(app)
      .delete(`/api/v8/execution-control/budget/entries/missing-${tag}`)
      .set(auth());
    expect(response.status).not.toBe(409);
  });

  it('keeps legacy reads outside the 409 boundary', async () => {
    const response = await request(app).get('/api/v8/execution-control/risk-signals').set(auth());
    expect(response.status).not.toBe(409);
  });
});
