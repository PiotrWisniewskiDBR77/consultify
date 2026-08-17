/** @vitest-environment node */
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && /^postgres/.test(url);
const secret = 'b1-admin-bulk-membership-secret-long-enough';
process.env.JWT_SECRET = secret; process.env.NODE_ENV = 'test'; process.env.DB_TYPE = 'postgres';
const prefix = `b1-bulk-${Date.now().toString(36)}`;
const org = `${prefix}-org`, admin = `${prefix}-admin`, importedEmail = `${prefix}@test.invalid`;

describe.skipIf(!enabled)('admin bulk user plus membership atomic writer realPG', () => {
  let pool: Pool, app: express.Express;
  beforeAll(async () => {
    pool = new Pool({ connectionString: url }); const now = new Date().toISOString();
    await pool.query(`INSERT INTO organizations(id,name,plan,status,is_active,created_at) VALUES($1,$1,'enterprise','active',1,$2)`, [org, now]);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status,created_at) VALUES($1,$2,$3,'unused','ADMIN','active',$4)`, [admin, org, `${admin}@test.invalid`, now]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'ADMIN','ACTIVE',$4)`, [`${prefix}-admin-m`, org, admin, now]);
    const router = (await import('../admin-bulk.routes.js')).default;
    app = express(); app.use(express.json()); app.use('/api/admin', router);
    app.use((e: any, _q: any, r: any, _n: any) => r.status(500).json({ error: String(e?.message || e) }));
  });
  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]); await pool.end();
  });

  it('commits user and ACTIVE membership together and cold-reads both', async () => {
    const bearer = jwt.sign({ id: admin, userId: admin, email: `${admin}@test.invalid`, organizationId: org, role: 'ADMIN' }, secret, { algorithm: 'HS256', expiresIn: '1h' });
    const response = await request(app).post('/api/admin/users/bulk-import')
      .set('Authorization', `Bearer ${bearer}`).send({ users: [{ email: importedEmail, role: 'MANAGER' }] });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ success: 1, failed: 0 });
    const cold = new Pool({ connectionString: url });
    try {
      const rows = await cold.query(`SELECT u.email,u.role user_role,m.role membership_role,m.status
        FROM users u JOIN organization_members m ON m.user_id=u.id AND m.organization_id=u.organization_id
        WHERE u.organization_id=$1 AND u.email=$2`, [org, importedEmail]);
      expect(rows.rows).toEqual([{ email: importedEmail, user_role: 'MANAGER', membership_role: 'MEMBER', status: 'ACTIVE' }]);
    } finally { await cold.end(); }
  });

  it('keeps duplicate import failure atomic with no second user or membership', async () => {
    const before = (await pool.query(`SELECT count(*)::int n FROM users WHERE organization_id=$1`, [org])).rows[0].n;
    const bearer = jwt.sign({ id: admin, userId: admin, email: `${admin}@test.invalid`, organizationId: org, role: 'ADMIN' }, secret);
    const response = await request(app).post('/api/admin/users/bulk-import')
      .set('Authorization', `Bearer ${bearer}`).send({ users: [{ email: importedEmail, role: 'MANAGER' }] });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ success: 0, failed: 1 });
    const paired = await pool.query(`SELECT count(*)::int n FROM users u JOIN organization_members m ON m.user_id=u.id WHERE u.organization_id=$1 AND u.email=$2`, [org, importedEmail]);
    expect(paired.rows[0].n).toBe(1);
    expect((await pool.query(`SELECT count(*)::int n FROM users WHERE organization_id=$1`, [org])).rows[0].n).toBe(before);
  });
});
