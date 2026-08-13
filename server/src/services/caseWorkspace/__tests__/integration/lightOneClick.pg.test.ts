/**
 * INTEGRATION — "Zatwierdź i rozpocznij" for a LIGHT Case, driven over REAL
 * HTTP (packet CW-T-C), the way the client actually takes it: POST /cases to
 * create the Case, then POST /cases/:caseId/light-start.
 *
 * ===========================================================================
 * WHY THIS MOUNTS ITS OWN APP INSTEAD OF REUSING goldenCaseHarness's
 * ===========================================================================
 * `lightStart.routes.ts` is NOT YET mounted by `routes/caseWorkspace/index.ts`
 * (that file is koordynator-owned, outside this packet's allowlist — see
 * `lightStart.routes.ts`'s own header for the exact mounting line to add).
 * `goldenCaseHarness.createGoldenCaseApp` mounts exactly that aggregator, so
 * an app built from it cannot reach `/light-start` at all. This suite proves
 * the route's REAL behaviour today by mounting the real aggregator (for
 * `/cases`) AND the real `lightStartRoutes` router side by side, in the
 * SAME production middleware order `lightStart.routes.ts`'s own header
 * documents for the coordinator (correlation → v8Context → routers → error
 * mapper) — once mounted for real, behaviour is identical, because nothing
 * here substitutes anything about the route itself, only where it is
 * attached in this ONE test process.
 *
 * A companion assertion (`it('is not yet reachable through the production
 * aggregator...')`) proves the CURRENT, unmounted state honestly: hitting
 * `/light-start` through the REAL aggregator alone 404s. That is not a
 * defect this packet introduces — it is the coordinator's mounting step not
 * having run yet — and it is asserted here rather than assumed, so this
 * suite cannot go stale silently once the route IS mounted (that assertion
 * would start failing, which is the correct signal to delete it).
 *
 *   DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test \
 *   npx vitest run src/services/caseWorkspace/__tests__/integration/lightOneClick.pg.test.ts --environment node
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import caseWorkspaceRoutes from '../../../../routes/caseWorkspace/index.js';
import lightStartRoutes from '../../../../routes/caseWorkspace/lightStart.routes.js';
import { errorHandlerMiddleware } from '../../../../utils/ErrorHandler.js';
import { correlationMiddleware } from '../../../../utils/RequestStore.js';
import type { ContractActor } from '../../../../routes/caseWorkspace/__tests__/contract/contractHarness.js';

const BASE = '/api/v8/case-workspace';
const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

async function isReachable(): Promise<boolean> {
  if (!REAL_DB_REQUESTED) return false;
  const probe = new Pool({ connectionString: CONNECTION_STRING, max: 1, connectionTimeoutMillis: 4000 });
  try {
    const result = await probe.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [['case_core', 'case_plan_versions', 'case_workspace_run_bindings', 'case_workspace_node_runs']]
    );
    return result.rowCount === 4;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

const REACHABLE = await isReachable();
if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[lightOneClick integration suite SKIPPED — clean skip, not a failure] needs ` +
      `DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a reachable, migrated DATABASE_URL. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

/**
 * Same production middleware chain `lightStart.routes.ts`'s own header
 * documents for the coordinator, with BOTH the real aggregator (for
 * `/cases`) and the real `lightStartRoutes` router mounted — see this file's
 * header for why that second router is not reachable through the aggregator
 * alone today.
 */
