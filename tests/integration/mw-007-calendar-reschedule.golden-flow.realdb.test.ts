/**
 * MW-07 — Calendar/time/capacity: task reschedule golden flow against a REAL
 * Postgres database (no mocks).
 *
 * Scope: the hardening added on this branch to
 * `server/src/routes/v8/my-work.routes.ts` —
 *   GET  /api/v8/my-work/calendar/unified   (task events now carry
 *        projectId/projectName, an honest provider='internal' marker, and an
 *        xmin-based `version` token)
 *   PUT  /api/v8/my-work/calendar/events/task/:taskId (now requires
 *        `expectedVersion` and rejects a stale write with 409 instead of a
 *        silent overwrite)
 * This is the single canonical write path the live MyWork Calendar tab uses
 * for drag/reschedule (see MW-07 discovery gate,
 * `Harvard/wdrozenie-100/_DISCOVERY_GATE_MW-07_2026-08-02.md`, family C). The
 * `initiative`/`decision` branches of the same PUT route are untouched by
 * this branch and are not exercised here (different writer's scope).
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated):
 *   MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
 *     DATABASE_URL="postgresql://iris:iris_test@localhost:5450/iris_test" \
 *     npx vitest run \
 *     tests/integration/mw-007-calendar-reschedule.golden-flow.realdb.test.ts \
 *     --no-file-parallelism
 *
 * MOCK_DB/RUN_DB_TESTS MUST be set on the shell, not only via this file's own
 * env guard below. `tests/setup.ts` (global vitest `setupFiles`) runs BEFORE
 * this file's module body and does `MOCK_DB = MOCK_DB || 'true'`, caching a
 * mock DB instance on `globalThis` the moment it sees MOCK_DB unset. Once
 * cached, `Database.ts#getDatabaseInstance()` returns that mock for the rest
 * of the process regardless of any env change this file makes afterwards —
 * `getTableColumns()` correctly re-evaluates "postgres mode" per call, but
 * the query still runs against the stale mock and returns zero rows,
 * silently, with no error. This is NOT this suite's mock — it's an ambient
 * ordering trap in the shared test harness that any new real-PG suite using
 * `queryHelpers`/`dbSchema.getTableColumns` should watch for.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// Routers/middleware imported AFTER the env guard above (informational — none
// of these touch the DB pool at import time).
import verifyToken from '../../server/src/middleware/auth.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../server/src/middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../server/src/middleware/v8FeatureGate.middleware.js';
import myWorkRoutes from '../../server/src/routes/v8/my-work.routes.js';

// ---------------------------------------------------------------------------
// Connection probe (same contract as the sibling realdb golden-flow files)
// ---------------------------------------------------------------------------

// Generous timeout: under a loaded sandbox/CI runner, a tight probe timeout
// here produces a false "Postgres not reachable" vacuous-skip PASS (the
// suite is designed to no-op cleanly when there is genuinely no database) —
// that is a materially different, much worse failure mode than a slow test,
// so this is deliberately permissive rather than fast.
const PROBE_TIMEOUT_MS = 10_000;

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

const REQUIRED_TABLES = ['organizations', 'users', 'projects', 'tasks'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as the sibling realdb golden-flow files)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'MW-07 Calendar RealDB Test User',
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
// App under test — REAL router, REAL v8 middleware chain (matches
// server/src/routes/v8/index.ts mount order for '/my-work': verifyToken ->
// requireV8OrgContext -> v8OrgGate -> attachV8Context -> myWorkRoutes).
// v8MetricsMiddleware/mutationAbortCanary are observability-only, omitted.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v8/my-work',
    verifyToken,
    requireV8OrgContext,
    v8OrgGate,
    attachV8Context,
    myWorkRoutes
  );
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string; // org A — assignee/owner of every org-A task below
  userCId: string; // org A — NOT the assignee of any task (403 probe)
  userBId: string; // org B — cross-tenant attacker
  projectAId: string;
  projectA2Id: string; // second project, org A — cross-project filter probe
  taskGoldenId: string; // org A, project A, assignee=userA
  taskProjectA2Id: string; // org A, project A2, assignee=userA
  taskOrgBId: string; // org B, assignee=userB
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
  const orgAId = `org_mw007_a_${tag}`;
  const orgBId = `org_mw007_b_${tag}`;
  const userAId = `user_mw007_a_${tag}`;
  const userCId = `user_mw007_c_${tag}`;
  const userBId = `user_mw007_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MW-07 RealDB Org A', 'enterprise', 'active')`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'MW-07 RealDB Org B', 'enterprise', 'active')`,
    [orgBId]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'MW07', 'UserA')`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'MW07', 'UserC')`,
    [userCId, orgAId, `${userCId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'MW07', 'UserB')`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  const projectAId = `proj_mw007_a_${tag}`;
  const projectA2Id = `proj_mw007_a2_${tag}`;
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'MW-07 RealDB Project A', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'MW-07 RealDB Project A2', 'active', $3)`,
    [projectA2Id, orgAId, userAId]
  );

  const taskGoldenId = `task_mw007_golden_${tag}`;
  await client.query(
    `INSERT INTO tasks (id, organization_id, project_id, assignee_id, title, status, due_date)
     VALUES ($1, $2, $3, $4, 'MW-07 golden calendar task', 'todo', '2026-03-05')`,
    [taskGoldenId, orgAId, projectAId, userAId]
  );

  const taskProjectA2Id = `task_mw007_a2_${tag}`;
  await client.query(
    `INSERT INTO tasks (id, organization_id, project_id, assignee_id, title, status, due_date)
     VALUES ($1, $2, $3, $4, 'MW-07 project-A2 task', 'todo', '2026-03-06')`,
    [taskProjectA2Id, orgAId, projectA2Id, userAId]
  );

  const taskOrgBId = `task_mw007_orgb_${tag}`;
  await client.query(
    `INSERT INTO tasks (id, organization_id, assignee_id, title, status, due_date)
     VALUES ($1, $2, $3, 'MW-07 org B task (bait)', 'todo', '2026-03-05')`,
    [taskOrgBId, orgBId, userBId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM tasks WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM projects WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
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

  return {
    client,
    orgAId,
    orgBId,
    userAId,
    userCId,
    userBId,
    projectAId,
    projectA2Id,
    taskGoldenId,
    taskProjectA2Id,
    taskOrgBId,
    cleanup,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MW-07 — calendar task reschedule golden flow against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — mw-007-calendar-reschedule ' +
        'golden-flow realdb tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to ' +
        'exercise this suite.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 90_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

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

  itDB(
    'golden flow: unified feed shows project/provider lineage + version -> reschedule -> read-back (hard-reload-equivalent) shows the new date under the SAME task id',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);

      const before = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${token}`);
      expect(before.status).toBe(200);
      const eventBefore = before.body.data.events.find(
        (e: any) => e.sourceId === h.taskGoldenId
      );
      expect(eventBefore).toBeTruthy();
      expect(eventBefore.start).toBe('2026-03-05');
      expect(eventBefore.projectId).toBe(h.projectAId);
      expect(eventBefore.projectName).toBe('MW-07 RealDB Project A');
      expect(eventBefore.provider).toBe('internal');
      expect(typeof eventBefore.version).toBe('string');
      expect(eventBefore.version.length).toBeGreaterThan(0);

      const putRes = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ start: '2026-03-12', expectedVersion: eventBefore.version });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.dueDate).toBe('2026-03-12');
      expect(putRes.body.data.projectId).toBe(h.projectAId);
      expect(putRes.body.data.provider).toBe('internal');
      expect(putRes.body.data.version).not.toBe(eventBefore.version);

      // Read-back proof: a fresh, independent GET (the HTTP equivalent of a
      // hard reload / deep link) returns the SAME canonical task id at the
      // NEW date — never the pre-write state.
      const after = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${token}`);
      expect(after.status).toBe(200);
      const eventAfter = after.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);
      expect(eventAfter).toBeTruthy();
      expect(eventAfter.start).toBe('2026-03-12');
      expect(eventAfter.version).toBe(putRes.body.data.version);

      // Confirm directly against Postgres too, not just through the API.
      const raw = await h.client.query('SELECT due_date::text FROM tasks WHERE id = $1', [
        h.taskGoldenId,
      ]);
      expect(String(raw.rows[0].due_date).slice(0, 10)).toBe('2026-03-12');
    }
  );

  itDB('missing expectedVersion is rejected (400) — never a blind write', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userAId, h.orgAId);
    const res = await request(app)
      .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ start: '2026-04-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VERSION_REQUIRED');
  });

  itDB(
    'malformed (non-numeric) expectedVersion is rejected with a clean 400, never a raw Postgres 500',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const res = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ start: '2026-04-01', expectedVersion: 'not-a-real-xid' });
      expect(res.status).toBe(400);
      expect(res.status).not.toBe(500);
    }
  );

  itDB(
    'concurrency: two writers read the same version; the second write is rejected 409 with fresh state, never silently overwritten',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);

      const read = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${token}`);
      const event = read.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);
      const sharedVersion = event.version;

      const first = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ start: '2026-05-01', expectedVersion: sharedVersion });
      expect(first.status).toBe(200);

      // Second writer still holds the now-stale version read before the
      // first writer committed — this is exactly the "conflict must not
      // silently overwrite" scenario the golden flow requires.
      const second = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ start: '2026-06-01', expectedVersion: sharedVersion });
      expect(second.status).toBe(409);
      expect(second.body.code).toBe('VERSION_CONFLICT');
      expect(second.body.data.dueDate).toBe('2026-05-01');
      expect(second.body.data.version).toBe(first.body.data.version);

      // Prove the rejected write never touched the row.
      const raw = await h.client.query('SELECT due_date::text FROM tasks WHERE id = $1', [
        h.taskGoldenId,
      ]);
      expect(String(raw.rows[0].due_date).slice(0, 10)).toBe('2026-05-01');

      // Retry-safety: replaying the exact same (now-stale) request again is
      // still rejected the same way — never applies a duplicate/second
      // mutation from a naive client retry.
      const retry = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ start: '2026-06-01', expectedVersion: sharedVersion });
      expect(retry.status).toBe(409);
    }
  );

  itDB(
    'cross-user (same org, not the assignee): 403, and the row is provably untouched',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const otherUserToken = makeE2EToken(h.userCId, h.orgAId);

      const read = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task&ownership=owner')
        .set('Authorization', `Bearer ${ownerToken}`);
      // ownership=owner still returns nothing useful for userC's own view; read the
      // canonical version as the actual owner instead, then attack as userC.
      const owned = read.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);
      const currentVersion = owned?.version;

      const res = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ start: '2026-07-01', expectedVersion: currentVersion || 'irrelevant' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');

      const raw = await h.client.query('SELECT due_date::text FROM tasks WHERE id = $1', [
        h.taskGoldenId,
      ]);
      expect(String(raw.rows[0].due_date).slice(0, 10)).not.toBe('2026-07-01');
    }
  );

  itDB(
    'cross-organization: org B cannot see or reschedule org A\'s task — 404 on both read absence and write, no existence leak',
    async (h) => {
      const app = buildApp();
      const crossOrgToken = makeE2EToken(h.userBId, h.orgBId);

      const read = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${crossOrgToken}`);
      expect(read.status).toBe(200);
      const leaked = read.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);
      expect(leaked).toBeUndefined();

      const res = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${crossOrgToken}`)
        // Syntactically valid (digits-only, like a real xid) so the ONLY
        // reason this is rejected is org isolation, not input validation.
        .send({ start: '2026-08-01', expectedVersion: '1' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task event not found for user');
    }
  );

  itDB(
    'actor/org forgery: client-supplied organizationId/userId/assigneeId in the body is ignored — only the session identity governs the write',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);

      const read = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${token}`);
      const event = read.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);

      const res = await request(app)
        .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          start: '2026-09-01',
          expectedVersion: event.version,
          // Forged fields — the route never reads any of these from req.body.
          organizationId: h.orgBId,
          userId: h.userCId,
          assigneeId: h.userCId,
          actor: h.userCId,
        });
      expect(res.status).toBe(200);
      expect(res.body.data.dueDate).toBe('2026-09-01');

      // The row's actual organization_id/assignee_id are unchanged by the
      // forged body fields — still bound to the real session identity.
      const raw = await h.client.query(
        'SELECT organization_id, assignee_id FROM tasks WHERE id = $1',
        [h.taskGoldenId]
      );
      expect(raw.rows[0].organization_id).toBe(h.orgAId);
      expect(raw.rows[0].assignee_id).toBe(h.userAId);
    }
  );

  itDB(
    'cross-project filter: filtering the unified feed by project A excludes a real task that belongs to project A2 in the SAME org',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);

      const scoped = await request(app)
        .get(`/api/v8/my-work/calendar/unified?sources=task&projectId=${h.projectAId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(scoped.status).toBe(200);
      const ids = scoped.body.data.events.map((e: any) => e.sourceId);
      expect(ids).toContain(h.taskGoldenId);
      expect(ids).not.toContain(h.taskProjectA2Id);

      const unscoped = await request(app)
        .get('/api/v8/my-work/calendar/unified?sources=task')
        .set('Authorization', `Bearer ${token}`);
      const unscopedIds = unscoped.body.data.events.map((e: any) => e.sourceId);
      expect(unscopedIds).toContain(h.taskProjectA2Id);
    }
  );

  itDB(
    'timezone/day-boundary: a reschedule to a specific calendar date reads back as that exact date regardless of the server process timezone',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userAId, h.orgAId);
      const originalTz = process.env.TZ;

      try {
        const read = await request(app)
          .get('/api/v8/my-work/calendar/unified?sources=task')
          .set('Authorization', `Bearer ${token}`);
        const event = read.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);

        // A negative-offset zone (UTC-8) is the classic case where a naive
        // Date<->UTC round trip shifts a local midnight back a calendar day.
        process.env.TZ = 'America/Los_Angeles';

        const put = await request(app)
          .put(`/api/v8/my-work/calendar/events/task/${h.taskGoldenId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ start: '2026-10-15', expectedVersion: event.version });
        expect(put.status).toBe(200);
        expect(put.body.data.dueDate).toBe('2026-10-15');

        // A positive-offset zone (UTC+13) for the read-back — the date must
        // still come back unshifted either direction.
        process.env.TZ = 'Pacific/Kiritimati';
        const after = await request(app)
          .get('/api/v8/my-work/calendar/unified?sources=task')
          .set('Authorization', `Bearer ${token}`);
        const eventAfter = after.body.data.events.find((e: any) => e.sourceId === h.taskGoldenId);
        expect(eventAfter.start).toBe('2026-10-15');
      } finally {
        if (originalTz === undefined) delete process.env.TZ;
        else process.env.TZ = originalTz;
      }
    }
  );
});
