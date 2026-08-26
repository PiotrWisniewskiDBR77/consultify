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
  const viewerId = `day31-viewer-${tag}`;
  const foreignOrganizationId = `day31-foreign-${tag}`;
  const foreignUserId = `day31-foreign-owner-${tag}`;
  const projectId = `day31-project-${tag}`;
  const initiativeId = `day31-initiative-${tag}`;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  let client: Client;
  let token = '';
  let viewerToken = '';
  let foreignToken = '';
  let app: express.Express;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,$1),($2,$2)`, [
      organizationId,
      foreignOrganizationId,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,role,status)
       VALUES($1,$2,$3,'OWNER','active'),($4,$2,$5,'USER','active'),($6,$7,$8,'OWNER','active')`,
      [
        userId,
        organizationId,
        `${userId}@example.test`,
        viewerId,
        `${viewerId}@example.test`,
        foreignUserId,
        foreignOrganizationId,
        `${foreignUserId}@example.test`,
      ]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE'),($4,$2,$5,'USER','ACTIVE'),($6,$7,$8,'OWNER','ACTIVE')`,
      [
        `membership-${userId}`,
        organizationId,
        userId,
        `membership-${viewerId}`,
        viewerId,
        `membership-${foreignUserId}`,
        foreignOrganizationId,
        foreignUserId,
      ]
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
    viewerToken = jwt.sign(
      { id: viewerId, organizationId, role: 'USER', email: `${viewerId}@example.test` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    foreignToken = jwt.sign(
      {
        id: foreignUserId,
        organizationId: foreignOrganizationId,
        role: 'OWNER',
        email: `${foreignUserId}@example.test`,
      },
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
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
      await client.query(`DELETE FROM projects WHERE organization_id = $1`, [organizationId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
        [organizationId, foreignOrganizationId],
      ]);
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

  it('writes a budget entry with CAS, idempotency, audit and fail-closed access', async () => {
    const entryId = `budget-entry-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/budget-entries/${entryId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `budget-request-${tag}`,
      entryType: 'PLANNED',
      costType: 'OPEX',
      category: 'software',
      amount: 1250,
      currency: 'PLN',
      description: 'Day 31 canonical writer proof',
      periodMonth: 8,
      periodYear: 2026,
      source: 'MANUAL',
    };
    const first = await request(app).post(path).set(auth()).send(body);
    expect(first.status).toBe(201);
    const repeated = await request(app).post(path).set(auth()).send(body);
    expect(repeated.status).toBe(200);
    expect(repeated.body).toMatchObject({
      status: 'REPLAYED',
      aggregateVersion: first.body.aggregateVersion,
      response: first.body.response,
    });

    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
      [organizationId, entryId]
    );
    const audit = await client.query(
      `SELECT aggregate_version FROM ie_audit_events
       WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
      [organizationId, entryId]
    );
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, amount: 1250 });
    expect(audit.rows).toEqual([{ aggregate_version: 1 }]);

    const conflict = await request(app)
      .post(path)
      .set(auth())
      .send({ ...body, clientRequestId: `budget-conflict-${tag}` });
    expect(conflict.status).toBe(409);
    expect(
      await client.query(
        `SELECT COUNT(*)::int AS count FROM ie_audit_events
         WHERE organization_id=$1 AND aggregate_type='execution_budget_entry' AND aggregate_id=$2`,
        [organizationId, entryId]
      )
    ).toMatchObject({ rows: [{ count: 1 }] });

    const foreign = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
      .send({ ...body, organizationId });
    expect(foreign.status).toBe(404);
    const denied = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .send(body);
    expect(denied.status).toBe(404);
  });

  it('records a realization through the same CAS and receipt spine', async () => {
    const realizationId = `realization-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/realizations/${realizationId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `realization-request-${tag}`,
      periodMonth: '2026-08',
      realizedRevenueDelta: 5000,
      realizedCostDelta: null,
      realizedSavings: 750,
      varianceNotes: 'Independent readback proof',
    };
    const first = await request(app).post(path).set(auth()).send(body);
    expect(first.status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='execution_realization' AND aggregate_id=$2`,
      [organizationId, realizationId]
    );
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, realizedSavings: 750 });
    const replay = await request(app).post(path).set(auth()).send(body);
    expect(replay.status).toBe(200);
    expect(replay.body.status).toBe('REPLAYED');
    const conflict = await request(app)
      .post(path)
      .set(auth())
      .send({ ...body, clientRequestId: `realization-conflict-${tag}` });
    expect(conflict.status).toBe(409);
    const foreign = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
      .send({ ...body, organizationId });
    expect(foreign.status).toBe(404);
    const denied = await request(app)
      .post(path)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .send(body);
    expect(denied.status).toBe(404);
  });

  it('records RAID mitigation through the canonical initiative identity', async () => {
    const raidItemId = `raid-${tag}`;
    const path = `/api/initiatives/runtime-v1/initiatives/${initiativeId}/raid-mitigations/${raidItemId}`;
    const body = {
      expectedVersion: 0,
      clientRequestId: `raid-request-${tag}`,
      mitigationPlan: 'Isolate the dependency and verify the owner',
      responseStrategy: 'MITIGATE',
      mitigationOwnerId: userId,
      mitigationDueDate: '2026-09-01T12:00:00.000Z',
      mitigationStatus: 'PLANNED',
    };
    expect((await request(app).post(path).set(auth()).send(body)).status).toBe(201);
    const state = await client.query(
      `SELECT version,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='raid_mitigation' AND aggregate_id=$2`,
      [organizationId, raidItemId]
    );
    expect(state.rows[0]).toMatchObject({ version: 1 });
    expect(state.rows[0].payload_json).toMatchObject({ initiativeId, raidItemId });
    expect((await request(app).post(path).set(auth()).send(body)).body.status).toBe('REPLAYED');
    expect(
      (
        await request(app)
          .post(path)
          .set(auth())
          .send({ ...body, clientRequestId: `raid-conflict-${tag}` })
      ).status
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${foreignToken}`, 'X-Organization-Id': organizationId })
          .send({ ...body, organizationId })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(path)
          .set({ Authorization: `Bearer ${viewerToken}` })
          .send(body)
      ).status
    ).toBe(404);
  });
});
