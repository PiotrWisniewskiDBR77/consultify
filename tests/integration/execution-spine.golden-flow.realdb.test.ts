/**
 * EXE-MVP-SPINE-001 — production legacy-write retirement, real PostgreSQL.
 * Runtime-v1 positive golden flow is qualified by initiatives-execution suites.
 */
import { randomBytes } from 'node:crypto';
import express from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

import initiativesRoutes from '../../server/src/routes/pmo/initiatives.routes.js';
import taskRoutes from '../../server/src/routes/pmo/tasks.routes.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
const real = databaseUrl ? describe : describe.skip;
const tag = `exe_readonly_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
const ids = {
  org: `org_${tag}`,
  user: `user_${tag}`,
  project: `project_${tag}`,
  initiative: `initiative_${tag}`,
};

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function token(): string {
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    e2e: true,
    id: ids.user,
    email: `${ids.user}@local.test`,
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId: ids.org,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.e2e`;
}

real('EXE-MVP-SPINE legacy compatibility is read-only', () => {
  const client = new Client({ connectionString: databaseUrl });
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativesRoutes);
  app.use('/api/tasks', taskRoutes);

  beforeAll(async () => {
    await client.connect();
    await client.query(
      `INSERT INTO organizations (id,name,plan,status)
       VALUES ($1,'Execution legacy retirement','enterprise','active')`,
      [ids.org]
    );
    await client.query(
      `INSERT INTO users
        (id,organization_id,email,password,role,status,first_name,last_name)
       VALUES ($1,$2,$3,'not-used','ADMIN','active','Execution','Owner')`,
      [ids.user, ids.org, `${ids.user}@local.test`]
    );
    await client.query(
      `INSERT INTO organization_members
        (id,organization_id,user_id,role,status,created_at)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE',NOW())`,
      [`member_${tag}`, ids.org, ids.user]
    );
    await client.query(
      `INSERT INTO projects (id,organization_id,name,status,owner_id)
       VALUES ($1,$2,'Execution project','active',$3)`,
      [ids.project, ids.org, ids.user]
    );
    await client.query(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status)
       VALUES ($1,$2,$3,'Execution initiative','EXECUTING')`,
      [ids.initiative, ids.org, ids.project]
    );
  });

  afterAll(async () => {
    try {
      await client.query(`DELETE FROM tasks WHERE initiative_id=$1`, [ids.initiative]);
      await client.query(`DELETE FROM raid_items WHERE initiative_id=$1`, [ids.initiative]);
      await client.query(`DELETE FROM initiative_resources WHERE initiative_id=$1`, [
        ids.initiative,
      ]);
      await client.query(`DELETE FROM initiative_milestones WHERE initiative_id=$1`, [
        ids.initiative,
      ]);
      await client.query(`DELETE FROM initiatives WHERE id=$1`, [ids.initiative]);
      await client.query(`DELETE FROM projects WHERE id=$1`, [ids.project]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [ids.org]);
      await client.query(`DELETE FROM users WHERE id=$1`, [ids.user]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [ids.org]);

      const residue = await client.query(
        `SELECT
          (SELECT count(*) FROM initiative_milestones WHERE initiative_id=$1)::int milestones,
          (SELECT count(*) FROM initiative_resources WHERE initiative_id=$1)::int resources,
          (SELECT count(*) FROM raid_items WHERE initiative_id=$1)::int raid,
          (SELECT count(*) FROM tasks WHERE initiative_id=$1)::int tasks,
          (SELECT count(*) FROM initiatives WHERE id=$1)::int initiatives,
          (SELECT count(*) FROM projects WHERE id=$2)::int projects,
          (SELECT count(*) FROM organization_members WHERE organization_id=$3)::int members,
          (SELECT count(*) FROM users WHERE id=$4)::int users,
          (SELECT count(*) FROM organizations WHERE id=$3)::int organizations`,
        [ids.initiative, ids.project, ids.org, ids.user]
      );
      expect(residue.rows[0]).toEqual({
        milestones: 0,
        resources: 0,
        raid: 0,
        tasks: 0,
        initiatives: 0,
        projects: 0,
        members: 0,
        users: 0,
        organizations: 0,
      });
      const locks = await client.query(
        `SELECT count(*)::int AS n FROM pg_locks
         WHERE locktype='advisory' AND pid <> pg_backend_pid()`
      );
      expect(locks.rows[0].n).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('denies representative legacy writes with one stable canonical-writer contract', async () => {
    const auth = `Bearer ${token()}`;
    const responses = await Promise.all([
      request(app)
        .post(`/api/initiatives/${ids.initiative}/milestones`)
        .set('Authorization', auth)
        .send({ name: 'legacy milestone' }),
      request(app)
        .post(`/api/initiatives/${ids.initiative}/resources`)
        .set('Authorization', auth)
        .send({ name: 'legacy resource', role: 'owner' }),
      request(app)
        .post(`/api/initiatives/${ids.initiative}/raid`)
        .set('Authorization', auth)
        .send({ type: 'risk', title: 'legacy risk' }),
      request(app)
        .post('/api/tasks')
        .set('Authorization', auth)
        .send({ title: 'legacy task', initiativeId: ids.initiative, projectId: ids.project }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        code: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
        canonicalWriter: '/api/initiatives/runtime-v1',
      });
    }
    const residue = await client.query(
      `SELECT
        (SELECT count(*) FROM initiative_milestones WHERE initiative_id=$1)::int milestones,
        (SELECT count(*) FROM initiative_resources WHERE initiative_id=$1)::int resources,
        (SELECT count(*) FROM raid_items WHERE initiative_id=$1)::int raid,
        (SELECT count(*) FROM tasks WHERE initiative_id=$1)::int tasks`,
      [ids.initiative]
    );
    expect(residue.rows[0]).toEqual({ milestones: 0, resources: 0, raid: 0, tasks: 0 });
  });

  it('keeps authenticated compatibility reads mounted', async () => {
    const auth = `Bearer ${token()}`;
    const [milestones, resources, raid] = await Promise.all([
      request(app).get(`/api/initiatives/${ids.initiative}/milestones`).set('Authorization', auth),
      request(app).get(`/api/initiatives/${ids.initiative}/resources`).set('Authorization', auth),
      request(app).get(`/api/initiatives/${ids.initiative}/raid`).set('Authorization', auth),
    ]);
    expect(milestones.status).toBe(200);
    expect(resources.status).toBe(200);
    expect(raid.status).toBe(200);
  });

  it('does not retire unrelated Initiative authoring and discovery commands', async () => {
    const response = await request(app)
      .post('/api/initiatives/similarity-check')
      .set('Authorization', `Bearer ${token()}`)
      .send({ name: 'Canonical authoring remains mounted' });

    expect(response.status).not.toBe(409);
    expect(response.body?.code).not.toBe('EXECUTION_RUNTIME_V1_WRITE_REQUIRED');
  });
});
