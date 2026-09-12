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

describe('CODEX2B gate roles canonical writer', { retry: 0, sequential: true }, () => {
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
  const base = `/api/initiatives/${initiative}/gate-roles`;
  const cleanup = async () => {
    if (!pool) return;
    await pool.query('DELETE FROM initiative_gate_roles WHERE initiative_id=$1', [initiative]);
    for (const table of [
      'staffing_plans',
      'ie_command_receipts',
      'ie_outbox_events',
      'ie_audit_events',
      'ie_aggregate_state',
      'initiative_budget_items',
      'initiatives',
      'organization_members',
      'projects',
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
        "INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Move target')",
        [`project-${run}`, org]
      );
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
      "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_gate_role_profile' AND aggregate_id=$2",
      [org, id]
    );
    const receipts = await pool.query(
      'SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',
      [org, id]
    );
    return { version: aggregate.rows[0]?.version, receipts: receipts.rows[0].n };
  };

  it(
    'OFF preserves complete legal role replacement and explicit clearing',
    { retry: 0 },
    async () => {
      delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
      const response = await request(app)
        .put(base)
        .set(auth())
        .send({ roles: [{ gateRole: 'SPONSOR', userId: actor }] });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      expect(response.body.roles).toEqual(
        expect.arrayContaining([expect.objectContaining({ gateRole: 'SPONSOR', userId: actor })])
      );
      expect(await snapshot(initiative)).toEqual({ version: undefined, receipts: 0 });
      expect((await request(app).put(base).set(auth()).send({ roles: [] })).status).toBe(200);
      expect(
        (
          await pool.query('SELECT id FROM initiative_gate_roles WHERE initiative_id=$1', [
            initiative,
          ])
        ).rowCount
      ).toBe(0);
    }
  );
  for (const read of ['false', 'true']) {
    it(
      `ON persists role profile, visible content and same receipt with READ=${read}`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = read;
        const body = { roles: [{ gateRole: 'SPONSOR', userId: actor }] };
        const send = () =>
          request(app)
            .put(base)
            .set(auth())
            .set('Idempotency-Key', `gate-${run}-${read}`)
            .send(body);
        const before = await snapshot(initiative);
        const response = await send();
        expect(response.status, JSON.stringify(response.body)).toBe(200);
        const row = response.body.roles[0];
        expect(typeof row.id).toBe('string');
        const state = await snapshot(initiative);
        expect(state.version).toBe((before.version ?? 0) + 1);
        expect(state.receipts).toBe(before.receipts + 1);
        const visible = await request(app).get(base).set(auth());
        expect(visible.status).toBe(200);
        expect(visible.body.roles).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: row.id, gateRole: 'SPONSOR', userId: actor }),
          ])
        );
        const retry = await send();
        expect(retry.status).toBe(200);
        expect(retry.body.roles[0].id).toBe(row.id);
        expect(await snapshot(initiative)).toEqual(state);
      }
    );
  }
  for (const write of ['false', 'true']) {
    it(
      `foreign initiative or assignee cannot replace the profile with WRITE=${write}`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = write;
        const own = await request(app)
          .put(base)
          .set(auth())
          .send({ roles: [{ gateRole: 'SPONSOR', userId: actor }] });
        expect(own.status).toBe(200);
        const before = await pool.query(
          'SELECT id,gate_role,user_id FROM initiative_gate_roles WHERE initiative_id=$1 ORDER BY id',
          [initiative]
        );
        const foreign = await request(app)
          .put(base)
          .set(foreignAuth())
          .send({ roles: [{ gateRole: 'SPONSOR', userId: foreignActor }] });
        expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
        const assignee = await request(app)
          .put(base)
          .set(auth())
          .send({ roles: [{ gateRole: 'SPONSOR', userId: foreignActor }] });
        expect(assignee.status, JSON.stringify(assignee.body)).toBe(403);
        expect(
          (
            await pool.query(
              'SELECT id,gate_role,user_id FROM initiative_gate_roles WHERE initiative_id=$1 ORDER BY id',
              [initiative]
            )
          ).rows
        ).toEqual(before.rows);
      }
    );
  }
  it(
    'native role replacement enforces CAS, tenant and supports clearing the list',
    { retry: 0 },
    async () => {
      const path = `/api/initiatives/runtime-v1/initiatives/${initiative}/gate-roles`;
      const before = await snapshot(initiative);
      const version = before.version ?? 0;
      const body = {
        expectedVersion: version,
        clientRequestId: `gate-native-${run}`,
        roles: [{ gateRole: 'SPONSOR', userId: actor }],
      };
      const response = await request(app).put(path).set(auth()).send(body);
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      const foreign = await request(app)
        .put(path)
        .set(foreignAuth())
        .send({ ...body, expectedVersion: 0, clientRequestId: `gate-foreign-${run}`, roles: [] });
      expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
      const stale = await request(app)
        .put(path)
        .set(auth())
        .send({ ...body, clientRequestId: `gate-stale-${run}`, roles: [] });
      expect(stale.status, JSON.stringify(stale.body)).toBe(409);
      const clear = await request(app)
        .put(path)
        .set(auth())
        .send({
          ...body,
          expectedVersion: version + 1,
          clientRequestId: `gate-clear-${run}`,
          roles: [],
        });
      expect(clear.status, JSON.stringify(clear.body)).toBe(200);
      expect(
        (
          await pool.query('SELECT id FROM initiative_gate_roles WHERE initiative_id=$1', [
            initiative,
          ])
        ).rowCount
      ).toBe(0);
    }
  );
});
