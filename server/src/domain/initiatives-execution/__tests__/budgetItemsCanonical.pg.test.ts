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

describe('CODEX2B budget items canonical writer', { retry: 0, sequential: true }, () => {
  const run = randomUUID();
  const org = `cx2b-budget-org-${run}`;
  const foreignOrg = `cx2b-budget-foreign-${run}`;
  const actor = `cx2b-budget-user-${run}`;
  const foreignActor = `cx2b-budget-other-${run}`;
  const initiative = `cx2b-budget-initiative-${run}`;
  let app: Express;
  let pool: Pool;
  let token: string;
  let foreignToken: string;
  const base = `/api/initiatives/${initiative}/budget-items`;
  const cleanup = async () => {
    if (!pool) return;
    for (const table of [
      'ie_command_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_aggregate_state',
      'initiative_budget_items',
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
      "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_budget_item' AND aggregate_id=$2",
      [org, id]
    );
    const receipts = await pool.query(
      'SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',
      [org, id]
    );
    return { version: aggregate.rows[0]?.version, receipts: receipts.rows[0].n };
  };
  it('OFF preserves legal create/update/delete response and projection', { retry: 0 }, async () => {
    delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
    const created = await request(app)
      .post(base)
      .set(auth())
      .send({
        category: 'hardware',
        amount: 123,
        currency: 'EUR',
        description: 'OFF legal budget',
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      success: true,
      budgetItem: {
        category: 'hardware',
        amount: 123,
        currency: 'EUR',
        description: 'OFF legal budget',
      },
    });
    const id = created.body.budgetItem.id;
    expect(typeof id).toBe('string');
    expect(
      (
        await pool.query(
          'SELECT description,amount FROM initiative_budget_items WHERE id=$1 AND organization_id=$2',
          [id, org]
        )
      ).rows[0]
    ).toMatchObject({ description: 'OFF legal budget' });
    expect(await snapshot(id)).toEqual({ version: undefined, receipts: 0 });
    expect(
      (await request(app).put(`${base}/${id}`).set(auth()).send({ amount: 456 })).body
    ).toEqual({ success: true });
    expect(
      Number(
        (await pool.query('SELECT amount FROM initiative_budget_items WHERE id=$1', [id])).rows[0]
          .amount
      )
    ).toBe(456);
    expect((await request(app).delete(`${base}/${id}`).set(auth())).body).toEqual({
      success: true,
    });
    expect(
      (await pool.query('SELECT id FROM initiative_budget_items WHERE id=$1', [id])).rowCount
    ).toBe(0);
  });
  for (const read of ['false', 'true']) {
    it(
      `ON persists canon and UI projection with READ=${read}; retries keep receipt/version`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = read;
        const body = {
          category: 'services',
          amount: 987,
          currency: 'EUR',
          description: `Canonical budget ${read}`,
        };
        const created = await request(app)
          .post(base)
          .set(auth())
          .set('Idempotency-Key', `budget-${run}-${read}`)
          .send(body);
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const id = created.body.budgetItem.id;
        expect(typeof id).toBe('string');
        expect(
          (
            await pool.query(
              'SELECT description FROM initiative_budget_items WHERE id=$1 AND organization_id=$2',
              [id, org]
            )
          ).rows[0]
        ).toMatchObject({ description: body.description });
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
        const visible = await request(app).get(base).set(auth());
        expect(visible.status, JSON.stringify(visible.body)).toBe(200);
        expect(visible.body.budgetItems).toEqual(
          expect.arrayContaining([expect.objectContaining({ id, description: body.description })])
        );
        const retry = await request(app)
          .post(base)
          .set(auth())
          .set('Idempotency-Key', `budget-${run}-${read}`)
          .send(body);
        expect([200, 201]).toContain(retry.status);
        expect(retry.body.budgetItem.id).toBe(id);
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
      }
    );
  }
  for (const write of ['false', 'true']) {
    it(`rejects foreign parent for all writes with WRITE=${write}`, { retry: 0 }, async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = write;
      const own = await request(app)
        .post(base)
        .set(auth())
        .send({ description: `Own ${write}`, amount: 5 });
      expect(own.status, JSON.stringify(own.body)).toBe(201);
      const id = own.body.budgetItem.id;
      for (const [method, path, body] of [
        ['post', base, { description: 'FOREIGN PROBE' }],
        ['put', `${base}/${id}`, { amount: 999 }],
        ['delete', `${base}/${id}`, {}],
      ] as const) {
        const response = await request(app)[method](path).set(foreignAuth()).send(body);
        expect(response.status, `${method} ${JSON.stringify(response.body)}`).toBe(404);
      }
      expect(
        Number(
          (await pool.query('SELECT amount FROM initiative_budget_items WHERE id=$1', [id])).rows[0]
            .amount
        )
      ).toBe(5);
      expect(
        (
          await pool.query(
            'SELECT id FROM initiative_budget_items WHERE initiative_id=$1 AND organization_id=$2',
            [initiative, foreignOrg]
          )
        ).rowCount
      ).toBe(0);
    });
  }
  it(
    'native runtime CRUD, explicit CAS and foreign tenant use the same projection',
    { retry: 0 },
    async () => {
      const id = `budget-native-${run}`;
      const path = `/api/initiatives/runtime-v1/initiatives/${initiative}/budget-items/${id}`;
      const createBody = {
        expectedVersion: 0,
        clientRequestId: `native-create-${run}`,
        fields: { description: 'Native budget', amount: 11 },
      };
      const created = await request(app).post(path).set(auth()).send(createBody);
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect(created.body.response).toMatchObject({ id, description: 'Native budget' });
      const replay = await request(app).post(path).set(auth()).send(createBody);
      expect(replay.status, JSON.stringify(replay.body)).toBe(200);
      expect(replay.body.status).toBe('REPLAYED');
      expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
      const update = await request(app)
        .patch(path)
        .set(auth())
        .send({
          expectedVersion: 1,
          clientRequestId: `native-update-${run}`,
          fields: { amount: 22 },
        });
      expect(update.status, JSON.stringify(update.body)).toBe(200);
      expect(update.body.response.amount).toBe(22);
      const stale = await request(app)
        .patch(path)
        .set(auth())
        .send({
          expectedVersion: 1,
          clientRequestId: `native-stale-${run}`,
          fields: { amount: 33 },
        });
      expect(stale.status, JSON.stringify(stale.body)).toBe(409);
      const foreign = await request(app)
        .patch(path)
        .set(foreignAuth())
        .send({
          expectedVersion: 0,
          clientRequestId: `native-foreign-${run}`,
          fields: { amount: 99 },
        });
      expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
      expect(
        Number(
          (await pool.query('SELECT amount FROM initiative_budget_items WHERE id=$1', [id])).rows[0]
            .amount
        )
      ).toBe(22);
      const del = await request(app)
        .delete(path)
        .set(auth())
        .send({ expectedVersion: 2, clientRequestId: `native-delete-${run}`, fields: {} });
      expect(del.status, JSON.stringify(del.body)).toBe(200);
      expect(del.body.response).toMatchObject({ id, deleted: true });
      expect(
        (await pool.query('SELECT id FROM initiative_budget_items WHERE id=$1', [id])).rowCount
      ).toBe(0);
      expect(await snapshot(id)).toEqual({ version: 3, receipts: 3 });
    }
  );
  it(
    'legacy ON supports update/delete and surfaces stale canonical version',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const created = await request(app)
        .post(base)
        .set(auth())
        .send({ description: 'Legacy ON CRUD', amount: 17 });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = created.body.budgetItem.id;
      const updated = await request(app)
        .put(`${base}/${id}`)
        .set(auth())
        .send({ amount: 29, expectedCanonicalVersion: 1 });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      const stale = await request(app)
        .put(`${base}/${id}`)
        .set(auth())
        .send({ amount: 30, expectedCanonicalVersion: 1 });
      expect(stale.status, JSON.stringify(stale.body)).toBe(409);
      expect(
        Number(
          (await pool.query('SELECT amount FROM initiative_budget_items WHERE id=$1', [id])).rows[0]
            .amount
        )
      ).toBe(29);
      const deleted = await request(app)
        .delete(`${base}/${id}`)
        .set(auth())
        .send({ expectedCanonicalVersion: 2 });
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
      expect(await snapshot(id)).toEqual({ version: 3, receipts: 3 });
    }
  );

  it(
    'a session correlation ID does not merge different operations; keyless edits can return A-B-A',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const session = { ...auth(), 'X-Correlation-ID': `session-${run}` };
      const first = await request(app)
        .post(base)
        .set(session)
        .send({ description: 'Session item one', amount: 1 });
      const second = await request(app)
        .post(base)
        .set(session)
        .send({ description: 'Session item two', amount: 2 });
      expect(first.status, JSON.stringify(first.body)).toBe(201);
      expect(second.status, JSON.stringify(second.body)).toBe(201);
      expect(first.body.budgetItem.id).not.toBe(second.body.budgetItem.id);
      const id = first.body.budgetItem.id;
      for (const amount of [10, 20, 10]) {
        const update = await request(app).put(`${base}/${id}`).set(session).send({ amount });
        expect(update.status, JSON.stringify(update.body)).toBe(200);
        expect(
          Number(
            (await pool.query('SELECT amount FROM initiative_budget_items WHERE id=$1', [id]))
              .rows[0].amount
          )
        ).toBe(amount);
      }
      const before = await snapshot(id);
      expect(
        (await request(app).put(`${base}/${id}`).set(session).send({ amount: 10 })).status
      ).toBe(200);
      expect(await snapshot(id)).toEqual(before);
    }
  );
  it(
    'keyless create after delete creates a live new incarnation and retries it',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const data = { description: 'Recreated item', amount: 55 };
      const first = await request(app).post(base).set(auth()).send(data);
      expect(first.status).toBe(201);
      expect(
        (await request(app).delete(`${base}/${first.body.budgetItem.id}`).set(auth())).status
      ).toBe(200);
      const recreated = await request(app).post(base).set(auth()).send(data);
      expect(recreated.status, JSON.stringify(recreated.body)).toBe(201);
      const id = recreated.body.budgetItem.id;
      expect(id).not.toBe(first.body.budgetItem.id);
      expect(
        (await pool.query('SELECT description FROM initiative_budget_items WHERE id=$1', [id]))
          .rows[0].description
      ).toBe(data.description);
      const retry = await request(app).post(base).set(auth()).send(data);
      expect(retry.status).toBe(200);
      expect(retry.body.budgetItem.id).toBe(id);
      expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
    }
  );
  it(
    'invalid canonical versions return 400 and archived writes return 409',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      for (const expectedCanonicalVersion of [-1, 'x']) {
        const response = await request(app)
          .post(base)
          .set(auth())
          .send({ description: 'Invalid version', expectedCanonicalVersion });
        expect(response.status, JSON.stringify(response.body)).toBe(400);
      }
      try {
        await pool.query(
          "INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES($1,'initiative',$2,1,$3::jsonb)",
          [org, initiative, JSON.stringify({ initiativeId: initiative, status: 'ARCHIVED' })]
        );
        const response = await request(app)
          .post(base)
          .set(auth())
          .send({ description: 'Archived mutation' });
        expect(response.status, JSON.stringify(response.body)).toBe(409);
      } finally {
        await pool.query(
          "DELETE FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2",
          [org, initiative]
        );
      }
    }
  );
});
