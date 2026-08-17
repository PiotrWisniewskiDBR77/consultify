/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '../../config/Config.js';
import verifyToken, { validateOrgMembership } from '../../middleware/auth.middleware.js';
import {
  flushPendingOperationalAuthDenialIntents,
  metricsMiddleware,
} from '../../middleware/metrics.middleware.js';

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
    app.get('/denied', verifyToken, validateOrgMembership, (_req, res) =>
      res.status(403).json({ error: 'policy_denied' })
    );
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
    await pool.query(`DELETE FROM operational_alert_repair_intents WHERE organization_id=ANY($1)`, [
      [org, foreign],
    ]);
    await pool.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${p}%`]);
    await pool.query(`DELETE FROM users WHERE id=ANY($1)`, [[active, revoked]]);
    await pool.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[org, foreign]]);
    await pool.end();
  });
  it('persists identity-complete denials, excludes missing correlation, and never attributes a forged foreign tenant', async () => {
    expect(
      (
        await request(app)
          .get('/denied')
          .set('Authorization', `Bearer ${sign(active, org)}`)
          .set('x-request-id', `${p}-ok`)
      ).status
    ).toBe(403);
    await flushPendingOperationalAuthDenialIntents();
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
          .get('/denied')
          .set('Authorization', `Bearer ${sign(active, org)}`)
      ).status
    ).toBe(403);
    expect([401, 403]).toContain(
      (
        await request(app)
          .get('/denied')
          .set('Authorization', `Bearer ${sign(revoked, org)}`)
          .set('x-request-id', `${p}-revoked`)
      ).status
    );
    expect([401, 403]).toContain(
      (
        await request(app)
          .get('/denied')
          .set('Authorization', `Bearer ${sign(active, foreign)}`)
          .set('x-request-id', `${p}-foreign`)
      ).status
    );
    await flushPendingOperationalAuthDenialIntents();
    const counts = await pool.query(
      `SELECT organization_id,count(*)::int n FROM operational_alert_repair_intents WHERE organization_id=ANY($1) GROUP BY organization_id`,
      [[org, foreign]]
    );
    expect(counts.rows).toEqual([{ organization_id: org, n: 3 }]);
  });
});
