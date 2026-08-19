/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import organizationsRouter from '../../server/src/routes/organization/organizations.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!realDb).sequential('ADM-UI-CANON-001 — mounted active member directory', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgA = `adm-dir-a-${suffix}`;
  const orgB = `adm-dir-b-${suffix}`;
  const activeAdmin = `adm-dir-admin-${suffix}`;
  const activeMember = `adm-dir-member-${suffix}`;
  const revokedAdmin = `adm-dir-revoked-${suffix}`;
  const foreignAdmin = `adm-dir-foreign-${suffix}`;

  let pool: Pool;
  let app: Express;

  const token = (id: string, organizationId: string) =>
    jwt.sign(
      { id, email: `${id}@test.invalid`, organizationId, organization_id: organizationId, role: 'ADMIN' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  beforeAll(async () => {
    if (!realDb) throw new Error('real PostgreSQL is required');
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: databaseUrl });

    for (const [id, name] of [[orgA, 'Admin directory A'], [orgB, 'Admin directory B']] as const) {
      await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$2)`, [id, name]);
    }
    for (const [id, org, role, membershipStatus] of [
      [activeAdmin, orgA, 'ADMIN', 'ACTIVE'],
      [activeMember, orgA, 'MEMBER', 'ACTIVE'],
      [revokedAdmin, orgA, 'ADMIN', 'INACTIVE'],
      [foreignAdmin, orgB, 'ADMIN', 'ACTIVE'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'unused',$4,'active')`,
        [id, org, `${id}@test.invalid`, role]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,$5)`,
        [randomUUID(), org, id, role, membershipStatus]
      );
    }

    app = express();
    app.use(express.json());
    app.use('/api/organizations', organizationsRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[orgA, orgB]]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[activeAdmin, activeMember, revokedAdmin, foreignAdmin]]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  }, 30_000);

  it('returns only active rows to an active tenant admin', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgA}/members`)
      .set('Authorization', `Bearer ${token(activeAdmin, orgA)}`);

    expect(response.status).toBe(200);
    expect(response.body.map((row: { user_id: string }) => row.user_id).sort()).toEqual(
      [activeAdmin, activeMember].sort()
    );
    expect(response.body.every((row: { status: string }) => row.status === 'ACTIVE')).toBe(true);
  });

  it('denies a signed revoked admin even when its JWT still claims ADMIN', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgA}/members`)
      .set('Authorization', `Bearer ${token(revokedAdmin, orgA)}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REQUIRED' });
  });

  it('denies a signed active admin from another tenant', async () => {
    const response = await request(app)
      .get(`/api/organizations/${orgA}/members`)
      .set('Authorization', `Bearer ${token(foreignAdmin, orgB)}`);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'ORG_MEMBERSHIP_REQUIRED' });
  });
});
