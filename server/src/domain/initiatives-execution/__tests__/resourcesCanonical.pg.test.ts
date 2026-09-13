/** @vitest-environment node */
/** §0.2e: (a) V8 must be explicitly enabled; (b) beta enforcement stays enabled;
 * (c) real Postgres, never sqlite/mock; (d) signed JWT and auth bypass disabled;
 * (e) inspect response bodies, a middleware 409 is not a writer proof;
 * (f) both READ states exercise the actual UI GET, WRITE toggled per test.
 * ApiGateway is the production route mount; no index.ts/outbox worker is started.
 */
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

describe('CODEX2B resources canonical writer', { retry: 0, sequential: true }, () => {
  const run = randomUUID();
  const org = `cx2b-resources-org-${run}`;
  const foreignOrg = `cx2b-resources-foreign-${run}`;
  const actor = `cx2b-resources-user-${run}`;
  const foreignActor = `cx2b-resources-other-${run}`;
  const initiative = `cx2b-resources-initiative-${run}`;
  let app: Express;
  let pool: Pool;
  let token: string;
  let foreignToken: string;
  const base = `/api/initiatives/${initiative}/resources`;
  const cleanup = async () => {
    if (!pool) return;
    for (const table of [
      'ie_command_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_aggregate_state',
      'initiative_resources',
      'initiatives',
      'organization_members',
      'users',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=ANY($1::text[])`, [
        [org, foreignOrg],
      ]);
    }
    await pool.query('DELETE FROM organizations WHERE id=ANY($1::text[])', [[org, foreignOrg]]);
  };
  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.RUN_DB_TESTS).toBe('1');
    expect(process.env.MOCK_DB).toBe('false');
    expect(process.env.ENABLE_V8_GLOBAL).toBe('true');
    expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).not.toBe('true');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let ready = false;
    try {
      for (const [id, userId] of [
        [org, actor],
        [foreignOrg, foreignActor],
      ]) {
        await pool.query("INSERT INTO organizations(id,name) VALUES($1,'CODEX2B local fixture')", [
          id,
        ]);
        await pool.query(
          "INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status) VALUES($1,$2,$3,'unused','Local','Fixture','ADMIN','active')",
          [userId, id, `${userId}@example.test`]
        );
        await pool.query(
          "INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')",
          [randomUUID(), id, userId]
        );
      }
      await pool.query(
        "INSERT INTO initiatives(id,organization_id,name,status,created_by) VALUES($1,$2,'Budget local fixture','DRAFT',$3)",
        [initiative, org, actor]
      );
      const { default: config } = await import('../../../config/Config.js');
      token = jwt.sign({ id: actor, organizationId: org, role: 'ADMIN' }, config.JWT_SECRET, {
        expiresIn: '10m',
      });
      foreignToken = jwt.sign(
        { id: foreignActor, organizationId: foreignOrg, role: 'ADMIN' },
        config.JWT_SECRET,
        { expiresIn: '10m' }
      );
      const { ApiGateway } = await import('../../../Gateway.js');
      app = express();
      app.use(express.json());
      ApiGateway.getInstance().initializeRoutes(app);
      ready = true;
    } finally {
      if (!ready) await cleanup();
    }
  }, 180000);
  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await pool?.end();
    }
    delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
    delete process.env.ENABLE_INITIATIVE_UNIFIED_READ;
  }, 60000);
  const auth = () => ({ Authorization: `Bearer ${token}`, 'x-organization-id': org });
  const foreignAuth = () => ({
    Authorization: `Bearer ${foreignToken}`,
    'x-organization-id': foreignOrg,
  });
  const snapshot = async (id: string) => {
    const aggregate = await pool.query(
      "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_resource' AND aggregate_id=$2",
      [org, id]
    );
    const receipts = await pool.query(
      'SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',
      [org, id]
    );
    return { version: aggregate.rows[0]?.version, receipts: receipts.rows[0].n };
  };

  const payload = () => ({ role: 'Engineer', name: 'Local resource', allocationPercentage: 50 });
  it('OFF legal create/update/delete preserves the existing projection', { retry: 0 }, async () => {
    delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
    const created = await request(app).post(base).set(auth()).send(payload());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.resource.id;
    expect(typeof id).toBe('string');
    expect(await snapshot(id)).toEqual({ version: undefined, receipts: 0 });
    const updated = await request(app)
      .put(`${base}/${id}`)
      .set(auth())
      .send({ name: 'Updated resource' });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    const row = await pool.query(
      'SELECT name FROM initiative_resources WHERE id=$1 AND organization_id=$2',
      [id, org]
    );
    expect(row.rows[0].name).toBe('Updated resource');
    expect((await request(app).delete(`${base}/${id}`).set(auth())).status).toBe(200);
  });
  for (const read of ['false', 'true']) {
    it(
      `ON creates projection and canon, read content and replay with READ=${read}`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = read;
        const data = { ...payload(), name: `Canonical resource ${read}` };
        const create = () =>
          request(app)
            .post(base)
            .set(auth())
            .set('Idempotency-Key', `resource-${run}-${read}`)
            .send(data);
        const response = await create();
        expect(response.status, JSON.stringify(response.body)).toBe(201);
        const id = response.body.resource.id;
        expect(
          (
            await pool.query(
              'SELECT name FROM initiative_resources WHERE id=$1 AND organization_id=$2',
              [id, org]
            )
          ).rows[0].name
        ).toBe(data.name);
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
        const visible = await request(app).get(base).set(auth());
        expect(visible.status, JSON.stringify(visible.body)).toBe(200);
        expect(visible.body.resources).toEqual(
          expect.arrayContaining([expect.objectContaining({ id, name: data.name })])
        );
        const retry = await create();
        expect([200, 201]).toContain(retry.status);
        expect(retry.body.resource.id).toBe(id);
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
      }
    );
  }
  for (const write of ['false', 'true']) {
    it(`rejects foreign initiative create with WRITE=${write}`, { retry: 0 }, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = write;
      const response = await request(app).post(base).set(foreignAuth()).send(payload());
      expect(response.status, JSON.stringify(response.body)).toBe(404);
      expect(
        (
          await pool.query(
            'SELECT id FROM initiative_resources WHERE organization_id=$1 AND initiative_id=$2',
            [foreignOrg, initiative]
          )
        ).rowCount
      ).toBe(0);
    });
  }
  it(
    'native CRUD preserves resource version CAS and atomic capacity readback',
    { retry: 0 },
    async () => {
      const id = `resource-native-${run}`;
      const path = `/api/initiatives/runtime-v1/initiatives/${initiative}/resources/${id}`;
      const send = (
        method: 'post' | 'patch' | 'delete',
        version: number,
        key: string,
        fields: Record<string, unknown>
      ) =>
        request(app)
          [method](path)
          .set(auth())
          .send({ expectedVersion: version, clientRequestId: `${key}-${run}`, fields });
      const created = await send('post', 0, 'resource-create', {
        role: 'Engineer',
        name: 'Native resource',
        allocationPercentage: 50,
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const rowVersion = created.body.response.version;
      const updated = await send('patch', 1, 'resource-update', {
        allocationPercentage: 80,
        expectedVersion: rowVersion,
      });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      expect(updated.body.response.version).toBe(rowVersion + 1);
      const stale = await send('patch', 2, 'resource-row-stale', {
        allocationPercentage: 90,
        expectedVersion: rowVersion,
      });
      expect(stale.status, JSON.stringify(stale.body)).toBe(409);
      const capacity = await pool.query(
        'SELECT i.allocated_capacity_fte,(SELECT SUM(allocation_percentage)/100.0 FROM initiative_resources WHERE initiative_id=i.id AND organization_id=i.organization_id) expected FROM initiatives i WHERE i.id=$1 AND i.organization_id=$2',
        [initiative, org]
      );
      expect(Number(capacity.rows[0].allocated_capacity_fte)).toBe(
        Number(capacity.rows[0].expected)
      );
      const foreign = await request(app)
        .patch(path)
        .set(foreignAuth())
        .send({
          expectedVersion: 0,
          clientRequestId: `resource-foreign-${run}`,
          fields: { name: 'Foreign mutation' },
        });
      expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
      const foreignUser = await request(app)
        .post(`${path}-foreign-user`)
        .set(auth())
        .send({
          expectedVersion: 0,
          clientRequestId: `resource-foreign-user-${run}`,
          fields: { role: 'Engineer', userId: foreignActor },
        });
      expect(foreignUser.status, JSON.stringify(foreignUser.body)).toBe(404);
      const deleted = await send('delete', 2, 'resource-delete', {});
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
      expect(
        (await pool.query('SELECT id FROM initiative_resources WHERE id=$1', [id])).rowCount
      ).toBe(0);
    }
  );
});
