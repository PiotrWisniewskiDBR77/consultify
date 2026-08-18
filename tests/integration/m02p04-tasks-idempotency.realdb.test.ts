/**
 * M02-P04 — Tasks (My Work list + detail), against a REAL Postgres database
 * (no mocks).
 *
 * Scope: M02-003 finding. Two independent create stacks write the same
 * `tasks` table and both needed fixing:
 *
 *   1. The REAL My Work Tasks create path — `TaskDetailView.tsx` ->
 *      `Api.createPersonalTask` -> `POST /api/my-work/personal-tasks`
 *      (`server/src/routes/my-work.routes.ts`, the legacy monolith). This
 *      route had ZERO idempotency handling before this packet — it did not
 *      even read `idempotencyKey` from the body.
 *   2. The `TaskDetailModal.tsx` create path (used by Initiative/dashboard
 *      task surfaces, NOT the My Work Tasks tab) -> `POST /api/tasks` ->
 *      `TaskController.createTask`. This route had a pre-existing
 *      EXE-002-004 idempotency mechanism, but it was gated on
 *      `initiativeId && idempotencyKey` — Postgres treats every NULL
 *      `initiative_id` as distinct in the partial unique index
 *      `idx_tasks_idempotency(initiative_id, idempotency_key)`, so any task
 *      created WITHOUT an initiative (which `TaskDetailModal.tsx` explicitly
 *      supports) had its key silently discarded and no protection at all.
 *
 * Both are fixed via the same org-scoped unique index added by
 * `20260804_m02a_tasks_tenant_idempotency.sql`
 * (`idx_tasks_idempotency_org (organization_id, idempotency_key)`).
 *
 * Also covers: full create -> mutate -> save -> server read-back -> fresh
 * reopen cycle (personal-tasks stack, since that is the actual My Work Tasks
 * surface), and cross-tenant / cross-owner-same-tenant / forged-body-field
 * negative controls on that same stack.
 *
 * Auth: same E2E_MODE unsigned-JWT bypass pattern as the sibling realdb
 * golden-flow files (`server/src/middleware/auth.middleware.ts` E2E_MODE
 * branch, `requireUser` reading `req.user.id`/`req.user.organizationId`).
 *
 * HOW TO RUN LOCALLY:
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:<port>/consultinity_test \
 *     RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres \
 *     npx vitest run tests/integration/m02p04-tasks-idempotency.realdb.test.ts
 *
 * SKIP POLICY: no DATABASE_URL/PGHOST/DB_HOST configured -> vacuous skip. A
 * *reachable* database with an *incomplete* schema is a hard FAILURE, not a
 * skip (same policy as the sibling EXE-08 realdb suite).
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

// Routers imported AFTER the env guard above.
import myWorkRoutes from '../../server/src/routes/my-work.routes.js';
import taskRoutes from '../../server/src/routes/pmo/tasks.routes.js';

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
      /* best-effort */
    }
  }
}

async function findMissingTables(client: Client, names: readonly string[]): Promise<string[]> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.filter((n) => !found.has(n));
}

const REQUIRED_TABLES = ['organizations', 'users', 'tasks'] as const;

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
    name: 'M02-P04 RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  app.use('/api/tasks', taskRoutes);
  return app;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userA1Id: string; // org A, primary actor
  userA2Id: string; // org A, different user — same-tenant owner-forgery control
  userBId: string; // org B — cross-tenant attacker
  tokenA1: string;
  tokenA2: string;
  tokenB: string;
  cleanup: () => Promise<void>;
}

