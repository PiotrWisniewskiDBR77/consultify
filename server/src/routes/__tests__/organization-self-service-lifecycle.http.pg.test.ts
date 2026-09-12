/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');

describe.skipIf(!enabled)('CODEX6 E4 organization self-service lifecycle', () => {
  const suffix = randomUUID().slice(0, 8);
  const org = `cx6-self-${suffix}`;
  const otherOrg = `cx6-other-${suffix}`;
  const admin = `cx6-admin-${suffix}`;
  const otherUser = `cx6-other-user-${suffix}`;
  const orgName = `CX6 Self Service ${suffix}`;
  let pool: Pool;
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name,organization_type,is_active) VALUES ($1,$2,'PAID',1),($3,$4,'PAID',1)`, [org, orgName, otherOrg, `Other ${suffix}`]);
    await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'ADMIN','active'),($4,$5,$6,'USER','active')`, [admin, org, `${admin}@example.test`, otherUser, otherOrg, `${otherUser}@example.test`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'USER','ACTIVE')`, [randomUUID(), org, admin, randomUUID(), otherOrg, otherUser]);
    const config = (await import('../../config/Config.js')).default;
    token = jwt.sign({ id: admin, email: `${admin}@example.test`, role: 'ADMIN', organizationId: org }, config.JWT_SECRET, { expiresIn: '15m' });
    const routes = (await import('../organization/ownership.routes.js')).default;
    app = express(); app.use(express.json()); app.use('/api/organizations', routes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [otherOrg]).catch(() => undefined);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [otherOrg]).catch(() => undefined);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [otherOrg]).catch(() => undefined);
    await pool.end();
  });

  it('exports own tenant data and excludes another tenant', async () => {
    const response = await request(app).get(`/api/organizations/${org}/export`).set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.text).toContain(admin);
    expect(response.text).not.toContain(otherUser);
  });

  it('rejects cross-tenant export and an incorrect deletion name without mutation', async () => {
    expect((await request(app).get(`/api/organizations/${otherOrg}/export`).set('Authorization', `Bearer ${token}`)).status).toBe(403);
    const wrong = await request(app).delete(`/api/organizations/${org}`).set('Authorization', `Bearer ${token}`).send({ confirmation: true, organizationName: 'wrong', reason: 'negative control' });
    expect(wrong.status).toBe(428);
    expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [org])).rowCount).toBe(1);
  });

  it('deletes the tenant atomically and leaves an immutable external receipt', async () => {
    const response = await request(app).delete(`/api/organizations/${org}`).set('Authorization', `Bearer ${token}`).send({ confirmation: true, organizationName: orgName, reason: 'CODEX6 local self-service proof' });
    expect(response.status).toBe(200);
    expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [org])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM users WHERE id=$1', [admin])).rowCount).toBe(0);
    const receipt = await pool.query('SELECT receipt_id,actor_id FROM organization_self_service_deletion_receipts WHERE target_organization_id=$1', [org]);
    expect(receipt.rows).toEqual([expect.objectContaining({ actor_id: admin })]);
    await expect(pool.query('DELETE FROM organization_self_service_deletion_receipts WHERE receipt_id=$1', [receipt.rows[0].receipt_id])).rejects.toThrow(/immutable/);
  });
});
