/** @vitest-environment node */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('canonical Initiative forecast through signed JWT, ApiGateway and real PostgreSQL', {
  retry: 0,
  sequential: true,
}, () => {
  const run = randomUUID();
  const organizationId = randomUUID();
  const foreignOrganizationId = randomUUID();
  const actorId = randomUUID();
  const foreignActorId = randomUUID();
  const projectId = randomUUID();
  const initiativeId = `initiative-forecast-${run}`;
  const requestId = `initiative-forecast-request-${run}`;
  const originalPlannedStart = '2026-09-01';
  const originalPlannedEnd = '2026-12-31';
  const originalForecastStart = '2026-09-15';
  const originalForecastEnd = '2026-12-15';
  const changedForecastEnd = '2027-01-15';
  let app: Express;
  let pool: Pool;
  let authorization: string;
  let foreignAuthorization: string;

  const cleanup = async () => {
    if (!pool) return;
    await pool.query('DELETE FROM initiative_history WHERE initiative_id=$1', [initiativeId]);
    for (const table of [
      'ie_command_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=ANY($1::text[])`, [
        [organizationId, foreignOrganizationId],
      ]);
    }
    await pool.query('DELETE FROM initiatives WHERE id=$1', [initiativeId]);
    await pool.query('DELETE FROM projects WHERE id=$1', [projectId]);
    await pool.query('DELETE FROM organization_members WHERE organization_id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query('DELETE FROM users WHERE organization_id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
    await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [
      [organizationId, foreignOrganizationId],
    ]);
  };

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.E2E_MODE).not.toBe('true');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let ready = false;
    try {
      for (const [orgId, userId, suffix] of [
        [organizationId, actorId, 'owner'],
        [foreignOrganizationId, foreignActorId, 'foreign'],
      ]) {
        await pool.query(
          "INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')",
          [orgId, `Canonical forecast ${suffix} ${run}`]
        );
        await pool.query(
          `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
           VALUES($1,$2,$3,'unused','Forecast','Fixture','ADMIN','active')`,
          [userId, orgId, `${userId}@example.test`]
        );
        await pool.query(
          `INSERT INTO organization_members(id,organization_id,user_id,role,status)
           VALUES($1,$2,$3,'OWNER','ACTIVE')`,
          [randomUUID(), orgId, userId]
        );
      }
      await pool.query(
        "INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'Canonical forecast project','active',$3)",
        [projectId, organizationId, actorId]
      );
      await pool.query(
        `INSERT INTO initiatives(
           id,organization_id,project_id,name,status,progress,planned_start_date,planned_end_date,
           forecast_start_date,forecast_end_date,created_by
         ) VALUES($1,$2,$3,'Canonical forecast Initiative','IN_EXECUTION',25,$4,$5,$6,$7,$8)`,
        [
          initiativeId,
          organizationId,
          projectId,
          originalPlannedStart,
          originalPlannedEnd,
          originalForecastStart,
          originalForecastEnd,
          actorId,
        ]
      );
      await pool.query(
        `INSERT INTO ie_aggregate_state(
           organization_id,aggregate_type,aggregate_id,version,payload_json
         ) VALUES($1,'initiative',$2,4,$3)`,
        [
          organizationId,
          initiativeId,
          JSON.stringify({
            initiativeId,
            projectId,
            initiativeOwnerId: actorId,
            lifecycleState: 'IN_EXECUTION',
            title: 'Canonical forecast Initiative',
            preservedMetadata: { ownerDecision: 'keep' },
          }),
        ]
      );

      const { default: config } = await import('../../../config/Config.js');
      authorization = `Bearer ${jwt.sign(
        {
          id: actorId,
          userId: actorId,
          organizationId,
          organization_id: organizationId,
          role: 'ADMIN',
        },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      )}`;
      foreignAuthorization = `Bearer ${jwt.sign(
        {
          id: foreignActorId,
          userId: foreignActorId,
          organizationId: foreignOrganizationId,
          organization_id: foreignOrganizationId,
          role: 'ADMIN',
        },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
      )}`;
      const { ApiGateway } = await import('../../../Gateway.js');
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      ready = true;
    } finally {
      if (!ready) await cleanup();
    }
  }, 180_000);

  afterAll(async () => {
    try {
      await cleanup();
      const leftovers = await pool.query<{ count: number }>(
        `SELECT (
          (SELECT count(*) FROM organizations WHERE id=ANY($1::text[])) +
          (SELECT count(*) FROM users WHERE organization_id=ANY($1::text[])) +
          (SELECT count(*) FROM organization_members WHERE organization_id=ANY($1::text[])) +
          (SELECT count(*) FROM projects WHERE id=$3) +
          (SELECT count(*) FROM initiatives WHERE id=$2) +
          (SELECT count(*) FROM initiative_history WHERE initiative_id=$2) +
          (SELECT count(*) FROM ie_aggregate_state WHERE organization_id=ANY($1::text[])) +
          (SELECT count(*) FROM ie_command_receipts WHERE organization_id=ANY($1::text[])) +
          (SELECT count(*) FROM ie_audit_events WHERE organization_id=ANY($1::text[])) +
          (SELECT count(*) FROM ie_outbox_events WHERE organization_id=ANY($1::text[]))
        )::int AS count`,
        [[organizationId, foreignOrganizationId], initiativeId, projectId]
      );
      expect(leftovers.rows[0].count).toBe(0);
    } finally {
      await pool?.end();
    }
  }, 60_000);

  const command = (overrides: Record<string, unknown> = {}) => ({
    expectedVersion: 4,
    clientRequestId: requestId,
    forecastEndDate: changedForecastEnd,
    reason: 'Supplier delivery moved',
    ...overrides,
  });

  it('advertises forecast availability through the real capability reader for the same module Initiative', async () => {
    const response = await request(app)
      .get(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/capabilities`)
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.executionWrites.forecast).toMatchObject({
      available: true,
      denialAt: null,
      denialCode: null,
      canonicalCommand: 'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/forecast',
    });
  });

  it('writes forecast through the canonical Runtime-v1 command and leaves baseline dates unchanged', async () => {
    const baselineBefore = await pool.query(
      `SELECT planned_start_date::text,planned_end_date::text
         FROM initiatives WHERE organization_id=$1 AND id=$2`,
      [organizationId, initiativeId]
    );
    const response = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId)
      .set('X-Correlation-ID', `forecast-correlation-${run}`)
      .send(command());

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      status: 'APPLIED',
      aggregateVersion: 5,
      response: {
        initiativeId,
        before: {
          forecastStartDate: originalForecastStart,
          forecastEndDate: originalForecastEnd,
        },
        after: {
          forecastStartDate: originalForecastStart,
          forecastEndDate: changedForecastEnd,
        },
      },
    });

    const projection = await pool.query(
      `SELECT planned_start_date::text,planned_end_date::text,
              forecast_start_date::text,forecast_end_date::text
         FROM initiatives WHERE organization_id=$1 AND id=$2`,
      [organizationId, initiativeId]
    );
    expect(projection.rows[0]).toMatchObject({
      planned_start_date: baselineBefore.rows[0].planned_start_date,
      planned_end_date: baselineBefore.rows[0].planned_end_date,
      forecast_start_date: originalForecastStart,
      forecast_end_date: changedForecastEnd,
    });
    const aggregate = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, initiativeId]
    );
    expect(aggregate.rows[0]).toMatchObject({ version: 5 });
    expect(aggregate.rows[0].payload_json).toMatchObject({
      initiativeId,
      lifecycleState: 'IN_EXECUTION',
      preservedMetadata: { ownerDecision: 'keep' },
      forecastStartDate: originalForecastStart,
      forecastEndDate: changedForecastEnd,
    });
    const history = await pool.query(
      `SELECT id,action,old_value,new_value,idempotency_key
         FROM initiative_history WHERE initiative_id=$1 ORDER BY changed_at`,
      [initiativeId]
    );
    expect(history.rows).toHaveLength(1);
    const historyRow = {
      ...history.rows[0],
      old_value:
        typeof history.rows[0].old_value === 'string'
          ? JSON.parse(history.rows[0].old_value)
          : history.rows[0].old_value,
      new_value:
        typeof history.rows[0].new_value === 'string'
          ? JSON.parse(history.rows[0].new_value)
          : history.rows[0].new_value,
    };
    expect(historyRow).toMatchObject({
      action: 'reforecast',
      old_value: { forecastEndDate: originalForecastEnd },
      new_value: { forecastEndDate: changedForecastEnd },
      idempotency_key: requestId,
    });
    expect(response.body.response.receiptId).toBe(historyRow.id);
  });

  it('projects the exact canonical receipt into the Execution Bank evidence read model', async () => {
    const historyReceipt = await pool.query<{ id: string; observed_ms: number }>(
      `SELECT id,EXTRACT(EPOCH FROM changed_at)::double precision*1000 AS observed_ms
         FROM initiative_history
        WHERE initiative_id=$1 AND action='reforecast' AND idempotency_key=$2`,
      [initiativeId, requestId]
    );
    const clockLeadMs = Number(historyReceipt.rows[0].observed_ms) - Date.now();
    expect(clockLeadMs).toBeLessThanOrEqual(1_000);
    if (clockLeadMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.ceil(clockLeadMs) + 5));
    }
    const response = await request(app)
      .get('/api/initiatives')
      .query({
        includeExecutionEvidence: '1',
        asOf: new Date().toISOString(),
      })
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const initiative = response.body.find((row: { id?: string }) => row.id === initiativeId);
    expect(initiative).toMatchObject({
      id: initiativeId,
      forecastEndDate: changedForecastEnd,
      forecastEndEvidence: {
        value: changedForecastEnd,
        completeness: 'KNOWN',
        source: { system: 'initiative_history' },
      },
    });
    expect(initiative.forecastEndEvidence.source.recordId).toBe(historyReceipt.rows[0].id);
    expect(initiative.forecastEndEvidence.observedAt).toBe(
      new Date(Number(historyReceipt.rows[0].observed_ms)).toISOString()
    );
  });

  it('replays the same request without a second projection, event or receipt', async () => {
    const replay = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId)
      .send(command());

    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body).toMatchObject({ status: 'REPLAYED', aggregateVersion: 5 });
    const counts = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM initiative_history WHERE initiative_id=$1) AS history,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$2 AND aggregate_id=$1) AS receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$2 AND aggregate_id=$1) AS audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$2 AND aggregate_id=$1) AS outbox`,
      [initiativeId, organizationId]
    );
    expect(counts.rows[0]).toEqual({ history: 1, receipts: 1, audits: 1, outbox: 1 });
  });

  it('rejects a stale expected version without changing either store or any receipt stream', async () => {
    const before = await pool.query(
      `SELECT
        (SELECT forecast_start_date::text FROM initiatives WHERE organization_id=$2 AND id=$1) AS forecast_start,
        (SELECT forecast_end_date::text FROM initiatives WHERE organization_id=$2 AND id=$1) AS forecast_end,
        (SELECT version FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS version,
        (SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS payload,
        (SELECT count(*)::int FROM initiative_history WHERE initiative_id=$1) AS history,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$2 AND aggregate_id=$1) AS receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$2 AND aggregate_id=$1) AS audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$2 AND aggregate_id=$1) AS outbox`,
      [initiativeId, organizationId]
    );
    const rejected = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId)
      .send(
        command({
          clientRequestId: `forecast-stale-${run}`,
          forecastEndDate: '2027-01-31',
          reason: 'Stale writer probe',
        })
      );

    expect(rejected.status).toBe(409);
    expect(rejected.body).toMatchObject({
      error: { code: 'VERSION_OR_IDEMPOTENCY_CONFLICT', expectedVersion: 4, currentVersion: 5 },
    });
    const after = await pool.query(
      `SELECT
        (SELECT forecast_start_date::text FROM initiatives WHERE organization_id=$2 AND id=$1) AS forecast_start,
        (SELECT forecast_end_date::text FROM initiatives WHERE organization_id=$2 AND id=$1) AS forecast_end,
        (SELECT version FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS version,
        (SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS payload,
        (SELECT count(*)::int FROM initiative_history WHERE initiative_id=$1) AS history,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$2 AND aggregate_id=$1) AS receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$2 AND aggregate_id=$1) AS audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$2 AND aggregate_id=$1) AS outbox`,
      [initiativeId, organizationId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('rolls back the module projection and receipt when a partial update creates an invalid range', async () => {
    const before = await pool.query(
      `SELECT
        (SELECT version FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS version,
        (SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS payload,
        (SELECT count(*)::int FROM initiative_history WHERE initiative_id=$1) AS history,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$2 AND aggregate_id=$1) AS receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$2 AND aggregate_id=$1) AS audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$2 AND aggregate_id=$1) AS outbox`,
      [initiativeId, organizationId]
    );
    const rejected = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('Authorization', authorization)
      .set('x-organization-id', organizationId)
      .send(
        command({
          expectedVersion: 5,
          clientRequestId: `forecast-invalid-${run}`,
          forecastStartDate: '2027-02-01',
          forecastEndDate: undefined,
          reason: 'Invalid partial range',
        })
      );

    expect(rejected.status).toBe(409);
    expect(JSON.stringify(rejected.body)).toContain('INITIATIVE_FORECAST_RANGE_INVALID');
    const state = await pool.query(
      `SELECT forecast_start_date::text,forecast_end_date::text FROM initiatives
        WHERE organization_id=$1 AND id=$2`,
      [organizationId, initiativeId]
    );
    expect(state.rows[0]).toEqual({
      forecast_start_date: originalForecastStart,
      forecast_end_date: changedForecastEnd,
    });
    const history = await pool.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM initiative_history WHERE initiative_id=$1',
      [initiativeId]
    );
    expect(history.rows[0].count).toBe(1);
    const after = await pool.query(
      `SELECT
        (SELECT version FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS version,
        (SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$2 AND aggregate_type='initiative' AND aggregate_id=$1) AS payload,
        (SELECT count(*)::int FROM initiative_history WHERE initiative_id=$1) AS history,
        (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$2 AND aggregate_id=$1) AS receipts,
        (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$2 AND aggregate_id=$1) AS audits,
        (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$2 AND aggregate_id=$1) AS outbox`,
      [initiativeId, organizationId]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('returns tenant-scoped 404 before replay lookup for the same Initiative identity', async () => {
    const foreign = await request(app)
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('Authorization', foreignAuthorization)
      .set('x-organization-id', foreignOrganizationId)
      .send(command());

    expect(foreign.status).toBe(404);
    expect(foreign.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
