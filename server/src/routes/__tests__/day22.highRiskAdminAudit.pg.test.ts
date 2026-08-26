/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL || '';
const enabled =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres(?:ql)?:/.test(databaseUrl);
const secret = 'day22-high-risk-admin-audit-secret-long-enough';
process.env.JWT_SECRET = secret;
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
process.env.MOCK_DB = 'false';

describe.skipIf(!enabled)('Day 22 high-risk Admin semantic audit on RealPG', () => {
  const org = randomUUID();
  const foreignOrg = randomUUID();
  const owner = randomUUID();
  const approver = randomUUID();
  const foreignOwner = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  let app: express.Express;
  let token: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const auditRows = async (action: string) =>
    (
      await pool.query(
        `SELECT id, org_id, actor_id, action, resource_type, resource_id,
                before_json, after_json, metadata_json
           FROM audit_events
          WHERE org_id = $1 AND action = $2
          ORDER BY ts DESC`,
        [org, action]
      )
    ).rows;
  const rejectAuditAction = async (action: string) => {
    await pool.query(`
      CREATE OR REPLACE FUNCTION pg_temp.day22_reject_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW.action = '${action}' THEN RAISE EXCEPTION 'DAY22_AUDIT_FAILURE'; END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER day22_reject_audit BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION pg_temp.day22_reject_audit();
    `);
  };
  const restoreAuditWrites = async () => {
    await pool.query('DROP TRIGGER IF EXISTS day22_reject_audit ON audit_events');
  };
  const fiveTableCounts = async () => {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM admin_audit_logs WHERE organization_id=$1) AS admin_audit_logs,
        (SELECT COUNT(*)::int FROM role_change_audit_events WHERE organization_id=$1) AS role_change_audit_events,
        (SELECT COUNT(*)::int FROM audit_events WHERE org_id=$1) AS audit_events,
        (SELECT COUNT(*)::int FROM activity_logs WHERE organization_id=$1) AS activity_logs,
        (SELECT COUNT(*)::int FROM audit_log WHERE organization_id=$1) AS audit_log`,
      [org]
    );
    return result.rows[0] as Record<string, number>;
  };

  beforeAll(async () => {
    for (const id of [org, foreignOrg])
      await pool.query('INSERT INTO organizations (id,name) VALUES ($1,$1)', [id]);
    for (const [id, organizationId, role] of [
      [owner, org, 'OWNER'],
      [approver, org, 'MEMBER'],
      [foreignOwner, foreignOrg, 'OWNER'],
    ]) {
      await pool.query(
        `INSERT INTO users (id,organization_id,email,role,status)
         VALUES ($1,$2,$3,$4,'active')`,
        [id, organizationId, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members (id,organization_id,user_id,role,status)
         VALUES ($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), organizationId, id, role]
      );
    }

    const breakGlass = (await import('../admin/break-glass.routes.js')).default;
    const serviceAccounts = (await import('../admin/service-accounts.routes.js')).default;
    const auditProjection = (await import('../adminP32.routes.js')).default;
    const { verifyToken } = await import('../../middleware/auth.middleware.js');
    const { default: auditLogMiddleware } = await import('../../middleware/auditLog.middleware.js');
    app = express();
    app.use(express.json());
    app.use('/api/', verifyToken, auditLogMiddleware);
    app.use('/api/admin/break-glass', breakGlass);
    app.use('/api/admin/service-accounts', serviceAccounts);
    app.use('/api/admin', auditProjection);
    token = jwt.sign(
      {
        id: owner,
        userId: owner,
        organizationId: org,
        email: `${owner}@test.invalid`,
        role: 'OWNER',
      },
      secret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM audit_events WHERE org_id = ANY($1)', [[org, foreignOrg]]);
    await pool.query('DELETE FROM activity_logs WHERE organization_id = ANY($1)', [
      [org, foreignOrg],
    ]);
    await pool.query('DELETE FROM audit_log WHERE organization_id = ANY($1)', [[org, foreignOrg]]);
    await pool.query('DELETE FROM admin_sessions WHERE organization_id = ANY($1)', [
      [org, foreignOrg],
    ]);
    await pool.query('DELETE FROM tp_service_accounts WHERE organization_id::text = ANY($1)', [
      [org, foreignOrg],
    ]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = ANY($1)', [
      [org, foreignOrg],
    ]);
    await pool.query('DELETE FROM users WHERE id = ANY($1)', [[owner, approver, foreignOwner]]);
    await pool.query('DELETE FROM organizations WHERE id = ANY($1)', [[org, foreignOrg]]);
    await pool.end();
  });

  it('creates a service account, independently reads it back, and projects a secret-free audit row', async () => {
    const response = await request(app)
      .post('/api/admin/service-accounts')
      .set(auth())
      .send({ name: 'day22-machine', scopes: ['records:read'], expiresInDays: 7 });
    expect(response.status).toBe(201);
    const accountId = response.body.data.account.id;
    const persisted = await pool.query(
      'SELECT id, organization_id::text, scopes FROM tp_service_accounts WHERE id = $1',
      [accountId]
    );
    expect(persisted.rows[0]).toMatchObject({
      id: accountId,
      organization_id: org,
      scopes: ['records:read'],
    });
    const rows = await auditRows('service_account.created');
    expect(rows[0]).toMatchObject({
      org_id: org,
      actor_id: owner,
      resource_type: 'service_account',
      resource_id: accountId,
    });
    expect(rows[0].resource_type).not.toBe(rows[0].action);
    expect(rows[0].metadata_json).not.toContain(response.body.data.token);

    const projection = await request(app).get('/api/admin/audit-logs?limit=100').set(auth());
    expect(projection.status).toBe(200);
    expect(projection.body.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: rows[0].id,
          organization_id: org,
          resource_type: 'service_account',
          resource_id: accountId,
          risk_score: null,
        }),
      ])
    );
  });

  it('returns an honest empty validation result and writes neither resource nor audit row', async () => {
    const before = (await auditRows('service_account.created')).length;
    const response = await request(app)
      .post('/api/admin/service-accounts')
      .set(auth())
      .send({ name: '', scopes: [] });
    expect(response.status).toBe(400);
    expect((await auditRows('service_account.created')).length).toBe(before);
  });

  it('reports that service-account creation was applied when its audit write fails', async () => {
    await rejectAuditAction('service_account.created');
    try {
      const response = await request(app)
        .post('/api/admin/service-accounts')
        .set(auth())
        .send({ name: 'audit-failure-machine', scopes: ['records:read'] });
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        code: 'AUDIT_UNAVAILABLE',
        operationApplied: true,
      });
      const resource = await pool.query(
        `SELECT COUNT(*)::int AS n FROM tp_service_accounts
          WHERE organization_id::text=$1 AND name='audit-failure-machine'`,
        [org]
      );
      expect(resource.rows[0].n).toBe(1);
    } finally {
      await restoreAuditWrites();
    }
  });

  it('hides a foreign service account and leaves both mutation and audit stores unchanged', async () => {
    const inserted = await pool.query(
      `INSERT INTO tp_service_accounts
       (organization_id,name,token_hash,token_prefix,scopes,created_by)
       VALUES ($1,'foreign-machine','hash','prefix',ARRAY['records:read'],$2)
       RETURNING id`,
      [foreignOrg, foreignOwner]
    );
    const id = inserted.rows[0].id;
    const before = (await auditRows('service_account.revoked')).length;
    const response = await request(app).delete(`/api/admin/service-accounts/${id}`).set(auth());
    expect(response.status).toBe(404);
    expect(
      (await pool.query('SELECT COUNT(*)::int AS n FROM tp_service_accounts WHERE id=$1', [id]))
        .rows[0].n
    ).toBe(1);
    expect((await auditRows('service_account.revoked')).length).toBe(before);
  });

  it('revokes an owned service account and records the confirmed deletion', async () => {
    const inserted = await pool.query(
      `INSERT INTO tp_service_accounts
       (organization_id,name,token_hash,token_prefix,scopes,created_by)
       VALUES ($1,'owned-machine','hash2','prefix2',ARRAY['records:write'],$2)
       RETURNING id`,
      [org, owner]
    );
    const id = inserted.rows[0].id;
    const response = await request(app).delete(`/api/admin/service-accounts/${id}`).set(auth());
    expect(response.status).toBe(204);
    expect(
      (await pool.query('SELECT COUNT(*)::int AS n FROM tp_service_accounts WHERE id=$1', [id]))
        .rows[0].n
    ).toBe(0);
    expect(await auditRows('service_account.revoked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource_type: 'service_account', resource_id: id }),
      ])
    );
  });

  it('creates and revokes a break-glass session with semantic audit after each readback', async () => {
    const created = await request(app)
      .post('/api/admin/break-glass/sessions')
      .set(auth())
      .send({ approvedBy: approver, breakGlassReason: 'Day 22 emergency verification' });
    expect(created.status).toBe(201);
    const session = await pool.query(
      `SELECT id, is_active FROM admin_sessions
        WHERE organization_id=$1 AND session_type='break_glass'
        ORDER BY created_at DESC LIMIT 1`,
      [org]
    );
    expect(session.rows[0].is_active).toBe(1);
    expect(await auditRows('break_glass_session.created')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource_type: 'break_glass_session',
          resource_id: session.rows[0].id,
        }),
      ])
    );

    const revoked = await request(app)
      .delete(`/api/admin/break-glass/sessions/${session.rows[0].id}`)
      .set(auth());
    expect(revoked.status).toBe(200);
    const readback = await pool.query('SELECT is_active FROM admin_sessions WHERE id=$1', [
      session.rows[0].id,
    ]);
    expect(readback.rows[0].is_active).toBe(0);
    expect(await auditRows('break_glass_session.revoked')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource_type: 'break_glass_session',
          resource_id: session.rows[0].id,
        }),
      ])
    );
  });

  it('reports that break-glass creation was applied when its audit write fails', async () => {
    await rejectAuditAction('break_glass_session.created');
    try {
      const response = await request(app)
        .post('/api/admin/break-glass/sessions')
        .set(auth())
        .send({ approvedBy: approver, breakGlassReason: 'Day 22 forced audit failure' });
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        code: 'AUDIT_UNAVAILABLE',
        operationApplied: true,
      });
      const resource = await pool.query(
        `SELECT COUNT(*)::int AS n FROM admin_sessions
          WHERE organization_id=$1 AND break_glass_reason='Day 22 forced audit failure'`,
        [org]
      );
      expect(resource.rows[0].n).toBe(1);
    } finally {
      await restoreAuditWrites();
    }
  });

  it('rejects a foreign break-glass session without a phantom audit row', async () => {
    const foreignSession = randomUUID();
    await pool.query(
      `INSERT INTO admin_sessions
       (id,admin_user_id,user_id,session_token,expires_at,session_type,organization_id,is_active)
       VALUES ($1,$2,$2,$3,NOW()+INTERVAL '1 hour','break_glass',$4,1)`,
      [foreignSession, foreignOwner, randomUUID(), foreignOrg]
    );
    const before = (await auditRows('break_glass_session.revoked')).length;
    const response = await request(app)
      .delete(`/api/admin/break-glass/sessions/${foreignSession}`)
      .set(auth());
    expect(response.status).toBe(404);
    expect(
      (await pool.query('SELECT is_active FROM admin_sessions WHERE id=$1', [foreignSession]))
        .rows[0].is_active
    ).toBe(1);
    expect((await auditRows('break_glass_session.revoked')).length).toBe(before);
  });

  it('proves the global writer duplicates one mutation and that projection legs 4/5 must not be added', async () => {
    const before = await fiveTableCounts();
    const response = await request(app)
      .post('/api/admin/service-accounts')
      .set(auth())
      .send({ name: 'triple-write-machine', scopes: ['records:read'] });
    expect(response.status).toBe(201);

    let after = await fiveTableCounts();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && after.audit_log - before.audit_log < 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      after = await fiveTableCounts();
    }
    expect({
      admin_audit_logs: after.admin_audit_logs - before.admin_audit_logs,
      role_change_audit_events: after.role_change_audit_events - before.role_change_audit_events,
      audit_events: after.audit_events - before.audit_events,
      activity_logs: after.activity_logs - before.activity_logs,
      audit_log: after.audit_log - before.audit_log,
    }).toEqual({
      admin_audit_logs: 0,
      role_change_audit_events: 0,
      audit_events: 2,
      activity_logs: 0,
      audit_log: 1,
    });
  });
});
