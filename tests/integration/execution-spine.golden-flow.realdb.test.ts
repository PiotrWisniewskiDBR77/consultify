/**
 * EXE-002-004 — Execution management spine golden-flow, against a REAL
 * Postgres database (no mocks).
 *
 * Scope: the initiative-scoped write surface added/hardened under EXE-02/03/04
 * — milestones, resources, RAID items (all on `InitiativeController`, mounted
 * at `/api/initiatives/:id/...`) and task creation (`TaskController.createTask`,
 * mounted at `POST /api/tasks` with `initiativeId` in the body, not the URL).
 * This file wires up the REAL Express routers (`initiatives.routes.ts` +
 * `tasks.routes.ts`), the REAL `verifyToken` auth middleware, and a REAL
 * Postgres connection — no stubbed DB layer, no mocked controllers.
 *
 * It proves three things end to end:
 *   1. Golden flow: an authenticated user in org A can create a milestone,
 *      a task, a resource, and a RAID item under one EXECUTING initiative,
 *      and every one of them is visible via GET — including a *second*,
 *      independent GET request (a fresh "reopen"), proving persistence
 *      rather than in-memory/request-scoped state.
 *   2. Idempotent retry: POSTing the same milestone twice with the same
 *      client-supplied `idempotencyKey` must not create a duplicate row and
 *      must report `idempotent: true` on the replay (contract added by
 *      migration `20260801_exe002004_idempotency_keys.sql` + the
 *      pre-insert-SELECT / unique-violation-fallback pattern in
 *      `InitiativeController.createMilestone`).
 *   3. Cross-tenant negative control: a user from an unrelated org B, given
 *      org A's real initiativeId, gets exactly the response codes the
 *      current controllers actually return for that scope violation — not
 *      an idealized contract. Per-endpoint verified from source
 *      (server/src/controllers/InitiativeController.ts) at the time this
 *      file was written:
 *        - GET  milestones — has an explicit initiative-existence-in-org
 *          guard (`getMilestones` L3036-3055) -> 404 "Initiative not found".
 *        - GET  resources  — NO existence guard; the SELECT itself filters
 *          `WHERE r.initiative_id = ? AND r.organization_id = ?`
 *          (`getResources` L3458-3490), so a cross-org read of a real
 *          initiative silently returns 200 with an EMPTY `resources` array
 *          rather than 404. That asymmetry with milestones is intentional
 *          to document here, not a bug this file is asserting away.
 *        - GET  raid       — same shape as resources: no existence guard,
 *          org-filtered SELECT (`getRaid` L4573-4611) -> 200 with empty
 *          `items` array on cross-org.
 *        - POST milestone/resource/RAID — all three have the EXE-02/03/04
 *          org-scope guard (`createMilestone` L3107-3116, `addResource`
 *          L3513-3524, `createRaidItem` L4629-4640) -> 404
 *          "Initiative not found" for a cross-org write attempt.
 *
 * Auth: the same E2E_MODE unsigned-JWT bypass (server/src/middleware/
 * auth.middleware.ts ~L1030-1148) used by tests/integration/
 * table-platform.idor.realdb.test.ts — mints two distinct (userId,
 * organizationId) identities without a login flow, while still exercising
 * the REAL `verifyToken` code path.
 *
 * DB / skip behavior: mirrors table-platform.idor.realdb.test.ts's
 * `pgReachable()` + `itDB` convention byte-for-byte — every test starts with
 * a fast connection probe and the whole suite reports a clean, non-failing
 * vacuous pass when no reachable Postgres is configured (DATABASE_URL /
 * PGHOST unset, or connection fails), so `npm run test:integration` stays
 * green on a machine with no DB.
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated):
 *   DATABASE_URL="postgresql://iris:iris_test@localhost:5447/iris_test" \
 *     NODE_ENV=test npx vitest run \
 *     tests/integration/execution-spine.golden-flow.realdb.test.ts \
 *     --no-file-parallelism
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured — mirrors
// table-platform.idor.realdb.test.ts's env guard. Plain top-level statements
// are sufficient (none of the modules imported below touch the DB pool or
// read these env vars at module-evaluation time).
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// Routers are imported AFTER the env guard above (module evaluation order is
// still hoisted by ESM/TS import semantics, but neither router module touches
// the DB pool at import time — same precondition table-platform's header
// documents — so this ordering note is informational, not load-bearing).
import initiativesRoutes from '../../server/src/routes/pmo/initiatives.routes.js';
import taskRoutes from '../../server/src/routes/pmo/tasks.routes.js';

// ---------------------------------------------------------------------------
// Connection probe (same contract as table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'projects',
  'initiatives',
  'initiative_milestones',
  'initiative_resources',
  'raid_items',
  'tasks',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'EXE Spine RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL routers, REAL verifyToken, REAL controllers.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativesRoutes);
  app.use('/api/tasks', taskRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  projectAId: string;
  initiativeAId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_exe_a_${tag}`;
  const orgBId = `org_exe_b_${tag}`;
  const userAId = `user_exe_a_${tag}`;
  const userBId = `user_exe_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Spine RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Spine RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  // Users A and B: the E2E auth bypass would auto-seed these on first
  // authenticated request anyway (ON CONFLICT DO NOTHING), but seeding them
  // up front keeps the harness deterministic and documents the identities
  // this suite is about, matching the table-platform IDOR realdb pattern.
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXE', 'UserA')
     ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXE', 'UserB')
     ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  const projectAId = `proj_exe_a_${tag}`;
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'EXE Spine RealDB Project (org A)', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );

  // Seeded directly by SQL (frozen: no transition/start/unblock endpoint call)
  // in the status the Execution module actually operates on. 'EXECUTING' is
  // a canonical InitiativeStatus value (server/src/constants/
  // initiativeStatuses.ts) reachable via the SCHEDULED -[START]-> EXECUTING
  // gate in real usage; here it is inserted directly per the task brief.
  const initiativeAId = `init_exe_a_${tag}`;
  await client.query(
    `INSERT INTO initiatives (id, organization_id, project_id, name, status)
     VALUES ($1, $2, $3, 'EXE Spine RealDB Initiative (org A, EXECUTING)', 'EXECUTING')`,
    [initiativeAId, orgAId, projectAId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM tasks WHERE initiative_id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM raid_items WHERE initiative_id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM initiative_resources WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiative_milestones WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]);
      // Best-effort: the E2E auth bypass also seeds `organization_members`
      // rows for whichever identities actually authenticate
      // (auth.middleware.ts ~L1112-1136); clean those up for these test orgs.
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, projectAId, initiativeAId, cleanup };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EXE-002-004 — execution management spine golden flow against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — execution-spine golden-flow realdb ' +
        'tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to exercise this suite.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  // Mirrors the `itDB` convention in table-platform.idor.realdb.test.ts: when
  // the harness is unavailable, report a clean vacuous pass instead of
  // failing `npm run test:integration` on a machine with no Postgres.
  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  // -------------------------------------------------------------------------
  // 1) Golden flow — org A, user A: create milestone, task, resource, RAID
  //    item under the EXECUTING initiative; confirm all four are visible via
  //    GET, including a second independent "reopen" GET.
  // -------------------------------------------------------------------------

  itDB('golden flow: create milestone -> task -> resource -> RAID item, all visible via GET', async (h) => {
    const app = buildApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const milestoneName = `Golden Flow Milestone ${suffix()}`;
    const raidTitle = `Golden Flow Risk ${suffix()}`;

    // 1a. POST milestone
    const milestoneRes = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: milestoneName, description: 'Golden flow milestone', isGate: false });

    expect(milestoneRes.status).toBe(201);
    expect(milestoneRes.body?.milestone?.id).toBeTruthy();
    const milestoneId = milestoneRes.body.milestone.id as string;

    // 1b. POST task with initiativeId in the body (not the URL path)
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: `Golden Flow Task ${suffix()}`,
        initiativeId: h.initiativeAId,
        projectId: h.projectAId,
      });

    expect(taskRes.status).toBe(201);
    const taskBody = taskRes.body?.task ?? taskRes.body;
    expect(taskBody?.id).toBeTruthy();
    const taskId = taskBody.id as string;

    // 1c. POST resource under the initiative
    const resourceRes = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/resources`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Golden Flow Resource', role: 'Consultant', allocationPercentage: 50 });

    expect(resourceRes.status).toBe(201);
    expect(resourceRes.body?.resource?.id ?? resourceRes.body?.id).toBeTruthy();

    // 1d. POST RAID item under the initiative
    const raidRes = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/raid`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ type: 'risk', title: raidTitle, severity: 'medium', probability: 'medium' });

    expect(raidRes.status).toBe(201);

    // 1e. GET milestones, GET resources, GET raid — confirm all created rows
    // are visible via the normal read path (not just present in the POST
    // response body).
    const milestonesGet = await request(app)
      .get(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(milestonesGet.status).toBe(200);
    expect(
      (milestonesGet.body?.milestones ?? []).some((m: any) => m.id === milestoneId)
    ).toBe(true);

    const resourcesGet = await request(app)
      .get(`/api/initiatives/${h.initiativeAId}/resources`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(resourcesGet.status).toBe(200);
    expect(
      (resourcesGet.body?.resources ?? []).some((r: any) => r.role === 'Consultant')
    ).toBe(true);

    const raidGet = await request(app)
      .get(`/api/initiatives/${h.initiativeAId}/raid`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(raidGet.status).toBe(200);
    expect((raidGet.body?.items ?? []).some((r: any) => r.title === raidTitle)).toBe(true);

    // 1f. "Reopen" the initiative — a SEPARATE, fresh GET request (new
    // supertest call against a freshly built app instance, not a cached
    // response) proves persistence in the database rather than
    // request-scoped/in-memory state.
    const reopenApp = buildApp();
    const reopenMilestonesGet = await request(reopenApp)
      .get(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reopenMilestonesGet.status).toBe(200);
    expect(
      (reopenMilestonesGet.body?.milestones ?? []).some((m: any) => m.id === milestoneId)
    ).toBe(true);

    const reopenResourcesGet = await request(reopenApp)
      .get(`/api/initiatives/${h.initiativeAId}/resources`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reopenResourcesGet.status).toBe(200);
    expect(
      (reopenResourcesGet.body?.resources ?? []).some((r: any) => r.role === 'Consultant')
    ).toBe(true);

    const reopenRaidGet = await request(reopenApp)
      .get(`/api/initiatives/${h.initiativeAId}/raid`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(reopenRaidGet.status).toBe(200);
    expect((reopenRaidGet.body?.items ?? []).some((r: any) => r.title === raidTitle)).toBe(true);

    // Sanity: the task created in step 1b is a real, persisted row scoped to
    // this initiative (belt-and-suspenders on top of the 201).
    const taskRow = await h.client.query('SELECT id, initiative_id FROM tasks WHERE id = $1', [
      taskId,
    ]);
    expect(taskRow.rows.length).toBe(1);
    expect(taskRow.rows[0].initiative_id).toBe(h.initiativeAId);
  });

  // -------------------------------------------------------------------------
  // 2) Idempotent retry — same idempotencyKey on a repeated milestone POST
  //    must not create a second row and must report idempotent: true.
  // -------------------------------------------------------------------------

  itDB('idempotent retry: repeating the same milestone POST with the same idempotencyKey does not duplicate', async (h) => {
    const app = buildApp();
    const ownerToken = makeE2EToken(h.userAId, h.orgAId);
    const idempotencyKey = `idem-${suffix()}`;
    const milestoneName = `Idempotent Milestone ${suffix()}`;

    const firstRes = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: milestoneName, idempotencyKey });

    expect(firstRes.status).toBe(201);
    expect(firstRes.body?.milestone?.id).toBeTruthy();
    const firstMilestoneId = firstRes.body.milestone.id as string;

    // Exact same POST body, same idempotencyKey, second independent request.
    const secondRes = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: milestoneName, idempotencyKey });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body?.idempotent).toBe(true);
    expect(secondRes.body?.milestone?.id).toBe(firstMilestoneId);

    const rows = await h.client.query(
      'SELECT id FROM initiative_milestones WHERE initiative_id = $1 AND name = $2',
      [h.initiativeAId, milestoneName]
    );
    expect(rows.rows.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 3) Cross-tenant negative control — user B (org B) against org A's real
  //    initiativeId. Assertions match what each controller ACTUALLY returns
  //    today (see file header for the per-endpoint guard inventory).
  // -------------------------------------------------------------------------

  itDB('cross-tenant: GET milestones for org A initiative as org B user -> 404 (existence guard present)', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);

    const res = await request(app)
      .get(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);
  });

  itDB(
    'cross-tenant: GET resources for org A initiative as org B user -> 200 with an empty list (no existence guard on this read path, org-filtered query)',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const res = await request(app)
        .get(`/api/initiatives/${h.initiativeAId}/resources`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body?.resources).toEqual([]);
    }
  );

  itDB(
    'cross-tenant: GET raid for org A initiative as org B user -> 200 with an empty list (no existence guard on this read path, org-filtered query)',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const res = await request(app)
        .get(`/api/initiatives/${h.initiativeAId}/raid`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(200);
      expect(res.body?.items).toEqual([]);
    }
  );

  itDB('cross-tenant: POST milestone into org A initiative as org B user -> 404, no row created', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);
    const attackerMilestoneName = `Attacker Milestone ${suffix()}`;

    const res = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/milestones`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ name: attackerMilestoneName });

    expect(res.status).toBe(404);

    const leaked = await h.client.query(
      'SELECT id FROM initiative_milestones WHERE initiative_id = $1 AND name = $2',
      [h.initiativeAId, attackerMilestoneName]
    );
    expect(leaked.rows.length).toBe(0);
  });

  itDB('cross-tenant: POST resource into org A initiative as org B user -> 404, no row created', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);

    const res = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/resources`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ name: 'Attacker Resource', role: 'Attacker' });

    expect(res.status).toBe(404);

    const leaked = await h.client.query(
      'SELECT id FROM initiative_resources WHERE initiative_id = $1 AND role = $2',
      [h.initiativeAId, 'Attacker']
    );
    expect(leaked.rows.length).toBe(0);
  });

  itDB('cross-tenant: POST RAID item into org A initiative as org B user -> 404, no row created', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);
    const attackerRaidTitle = `Attacker RAID ${suffix()}`;

    const res = await request(app)
      .post(`/api/initiatives/${h.initiativeAId}/raid`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({ type: 'risk', title: attackerRaidTitle });

    expect(res.status).toBe(404);

    const leaked = await h.client.query(
      'SELECT id FROM raid_items WHERE initiative_id = $1 AND title = $2',
      [h.initiativeAId, attackerRaidTitle]
    );
    expect(leaked.rows.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 4) Idempotency coverage for the other three entities — the milestone
  //    test above (§2) only exercised the sequential-retry path for one of
  //    the four tables the 20260801_exe002004_idempotency_keys.sql migration
  //    touches. These close that gap for resources and tasks (sequential
  //    retry), and add the one case §2 didn't cover for ANY entity: a
  //    genuine concurrent race on RAID, which is the actual scenario the
  //    unique-violation catch/re-select fallback in createRaidItem exists
  //    for — two requests both passing the pre-insert SELECT before either
  //    has committed its INSERT.
  // -------------------------------------------------------------------------

  itDB(
    'idempotent retry: repeating the same resource POST with the same idempotencyKey does not duplicate',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-res-${suffix()}`;
      const resourceRole = `Idempotent Role ${suffix()}`;

      const firstRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/resources`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Idempotent Resource', role: resourceRole, idempotencyKey });

      expect(firstRes.status).toBe(201);
      const firstResourceId = (firstRes.body?.resource?.id ?? firstRes.body?.id) as string;
      expect(firstResourceId).toBeTruthy();

      const secondRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/resources`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Idempotent Resource', role: resourceRole, idempotencyKey });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body?.idempotent).toBe(true);
      expect((secondRes.body?.resource?.id ?? secondRes.body?.id) as string).toBe(
        firstResourceId
      );

      const rows = await h.client.query(
        'SELECT id FROM initiative_resources WHERE initiative_id = $1 AND idempotency_key = $2',
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'idempotent retry: repeating the same task POST with the same idempotencyKey does not duplicate',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-task-${suffix()}`;
      const taskTitle = `Idempotent Task ${suffix()}`;

      const firstRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: taskTitle,
          initiativeId: h.initiativeAId,
          projectId: h.projectAId,
          idempotencyKey,
        });

      expect(firstRes.status).toBe(201);
      const firstTaskBody = firstRes.body?.task ?? firstRes.body;
      const firstTaskId = firstTaskBody?.id as string;
      expect(firstTaskId).toBeTruthy();

      const secondRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: taskTitle,
          initiativeId: h.initiativeAId,
          projectId: h.projectAId,
          idempotencyKey,
        });

      expect(secondRes.status).toBe(200);
      const secondTaskBody = secondRes.body?.task ?? secondRes.body;
      expect(secondTaskBody?.idempotent).toBe(true);
      expect(secondTaskBody?.id).toBe(firstTaskId);

      const rows = await h.client.query(
        'SELECT id FROM tasks WHERE initiative_id = $1 AND idempotency_key = $2',
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'concurrent race: two simultaneous RAID POSTs with the same idempotencyKey create exactly one row',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-race-${suffix()}`;
      const raidTitle = `Race RAID ${suffix()}`;
      const body = { type: 'risk', title: raidTitle, severity: 'medium', idempotencyKey };

      // Fire both requests concurrently (no await between them) so their
      // pre-insert dedup SELECTs are very likely to both run before either
      // INSERT commits — the scenario the `err.code === '23505'` catch +
      // re-select fallback in createRaidItem exists for. This is inherently
      // racy in timing (not guaranteed to hit the exact interleaving every
      // run), but the row-count + same-id assertions below hold regardless
      // of which of the two branches (pre-insert SELECT hit vs. unique-
      // violation catch) actually resolved each request.
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/initiatives/${h.initiativeAId}/raid`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(body),
        request(app)
          .post(`/api/initiatives/${h.initiativeAId}/raid`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(body),
      ]);

      // Both requests must succeed (either the creator's 201 or the
      // idempotent-replay's 200) — neither may fail outright.
      expect([200, 201]).toContain(resA.status);
      expect([200, 201]).toContain(resB.status);
      expect(resA.body?.id).toBeTruthy();
      expect(resB.body?.id).toBeTruthy();
      // Whichever request "won", both must resolve to the SAME server row.
      expect(resA.body.id).toBe(resB.body.id);
      // At least one of the two must have gone through the create path
      // (201) — this is not a test that both requests were rejected.
      expect([resA.status, resB.status]).toContain(201);

      const rows = await h.client.query(
        'SELECT id FROM raid_items WHERE initiative_id = $1 AND idempotency_key = $2',
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].id).toBe(resA.body.id);
    }
  );
});
