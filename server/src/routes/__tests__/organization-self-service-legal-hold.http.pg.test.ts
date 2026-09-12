/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL || '';
const enabled = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');

describe.skipIf(!enabled)('CODEX6 E4 transactional legal-hold deletion guard', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgId = `cx6-hold-${suffix}`;
  const concurrentOrgId = `cx6-hold-race-${suffix}`;
  const adminId = `cx6-hold-admin-${suffix}`;
  const concurrentAdminId = `cx6-hold-race-admin-${suffix}`;
  const orgName = `CX6 Held ${suffix}`;
  const concurrentOrgName = `CX6 Held Race ${suffix}`;
  let pool: Pool;
  let app: express.Express;
  let token: string;
  let concurrentToken: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 8 });
    await pool.query(`INSERT INTO organizations(id,name,organization_type,is_active) VALUES ($1,$2,'PAID',1),($3,$4,'PAID',1)`, [orgId, orgName, concurrentOrgId, concurrentOrgName]);
    await pool.query(`INSERT INTO users(id,organization_id,email,role,status) VALUES ($1,$2,$3,'ADMIN','active'),($4,$5,$6,'ADMIN','active')`, [adminId, orgId, `${adminId}@example.test`, concurrentAdminId, concurrentOrgId, `${concurrentAdminId}@example.test`]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$6,'ADMIN','ACTIVE')`, [randomUUID(), orgId, adminId, randomUUID(), concurrentOrgId, concurrentAdminId]);
    await pool.query(`INSERT INTO org_policies(id,organization_id,legal_hold_enabled) VALUES ($1,$2,1),($3,$4,0)`, [`cx6-policy-${suffix}`, orgId, `cx6-policy-race-${suffix}`, concurrentOrgId]);
    const config = (await import('../../config/Config.js')).default;
    token = jwt.sign({ id: adminId, email: `${adminId}@example.test`, role: 'ADMIN', organizationId: orgId }, config.JWT_SECRET, { expiresIn: '15m' });
    concurrentToken = jwt.sign({ id: concurrentAdminId, email: `${concurrentAdminId}@example.test`, role: 'ADMIN', organizationId: concurrentOrgId }, config.JWT_SECRET, { expiresIn: '15m' });
    const routes = (await import('../organization/ownership.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/organizations', routes);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM org_policies WHERE organization_id IN ($1,$2)', [orgId, concurrentOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM organization_members WHERE organization_id IN ($1,$2)', [orgId, concurrentOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id IN ($1,$2)', [orgId, concurrentOrgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id IN ($1,$2)', [orgId, concurrentOrgId]).catch(() => undefined);
    await pool.end();
  });

  it('returns controlled 423 for an active hold without deletion or success receipt', async () => {
    const response = await request(app).delete(`/api/organizations/${orgId}`).set('Authorization', `Bearer ${token}`).send({ confirmation: true, organizationName: orgName, reason: 'held tenant negative control' });
    expect(response.status).toBe(423);
    expect(response.body).toEqual({ code: 'LEGAL_HOLD' });
    expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [orgId])).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM organization_self_service_deletion_receipts WHERE target_organization_id=$1', [orgId])).rowCount).toBe(0);
  });

  it('rechecks policy after the organization lock when a hold is activated during deletion', async () => {
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [concurrentOrgId]);
      const deletion = request(app).delete(`/api/organizations/${concurrentOrgId}`).set('Authorization', `Bearer ${concurrentToken}`).send({ confirmation: true, organizationName: concurrentOrgName, reason: 'concurrent hold proof' });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await blocker.query('UPDATE org_policies SET legal_hold_enabled=1 WHERE organization_id=$1', [concurrentOrgId]);
      await blocker.query('COMMIT');
      const response = await deletion;
      expect(response.status).toBe(423);
      expect(response.body.code).toBe('LEGAL_HOLD');
      expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [concurrentOrgId])).rowCount).toBe(1);
      expect((await pool.query('SELECT 1 FROM organization_self_service_deletion_receipts WHERE target_organization_id=$1', [concurrentOrgId])).rowCount).toBe(0);
    } finally {
      await blocker.query('ROLLBACK').catch(() => undefined);
      blocker.release();
    }
  });
});
