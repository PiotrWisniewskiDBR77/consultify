import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const databaseUrl = process.env.DATABASE_URL || '';
const expectedDatabase = process.env.C6_EXPORT_TEST_DATABASE || '';
const pool = new Pool({ connectionString: databaseUrl, max: 6 });
const orgIds: string[] = [];
const userIds: string[] = [];
let server: Server;
let secret: string;
const origin = 'http://127.0.0.1:4216';
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function account(superadmin = false) {
  const orgId = randomUUID(),
    userId = randomUUID();
  orgIds.push(orgId);
  userIds.push(userId);
  await pool.query('INSERT INTO organizations(id,name) VALUES ($1,$2)', [
    orgId,
    `Gateway export ${orgId}`,
  ]);
  await pool.query(
    "INSERT INTO users(id,organization_id,email,password,role,status) VALUES ($1,$2,$3,'local-fixture-not-login',$4,'active')",
    [userId, orgId, `${userId}@test.invalid`, superadmin ? 'SUPERADMIN' : 'ADMIN']
  );
  await pool.query(
    "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')",
    [randomUUID(), orgId, userId]
  );
  const token = jwt.sign(
    {
      id: userId,
      organizationId: orgId,
      role: superadmin ? 'SUPERADMIN' : 'ADMIN',
      email: `${userId}@test.invalid`,
    },
    secret,
    { expiresIn: '15m' }
  );
  return { orgId, userId, token };
}
beforeAll(async () => {
  expect(expectedDatabase.startsWith('cx6_')).toBe(true);
  const identity = await assertRealPostgresTestEnvironment({ expectedDatabase });
  expect(identity.host).toBe('127.0.0.1');
  expect(identity.port).toBe('6457');
  const config = (await import('../../config/Config.js')).default;
  secret = config.JWT_SECRET;
  const { ApiGateway } = await import('../../Gateway.js');
  const app = express();
  app.use(express.json());
  ApiGateway.getInstance().initializeRoutes(app);
  server = await new Promise<Server>((resolve, reject) => {
    const listening = app.listen(4216, '127.0.0.1', () => resolve(listening));
    listening.once('error', reject);
  });
}, 60000);
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  await pool.query('DELETE FROM org_policies WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query(
    'DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE organization_id=ANY($1::text[]))',
    [orgIds]
  );
  await pool.query('DELETE FROM projects WHERE organization_id=ANY($1::text[])', [orgIds]);
  await pool.query('DELETE FROM organization_members WHERE organization_id=ANY($1::text[])', [
    orgIds,
  ]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::text[])', [userIds]);
  await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [orgIds]);
  await pool.end();
  const db = await import('../../database/PostgresDatabase.js');
  await db.default.close();
});
describe('real export persisted membership authority', () => {
  it.each([
    ['ACTIVE ADMIN', 'ADMIN', 'ACTIVE', false, 200],
    ['ACTIVE OWNER', 'OWNER', 'ACTIVE', false, 200],
    ['persisted MEMBER with stale ADMIN JWT', 'MEMBER', 'ACTIVE', false, 403],
    ['inactive ADMIN membership', 'ADMIN', 'INACTIVE', false, 403],
    ['missing membership', 'ADMIN', 'ACTIVE', true, 403],
  ] as const)(
    '%s is decided by persisted membership',
    async (_name, role, status, missing, expected) => {
      const a = await account();
      if (missing)
        await pool.query(
          'DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2',
          [a.orgId, a.userId]
        );
      else
        await pool.query(
          'UPDATE organization_members SET role=$1,status=$2 WHERE organization_id=$3 AND user_id=$4',
          [role, status, a.orgId, a.userId]
        );
      const result = await request(origin)
        .get(`/api/organizations/${a.orgId}/export`)
        .set('Authorization', `Bearer ${a.token}`);
      expect(result.status, result.text).toBe(expected);
      if (expected === 200) expect(JSON.parse(result.text).organization.id).toBe(a.orgId);
      else {
        expect(result.headers['content-disposition']).toBeUndefined();
        expect(result.body.error).toBe('ORG_ADMIN_REQUIRED');
      }
    }
  );
  it('normal catalog rejects empty and invalid membership roles before any endpoint call', async () => {
    const a = await account();
    for (const role of ['', 'INVALID']) {
      await expect(
        pool.query(
          'UPDATE organization_members SET role=$1 WHERE organization_id=$2 AND user_id=$3',
          [role, a.orgId, a.userId]
        )
      ).rejects.toMatchObject({ code: '23514' });
    }
  });
  it.each(['', 'INVALID'])(
    'controlled CHECK drift role=%s cannot recover ADMIN authority from JWT',
    async (role) => {
      const a = await account();
      const query =
        "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='public.organization_members'::regclass AND conname='organization_members_role_check' AND contype='c'";
      const original = (await pool.query(query)).rows;
      expect(original).toHaveLength(1);
      const constraint = original[0];
      const before = (
        await pool.query(
          'SELECT id,role,status FROM organization_members WHERE organization_id=$1 AND user_id=$2',
          [a.orgId, a.userId]
        )
      ).rows[0];
      let dropped = false;
      try {
        await pool.query(
          'ALTER TABLE public.organization_members DROP CONSTRAINT organization_members_role_check'
        );
        dropped = true;
        await pool.query('UPDATE organization_members SET role=$1 WHERE id=$2', [role, before.id]);
        const result = await request(origin)
          .get(`/api/organizations/${a.orgId}/export`)
          .set('Authorization', `Bearer ${a.token}`);
        expect(result.status, result.text).toBe(403);
        expect(result.headers['content-disposition']).toBeUndefined();
        expect(result.body.error).toBe('ORG_ADMIN_REQUIRED');
      } finally {
        await pool.query('UPDATE organization_members SET role=$1,status=$2 WHERE id=$3', [
          before.role,
          before.status,
          before.id,
        ]);
        if (dropped)
          await pool.query(
            `ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_role_check ${constraint.definition}`
          );
        expect((await pool.query(query)).rows).toEqual(original);
        expect(
          (
            await pool.query('SELECT id,role,status FROM organization_members WHERE id=$1', [
              before.id,
            ])
          ).rows[0]
        ).toEqual(before);
        await expect(
          pool.query(
            "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'INVALID','ACTIVE')",
            [randomUUID(), a.orgId, a.userId]
          )
        ).rejects.toMatchObject({ code: '23514' });
      }
    }
  );
  it('foreign tenant and unauthenticated callers receive no export attachment', async () => {
    const a = await account(),
      b = await account();
    const foreign = await request(origin)
      .get(`/api/organizations/${b.orgId}/export`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(foreign.status).toBe(403);
    expect(foreign.headers['content-disposition']).toBeUndefined();
    const unauth = await request(origin).get(`/api/organizations/${a.orgId}/export`);
    expect(unauth.status).toBe(401);
    expect(unauth.headers['content-disposition']).toBeUndefined();
  });
});
