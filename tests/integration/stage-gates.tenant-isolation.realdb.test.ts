/**
 * Stage gates — tenant isolation + honest-failure regression against a REAL
 * Postgres database (no mocks) — fix/inbox-failopen-stagegates-20260828,
 * COMMIT 2.
 *
 * BUG 1 (cross-tenant IDOR): every handler in `StageGateController.ts`
 * resolved `projectId` from the URL with zero check that the project
 * belongs to the CALLER's own organization. The mount
 * (`server/src/Gateway.ts` → `stageGates.routes.ts`) only applies a rate
 * limiter + `verifyToken`; `stageGateService.ts` never references
 * `organization_id` at all. Confirmed live: a user in org A (lowest role)
 * could `GET /api/stage-gates/proj-victim-b/evaluate/READINESS_GATE` and
 * get back the full evaluation of a project belonging to org B; an org-A
 * admin could `POST /pass/READINESS_GATE` on it — `req.can()` only checks
 * the CALLER's own organizationId, never which org the TARGET project
 * belongs to.
 *
 * FIX 1: every handler now resolves `WHERE id = ? AND organization_id = ?`
 * against the server-derived `req.user.organizationId` BEFORE evaluating or
 * writing anything. A project in a different org is indistinguishable from
 * one that doesn't exist — 404, not 403 — so the endpoint can't be used to
 * enumerate other tenants' project IDs either. The capability check
 * (`manage_stage_gates`) now runs AFTER this ownership check, not instead
 * of it.
 *
 * BUG 2 (lying success): `passGate()` in `stageGateService.ts` called
 * `DbPromise.run()` with its default `fallback: true`, which resolves
 * `{success: false}` on a DB error instead of throwing. The INSERT's result
 * was never checked, so a failed write (e.g. `stage_gates` missing — true
 * TODAY on this schema; it only exists in the abandoned
 * `migrations-v2/001_baseline_20260413.sql`) still fell through to
 * `status: 'PASSED'` — a fabricated success.
 *
 * FIX 2: the INSERT now uses `{fallback: false}` and its result is checked;
 * a DB failure throws an `AppError` that the global error handler turns
 * into an honest 5xx, never a 200 `PASSED`.
 *
 * NOTE ON SCOPE: `stage_gates` does not exist on the current schema (see
 * BUG 2 above), so this suite does NOT assert a positive "gate passed"
 * response anywhere — it asserts the ownership 404s (which never reach the
 * table) and the honest-failure 5xx for the one path that does (own
 * project, table missing). No migration is added; that is a deliberate,
 * separate decision (owner: A, see repo ledger).
 *
 * This file drives the REAL Express router (`stageGates.routes.ts`), the
 * REAL `verifyToken` auth middleware, and the REAL `PermissionService.can`
 * capability check end-to-end against a REAL Postgres database. Uses the
 * same E2E_MODE unsigned-JWT bypass as table-platform.idor.realdb.test.ts
 * to mint two distinct (userId, organizationId) identities without a login
 * flow, while still exercising the real `verifyToken` code path.
 *
 * DB: same `pgReachable()` skip-clean convention as every other
 * `*.realdb.test.ts` file in this repo.
 *
 *   docker run -d --name stage-gates-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test \
 *     -p 59321:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL=postgres://iris:iris_test@localhost:59321/iris_test \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   DATABASE_URL=postgres://iris:iris_test@localhost:59321/iris_test \
 *     npx vitest run tests/integration/stage-gates.tenant-isolation.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import stageGatesRoutes from '../../server/src/routes/stageGates.routes.js';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// ---------------------------------------------------------------------------
// Connection probe (identical contract to table-platform.idor.realdb.test.ts)
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

async function tableExists(client: Client, name: string): Promise<boolean> {
  return tablesExist(client, [name]);
}

const REQUIRED_TABLES = ['organizations', 'users', 'projects'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as table-platform.idor.realdb.test.ts /
// tests/e2e/tools/collab-*.spec.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role = 'ADMIN'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'Stage Gate RealDB Test User',
    role,
    userRole: role,
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL router, REAL verifyToken, REAL PermissionService.
// ---------------------------------------------------------------------------

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/stage-gates', stageGatesRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string; // lives in org A — the attacker
  adminAId: string; // admin in org A — also the attacker, for the pass-gate probe
  userBId: string; // legit owner in org B
  projectBId: string; // project owned by org B, seeded READY for READINESS_GATE
  stageGatesTableExists: boolean;
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

  const stageGatesTableExists = await tableExists(client, 'stage_gates');

  const tag = suffix();
  const orgAId = `org_sg_a_${tag}`;
  const orgBId = `org_sg_b_${tag}`;
  const userAId = `user_sg_a_${tag}`;
  const adminAId = `admin_sg_a_${tag}`;
  const userBId = `user_sg_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Stage Gate RealDB Org A (attacker)', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Stage Gate RealDB Org B (victim)', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  // Project belongs to org B, seeded with context_data that satisfies every
  // READINESS_GATE criterion (hasStrategicGoals / hasChallenges /
  // hasConstraints / contextReadinessOk) so a legitimate org-B evaluate call
  // reports READY — this is what lets test (c) reach the actual passGate()
  // write attempt instead of stopping early on a 400 "Gate not ready".
  const projectBId = `proj_sg_victim_${tag}`;
  const contextData = JSON.stringify({
    strategicGoals: ['Grow revenue 20%'],
    challenges: ['Legacy tooling'],
    constraints: ['Fixed headcount'],
  });
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, context_data)
     VALUES ($1, $2, 'Stage Gate RealDB Victim Project', 'active', $3)`,
    [projectBId, orgBId, contextData]
  );

  const cleanup = async () => {
    try {
      if (stageGatesTableExists) {
        await client.query(`DELETE FROM stage_gates WHERE project_id = $1`, [projectBId]);
      }
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectBId]);
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
    adminAId,
    userBId,
    projectBId,
    stageGatesTableExists,
    cleanup,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Stage gates — tenant isolation + honest-failure regression against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — stage-gates tenant-isolation realdb tests skipped. ' +
        'See file header for the docker run + migrate + vitest command to exercise this suite locally.'
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

  const app = buildApp();

  // (a) own project → 200 (evaluate).
  itDB('(a) GET evaluate — legit org-B user on their OWN project → 200', async (h) => {
    const token = makeE2EToken(h.userBId, h.orgBId);
    const res = await request(app)
      .get(`/api/stage-gates/${h.projectBId}/evaluate/READINESS_GATE`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body?.projectId).toBe(h.projectBId);
    expect(res.body?.status).toBe('READY');
  });

  // (b) cross-org attacker → 404 for evaluate/pass/history/current, every role.
  itDB(
    '(b1) GET evaluate — org-A user (non-admin) on org-B project → 404 (not 200, not 403)',
    async (h) => {
      const token = makeE2EToken(h.userAId, h.orgAId, 'MEMBER');
      const res = await request(app)
        .get(`/api/stage-gates/${h.projectBId}/evaluate/READINESS_GATE`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    }
  );

  itDB(
    '(b2) GET evaluate — org-A ADMIN on org-B project → 404 (highest role still refused)',
    async (h) => {
      const token = makeE2EToken(h.adminAId, h.orgAId, 'ADMIN');
      const res = await request(app)
        .get(`/api/stage-gates/${h.projectBId}/evaluate/READINESS_GATE`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    }
  );

  itDB('(b3) GET current — org-A user on org-B project → 404', async (h) => {
    const token = makeE2EToken(h.userAId, h.orgAId, 'MEMBER');
    const res = await request(app)
      .get(`/api/stage-gates/${h.projectBId}/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  itDB('(b4) GET history — org-A user on org-B project → 404', async (h) => {
    const token = makeE2EToken(h.userAId, h.orgAId, 'MEMBER');
    const res = await request(app)
      .get(`/api/stage-gates/${h.projectBId}/history`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  itDB(
    '(b5) POST pass — org-A ADMIN attempting to pass a gate on org-B project → 404 (the confirmed live exploit)',
    async (h) => {
      const token = makeE2EToken(h.adminAId, h.orgAId, 'ADMIN');
      const res = await request(app)
        .post(`/api/stage-gates/${h.projectBId}/pass/READINESS_GATE`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'cross-tenant forced pass attempt' });

      expect(res.status).toBe(404);
      // And it must not have actually recorded anything against the victim
      // project, table-exists-or-not.
      if (h.stageGatesTableExists) {
        const rows = await h.client.query(`SELECT id FROM stage_gates WHERE project_id = $1`, [
          h.projectBId,
        ]);
        expect(rows.rowCount).toBe(0);
      }
    }
  );

  // (c) pass on own project when `stage_gates` doesn't exist → honest error,
  // never a fabricated 200 PASSED. On today's schema this table is absent
  // (see file header), so this exercises exactly the "lying success" bug.
  itDB(
    '(c) POST pass — legit org-B user on own project, stage_gates table missing → NOT 200 PASSED, honest 5xx',
    async (h) => {
      if (h.stageGatesTableExists) {
        // Environment has the table (e.g. someone applied migrations-v2
        // manually) — this scenario doesn't apply; skip without failing.
        expect(true).toBe(true);
        return;
      }
      const token = makeE2EToken(h.userBId, h.orgBId);
      const res = await request(app)
        .post(`/api/stage-gates/${h.projectBId}/pass/READINESS_GATE`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'legit pass attempt, table missing' });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(res.status).toBeLessThan(600);
      expect(res.body?.status).not.toBe('PASSED');
    }
  );
});