function createAppWithLightStart(actor: ContractActor): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use((req: any, _res, next) => {
    req.v8Context = { ...actor };
    next();
  });
  app.use(BASE, caseWorkspaceRoutes);
  app.use(BASE, lightStartRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

/** The real aggregator ALONE — proves today's actually-deployed shape. */
function createAppAggregatorOnly(actor: ContractActor): Express {
  const app = express();
  app.use(express.json());
  app.use(correlationMiddleware);
  app.use((req: any, _res, next) => {
    req.v8Context = { ...actor };
    next();
  });
  app.use(BASE, caseWorkspaceRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

suite('LIGHT one-click over HTTP (CW-T-C)', () => {
  let control: Pool;

  beforeAll(async () => {
    control = new Pool({ connectionString: CONNECTION_STRING, max: 10 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  async function seedFixture(label: string): Promise<{ orgId: string; projectId: string; userId: string }> {
    const suffix = randomUUID();
    const orgId = suffix;
    const projectId = `light1c-http-project-${label}-${suffix}`;
    const userId = randomUUID();
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [orgId, `LIGHT 1-click HTTP org (${label})`]);
    await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      projectId,
      orgId,
      `LIGHT 1-click HTTP project (${label})`,
    ]);
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [randomUUID(), orgId, userId]
    );
    return { orgId, projectId, userId };
  }

  async function teardown(caseId: string, orgId: string, projectId: string, userId: string): Promise<void> {
    await control.query(`DELETE FROM case_workspace_node_run_attempts WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_node_runs WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_run_bindings WHERE case_id = $1`, [caseId]).catch(() => undefined);
    const runs = await control
      .query<{ run_id: string; context_snapshot_id: string }>(
        `SELECT run_id, context_snapshot_id FROM v8_execution_runs WHERE metadata::text LIKE $1`,
        [`%${caseId}%`]
      )
      .catch(() => ({ rows: [] as { run_id: string; context_snapshot_id: string }[] }));
    for (const run of runs.rows) {
      await control.query(`DELETE FROM v8_execution_runs WHERE run_id = $1`, [run.run_id]).catch(() => undefined);
      await control
        .query(`DELETE FROM v8_context_snapshots WHERE snapshot_id = $1`, [run.context_snapshot_id])
        .catch(() => undefined);
    }
    await control.query(`DELETE FROM case_plan_versions WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_workspace_event_outbox WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM case_core WHERE case_id = $1`, [caseId]).catch(() => undefined);
    await control.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]).catch(() => undefined);
    await control.query(`DELETE FROM users WHERE id = $1`, [userId]).catch(() => undefined);
    await control.query(`DELETE FROM projects WHERE id = $1`, [projectId]).catch(() => undefined);
    await control.query(`DELETE FROM organizations WHERE id = $1`, [orgId]).catch(() => undefined);
  }

  it('the route IS reachable through the REAL aggregator once the coordinator mounts it', async () => {
    const { orgId, projectId, userId } = await seedFixture('unmounted');
    let caseId = '';
    try {
      const actor: ContractActor = { organizationId: orgId, userId, userRole: 'MEMBER', isSuperAdmin: false };
      const aggregatorOnly = createAppAggregatorOnly(actor);

      const created = await request(aggregatorOnly).post(`${BASE}/cases`).send({
        projectId,
        caseName: 'LIGHT one-click HTTP test case',
        caseProfile: 'LIGHT',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      const res = await request(aggregatorOnly).post(`${BASE}/cases/${caseId}/light-start`).send({});
      // Was 404 by construction while the packet awaited fan-in; the
      // coordinator has since mounted lightStartRoutes in
      // routes/caseWorkspace/index.ts, so the aggregator now reaches it.
      // Anything but 404 proves the mount; the specific success/refusal
      // outcome is asserted by the scenarios below and by the service suite.
      expect(res.status).not.toBe(404);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  it('POST /cases then POST /cases/:caseId/light-start — real HTTP response, real DB, one Run, one outbox trail', async () => {
    const { orgId, projectId, userId } = await seedFixture('http-happy');
    let caseId = '';
    try {
      const actor: ContractActor = { organizationId: orgId, userId, userRole: 'MEMBER', isSuperAdmin: false };
      const app = createAppWithLightStart(actor);
      const correlationId = `light1c-http-${randomUUID()}`;
      const asActor = (method: 'post' | 'get', url: string) =>
        request(app)[method](url).set('X-Correlation-ID', correlationId);

      const created = await asActor('post', `${BASE}/cases`).send({
        projectId,
        caseName: 'LIGHT one-click HTTP test case',
        caseProfile: 'LIGHT',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;
      expect(created.body.data.caseStatus).toBe('DRAFT');

      const started = await asActor('post', `${BASE}/cases/${caseId}/light-start`)
        .set('Idempotency-Key', `light1c-http-key-${randomUUID()}`)
        .send({});
      expect(started.status).toBe(200);
      expect(started.body.data.outcome).toBe('started');
      const runId: string = started.body.data.runId;
      const casePlanVersionId: string = started.body.data.casePlanVersionId;
      expect(runId).toBeTruthy();
      expect(casePlanVersionId).toBeTruthy();
      expect(started.body.data.case.caseStatus).toBe('ACTIVE');
      expect(started.body.data.planVersion.status).toBe('PUBLISHED');
      expect(started.body.data.nodeRunIds).toHaveLength(1);

      // Real button clicked twice / page refreshed — same HTTP route, same
      // real backend, no duplicate Run.
      const startedAgain = await asActor('post', `${BASE}/cases/${caseId}/light-start`).send({});
      expect(startedAgain.status).toBe(200);
      expect(startedAgain.body.data.outcome).toBe('already_started');
      expect(startedAgain.body.data.runId).toBe(runId);

      // Authoritative readback through the real GET route.
      const readback = await asActor('get', `${BASE}/cases/${caseId}`);
      expect(readback.status).toBe(200);
      expect(readback.body.data.caseStatus).toBe('ACTIVE');

      // ===================================================================
      // REAL DATABASE — out of band, not the HTTP response.
      // ===================================================================
      const bindingRow = await control.query<{ run_id: string }>(
        `SELECT run_id FROM case_workspace_run_bindings WHERE case_id = $1`,
        [caseId]
      );
      expect(bindingRow.rowCount).toBe(1);
      expect(bindingRow.rows[0]?.run_id).toBe(runId);

      const nodeRunRow = await control.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM case_workspace_node_runs WHERE case_id = $1 AND run_id = $2`,
        [caseId, runId]
      );
      expect(nodeRunRow.rows[0]?.c).toBe(1);

      // ===================================================================
      // OUTBOX — the operator trace, under the ONE correlation id sent.
      // ===================================================================
      const outbox = await control.query<{ event_type: string; correlation_id: string }>(
        `SELECT event_type, correlation_id FROM case_workspace_event_outbox
          WHERE case_id = $1 ORDER BY created_at ASC`,
        [caseId]
      );
      const eventTypes = outbox.rows.map((r) => r.event_type);
      expect(eventTypes).toContain('case.created');
      expect(eventTypes).toContain('case.activated');
      expect(eventTypes).toContain('case.plan.published');
      expect(eventTypes).toContain('run.bound_to_plan_version');
      expect(eventTypes).toContain('case.light_one_click.started');
      // The retry ("startedAgain") emitted NOTHING new — a rejected/idempotent
      // replay must not leave a second fact behind.
      expect(eventTypes.filter((t) => t === 'case.light_one_click.started')).toHaveLength(1);
      for (const row of outbox.rows) expect(row.correlation_id).toBe(correlationId);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);

  it('STANDARD case: the route refuses over real HTTP, zero Run, zero Plan', async () => {
    const { orgId, projectId, userId } = await seedFixture('http-standard');
    let caseId = '';
    try {
      const actor: ContractActor = { organizationId: orgId, userId, userRole: 'MEMBER', isSuperAdmin: false };
      const app = createAppWithLightStart(actor);

      const created = await request(app).post(`${BASE}/cases`).send({
        projectId,
        caseName: 'STANDARD refusal HTTP test case',
        caseProfile: 'STANDARD',
        contractedClosureType: 'DELIVERY_COMPLETED',
      });
      expect(created.status).toBe(201);
      caseId = created.body.data.caseId;

      const res = await request(app).post(`${BASE}/cases/${caseId}/light-start`).send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body?.error?.code).toBe('LIGHT_ONE_CLICK_REQUIRES_LIGHT_PROFILE');

      const bindingRow = await control.query<{ c: number }>(
        `SELECT count(*)::int AS c FROM case_workspace_run_bindings WHERE case_id = $1`,
        [caseId]
      );
      expect(bindingRow.rows[0]?.c).toBe(0);
    } finally {
      await teardown(caseId, orgId, projectId, userId);
    }
  }, 60_000);
});
