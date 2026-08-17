/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER / T13 + T14 — kernel proof on fresh real PostgreSQL.
 *
 * Everything here goes through the REAL mounted router with a REAL JWT and a
 * REAL membership row. The guard is not called directly for the refusal proofs,
 * because a guard that refuses when called in isolation but is mounted after the
 * leaf route would prove nothing about the running server.
 *
 * The telemetry-outage proof deliberately does NOT mock the database. It renames
 * the observation table out from under the running guard, so the insert fails
 * the way it would fail in production, and asserts the writer stays refused.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { PARTNERS_CUTOVER } from '../registry.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

const SECRET = 'legacy-cutover-kernel-secret-at-least-32-characters';
process.env.JWT_SECRET = SECRET;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// The real authentication path must run; the bypass would make the tenant
// assertions meaningless.
delete process.env.ENABLE_TEST_AUTH_BYPASS;

const prefix = `lck-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const userA = `${prefix}-user-a`;
const userB = `${prefix}-user-b`;

function bearer(userId: string, organizationId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        email: `${userId}@example.test`,
        organizationId,
        organization_id: organizationId,
        role: 'ADMIN',
      },
      SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    )}`,
  };
}

describe.skipIf(!REAL_PG)('Legacy cutover kernel (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  async function seedTenant(orgId: string, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
       VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
      [orgId, orgId, now]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,created_at)
       VALUES($1,$2,$3,'unused','ADMIN','active',$4) ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, `${userId}@example.test`, now]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'ADMIN','ACTIVE',$4) ON CONFLICT (id) DO NOTHING`,
      [`${userId}-membership`, orgId, userId, now]
    );
  }

  async function events(orgId: string, requestId?: string) {
    const result = await pool.query(
      `SELECT domain, writer_id, organization_id, tenant_resolution, request_id, method,
              route_path, access_kind, successor_path, identity_status, source
         FROM legacy_cutover_usage_events
        WHERE organization_id = $1 ${requestId ? 'AND request_id = $2' : ''}
        ORDER BY observed_at, id`,
      requestId ? [orgId, requestId] : [orgId]
    );
    return result.rows;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await seedTenant(orgA, userA);
    await seedTenant(orgB, userB);

    const { verifyToken } = await import('../../../middleware/auth.middleware.js');
    app = express();
    app.use(express.json());
    // This bounded integration deliberately does not refactor the production
    // Partner router yet. Exercise the kernel as mounted middleware behind the
    // real authentication boundary, with representative leaf handlers, so the
    // proof has no hidden dependency on the later Partner compatibility tranche.
    const representativeLeaves = express.Router();
    representativeLeaves.post('/payouts/request', (_req, res) => res.sendStatus(204));
    representativeLeaves.put('/organization/listing', (_req, res) => res.sendStatus(204));
    app.use(
      '/api/partners',
      verifyToken,
      createLegacyCutoverGuard(PARTNERS_CUTOVER),
      representativeLeaves
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    delete process.env.PARTNER_LEGACY_ROLLBACK_WRITERS;
    delete process.env.PARTNER_LEGACY_ROLLBACK_ENABLED;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('refuses a retired writer through the real mounted router with a real JWT', async () => {
    const response = await request(app)
      .post('/api/partners/payouts/request')
      .set(bearer(userA, orgA))
      .set('x-request-id', `${prefix}-blocked`)
      .send({ amount: 100 });

    expect(response.status).toBe(410);
    expect(response.body).toMatchObject({
      success: false,
      code: 'PARTNER_LEGACY_WRITER_DISABLED',
      writerId: 'PRT-W01',
      successor: '/api/v8/partner/payouts/request',
      rollbackEnv: 'PARTNER_LEGACY_ROLLBACK_ENABLED',
      rollbackWritersEnv: 'PARTNER_LEGACY_ROLLBACK_WRITERS',
    });
  });

  it('records the refusal against the resolved tenant', async () => {
    const rows = await events(orgA, `${prefix}-blocked`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      domain: 'partners',
      writer_id: 'PRT-W01',
      organization_id: orgA,
      tenant_resolution: 'resolved',
      method: 'POST',
      // The FULL path, not the router-local one: the same writer can be
      // reachable through more than one mount and the two must stay separable.
      route_path: '/api/partners/payouts/request',
      access_kind: 'legacy_writer_blocked',
      successor_path: '/api/v8/partner/payouts/request',
      identity_status: 'not_applicable',
      source: 'runtime',
    });
  });

  it('collapses retries and concurrent duplicates of one request identity into one row', async () => {
    const requestId = `${prefix}-retry`;
    const fire = () =>
      request(app)
        .post('/api/partners/payouts/request')
        .set(bearer(userA, orgA))
        .set('x-request-id', requestId)
        .send({ amount: 100 });

    await fire();
    await fire();
    const concurrent = await Promise.all([fire(), fire(), fire(), fire(), fire()]);
    expect(concurrent.every((response) => response.status === 410)).toBe(true);

    const rows = await events(orgA, requestId);
    expect(rows).toHaveLength(1);
  });

  it('keeps the same request identity in a foreign tenant as a separate observation', async () => {
    const requestId = `${prefix}-shared-request-id`;
    await request(app)
      .post('/api/partners/payouts/request')
      .set(bearer(userA, orgA))
      .set('x-request-id', requestId)
      .send({});
    await request(app)
      .post('/api/partners/payouts/request')
      .set(bearer(userB, orgB))
      .set('x-request-id', requestId)
      .send({});

    const rowsA = await events(orgA, requestId);
    const rowsB = await events(orgB, requestId);
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0].organization_id).toBe(orgA);
    expect(rowsB[0].organization_id).toBe(orgB);
  });

  it('leaves an unauthenticated call at 401 without inventing a tenant', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM legacy_cutover_usage_events WHERE tenant_resolution = 'unresolved'`
    );
    const response = await request(app).post('/api/partners/payouts/request').send({});
    expect(response.status).toBe(401);
    const after = await pool.query(
      `SELECT count(*)::int AS n FROM legacy_cutover_usage_events WHERE tenant_resolution = 'unresolved'`
    );
    // The guard is mounted behind verifyToken, so no observation is produced at
    // all — the assertion is that nothing was attributed to a guessed tenant.
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  it('keeps the writer refused when the telemetry table itself is unavailable', async () => {
    await pool.query(`ALTER TABLE legacy_cutover_usage_events RENAME TO legacy_cutover_usage_events_off`);
    try {
      const response = await request(app)
        .post('/api/partners/payouts/request')
        .set(bearer(userA, orgA))
        .set('x-request-id', `${prefix}-telemetry-down`)
        .send({});
      expect(response.status).toBe(410);
      expect(response.body.code).toBe('PARTNER_LEGACY_WRITER_DISABLED');
    } finally {
      await pool.query(
        `ALTER TABLE legacy_cutover_usage_events_off RENAME TO legacy_cutover_usage_events`
      );
    }
    const rows = await events(orgA, `${prefix}-telemetry-down`);
    expect(rows).toHaveLength(0);
  });

  it('rolls back exactly one named writer and records the rollback without deleting evidence', async () => {
    const before = await pool.query(
      `SELECT count(*)::int AS n FROM legacy_cutover_usage_events WHERE organization_id = $1`,
      [orgA]
    );

    process.env.PARTNER_LEGACY_ROLLBACK_WRITERS = 'PRT-W07';
    try {
      // The named writer is reachable again ...
      const rolledBack = await request(app)
        .put('/api/partners/organization/listing')
        .set(bearer(userA, orgA))
        .set('x-request-id', `${prefix}-rollback`)
        .send({});
      expect(rolledBack.status).not.toBe(410);

      // ... and every other writer in the same domain stays refused.
      const stillBlocked = await request(app)
        .post('/api/partners/payouts/request')
        .set(bearer(userA, orgA))
        .set('x-request-id', `${prefix}-rollback-neighbour`)
        .send({});
      expect(stillBlocked.status).toBe(410);
    } finally {
      delete process.env.PARTNER_LEGACY_ROLLBACK_WRITERS;
    }

    const rollbackRows = await events(orgA, `${prefix}-rollback`);
    expect(rollbackRows).toHaveLength(1);
    expect(rollbackRows[0]).toMatchObject({
      writer_id: 'PRT-W07',
      access_kind: 'rollback_writer',
      organization_id: orgA,
    });

    const after = await pool.query(
      `SELECT count(*)::int AS n FROM legacy_cutover_usage_events WHERE organization_id = $1`,
      [orgA]
    );
    expect(after.rows[0].n).toBeGreaterThan(before.rows[0].n);

    // The rollback is a route switch, not a data operation: the earlier
    // observations are all still present.
    const survivors = await events(orgA, `${prefix}-blocked`);
    expect(survivors).toHaveLength(1);
  });

  it('survives a cold connection with stable tenant attribution', async () => {
    const cold = new Pool({ connectionString: CONNECTION_STRING });
    try {
      const rows = await cold.query(
        `SELECT organization_id, writer_id, access_kind
           FROM legacy_cutover_usage_events
          WHERE organization_id = $1 AND request_id = $2`,
        [orgA, `${prefix}-blocked`]
      );
      expect(rows.rows).toEqual([
        { organization_id: orgA, writer_id: 'PRT-W01', access_kind: 'legacy_writer_blocked' },
      ]);
    } finally {
      await cold.end();
    }
  });
});
