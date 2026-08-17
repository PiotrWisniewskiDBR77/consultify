/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /^postgres/.test(url);
const secret = 'b1-mounted-intent-observation-secret-long-enough';
process.env.JWT_SECRET = secret; process.env.NODE_ENV = 'test'; process.env.DB_TYPE = 'postgres';
process.env.ENABLE_V8_GLOBAL = 'true'; delete process.env.ENABLE_TEST_AUTH_BYPASS;
const prefix = `b1-mounted-${Date.now().toString(36)}`;
const org = `${prefix}-org`, active = `${prefix}-active`, revoked = `${prefix}-revoked`;
const superNoMember = `${prefix}-super-no-member`;
const token = (id: string, role = 'ADMIN') => ({ Authorization: `Bearer ${jwt.sign({
  id, userId: id, email: `${id}@test.invalid`, organizationId: org, organization_id: org, role,
}, secret, { algorithm: 'HS256', expiresIn: '1h' })}` });

async function waitFor(pool: Pool, requestId: string) {
  for (let i = 0; i < 80; i++) {
    const row = (await pool.query(`SELECT * FROM legacy_cutover_signal_intents WHERE request_id=$1`, [requestId])).rows[0];
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`intent not visible: ${requestId}`);
}

describe.skipIf(!enabled)('B1 mounted durable intent and strict membership realPG', () => {
  let pool: Pool, fin: express.Express, partner: express.Express, results: express.Express;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url }); const now = new Date().toISOString();
    await pool.query(`INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$1,'enterprise','active',1,$2)`, [org, now]);
    for (const [id, role] of [[active, 'ADMIN'], [revoked, 'ADMIN'], [superNoMember, 'SUPERADMIN']])
      await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status,created_at) VALUES($1,$2,$3,'unused',$4,'active',$5)`, [id, org, `${id}@test.invalid`, role, now]);
    for (const [id, status] of [[active, 'ACTIVE'], [revoked, 'REVOKED']])
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'ADMIN',$4,$5)`, [`${prefix}-${id}-m`, org, id, status, now]);
    const financeRouter = (await import('../../../routes/financial-modeling.routes.js')).default;
    fin = express(); fin.use(express.json()); fin.use('/api/financial-modeling', financeRouter);
    fin.use((e: any, _q: any, r: any, _n: any) => r.status(500).json({ error: String(e?.message || e) }));
    const { superAdminPartnerRouter } = await import('../../../routes/partners.routes.js');
    partner = express(); partner.use(express.json()); partner.use('/api/superadmin/partner-settlements', superAdminPartnerRouter);
    partner.use((e: any, _q: any, r: any, _n: any) => r.status(500).json({ error: String(e?.message || e) }));
    const { default: v8 } = await import('../../../routes/v8/index.js');
    results = express(); results.use(express.json()); results.use('/api/v8', v8);
    results.use((e: any, _q: any, r: any, _n: any) => r.status(500).json({ error: String(e?.message || e) }));
  }, 120_000);
  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM legacy_cutover_signal_intents WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM kpi_metric_audit_log WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM initiative_kpis WHERE organization_id=$1 AND name LIKE $2`, [org, `${prefix}%`]);
    await pool.query(`DELETE FROM kpi_definition_versions WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]); await pool.end();
  });

  it('registers intent before the real Finance handler can continue, then completes the same row', async () => {
    const lock = new Client({ connectionString: url }); await lock.connect();
    await lock.query('BEGIN'); await lock.query('LOCK TABLE financial_models IN ACCESS EXCLUSIVE MODE');
    const requestId = `${prefix}-paused`;
    const pending = request(fin).post(`/api/financial-modeling/models/${prefix}-missing/approve`)
      .set(token(active)).set('x-request-id', requestId).send({}).then((r) => r);
    const registered = await waitFor(pool, requestId); expect(registered.status).toBe('REGISTERED');
    await lock.query('ROLLBACK'); await lock.end(); const response = await pending; expect(response.status).toBe(404);
    for (let i = 0; i < 80; i++) {
      const row = (await pool.query(`SELECT * FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [registered.intent_id])).rows[0];
      if (row.status === 'COMPLETED') { expect(row.terminal_status).toBe(404); expect(row.terminal_result).toBe('passed'); return; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('terminal completion not visible');
  });

  it('rejects revoked Results membership before intent or mutation', async () => {
    const requestId = `${prefix}-revoked`;
    const response = await request(results).post('/api/v8/results/kpis').set(token(revoked)).set('x-request-id', requestId).send({ name: `${prefix}-kpi` });
    expect(response.status).toBe(403); expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    expect((await pool.query(`SELECT count(*)::int n FROM legacy_cutover_signal_intents WHERE request_id=$1`, [requestId])).rows[0].n).toBe(0);
  });

  it('lets an ACTIVE signed Results caller reach the real handler and completes its intent', async () => {
    const requestId = `${prefix}-results-active`;
    const response = await request(results).post('/api/v8/results/kpis')
      .set(token(active)).set('x-request-id', requestId).send({ name: `${prefix}-active-kpi` });
    expect([401, 403, 503]).not.toContain(response.status);
    const intent = await waitFor(pool, requestId);
    for (let i = 0; i < 80; i++) {
      const row = (await pool.query(`SELECT status,terminal_status FROM legacy_cutover_signal_intents WHERE intent_id=$1`, [intent.intent_id])).rows[0];
      if (row.status === 'COMPLETED') { expect(row.terminal_status).toBe(response.status); return; }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('Results terminal completion not visible');
  });

  it('does not let SUPERADMIN bypass missing ACTIVE membership on Partner', async () => {
    const requestId = `${prefix}-super-no-membership`;
    const response = await request(partner).post('/api/superadmin/partner-settlements/approve-commissions')
      .set(token(superNoMember, 'SUPERADMIN')).set('x-request-id', requestId).send({ commissionIds: [] });
    expect(response.status).toBe(403); expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });
    expect((await pool.query(`SELECT count(*)::int n FROM legacy_cutover_signal_intents WHERE request_id=$1`, [requestId])).rows[0].n).toBe(0);
  });

  it('fails 503 before Finance handler when durable registration is unavailable', async () => {
    const name = (await pool.query(`SELECT current_database() name`)).rows[0].name as string;
    if (!/(b1|disposable|test)/i.test(name)) throw new Error(`B1_TEST_DB_NOT_DISPOSABLE:${name}`);
    await pool.query(`ALTER TABLE legacy_cutover_signal_intents RENAME TO legacy_cutover_signal_intents_b1_hold`);
    try {
      const response = await request(fin).post(`/api/financial-modeling/models/${prefix}-db-down/approve`)
        .set(token(active)).set('x-request-id', `${prefix}-db-down`).send({});
      expect(response.status).toBe(503); expect(response.body).toMatchObject({ code: 'LEGACY_CUTOVER_INTENT_UNAVAILABLE' });
    } finally { await pool.query(`ALTER TABLE legacy_cutover_signal_intents_b1_hold RENAME TO legacy_cutover_signal_intents`); }
  });

  it('cold pool reads exact completed Finance intent', async () => {
    const cold = new Pool({ connectionString: url });
    try {
      const rows = await cold.query(`SELECT status,terminal_status,terminal_result FROM legacy_cutover_signal_intents WHERE request_id=$1`, [`${prefix}-paused`]);
      expect(rows.rows).toEqual([{ status: 'COMPLETED', terminal_status: 404, terminal_result: 'passed' }]);
    } finally { await cold.end(); }
  });
});
