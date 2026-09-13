import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
describe('real ApiGateway JWT export snapshot', () => {
  it('self-service exports approved root with truthful incomplete manifest and denies another tenant', async () => {
    const a = await account(),
      b = await account();
    const response = await request(origin)
      .get(`/api/organizations/${a.orgId}/export`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(response.status, response.text).toBe(200);
    expect(response.headers['content-disposition']).toContain('attachment;');
    const body = JSON.parse(response.text);
    expect(body.organization.id).toBe(a.orgId);
    expect(body.securityManifest.complete).toBe(false);
    expect(JSON.stringify(body)).not.toContain(b.orgId);
    const denied = await request(origin)
      .get(`/api/organizations/${b.orgId}/export`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(denied.status).toBe(403);
  });
  it.each(['absent', 'existing'])(
    'HTTP waits for canonical policy writer (%s), returns423 and no export attachment',
    async (mode) => {
      const a = await account();
      const db = await import('../../database/PostgresDatabase.js');
      const policy = await import('../../services/OrgPoliciesService.js');
      if (mode === 'existing') await policy.upsertOrgPolicy(a.orgId, { legalHoldEnabled: false });
      const writer = await pool.connect();
      const original = writer.query.bind(writer);
      const atCommit = deferred(),
        finish = deferred();
      writer.query = (async (sql: string, ...args: unknown[]) => {
        if (sql === 'COMMIT') {
          atCommit.resolve();
          await finish.promise;
        }
        return (original as any)(sql, ...args);
      }) as typeof writer.query;
      const acquire = vi.spyOn(db, 'acquirePgClient').mockResolvedValueOnce(writer);
      const writing = policy.upsertOrgPolicy(a.orgId, { legalHoldEnabled: true });
      await atCommit.promise;
      acquire.mockRestore();
      let settled = false;
      const exporting = request(origin)
        .get(`/api/organizations/${a.orgId}/export`)
        .set('Authorization', `Bearer ${a.token}`)
        .then((r) => {
          settled = true;
          return r;
        });
      try {
        let waiting = false;
        for (let i = 0; i < 150; i++) {
          const locks = await pool.query(
            "SELECT 1 FROM pg_locks WHERE locktype='advisory' AND granted=false"
          );
          if (locks.rowCount) {
            waiting = true;
            break;
          }
          if (settled) break;
          await new Promise((r) => setTimeout(r, 20));
        }
        expect(waiting).toBe(true);
        expect(settled).toBe(false);
      } finally {
        finish.resolve();
      }
      await writing;
      const response = await exporting;
      expect(response.status, response.text).toBe(423);
      expect(response.body.code).toBe('LEGAL_HOLD');
      expect(response.headers['content-disposition']).toBeUndefined();
      expect(response.body.tables).toBeUndefined();
    }
  );
  it('superadmin export enforces same held-tenant423 without attachment', async () => {
    const a = await account(true);
    const policy = await import('../../services/OrgPoliciesService.js');
    await policy.upsertOrgPolicy(a.orgId, { legalHoldEnabled: true });
    const response = await request(origin)
      .get(`/api/superadmin/organizations/${a.orgId}/export`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(response.status, response.text).toBe(423);
    expect(response.body.code).toBe('LEGAL_HOLD');
    expect(response.headers['content-disposition']).toBeUndefined();
  });
  it('real project writer and reader feed tenant JSON and CSV with owned membership descendants', async () => {
    const a = await account(),
      b = await account();
    const created = await request(origin)
      .post('/api/projects')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ name: 'Export own project', description: 'Own business description' });
    expect(created.status, created.text).toBe(201);
    const own = created.body;
    const foreign = await request(origin)
      .post('/api/projects')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ name: 'Other tenant sentinel', description: 'Must not export to A' });
    expect(foreign.status, foreign.text).toBe(201);
    const other = foreign.body;
    const read = await request(origin)
      .get('/api/projects')
      .set('Authorization', `Bearer ${a.token}`);
    expect(read.status, read.text).toBe(200);
    expect(read.body.some((row: { id: string }) => row.id === own.id)).toBe(true);
    const response = await request(origin)
      .get(`/api/organizations/${a.orgId}/export`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(response.status, response.text).toBe(200);
    const body = JSON.parse(response.text);
    expect(body.tables.projects.map((row: { id: string }) => row.id)).toEqual([own.id]);
    expect(body.tables.project_members).toHaveLength(1);
    expect(body.tables.project_members[0]).toMatchObject({
      project_id: own.id,
      user_id: a.userId,
      project_role: 'PROJECT_MANAGER',
    });
    expect(body.rowCounts.projects).toBe(1);
    expect(body.rowCounts.project_members).toBe(1);
    expect(body.totalRows).toBe(2);
    expect(response.text).not.toContain(other.id);
    expect(response.text).not.toContain(b.userId);
    const csv = await request(origin)
      .get(`/api/organizations/${a.orgId}/export?format=csv`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(csv.status, csv.text).toBe(200);
    expect(csv.text).toContain('"projects",0,');
    expect(csv.text).toContain('"project_members",0,');
    expect(csv.text).toContain(own.id);
    expect(csv.text).not.toContain(other.id);
    const sql = await pool.query('SELECT id,organization_id,name FROM projects WHERE id=$1', [
      own.id,
    ]);
    expect(sql.rows[0]).toMatchObject({
      id: own.id,
      organization_id: a.orgId,
      name: 'Export own project',
    });
  });
});
