/**
 * EXE-005/006 — Change + progress spine golden-flow, against a REAL
 * Postgres database (no mocks).
 *
 * Scope: three write surfaces added/hardened on this branch on top of
 * EXE-002-004 (tests/integration/execution-spine.golden-flow.realdb.test.ts):
 *
 *   1. Progress update — `PATCH /api/initiatives/:id/quick-update`
 *      (`InitiativeController.quickUpdateInitiative`, mounted in
 *      `server/src/routes/pmo/initiatives.routes.ts`). Writes
 *      `initiative_history` (action='progress_updated').
 *   2. Reforecast — `POST /api/v8/execution-control/interventions/replan`
 *      (`server/src/routes/v8/execution-control.routes.ts`, mounted at
 *      `/api/v8/execution-control` by `server/src/routes/v8/index.ts`).
 *      Writes BOTH `execution_audit_log` (field_changed='replan') AND
 *      `initiative_history` (action='reforecast') — the latter is the one
 *      `GET /:id/history` (and therefore the front end) actually reads.
 *   3. Change/decision create-or-link — `POST /api/initiatives/:id/changes`
 *      (new handler in `initiatives.routes.ts`, next to `apply-template`).
 *      CREATE path inserts into `decisions` + `initiative_history`
 *      (action='change_created'); LINK path updates an existing `decisions`
 *      row + `initiative_history` (action='change_linked').
 *
 * Auth: same E2E_MODE unsigned-JWT bypass as execution-spine.golden-flow
 * (server/src/middleware/auth.middleware.ts E2E_MODE branch). The v8
 * execution-control router additionally requires
 * `verifyToken -> requireV8OrgContext -> v8OrgGate -> attachV8Context ->
 * v8MetricsMiddleware -> mutationAbortCanary` (see `routes/v8/index.ts`
 * mount order) before `getV8Context(req)` is usable inside the handler —
 * this file wires that exact chain for the execution-control mount instead
 * of assuming `verifyToken` alone is sufficient. `v8OrgGate` allows orgs
 * with zero `v8_feature_flags` rows through (implicit fallback) whenever
 * `NODE_ENV !== 'production'`, so no flag seeding is required for the E2E
 * test orgs created here.
 *
 * FIXED DEFECT this file caught (kept here as a regression note): the
 * `quick-update` route runs `validateBody(QuickUpdateInitiativeSchema)`
 * (server/src/validators/initiative.validators.ts) BEFORE
 * `quickUpdateInitiative` runs, and `validateBody` replaces `req.body` with
 * the *parsed* result (server/src/middleware/validation.middleware.ts,
 * `req.body = result.data`) — so any field the controller reads but the
 * schema doesn't declare is silently stripped before the handler sees it.
 * `QuickUpdateInitiativeSchema` originally had no `idempotencyKey` field,
 * so a client-supplied key on `PATCH .../quick-update` never reached the
 * controller even though its idempotent-replay branch was otherwise
 * correct. Fixed in the same branch (`idempotencyKey: z.string().optional()`
 * added to the schema) — the progress idempotency test below now exercises
 * the real, fixed path. If this regresses, the fix is almost certainly that
 * one line in `QuickUpdateInitiativeSchema` again.
 *
 * DB / skip behavior: mirrors execution-spine.golden-flow.realdb.test.ts's
 * `pgReachable()` + `itDB` convention byte-for-byte.
 *
 * HOW TO RUN LOCALLY (Postgres already up + migrated):
 *   DATABASE_URL="postgresql://iris:iris_test@localhost:5448/iris_test" \
 *     NODE_ENV=test npx vitest run \
 *     tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts \
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
// execution-spine.golden-flow.realdb.test.ts's env guard.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// Routers/middleware are imported AFTER the env guard above (informational —
// none of these modules touch the DB pool at import time).
import initiativesRoutes from '../../server/src/routes/pmo/initiatives.routes.js';
import verifyToken from '../../server/src/middleware/auth.middleware.js';
import { mutationAbortCanary } from '../../server/src/middleware/mutationGuard.middleware.js';
import { attachV8Context, requireV8OrgContext } from '../../server/src/middleware/v8Auth.middleware.js';
import { v8OrgGate } from '../../server/src/middleware/v8FeatureGate.middleware.js';
import { v8MetricsMiddleware } from '../../server/src/middleware/v8Metrics.middleware.js';
import executionControlRoutes from '../../server/src/routes/v8/execution-control.routes.js';

// ---------------------------------------------------------------------------
// Connection probe (same contract as execution-spine.golden-flow.realdb.test.ts)
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
  'initiative_history',
  'execution_audit_log',
  'decisions',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as execution-spine.golden-flow.realdb.test.ts)
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
    name: 'EXE Change/Progress Spine RealDB Test User',
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
// App under test — REAL routers, REAL middleware chains, REAL controllers.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativesRoutes);
  // Mirrors the exact mount order in server/src/routes/v8/index.ts for the
  // '/execution-control' sub-router: verifyToken -> requireV8OrgContext ->
  // v8OrgGate -> attachV8Context -> v8MetricsMiddleware -> mutationAbortCanary
  // -> executionControlRoutes. getV8Context(req) inside the route handlers
  // throws if this chain is not applied in full.
  app.use(
    '/api/v8/execution-control',
    verifyToken,
    requireV8OrgContext,
    v8OrgGate,
    attachV8Context,
    v8MetricsMiddleware,
    mutationAbortCanary,
    executionControlRoutes
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
  const orgAId = `org_excp_a_${tag}`;
  const orgBId = `org_excp_b_${tag}`;
  const userAId = `user_excp_a_${tag}`;
  const userBId = `user_excp_b_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Change/Progress RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'EXE Change/Progress RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXECP', 'UserA')
     ON CONFLICT (id) DO NOTHING`,
    [userAId, orgAId, `${userAId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'e2e-not-used', 'ADMIN', 'active', 'EXECP', 'UserB')
     ON CONFLICT (id) DO NOTHING`,
    [userBId, orgBId, `${userBId}@local.test`]
  );

  const projectAId = `proj_excp_a_${tag}`;
  await client.query(
    `INSERT INTO projects (id, organization_id, name, status, owner_id)
     VALUES ($1, $2, 'EXE Change/Progress RealDB Project (org A)', 'active', $3)`,
    [projectAId, orgAId, userAId]
  );

  // Seeded directly by SQL (frozen: no transition/start/unblock endpoint call)
  // in the status Execution actually operates on, same convention as
  // execution-spine.golden-flow.realdb.test.ts.
  const initiativeAId = `init_excp_a_${tag}`;
  await client.query(
    `INSERT INTO initiatives (id, organization_id, project_id, name, status, progress)
     VALUES ($1, $2, $3, 'EXE Change/Progress RealDB Initiative (org A, EXECUTING)', 'EXECUTING', 0)`,
    [initiativeAId, orgAId, projectAId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM decisions WHERE initiative_id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM execution_audit_log WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiative_history WHERE initiative_id = $1`, [
        initiativeAId,
      ]);
      await client.query(`DELETE FROM initiatives WHERE id = $1`, [initiativeAId]);
      await client.query(`DELETE FROM projects WHERE id = $1`, [projectAId]);
      // Best-effort: the E2E auth bypass also seeds `organization_members`
      // rows for whichever identities actually authenticate.
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

describe('EXE-005-006 — change + progress spine golden flow against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — execution-change-progress-spine ' +
        'golden-flow realdb tests skipped. Set DATABASE_URL / PGHOST to a migrated Postgres to ' +
        'exercise this suite.'
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

  // Mirrors the `itDB` convention in execution-spine.golden-flow.realdb.test.ts:
  // when the harness is unavailable, report a clean vacuous pass instead of
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
  // 1) Golden flow: GET baseline -> progress update -> reforecast -> change
  //    create -> GET reopen (coherent state) -> GET history (coherent audit)
  //    -> direct DB sanity on execution_audit_log.
  // -------------------------------------------------------------------------

  itDB(
    'golden flow: progress update -> reforecast -> change create, all coherent on reopen GET + history',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const changeTitle = `Golden Flow Change ${suffix()}`;
      const forecastEndDate = '2026-12-15';
      const reforecastReason = `Golden flow reforecast ${suffix()}`;

      // 1a. GET baseline
      const baselineGet = await request(app)
        .get(`/api/initiatives/${h.initiativeAId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(baselineGet.status).toBe(200);
      expect(baselineGet.body?.id).toBe(h.initiativeAId);

      // 1b. PATCH quick-update — progress only, NO status field.
      const progressRes = await request(app)
        .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ progress: 42 });
      expect(progressRes.status).toBe(200);
      expect(progressRes.body?.success).toBe(true);
      expect(progressRes.body?.message).toBe('Initiative updated');

      // 1c. POST replan (reforecast) — forecastEndDate + required reason.
      const replanRes = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entityType: 'INITIATIVE',
          entityId: h.initiativeAId,
          forecastEndDate,
          reason: reforecastReason,
        });
      expect(replanRes.status).toBe(200);
      expect(replanRes.body?.data?.success).toBe(true);
      expect(replanRes.body?.data?.action).toBe('replan');

      // 1d. POST /changes CREATE — new decision.
      const changeRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: changeTitle, reason: 'Golden flow change create' });
      expect(changeRes.status).toBe(201);
      expect(changeRes.body?.success).toBe(true);
      expect(changeRes.body?.decisionId).toBeTruthy();
      const decisionId = changeRes.body.decisionId as string;

      // 1e. "Reopen" — a SEPARATE, fresh GET request (new supertest call
      // against a freshly built app instance) proves persistence rather than
      // request-scoped/in-memory state.
      const reopenApp = buildApp();
      const reopenGet = await request(reopenApp)
        .get(`/api/initiatives/${h.initiativeAId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reopenGet.status).toBe(200);
      expect(Number(reopenGet.body?.progress)).toBe(42);
      const reopenForecastEnd =
        reopenGet.body?.forecastEndDate ?? reopenGet.body?.forecast_end_date;
      expect(reopenForecastEnd).toBeTruthy();
      expect(String(reopenForecastEnd).slice(0, 10)).toBe(forecastEndDate);

      // 1f. GET history — coherent audit read-back: progress_updated,
      // reforecast, and change_created must all be visible via the ONE path
      // the front end actually reads (GET /:id/history), not just in the
      // (unexposed) execution_audit_log table.
      const historyGet = await request(reopenApp)
        .get(`/api/initiatives/${h.initiativeAId}/history`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(historyGet.status).toBe(200);
      const events = (historyGet.body?.events ?? []) as Array<{ eventType: string }>;
      const actionTypes = new Set(events.map((e) => e.eventType));
      expect(actionTypes.has('progress_updated')).toBe(true);
      expect(actionTypes.has('reforecast')).toBe(true);
      expect(actionTypes.has('change_created')).toBe(true);

      // 1g. Sanity DB query directly on execution_audit_log — the golden-flow
      // requirement says "audit" generically; execution_audit_log is NOT
      // exposed to the client (see file header), but the replan intervention
      // must still have written it.
      const auditRows = await h.client.query(
        `SELECT id FROM execution_audit_log WHERE initiative_id = $1 AND field_changed = 'replan'`,
        [h.initiativeAId]
      );
      expect(auditRows.rows.length).toBeGreaterThanOrEqual(1);

      const decisionRow = await h.client.query(
        `SELECT id, initiative_id, title, decision_maker_id FROM decisions WHERE id = $1`,
        [decisionId]
      );
      expect(decisionRow.rows.length).toBe(1);
      expect(decisionRow.rows[0].initiative_id).toBe(h.initiativeAId);
      expect(decisionRow.rows[0].title).toBe(changeTitle);
      // decisions.decision_maker_id is NOT NULL on the real schema and must be
      // the session actor who created the change — never null, never a
      // fabricated system id.
      expect(decisionRow.rows[0].decision_maker_id).toBe(h.userAId);
    }
  );

  itDB(
    "POST /changes CREATE: decisionMakerId in the request body cannot spoof decisions.decision_maker_id",
    async (h) => {
      // Regression test for the Codex-review blocker: decisions.decision_maker_id
      // is NOT NULL and MUST come from the authenticated session, never from the
      // request body — a caller must not be able to hand a decision to an
      // arbitrary user id it doesn't have ownership/capability over. This
      // endpoint does not read a decisionMakerId/decisionOwnerId field from the
      // body at all; assert that sending one is silently ignored rather than
      // honored, and that the row still resolves to the real session actor.
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const spoofedUserId = `spoofed-user-${suffix()}`;
      const title = `Spoof attempt ${suffix()}`;

      const res = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title,
          decisionMakerId: spoofedUserId,
          decisionOwnerId: spoofedUserId,
          decision_maker_id: spoofedUserId,
        });
      expect(res.status).toBe(201);
      const decisionId = res.body?.decisionId as string;
      expect(decisionId).toBeTruthy();

      const row = await h.client.query(
        `SELECT decision_maker_id FROM decisions WHERE id = $1`,
        [decisionId]
      );
      expect(row.rows.length).toBe(1);
      expect(row.rows[0].decision_maker_id).toBe(h.userAId);
      expect(row.rows[0].decision_maker_id).not.toBe(spoofedUserId);
    }
  );

  // -------------------------------------------------------------------------
  // 2) Idempotent retry — one test per endpoint.
  // -------------------------------------------------------------------------

  itDB(
    'idempotent retry: repeating the same progress quick-update with the same idempotencyKey does not duplicate',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-progress-${suffix()}`;

      const firstRes = await request(app)
        .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ progress: 55, idempotencyKey });
      expect(firstRes.status).toBe(200);
      expect(firstRes.body?.success).toBe(true);

      const secondRes = await request(app)
        .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ progress: 55, idempotencyKey });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body?.idempotent).toBe(true);

      const rows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = 'progress_updated' AND idempotency_key = $2`,
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'idempotent retry: repeating the same replan (reforecast) POST with the same idempotencyKey does not duplicate',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-replan-${suffix()}`;
      const body = {
        entityType: 'INITIATIVE',
        entityId: h.initiativeAId,
        forecastEndDate: '2027-01-20',
        reason: 'Idempotent replan retry',
        idempotencyKey,
      };

      const firstRes = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);
      expect(firstRes.status).toBe(200);
      expect(firstRes.body?.data?.success).toBe(true);

      const secondRes = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send(body);
      expect(secondRes.status).toBe(200);
      expect(secondRes.body?.data?.idempotent).toBe(true);

      const auditRows = await h.client.query(
        `SELECT id FROM execution_audit_log WHERE initiative_id = $1 AND field_changed = 'replan' AND idempotency_key = $2`,
        [h.initiativeAId, idempotencyKey]
      );
      expect(auditRows.rows.length).toBe(1);

      const historyRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND action = 'reforecast' AND idempotency_key = $2`,
        [h.initiativeAId, idempotencyKey]
      );
      expect(historyRows.rows.length).toBe(1);
    }
  );

  itDB(
    'idempotent retry: repeating the same change/decision CREATE POST with the same idempotencyKey does not duplicate',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-change-${suffix()}`;
      const title = `Idempotent Change ${suffix()}`;

      const firstRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title, idempotencyKey });
      expect(firstRes.status).toBe(201);
      expect(firstRes.body?.success).toBe(true);
      const firstDecisionId = firstRes.body?.decisionId as string;
      expect(firstDecisionId).toBeTruthy();

      const secondRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title, idempotencyKey });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body?.idempotent).toBe(true);
      expect(secondRes.body?.decisionId).toBe(firstDecisionId);

      const rows = await h.client.query(
        `SELECT id, decision_maker_id FROM decisions WHERE initiative_id = $1 AND idempotency_key = $2`,
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].decision_maker_id).toBe(h.userAId);
    }
  );

  // -------------------------------------------------------------------------
  // 3) Cross-tenant fail-closed — user B (org B) against org A's real
  //    initiativeId. Every write must be rejected AND leave no trace.
  // -------------------------------------------------------------------------

  itDB(
    'cross-tenant: PATCH quick-update on org A initiative as org B user -> 404, no state change',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const before = await h.client.query(`SELECT progress FROM initiatives WHERE id = $1`, [
        h.initiativeAId,
      ]);

      const res = await request(app)
        .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ progress: 99 });
      expect(res.status).toBe(404);

      const after = await h.client.query(`SELECT progress FROM initiatives WHERE id = $1`, [
        h.initiativeAId,
      ]);
      expect(after.rows[0].progress).toBe(before.rows[0].progress);

      const historyRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND changed_by = $2`,
        [h.initiativeAId, h.userBId]
      );
      expect(historyRows.rows.length).toBe(0);
    }
  );

  itDB(
    'cross-tenant: POST replan on org A initiative as org B user -> 404, no execution_audit_log/history row',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const res = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          entityType: 'INITIATIVE',
          entityId: h.initiativeAId,
          forecastEndDate: '2028-06-01',
          reason: 'Attacker replan attempt',
        });
      expect(res.status).toBe(404);

      const auditRows = await h.client.query(
        `SELECT id FROM execution_audit_log WHERE initiative_id = $1 AND changed_by = $2`,
        [h.initiativeAId, h.userBId]
      );
      expect(auditRows.rows.length).toBe(0);

      const historyRows = await h.client.query(
        `SELECT id FROM initiative_history WHERE initiative_id = $1 AND changed_by = $2`,
        [h.initiativeAId, h.userBId]
      );
      expect(historyRows.rows.length).toBe(0);
    }
  );

  itDB(
    "cross-tenant: POST replan on org A initiative as org B user, with org A's own idempotencyKey -> still 404, not an idempotent-replay 200",
    async (h) => {
      // Regression test for an adversarial-review finding: the idempotency-replay
      // check in the INITIATIVE branch of /interventions/replan used to run
      // BEFORE the org-scope existence guard, so a cross-tenant caller who
      // guessed/observed an (entityId, idempotencyKey) pair already recorded by
      // the legitimate org could get back `200 { idempotent: true }` without ever
      // being proven to own that initiative — a cross-tenant existence oracle
      // bypassing the 404 this endpoint otherwise enforces on every other path.
      // The sibling test above only sends an attack request WITHOUT an
      // idempotencyKey, so it never exercised the vulnerable branch — this test
      // specifically targets it.
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const idempotencyKey = `idem-replan-xtenant-${suffix()}`;

      // 1. Org A legitimately performs a replan with this idempotencyKey — this
      // creates the execution_audit_log row an attacker might discover/guess.
      const legitRes = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entityType: 'INITIATIVE',
          entityId: h.initiativeAId,
          forecastEndDate: '2028-07-01',
          reason: 'Legitimate reforecast',
          idempotencyKey,
        });
      expect(legitRes.status).toBe(200);

      // 2. Org B replays the SAME idempotencyKey against the SAME initiativeId —
      // must be 404 (org B does not own this initiative), never a 200 replay.
      const attackRes = await request(app)
        .post('/api/v8/execution-control/interventions/replan')
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({
          entityType: 'INITIATIVE',
          entityId: h.initiativeAId,
          forecastEndDate: '2099-01-01',
          reason: 'Cross-tenant idempotency-oracle attempt',
          idempotencyKey,
        });
      expect(attackRes.status).toBe(404);
      expect(attackRes.body?.data?.idempotent).not.toBe(true);

      // 3. The legitimate forecast must be untouched by the attack attempt.
      const row = await h.client.query(
        `SELECT forecast_end_date FROM initiatives WHERE id = $1`,
        [h.initiativeAId]
      );
      expect(String(row.rows[0]?.forecast_end_date)).toContain('2028-07-01');
    }
  );

  itDB(
    'cross-tenant: POST /changes CREATE on org A initiative as org B user -> 404, no decision created',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);
      const attackerTitle = `Attacker Change ${suffix()}`;

      const res = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ title: attackerTitle });
      expect(res.status).toBe(404);

      const leaked = await h.client.query(
        `SELECT id FROM decisions WHERE initiative_id = $1 AND title = $2`,
        [h.initiativeAId, attackerTitle]
      );
      expect(leaked.rows.length).toBe(0);
    }
  );

  itDB(
    'cross-tenant: POST /changes LINK org A initiative + org A decision as org B user -> 404, decision untouched',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      // Set up a real, unlinked org-A decision to try to steal.
      const seedTitle = `Cross-tenant Link Bait ${suffix()}`;
      const seedRes = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: seedTitle });
      expect(seedRes.status).toBe(201);
      const seedDecisionId = seedRes.body.decisionId as string;

      // Org B user tries to link ITS view of org A's initiativeId to org A's
      // decisionId. Org-scope guard on the initiative lookup fires first (org
      // B has no matching initiative row for that id) -> 404, before the
      // decision's org is even considered.
      const res = await request(app)
        .post(`/api/initiatives/${h.initiativeAId}/changes`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ decisionId: seedDecisionId });
      expect(res.status).toBe(404);

      const decisionRow = await h.client.query(
        `SELECT initiative_id FROM decisions WHERE id = $1`,
        [seedDecisionId]
      );
      expect(decisionRow.rows.length).toBe(1);
      // Untouched: still linked to the initiative it was created under
      // (created via /changes CREATE, which links at insert time), not
      // reassigned or nulled by the failed cross-tenant attempt.
      expect(decisionRow.rows[0].initiative_id).toBe(h.initiativeAId);
    }
  );

  // -------------------------------------------------------------------------
  // 4) Concurrent writes — "no two active versions" guarantee. Most
  //    important test in this file per the task brief.
  // -------------------------------------------------------------------------

  itDB(
    'concurrent writes: two simultaneous progress quick-updates settle on exactly one of the two values, no torn state',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);

      // No idempotencyKey — this is deliberately NOT a test of the replay
      // guard. It proves that two genuinely different concurrent writers to
      // the same row do not corrupt state (row-level locking on the
      // `UPDATE ... WHERE id = ? AND organization_id = ?` gives a clean
      // last-write-wins, not a torn/NULL/error state).
      const [resA, resB] = await Promise.all([
        request(app)
          .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ progress: 10 }),
        request(app)
          .patch(`/api/initiatives/${h.initiativeAId}/quick-update`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ progress: 90 }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resA.body?.success).toBe(true);
      expect(resB.body?.success).toBe(true);

      const reopenApp = buildApp();
      const finalGet = await request(reopenApp)
        .get(`/api/initiatives/${h.initiativeAId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(finalGet.status).toBe(200);
      const finalProgress = Number(finalGet.body?.progress);
      expect([10, 90]).toContain(finalProgress);
    }
  );

  itDB(
    'concurrent writes: two simultaneous /changes CREATE POSTs with the same idempotencyKey but different titles create exactly one decision',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const idempotencyKey = `idem-race-change-${suffix()}`;
      const titleA = `Race Change A ${suffix()}`;
      const titleB = `Race Change B ${suffix()}`;

      // Fire both requests concurrently (no await between them) to exercise
      // the exact scenario the partial unique index
      // (decisions(initiative_id, idempotency_key) WHERE idempotency_key IS
      // NOT NULL) + `err.code === '23505'` catch/re-select fallback in the
      // /changes CREATE handler exists for: a double-click / retried network
      // POST, not a sequential retry.
      const [resA, resB] = await Promise.all([
        request(app)
          .post(`/api/initiatives/${h.initiativeAId}/changes`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: titleA, idempotencyKey }),
        request(app)
          .post(`/api/initiatives/${h.initiativeAId}/changes`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: titleB, idempotencyKey }),
      ]);

      // Both requests must succeed: one 201 (the creator) and one 200+idempotent
      // (the loser of the race), in EITHER order.
      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 201]);

      const winner = resA.status === 201 ? resA : resB;
      const loser = resA.status === 201 ? resB : resA;
      expect(winner.body?.success).toBe(true);
      expect(winner.body?.decisionId).toBeTruthy();
      expect(loser.body?.idempotent).toBe(true);
      expect(loser.body?.decisionId).toBe(winner.body.decisionId);

      const rows = await h.client.query(
        `SELECT id, decision_maker_id FROM decisions WHERE initiative_id = $1 AND idempotency_key = $2`,
        [h.initiativeAId, idempotencyKey]
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].id).toBe(winner.body.decisionId);
      // The single surviving row (whichever request actually won the race)
      // must still carry the real session actor as decision_maker_id — the
      // NOT NULL column and the idempotency race must not interact to leave
      // it null or mismatched.
      expect(rows.rows[0].decision_maker_id).toBe(h.userAId);
    }
  );
});
