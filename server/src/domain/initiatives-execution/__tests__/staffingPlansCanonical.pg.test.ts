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

describe('CODEX2B staffing canonical writer', { retry: 0, sequential: true }, () => {
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
  const base = `/api/initiatives/${initiative}/staffing-plans`;
  const cleanup = async () => {
    if (!pool) return;
    await pool.query(
      'DELETE FROM staffing_plan_roles WHERE staffing_plan_id IN (SELECT id FROM staffing_plans WHERE organization_id=ANY($1::text[]))',
      [[org, foreignOrg]]
    );
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
      "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='staffing_plan' AND aggregate_id=$2",
      [org, id]
    );
    const receipts = await pool.query(
      'SELECT count(*)::int AS n FROM ie_command_receipts WHERE organization_id=$1 AND aggregate_id=$2',
      [org, id]
    );
    return { version: aggregate.rows[0]?.version, receipts: receipts.rows[0].n };
  };

  const createPlan = async (name: string) => {
    const response = await request(app).post(base).set(auth()).send({ name });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body.id as string;
  };
  it('OFF legal plan CRUD preserves response and projection', { retry: 0 }, async () => {
    delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
    const id = await createPlan('OFF plan');
    expect(await snapshot(id)).toEqual({ version: undefined, receipts: 0 });
    expect(
      (await request(app).put(`${base}/${id}`).set(auth()).send({ name: 'OFF updated' })).body
    ).toEqual({ success: true });
    const read = await request(app).get(`${base}/${id}`).set(auth());
    expect(read.status).toBe(200);
    expect(read.body.plan).toMatchObject({ id, name: 'OFF updated' });
    expect((await request(app).delete(`${base}/${id}`).set(auth())).body).toEqual({
      success: true,
    });
  });
  for (const read of ['false', 'true']) {
    it(
      `ON creates plan in canon and actual UI list, replay with READ=${read}`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
        process.env.ENABLE_INITIATIVE_UNIFIED_READ = read;
        const body = { name: `Canonical plan ${read}` };
        const send = () =>
          request(app)
            .post(base)
            .set(auth())
            .set('Idempotency-Key', `staffing-${run}-${read}`)
            .send(body);
        const created = await send();
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const id = created.body.id;
        expect(typeof id).toBe('string');
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
        const visible = await request(app).get(base).set(auth());
        expect(visible.status).toBe(200);
        expect(visible.body.plans).toEqual(
          expect.arrayContaining([expect.objectContaining({ id, name: body.name })])
        );
        const replay = await send();
        expect([200, 201]).toContain(replay.status);
        expect(replay.body.id).toBe(id);
        expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
      }
    );
  }
  for (const write of ['false', 'true']) {
    it(
      `foreign parent cannot receive a staffing plan with WRITE=${write}`,
      { retry: 0 },
      async () => {
        process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = write;
        const response = await request(app)
          .post(base)
          .set(foreignAuth())
          .send({ name: `Foreign plan ${write}` });
        const rows = await pool.query(
          'SELECT id FROM staffing_plans WHERE initiative_id=$1 AND organization_id=$2',
          [initiative, foreignOrg]
        );
        expect({ status: response.status, writes: rows.rowCount }).toEqual({
          status: 404,
          writes: 0,
        });
      }
    );
  }
  for (const method of ['post', 'put', 'delete'] as const) {
    it(`foreign ${method} cannot change a protected role`, { retry: 0 }, async () => {
      delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
      const id = await createPlan(`Protected plan ${method}`);
      const role = await request(app)
        .post(`${base}/${id}/roles`)
        .set(auth())
        .send({ roleName: 'Protected role', fteRequired: 1 });
      expect(role.status).toBe(201);
      const path =
        method === 'post' ? `${base}/${id}/roles` : `${base}/${id}/roles/${role.body.id}`;
      const response = await request(app)
        [method](path)
        .set(foreignAuth())
        .send({ roleName: 'Foreign mutation', fteRequired: 99 });
      const rows = await pool.query(
        'SELECT id,role_name FROM staffing_plan_roles WHERE staffing_plan_id=$1 ORDER BY id',
        [id]
      );
      expect({ status: response.status, rows: rows.rows }).toEqual({
        status: 404,
        rows: [{ id: role.body.id, role_name: 'Protected role' }],
      });
    });
  }
  it(
    'foreign and missing gaps return the same 404; legitimate gaps remain readable',
    { retry: 0 },
    async () => {
      delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
      const id = await createPlan('Protected gaps');
      const role = await request(app)
        .post(`${base}/${id}/roles`)
        .set(auth())
        .send({ roleName: 'Protected gap name', fteRequired: 2 });
      expect(role.status).toBe(201);
      const own = await request(app).get(`${base}/${id}/gaps`).set(auth());
      expect(own.status, JSON.stringify(own.body)).toBe(200);
      expect(JSON.stringify(own.body)).toContain('Protected gap name');
      const foreign = await request(app).get(`${base}/${id}/gaps`).set(foreignAuth());
      const missing = await request(app).get(`${base}/missing-${run}/gaps`).set(foreignAuth());
      expect({ status: foreign.status, body: foreign.body }).toEqual({
        status: 404,
        body: missing.body,
      });
      expect(missing.status).toBe(404);
    }
  );
  it(
    'ON role CRUD recalculates the plan and explicit capacity sync in canon',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const id = await createPlan('Canonical roles');
      const created = await request(app)
        .post(`${base}/${id}/roles`)
        .set(auth())
        .send({ roleName: 'Engineer', fteRequired: 1.25 });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const roleId = created.body.id;
      expect(
        (
          await pool.query(
            "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='staffing_plan_role' AND aggregate_id=$2",
            [org, roleId]
          )
        ).rows[0]?.version
      ).toBe(1);
      const updated = await request(app)
        .put(`${base}/${id}/roles/${roleId}`)
        .set(auth())
        .send({ assignedUserId: actor, fteAllocated: 0.75 });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      const plan = await pool.query(
        'SELECT total_fte_required,total_fte_allocated FROM staffing_plans WHERE id=$1',
        [id]
      );
      expect(Number(plan.rows[0].total_fte_required)).toBe(1.25);
      expect(Number(plan.rows[0].total_fte_allocated)).toBe(0.75);
      const sync = await request(app).post(`${base}/${id}/sync-capacity`).set(auth()).send({});
      expect(sync.status, JSON.stringify(sync.body)).toBe(200);
      expect(
        (
          await pool.query(
            "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_capacity_snapshot' AND aggregate_id=$2",
            [org, initiative]
          )
        ).rows[0]?.version
      ).toBe(1);
      expect((await request(app).delete(`${base}/${id}/roles/${roleId}`).set(auth())).status).toBe(
        200
      );
      expect(
        (await pool.query('SELECT id FROM staffing_plan_roles WHERE id=$1', [roleId])).rowCount
      ).toBe(0);
    }
  );
  it(
    'native plan and role writes enforce tenant, CAS and persist the same projection',
    { retry: 0 },
    async () => {
      const id = `native-plan-${run}`,
        roleId = `native-role-${run}`;
      const path = `/api/initiatives/runtime-v1/initiatives/${initiative}/staffing-plans/${id}`;
      const body = {
        expectedVersion: 0,
        clientRequestId: `native-plan-create-${run}`,
        name: 'Native plan',
      };
      const foreign = await request(app)
        .post(path)
        .set(foreignAuth())
        .send({ ...body, clientRequestId: `native-foreign-${run}` });
      expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
      const created = await request(app).post(path).set(auth()).send(body);
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect(await snapshot(id)).toEqual({ version: 1, receipts: 1 });
      const stale = await request(app)
        .patch(path)
        .set(auth())
        .send({ ...body, clientRequestId: `native-stale-${run}`, name: 'Stale' });
      expect(stale.status, JSON.stringify(stale.body)).toBe(409);
      const updated = await request(app)
        .patch(path)
        .set(auth())
        .send({
          ...body,
          expectedVersion: 1,
          clientRequestId: `native-update-${run}`,
          name: 'Native updated',
        });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      const role = await request(app)
        .post(`${path}/roles/${roleId}`)
        .set(auth())
        .send({
          expectedVersion: 0,
          clientRequestId: `native-role-${run}`,
          roleName: 'Native role',
          fteRequired: 2,
        });
      expect(role.status, JSON.stringify(role.body)).toBe(201);
      const patched = await request(app)
        .patch(`${path}/roles/${roleId}`)
        .set(auth())
        .send({ expectedVersion: 1, clientRequestId: `native-role-update-${run}`, fteRequired: 3 });
      expect(patched.status, JSON.stringify(patched.body)).toBe(200);
      const visible = await request(app).get(`${base}/${id}`).set(auth());
      expect(visible.body.plan.name).toBe('Native updated');
      expect(visible.body.roles).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: roleId, fteRequired: 3 })])
      );
      const deletedRole = await request(app)
        .delete(`${path}/roles/${roleId}`)
        .set(auth())
        .send({ expectedVersion: 2, clientRequestId: `native-role-delete-${run}` });
      expect(deletedRole.status, JSON.stringify(deletedRole.body)).toBe(200);
      const deleted = await request(app)
        .delete(path)
        .set(auth())
        .send({ expectedVersion: 2, clientRequestId: `native-delete-${run}` });
      expect(deleted.status, JSON.stringify(deleted.body)).toBe(200);
      expect((await pool.query('SELECT id FROM staffing_plans WHERE id=$1', [id])).rowCount).toBe(
        0
      );
    }
  );
  it(
    'ON assigned and unassigned role creation returns actual SQL allocation without granting FTE',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const id = await createPlan('Allocation truth');
      for (const assignedUserId of [undefined, actor]) {
        const response = await request(app)
          .post(`${base}/${id}/roles`)
          .set(auth())
          .send({ roleName: assignedUserId ? 'Assigned' : 'Open', assignedUserId, fteRequired: 2 });
        expect(response.status, JSON.stringify(response.body)).toBe(201);
        const sql = await pool.query(
          'SELECT fte_allocated,assigned_user_id FROM staffing_plan_roles WHERE id=$1',
          [response.body.id]
        );
        expect(response.body.fteAllocated).toBe(Number(sql.rows[0].fte_allocated));
        expect(response.body.fteAllocated).toBe(0);
        expect(sql.rows[0].assigned_user_id).toBe(assignedUserId || null);
      }
    }
  );
  it(
    'session correlation allows repeated plan intents and capacity sync follows changed source',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const id = await createPlan('Session plan');
      const headers = { ...auth(), 'X-Correlation-ID': `session-${run}` };
      for (const name of ['A', 'B', 'A'])
        expect((await request(app).put(`${base}/${id}`).set(headers).send({ name })).status).toBe(
          200
        );
      expect(
        (await pool.query('SELECT name FROM staffing_plans WHERE id=$1', [id])).rows[0].name
      ).toBe('A');
      expect((await snapshot(id)).version).toBe(4);
      const role = await request(app)
        .post(`${base}/${id}/roles`)
        .set(headers)
        .send({ roleName: 'Capacity source', fteRequired: 1 });
      expect(role.status).toBe(201);
      const sync = () => request(app).post(`${base}/${id}/sync-capacity`).set(headers).send({});
      expect((await sync()).status).toBe(200);
      const version = Number(
        (
          await pool.query(
            "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_capacity_snapshot' AND aggregate_id=$2",
            [org, initiative]
          )
        ).rows[0].version
      );
      expect(
        (
          await request(app)
            .put(`${base}/${id}/roles/${role.body.id}`)
            .set(headers)
            .send({ fteRequired: 2 })
        ).status
      ).toBe(200);
      expect((await sync()).status).toBe(200);
      expect(
        Number(
          (
            await pool.query(
              "SELECT version FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative_capacity_snapshot' AND aggregate_id=$2",
              [org, initiative]
            )
          ).rows[0].version
        )
      ).toBe(version + 1);
      const sums = await pool.query(
        'SELECT (SELECT required_capacity_fte FROM initiatives WHERE id=$1) AS actual,(SELECT SUM(r.fte_required) FROM staffing_plan_roles r JOIN staffing_plans p ON p.id=r.staffing_plan_id WHERE p.initiative_id=$1 AND p.organization_id=$2) AS expected',
        [initiative, org]
      );
      expect(Number(sums.rows[0].actual)).toBe(Number(sums.rows[0].expected));
    }
  );
  for (const method of ['post', 'put'] as const) {
    it(`OFF ${method} cannot assign a foreign organization user`, { retry: 0 }, async () => {
      delete process.env.ENABLE_INITIATIVE_UNIFIED_WRITE;
      const id = await createPlan(`Assignee boundary ${method}`);
      let roleId: string | undefined;
      if (method === 'put') {
        const role = await request(app)
          .post(`${base}/${id}/roles`)
          .set(auth())
          .send({ roleName: 'Existing role' });
        expect(role.status).toBe(201);
        roleId = role.body.id;
      }
      const response = await request(app)
        [method](`${base}/${id}/roles${roleId ? `/${roleId}` : ''}`)
        .set(auth())
        .send({ roleName: 'Foreign assignment', assignedUserId: foreignActor });
      const foreignRows = await pool.query(
        'SELECT id FROM staffing_plan_roles WHERE staffing_plan_id=$1 AND assigned_user_id=$2',
        [id, foreignActor]
      );
      expect({ status: response.status, foreignAssignments: foreignRows.rowCount }).toEqual({
        status: 404,
        foreignAssignments: 0,
      });
    });
  }
  it(
    'plan deletion cascades UI roles while canonical plan tombstone preserves history',
    { retry: 0 },
    async () => {
      process.env.ENABLE_INITIATIVE_UNIFIED_WRITE = 'true';
      const id = await createPlan('Cascade plan');
      const role = await request(app)
        .post(`${base}/${id}/roles`)
        .set(auth())
        .send({ roleName: 'Cascade role' });
      expect(role.status).toBe(201);
      expect((await request(app).delete(`${base}/${id}`).set(auth())).status).toBe(200);
      expect(
        (await pool.query('SELECT id FROM staffing_plan_roles WHERE staffing_plan_id=$1', [id]))
          .rowCount
      ).toBe(0);
      const read = await request(app).get(`${base}/${id}`).set(auth());
      expect(read.status).toBe(404);
      expect(JSON.stringify(read.body)).not.toContain('Cascade role');
      const list = await request(app).get(base).set(auth());
      expect(list.status).toBe(200);
      expect(list.body.plans.some((plan: { id: string }) => plan.id === id)).toBe(false);
      const tombstone = await pool.query(
        "SELECT payload_json AS payload FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='staffing_plan' AND aggregate_id=$2",
        [org, id]
      );
      expect(tombstone.rows[0].payload.deleted).toBe(true);
      const roleHistory = await pool.query(
        "SELECT payload_json AS payload FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='staffing_plan_role' AND aggregate_id=$2",
        [org, role.body.id]
      );
      expect(roleHistory.rows[0].payload.staffingPlanId).toBe(id);
    }
  );
});
