/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../../config/Config.js';
import {
  flushPendingOperationalAuthDenialIntents,
  metricsMiddleware,
  trackOperationalAuthIntentForShutdown,
} from '../../middleware/metrics.middleware.js';
import organizationContextRouter from '../../routes/organization-context.routes.js';

const url = process.env.DATABASE_URL ?? '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false';
describe.skipIf(!enabled)('OPS mounted signed-JWT auth denial repair intent', () => {
  const p = `ops-auth-${randomUUID()}`,
    org = `${p}-org`,
    foreign = `${p}-foreign`,
    active = `${p}-active`,
    revoked = `${p}-revoked`;
  let pool: Pool;
  let app: express.Express;
  const sign = (id: string, organizationId: string) =>
    jwt.sign(
      { id, organizationId, role: 'MEMBER', email: `${id}@test.invalid` },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  beforeAll(async () => {
    process.env.OPERATIONAL_ALERT_DURABLE_ENABLED = 'true';
    pool = new Pool({ connectionString: url });
    for (const [id, name] of [
      [org, 'A'],
      [foreign, 'B'],
    ])
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [id, name]);
    for (const [id, o, status] of [
      [active, org, 'ACTIVE'],
      [revoked, org, 'INACTIVE'],
    ]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','MEMBER','active')`,
        [id, o, `${id}@test.invalid`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'MEMBER',$4)`,
        [`${p}-m-${id}`, o, id, status]
      );
    }
    app = express();
    app.use(metricsMiddleware);
    app.use(express.json());
    app.use('/api/organization-context', organizationContextRouter);
  });
  afterAll(async () => {
    delete process.env.OPERATIONAL_ALERT_DURABLE_ENABLED;
    await pool.query(
      `ALTER TABLE operational_alert_repair_receipts DISABLE TRIGGER trg_operational_alert_repair_receipts_immutable`
    );
    await pool.query(
      `DELETE FROM operational_alert_repair_receipts WHERE organization_id=ANY($1)`,
      [[org, foreign]]
    );
    await pool.query(
      `ALTER TABLE operational_alert_repair_receipts ENABLE TRIGGER trg_operational_alert_repair_receipts_immutable`
    );
    await pool.query(
      `ALTER TABLE operational_alert_repair_attempts DISABLE TRIGGER trg_operational_alert_repair_attempts_immutable`
    );
    await pool.query(
      `DELETE FROM operational_alert_repair_attempts WHERE organization_id=ANY($1)`,
      [[org, foreign]]
    );
    await pool.query(
      `ALTER TABLE operational_alert_repair_attempts ENABLE TRIGGER trg_operational_alert_repair_attempts_immutable`
    );
    await pool.query(`DELETE FROM operational_alert_repair_intents WHERE organization_id=ANY($1)`, [
      [org, foreign],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${p}%`]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[active, revoked]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[org, foreign]]);
    await pool.end();
  });
  it('mounts the production route and persists exact active, revoked and forged-tenant denial identity', async () => {
    const activeDenied = await request(app)
      .post('/api/organization-context/rebuild')
      .set('Authorization', `Bearer ${sign(active, org)}`)
      .set('x-request-id', `${p}-ok`);
    expect(activeDenied.status).toBe(403);
    expect(activeDenied.body).toMatchObject({ error: 'Admin access required' });
    // The response itself is the durability barrier: no explicit shutdown
    // flush is needed before this readback.
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM operational_alert_repair_intents WHERE organization_id=$1`,
          [org]
        )
      ).rows[0].n
    ).toBe(1);
    expect(
      (
        await request(app)
          .post('/api/organization-context/rebuild')
          .set('Authorization', `Bearer ${sign(active, org)}`)
      ).status
    ).toBe(403);
    const revokedDenied = await request(app)
      .post('/api/organization-context/rebuild')
      .set('Authorization', `Bearer ${sign(revoked, org)}`)
      .set('x-request-id', `${p}-revoked`);
    expect(revokedDenied.status).toBe(403);
    expect(revokedDenied.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    const forgedTenantDenied = await request(app)
      .post('/api/organization-context/rebuild')
      .set('Authorization', `Bearer ${sign(active, foreign)}`)
      .set('x-request-id', `${p}-foreign`);
    expect(forgedTenantDenied.status).toBe(403);
    expect(forgedTenantDenied.body).toMatchObject({ error: 'Admin access required' });
    await flushPendingOperationalAuthDenialIntents();
    const rows = await pool.query(
      `SELECT organization_id,actor_id,correlation_id,kind,outcome,source_type FROM operational_alert_repair_intents WHERE organization_id=ANY($1) ORDER BY correlation_id`,
      [[org, foreign]]
    );
    expect(rows.rows).toEqual([
      {
        organization_id: org,
        actor_id: active,
        correlation_id: `${p}-foreign`,
        kind: 'REPEATED_AUTH_DENIALS',
        outcome: 'DENIAL',
        source_type: 'http_auth_denial',
      },
      {
        organization_id: org,
        actor_id: active,
        correlation_id: `${p}-ok`,
        kind: 'REPEATED_AUTH_DENIALS',
        outcome: 'DENIAL',
        source_type: 'http_auth_denial',
      },
      {
        organization_id: org,
        actor_id: revoked,
        correlation_id: `${p}-revoked`,
        kind: 'REPEATED_AUTH_DENIALS',
        outcome: 'DENIAL',
        source_type: 'http_auth_denial',
      },
    ]);
  });
  it('reports a real bounded shutdown timeout and later flushes after the pending write settles', async () => {
    const slow = new Promise<void>((resolve) => setTimeout(resolve, 80));
    trackOperationalAuthIntentForShutdown(slow);
    const started = Date.now();
    expect(await flushPendingOperationalAuthDenialIntents({ timeoutMs: 20 })).toBe('timed_out');
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
    await slow;
    expect(await flushPendingOperationalAuthDenialIntents({ timeoutMs: 20 })).toBe('flushed');
  });
});