async function setupHarness(): Promise<Harness | null> {
  const config = buildClientConfig();
  if (!config) return null;
  if (!(await pgReachable())) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  let missing: string[];
  try {
    missing = await findMissingTables(client, REQUIRED_TABLES);
  } catch (err) {
    await client.end().catch(() => {});
    throw new Error(
      `DATABASE_URL is configured and reachable, but the fresh-schema check itself failed: ` +
        `${err instanceof Error ? err.message : String(err)}. Run ` +
        `server/scripts/migrate.postgres.ts --safe against this database first.`
    );
  }
  if (missing.length > 0) {
    await client.end().catch(() => {});
    throw new Error(
      `DATABASE_URL is configured and reachable, but the schema is incomplete — missing ` +
        `table(s): ${missing.join(', ')}. Run server/scripts/migrate.postgres.ts --safe first.`
    );
  }

  // idx_tasks_idempotency_org must exist — the whole suite is meaningless
  // without it. Hard failure, not a skip, if the migration wasn't applied.
  const idxCheck = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'tasks' AND indexname = 'idx_tasks_idempotency_org'`
  );
  if (idxCheck.rows.length === 0) {
    await client.end().catch(() => {});
    throw new Error(
      `idx_tasks_idempotency_org is missing on the tasks table. Apply ` +
        `server/migrations/20260804_m02a_tasks_tenant_idempotency.sql against this database ` +
        `before re-running this suite (e.g. via server/scripts/migrate.postgres.ts --safe).`
    );
  }

  const tag = suffix();
  const orgAId = `org_m02p04_a_${tag}`;
  const orgBId = `org_m02p04_b_${tag}`;
  const userA1Id = `user_m02p04_a1_${tag}`;
  const userA2Id = `user_m02p04_a2_${tag}`;
  const userBId = `user_m02p04_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M02-P04 RealDB Org A', 'enterprise', 'active')`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M02-P04 RealDB Org B', 'enterprise', 'active')`,
    [orgBId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'M02P04', 'UserA1')`,
    [userA1Id, orgAId, `${userA1Id}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'M02P04', 'UserA2')`,
    [userA2Id, orgAId, `${userA2Id}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'MEMBER', 'active', 'M02P04', 'UserB')`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM tasks WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } finally {
      await client.end().catch(() => {});
    }
  };

  return {
    client,
    orgAId,
    orgBId,
    userA1Id,
    userA2Id,
    userBId,
    tokenA1: makeE2EToken(userA1Id, orgAId),
    tokenA2: makeE2EToken(userA2Id, orgAId),
    tokenB: makeE2EToken(userBId, orgBId),
    cleanup,
  };
}

