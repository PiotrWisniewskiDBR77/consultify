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
  expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
  expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
  expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
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
  for (const table of ['tasks', 'canonical_inbox_items'])
    await pool.query(`DELETE FROM ${table} WHERE organization_id=ANY($1::text[])`, [orgIds]);
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
describe('real personal task export', () => {
  it('My Work writer and reader preserve manual content while linked private source content stays unresolved in JSON CSV', async () => {
    const a = await account(),
      b = await account();
    const created: Array<{ id: string; title: string; orgId: string }> = [];
    for (const [actor, title, source] of [
      [a, 'OWN_MANUAL_TASK', null],
      [b, 'FOREIGN_TASK_CONTENT', null],
      [
        a,
        'PRIVATE_NOTEBOOK_TASK',
        { sourceType: 'notebook', sourceId: `private-note-${randomUUID()}` },
      ],
    ] as const) {
      const write = await request(origin)
        .post('/api/my-work/personal-tasks')
        .set('Authorization', `Bearer ${actor.token}`)
        .send({
          title,
          description: title + '_BODY',
          tags: ['manual-export'],
          idempotencyKey: randomUUID(),
          ...(source || {}),
        });
      expect(write.status, write.text).toBe(201);
      expect(write.body.id).toBeTruthy();
      created.push({ id: write.body.id, title, orgId: actor.orgId });
    }
    const read = await request(origin)
      .get('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${a.token}`);
    expect(read.status, read.text).toBe(200);
    expect(read.text).toContain('OWN_MANUAL_TASK');
    expect(read.text).not.toContain('FOREIGN_TASK_CONTENT');
    // Additional scalar/JSON payloads come from different writers. This explicit
    // fixture does not claim those writers were exercised or grant their content.
    await pool.query('UPDATE tasks SET risks=$1, attachments=$2 WHERE id=$3', [
      { detail: 'PRIVATE_SUPPLEMENTAL_TASK' },
      'PRIVATE_SUPPLEMENTAL_TASK',
      created[0].id,
    ]);
    const snapshot = async () =>
      (
        await pool.query(
          'SELECT to_jsonb(t) AS row FROM tasks t WHERE organization_id=ANY($1::text[]) ORDER BY id',
          [[a.orgId, b.orgId]]
        )
      ).rows;
    const before = await snapshot();
    expect(before.find((r) => r.row.id === created[0].id).row).toMatchObject({
      task_type: 'personal',
      source: 'manual',
      source_type: null,
      source_id: null,
      assignee_id: a.userId,
    });
    expect(before.find((r) => r.row.id === created[2].id).row.source_type).toBe('notebook');
    for (const format of ['json', 'csv']) {
      const exported = await request(origin)
        .get(`/api/organizations/${a.orgId}/export?format=${format}`)
        .set('Authorization', `Bearer ${a.token}`);
      expect(exported.status, exported.text).toBe(200);
      expect(exported.text).toContain('OWN_MANUAL_TASK_BODY');
      for (const sentinel of [
        'PRIVATE_NOTEBOOK_TASK',
        'FOREIGN_TASK_CONTENT',
        'PRIVATE_SUPPLEMENTAL_TASK',
      ])
        expect(exported.text).not.toContain(sentinel);
      if (format === 'json') {
        expect(exported.body.tables.tasks).toHaveLength(2);
        expect(exported.body.securityManifest.complete).toBe(false);
        expect(
          exported.body.tables.tasks.find((r: any) => r.id === created[2].id).source_type
        ).toBe('notebook');
      }
    }
    expect(await snapshot()).toEqual(before);
  });
});
