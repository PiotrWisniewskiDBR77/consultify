/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — SETTINGS domain guard.
 *
 * Proves the kernel, composed with the REAL settings router
 * (`server/src/routes/settings.routes.ts`, mounted at `/api/settings` exactly
 * as `server/src/Gateway.ts:741` does), does not block the seven registered
 * SETTINGS-Wxx writers while recording tenant-scoped, idempotent telemetry for
 * each of them — profile import, the two "privacy preferences" blobs
 * (gdpr/consents, gdpr/retention), the general privacy-preferences blob, and
 * two of the three competing GDPR export/deletion writers.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { SETTINGS_CUTOVER } from '../registry/settings.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// Every route in settings.routes.ts calls the real verifyToken middleware
// inline. No bearer token is sent here, so without the bypass every call
// would 401 before reaching the leaf handler and this suite would only prove
// the guard runs ahead of authentication, not that the writer stays reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `settings-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const userA = `${prefix}-user-a`;
const userB = `${prefix}-user-b`;

describe.skipIf(!REAL_PG)('SETTINGS legacy-cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  function authenticate(req: any, _res: any, next: any): void {
    const organizationId = String(req.headers['x-test-org'] || orgA);
    const userId = organizationId === orgB ? userB : userA;
    req.user = { id: userId, organizationId, role: 'ADMIN' };
    req.userId = userId;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId, userRole: 'ADMIN' };
    next();
  }

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
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    await seedTenant(orgA, userA);
    await seedTenant(orgB, userB);

    const settingsRouter = (await import('../../../routes/settings.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(authenticate);
    app.use('/api/settings', createLegacyCutoverGuard(SETTINGS_CUTOVER), settingsRouter);
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM data_export_requests WHERE user_id = ANY($1)`, [
      [userA, userB],
    ]);
    await pool.query(`DELETE FROM gdpr_requests WHERE user_id = ANY($1)`, [[userA, userB]]);
    await pool.query(`DELETE FROM user_preferences WHERE user_id = ANY($1)`, [[userA, userB]]);
    await pool.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('does not block profile import (SETTINGS-W03)', async () => {
    const response = await request(app)
      .post('/api/settings/import')
      .set('x-request-id', `${prefix}-import-1`)
      .send({ data: { settings: { profile: { firstName: 'Ada' } } } });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
  });

  it('does not block the gdpr/consents blob writer (SETTINGS-W07)', async () => {
    const response = await request(app)
      .put('/api/settings/gdpr/consents')
      .set('x-request-id', `${prefix}-consents-1`)
      .send({ consents: { marketingCommunications: true } });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(200);
  });

  it('does not block the gdpr/retention blob writer (SETTINGS-W09)', async () => {
    const response = await request(app)
      .put('/api/settings/gdpr/retention')
      .set('x-request-id', `${prefix}-retention-1`)
      .send({ retention: { period: '90d' } });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('does not block the general privacy-preferences blob writer (SETTINGS-W06)', async () => {
    const response = await request(app)
      .put('/api/settings/preferences/privacy')
      .set('x-request-id', `${prefix}-privacy-1`)
      .send({ preferences: { shareActivityWithAI: false } });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('does not block export-data, one of three GDPR-export writers (SETTINGS-W11)', async () => {
    const response = await request(app)
      .post('/api/settings/export-data')
      .set('x-request-id', `${prefix}-export-data-1`)
      .send({ format: 'json' });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('does not block the third gdpr_requests export table writer (SETTINGS-W13)', async () => {
    const response = await request(app)
      .post('/api/settings/gdpr/export-request')
      .set('x-request-id', `${prefix}-export-request-1`)
      .send({});
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('does not block the live account-deletion writer (SETTINGS-W15)', async () => {
    const response = await request(app)
      .post('/api/settings/gdpr/deletion-request')
      .set('x-request-id', `${prefix}-deletion-request-1`)
      .send({ reason: 'test', password: 'not-the-real-password' });
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
  });

  it('records one durable, tenant-scoped observation row per writer', async () => {
    const rows = await pool.query(
      `SELECT writer_id, access_kind, organization_id, tenant_resolution, route_path
         FROM legacy_cutover_usage_events
        WHERE domain = 'settings' AND organization_id = $1
          AND request_id = ANY($2)
        ORDER BY writer_id`,
      [
        orgA,
        [
          `${prefix}-import-1`,
          `${prefix}-consents-1`,
          `${prefix}-retention-1`,
          `${prefix}-privacy-1`,
          `${prefix}-export-data-1`,
          `${prefix}-export-request-1`,
          `${prefix}-deletion-request-1`,
        ],
      ]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'SETTINGS-W03',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/import',
      },
      {
        writer_id: 'SETTINGS-W06',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/preferences/privacy',
      },
      {
        writer_id: 'SETTINGS-W07',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/gdpr/consents',
      },
      {
        writer_id: 'SETTINGS-W09',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/gdpr/retention',
      },
      {
        writer_id: 'SETTINGS-W11',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/export-data',
      },
      {
        writer_id: 'SETTINGS-W13',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/gdpr/export-request',
      },
      {
        writer_id: 'SETTINGS-W15',
        access_kind: 'legacy_uncovered_writer',
        organization_id: orgA,
        tenant_resolution: 'resolved',
        route_path: '/api/settings/gdpr/deletion-request',
      },
    ]);
  });

  it('is idempotent under a retried x-request-id', async () => {
    const requestId = `${prefix}-idempotent`;
    await request(app)
      .put('/api/settings/gdpr/retention')
      .set('x-request-id', requestId)
      .send({ retention: { period: '30d' } });
    await request(app)
      .put('/api/settings/gdpr/retention')
      .set('x-request-id', requestId)
      .send({ retention: { period: '30d' } });

    const rows = await pool.query(
      `SELECT id FROM legacy_cutover_usage_events
        WHERE domain = 'settings' AND organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('attributes two tenants making the same call with the same x-request-id to one row each', async () => {
    const requestId = `${prefix}-tenant-isolation`;
    await request(app)
      .put('/api/settings/gdpr/retention')
      .set('x-request-id', requestId)
      .set('x-test-org', orgA)
      .send({ retention: { period: '30d' } });
    await request(app)
      .put('/api/settings/gdpr/retention')
      .set('x-request-id', requestId)
      .set('x-test-org', orgB)
      .send({ retention: { period: '30d' } });

    const rows = await pool.query(
      `SELECT organization_id FROM legacy_cutover_usage_events
        WHERE domain = 'settings' AND request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [requestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([{ organization_id: orgA }, { organization_id: orgB }]);
  });
});