describe('M02-P04 — Tasks idempotency + lifecycle + tenant isolation (real Postgres)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;
  const app = buildApp();

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — m02p04-tasks-idempotency realdb ' +
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

  // Runtime guard inside `it`, always registered — reports a clean vacuous
  // pass instead of failing the suite on a machine with no Postgres, and
  // (unlike a describe-time `harness ? it : it.skip`) is evaluated AFTER
  // beforeAll has actually run.
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

  // ── GATE 2a: real My Work Tasks stack (POST /api/my-work/personal-tasks) ──

  itDB('sequential retry with the same idempotency key returns the SAME task, not a duplicate', async (h) => {
    const key = `idem-seq-${suffix()}`;
    const first = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Sequential retry task', idempotencyKey: key });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Sequential retry task', idempotencyKey: key });
    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const rows = await h.client.query(
      `SELECT id FROM tasks WHERE organization_id = $1 AND idempotency_key = $2`,
      [h.orgAId, key]
    );
    expect(rows.rows.length).toBe(1);
  });

  itDB('concurrent double-submit (Promise.all) with the same key collapses to ONE owner task', async (h) => {
    const key = `idem-concurrent-${suffix()}`;
    const [r1, r2] = await Promise.all([
      request(app)
        .post('/api/my-work/personal-tasks')
        .set('Authorization', `Bearer ${h.tokenA1}`)
        .send({ title: 'Concurrent double-submit task', idempotencyKey: key }),
      request(app)
        .post('/api/my-work/personal-tasks')
        .set('Authorization', `Bearer ${h.tokenA1}`)
        .send({ title: 'Concurrent double-submit task', idempotencyKey: key }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 201]);
    const ids = [r1.body.id, r2.body.id];
    expect(ids[0]).toBe(ids[1]);

    const rows = await h.client.query(
      `SELECT id FROM tasks WHERE organization_id = $1 AND idempotency_key = $2`,
      [h.orgAId, key]
    );
    expect(rows.rows.length).toBe(1);
  });

  itDB('a genuinely new create attempt (fresh key) is never collapsed into an unrelated one', async (h) => {
    const keyOne = `idem-distinct-1-${suffix()}`;
    const keyTwo = `idem-distinct-2-${suffix()}`;
    const r1 = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Distinct task one', idempotencyKey: keyOne });
    const r2 = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Distinct task two', idempotencyKey: keyTwo });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r1.body.id).not.toBe(r2.body.id);
  });

  // ── GATE 2b: pmo/TaskController stack (POST /api/tasks), the bug this ──
  // packet actually closed: `initiativeId && idempotencyKey` silently
  // discarded the key for any task without an initiative.

  itDB('pmo stack: task WITHOUT an initiativeId is now idempotency-protected (was NOT before this fix)', async (h) => {
    const key = `idem-pmo-noinit-${suffix()}`;
    const payload = {
      title: 'PMO stack task, no initiative',
      status: 'todo',
      priority: 'medium',
      initiativeId: null,
      projectId: null,
      idempotencyKey: key,
    };
    const [r1, r2] = await Promise.all([
      request(app).post('/api/tasks').set('Authorization', `Bearer ${h.tokenA1}`).send(payload),
      request(app).post('/api/tasks').set('Authorization', `Bearer ${h.tokenA1}`).send(payload),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 201]);
    expect(r1.body.id).toBe(r2.body.id);

    const rows = await h.client.query(
      `SELECT id FROM tasks WHERE organization_id = $1 AND idempotency_key = $2 AND initiative_id IS NULL`,
      [h.orgAId, key]
    );
    expect(rows.rows.length).toBe(1);
  });

  // ── GATE 3: full create -> mutate -> save -> server read-back -> fresh ──
  // reopen cycle, on the REAL My Work Tasks stack.

  itDB('full lifecycle: create -> mutate -> save -> read-back -> fresh reopen', async (h) => {
    const created = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'Lifecycle task v1',
        description: 'initial description',
        priority: 'medium',
        idempotencyKey: `idem-lifecycle-${suffix()}`,
      });
    expect(created.status).toBe(201);
    const taskId = created.body.id;

    const initiallyOpened = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(initiallyOpened.status).toBe(200);

    const mutated = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'Lifecycle task v2 — edited',
        status: 'in_progress',
        priority: 'high',
        expectedOutcome: 'ship the fix',
        checklist: [{ id: 'c1', text: 'step one', completed: false }],
        expectedVersionToken: initiallyOpened.body.versionToken,
      });
    expect(mutated.status).toBe(200);
    expect(mutated.body.title).toBe('Lifecycle task v2 — edited');
    expect(mutated.body.status).toBe('in_progress');

    // "Fresh reopen" — an independent GET, no client-side state carried over,
    // simulating the user closing and reopening the task detail view.
    const reopened = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(reopened.status).toBe(200);
    expect(reopened.body.title).toBe('Lifecycle task v2 — edited');
    expect(reopened.body.status).toBe('in_progress');
    expect(reopened.body.priority).toBe('high');
    expect(reopened.body.expectedOutcome).toBe('ship the fix');

    // Complete the lifecycle: mark done, confirm completed_at bookkeeping,
    // then delete and confirm it is gone.
    const completed = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ status: 'done', expectedVersionToken: reopened.body.versionToken });
    expect(completed.status).toBe(200);
    expect(completed.body.completedAt).toBeTruthy();

    const del = await request(app)
      .delete(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(del.status).toBe(204);

    const afterDelete = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(afterDelete.status).toBe(404);
  });

  itDB('optimistic token makes two-writer personal-task updates atomic', async (h) => {
    const created = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'Two writer baseline',
        idempotencyKey: `idem-two-writer-${suffix()}`,
      });
    expect(created.status).toBe(201);

    const taskId = created.body.id;
    const opened = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(opened.status).toBe(200);
    expect(opened.body.versionToken).toEqual(expect.any(String));

    const beforeMissingToken = await h.client.query<{ title: string }>(
      `SELECT title FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, h.orgAId]
    );
    const missingToken = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Blind overwrite must be refused' });
    expect(missingToken.status).toBe(428);
    expect(missingToken.body).toEqual({
      error: 'expectedVersionToken is required',
      code: 'TASK_VERSION_REQUIRED',
    });
    const afterMissingToken = await h.client.query<{ title: string }>(
      `SELECT title FROM tasks WHERE id = $1 AND organization_id = $2`,
      [taskId, h.orgAId]
    );
    expect(afterMissingToken.rows).toEqual(beforeMissingToken.rows);

    const foreignWithStolenToken = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenB}`)
      .send({
        title: 'Foreign writer must not reach version comparison',
        expectedVersionToken: opened.body.versionToken,
      });
    expect(foreignWithStolenToken.status).toBe(404);

    const firstWriter = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'First writer wins',
        expectedVersionToken: opened.body.versionToken,
      });
    expect(firstWriter.status).toBe(200);
    expect(firstWriter.body.versionToken).toEqual(expect.any(String));
    expect(firstWriter.body.versionToken).not.toBe(opened.body.versionToken);

    const staleWriter = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'Stale writer must lose',
        expectedVersionToken: opened.body.versionToken,
      });
    expect(staleWriter.status).toBe(409);
    expect(staleWriter.body).toMatchObject({
      error: 'Task changed since it was opened',
      code: 'TASK_VERSION_CONFLICT',
      currentVersionToken: firstWriter.body.versionToken,
    });

    const readback = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(readback.status).toBe(200);
    expect(readback.body.title).toBe('First writer wins');
    expect(readback.body.versionToken).toBe(firstWriter.body.versionToken);
  });

  // ── GATE 4: cross-tenant / cross-owner-same-tenant / forged-field controls ──

  itDB('cross-tenant: org B cannot read, update, or delete org A\'s personal task', async (h) => {
    const created = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'Org A private task', idempotencyKey: `idem-xtenant-${suffix()}` });
    expect(created.status).toBe(201);
    const taskId = created.body.id;

    const getAsB = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenB}`);
    expect(getAsB.status).toBe(404);

    const putAsB = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenB}`)
      .send({ title: 'forged by org B' });
    expect(putAsB.status).toBe(404);

    const deleteAsB = await request(app)
      .delete(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenB}`);
    expect(deleteAsB.status).toBe(204); // DELETE is scoped (WHERE ... AND owner match); no-op for a non-owned row

    // Task must still exist and be unchanged — org B's delete call above was
    // a no-op (0 rows affected, WHERE clause excluded it), not a real delete.
    const stillThere = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.title).toBe('Org A private task');

    const listAsB = await request(app)
      .get('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenB}`);
    expect(listAsB.status).toBe(200);
    expect((listAsB.body as any[]).some((t) => t.id === taskId)).toBe(false);
  });

  itDB('same-tenant, different owner: user A2 cannot read/update/delete user A1\'s task', async (h) => {
    const created = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: 'A1-owned task', idempotencyKey: `idem-samet-${suffix()}` });
    expect(created.status).toBe(201);
    const taskId = created.body.id;

    const getAsA2 = await request(app)
      .get(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA2}`);
    expect(getAsA2.status).toBe(404);

    const putAsA2 = await request(app)
      .put(`/api/my-work/personal-tasks/${taskId}`)
      .set('Authorization', `Bearer ${h.tokenA2}`)
      .send({ title: 'forged by A2' });
    expect(putAsA2.status).toBe(404);

    const listAsA2 = await request(app)
      .get('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA2}`);
    expect(listAsA2.status).toBe(200);
    expect((listAsA2.body as any[]).some((t) => t.id === taskId)).toBe(false);
  });

  itDB('forged org/owner fields in the create body are ignored — server derives identity from the session', async (h) => {
    const created = await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({
        title: 'Forged-body task',
        // None of these are read by POST /personal-tasks — organization_id and
        // assignee_id/reporter_id come from the resolved session identity only.
        organizationId: h.orgBId,
        assigneeId: h.userBId,
        ownerId: h.userBId,
        idempotencyKey: `idem-forged-${suffix()}`,
      });
    expect(created.status).toBe(201);

    const row = await h.client.query(
      `SELECT organization_id, assignee_id, reporter_id FROM tasks WHERE id = $1`,
      [created.body.id]
    );
    expect(row.rows[0].organization_id).toBe(h.orgAId);
    expect(row.rows[0].assignee_id).toBe(h.userA1Id);
    expect(row.rows[0].reporter_id).toBe(h.userA1Id);
  });

  // ── GATE 5 (partial): server-side list filters actually used by ──
  // MyTasksListContent.tsx via Api.getPersonalTasks({status, q, includeDone}).

  itDB('list: status filter and search (q) narrow results as MyTasksListContent expects', async (h) => {
    const tag = suffix();
    await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: `Findme-${tag} alpha`, status: 'todo', idempotencyKey: `idem-list-a-${tag}` });
    await request(app)
      .post('/api/my-work/personal-tasks')
      .set('Authorization', `Bearer ${h.tokenA1}`)
      .send({ title: `Other-${tag} beta`, status: 'in_progress', idempotencyKey: `idem-list-b-${tag}` });

    const byQuery = await request(app)
      .get(`/api/my-work/personal-tasks?q=${encodeURIComponent(`findme-${tag}`)}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(byQuery.status).toBe(200);
    expect((byQuery.body as any[]).every((t) => /findme/i.test(t.title))).toBe(true);
    expect((byQuery.body as any[]).length).toBeGreaterThanOrEqual(1);

    const byStatus = await request(app)
      .get(`/api/my-work/personal-tasks?status=in_progress&q=${encodeURIComponent(tag)}`)
      .set('Authorization', `Bearer ${h.tokenA1}`);
    expect(byStatus.status).toBe(200);
    expect((byStatus.body as any[]).every((t) => t.status === 'in_progress')).toBe(true);
  });
});
