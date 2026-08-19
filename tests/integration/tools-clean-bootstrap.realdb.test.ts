/**
 * TASK 1 (P0) — canonical clean-database bootstrap for `promoteToOutput`.
 *
 * Known problem this suite is the regression gate for: on a bare/under-
 * migrated database, `POST /api/tools/:toolId/promote` returned HTTP 500
 * with Postgres SQLSTATE 42P01 `relation "permissions" does not exist`
 * (or, transitively, `relation "initiatives"`/`"audit_log"` does not exist).
 * `ensureToolsSchema()` in `server/src/controllers/ToolController.ts` only
 * ever creates the four `tool_*` tables (`tool_sessions`, `tool_decisions`,
 * `tool_initiative_batches`, `tool_initiative_links`) plus best-effort
 * `INSERT`s into `permissions`/`role_permissions` — it never `CREATE TABLE`s
 * either of those, and the whole function is wrapped in a blanket
 * try/catch that silently swallows the 42P01 that INSERT throws on a bare
 * DB. The fix is NOT to hand-create `permissions` in application code —
 * it is to run the real migration set first. This suite proves that.
 *
 * PORTED (2026-08-13, S6 integration) from
 * `codex/tools-wt-bootstrap-20260813` @ `5d5646b3e3`. Two adaptations vs
 * the original commit — see docs/program/METHOD_TOOLS_2026-08-13/CLEAN_BOOTSTRAP.md
 * "Integration note" for the full rationale:
 *   1. Points at the canonical `./_helpers/assertRealPostgres.js` (async,
 *      no-arg call) instead of the worktree-local `bootstrapHelpers.ts`,
 *      which never merged and does not exist on this branch.
 *   2. The pre-flight `assertPromotionBranchReached(fixture)` sanity check
 *      (which validated a *fixture*, not an HTTP response) is dropped —
 *      the canonical helper's `assertPromotionBranchReached` validates an
 *      HTTP response's status/body instead, and is used post-request below
 *      for that purpose. The confidence_avg=5/completion_percent=100
 *      reasoning it protected against is preserved as a comment.
 *
 * HOW TO RUN LOCALLY (this workstream's disposable container):
 *   docker run -d --name cfy-s6-integ -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_USER=consultinity -e POSTGRES_DB=consultinity \
 *     -p 56505:5432 pgvector/pgvector:pg15
 *   NODE_ENV=test DATABASE_URL=postgres://consultinity:test@localhost:56505/consultinity \
 *     DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56505/consultinity \
 *     npx vitest run tests/integration/tools-clean-bootstrap.realdb.test.ts
 *
 * IMPORTANT: a plain `postgres` image (no pgvector bundled) does NOT ship
 * the `vector` extension, and `server/migrations/20260719_baseline_gap.sql`
 * does `create extension if not exists vector`. The strict migration run
 * FAILS on plain postgres with "extension \"vector\" is not available".
 * Use an image that bundles pgvector (`pgvector/pgvector:pg15` — matching
 * this worktree's assigned container image) for a full strict run.
 *
 * This suite deliberately does NOT run the migrations itself (that is a
 * slow, multi-minute, ~580-file operation and is the CI/dev-workflow's
 * job, not a unit test's). It asserts that a database that HAS been
 * migrated has every table `promoteToOutput` touches, and that firing a
 * real promotion HTTP request against it does not 42P01.
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// ---------------------------------------------------------------------------
// Tables `promoteToOutput` depends on, derived from reading
// `server/src/controllers/ToolController.ts` (promoteToOutput, ~L2052-2345)
// plus everything it transitively calls for outputType='initiative'
// (`resolveInitiativeProjectId`, `logAudit`) and outputType='report'
// (`ReportBuilderService`). NOT every table here is required for every
// outputType — `report_builder_reports`/`report_builder_sections` only
// matter for outputType='report', `v8_artifact_runs` only for
// 'presentation', `my_ideas` only for 'idea' — but all are asserted present
// because a fresh/managed DB should provide the full contract, and several
// of these (`permissions`, `role_permissions`, `audit_log`) are exactly the
// tables `ensureToolsSchema()` silently fails to create.
// ---------------------------------------------------------------------------
const REQUIRED_TABLES = [
  // Read/written directly by promoteToOutput itself.
  'tool_sessions',
  'tool_initiative_links',
  'initiatives',
  // permissions/role_permissions: ensureToolsSchema() INSERTs into these
  // without ever CREATE TABLE-ing them — the origin of the 42P01 bug.
  'permissions',
  'role_permissions',
  // logAudit() — called on every successful promotion.
  'audit_log',
  // outputType='report' path.
  'report_builder_reports',
  'report_builder_sections',
  // FK targets used to build a valid tool_sessions row / initiatives row.
  'organizations',
  'users',
] as const;

let mockUser: { id: string; role: string; organizationId: string } | null = null;

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) return res.status(401).json({ error: 'No token' });
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));
vi.mock('../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (req: any, res: any, next: () => void) => {
    if (!req.user) return res.status(401).json({ error: 'No token' });
    next();
  },
}));
vi.mock('../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

describe('Tools clean-database bootstrap — promoteToOutput (real Postgres)', () => {
  const suffix = randomUUID();
  const orgId = `org-bootstrap-${suffix}`;
  const userId = `user-bootstrap-${suffix}`;
  const membershipId = randomUUID();
  const toolSessionId = `tool-bootstrap-${suffix}`;

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  let app: Express;
  // Guards afterAll below: if beforeAll throws before `client.connect()`
  // runs (the expected outcome when preconditions are missing — see
  // assertRealPostgresTestEnvironment()), an unconnected pg.Client hangs
  // for the full hookTimeout on any `.query()`/`.end()` call instead of
  // failing fast.
  let connected = false;

  async function buildApp(): Promise<Express> {
    // Fresh module registry each time — mirrors "restart the API layer":
    // a brand-new import of the router/controller module, not a cached one.
    vi.resetModules();
    const mod = await import('../../server/src/routes/tools.routes.js');
    const { errorHandler } = await import('../../server/src/middleware/errorHandler.js');
    const freshApp = express();
    freshApp.use(express.json());
    freshApp.use('/api/tools', mod.default);
    freshApp.use(errorHandler);
    return freshApp;
  }

  async function insertFreshToolSession(id: string): Promise<void> {
    // completion_percent=100, confidence_avg=5 — 0-5 scale, promotion
    // threshold is >=3 (getRuntimeGateBlockers() in ToolController). A
    // value like 0.9 looks like "90%" but is actually just under 1/5 and
    // would leave the promotion branch permanently unreached.
    const fixture = { confidence_avg: 5, completion_percent: 100 };
    await client.query(
      `INSERT INTO tool_sessions (
         id, organization_id, tool_type, name, status,
         completion_percent, confidence_avg, answers_json, missing_items_json,
         created_by, created_at, updated_at
       ) VALUES ($1,$2,'SWOT','Bootstrap promotion fixture','APPROVED',$3,$4,'{}','[]',$5,NOW(),NOW())`,
      [id, orgId, fixture.completion_percent, fixture.confidence_avg, userId]
    );
  }

  beforeAll(async () => {
    // ABSOLUTE RULE for this workstream: fail, never skip, never mock.
    await assertRealPostgresTestEnvironment();

    await client.connect();
    connected = true;
    // REQUIRE_INITIATIVE_PROJECT=false keeps this suite scoped to the
    // 42P01/schema-bootstrap question, not the (separate, fail-soft)
    // system-portfolio-project auto-creation policy.
    process.env.REQUIRE_INITIATIVE_PROJECT = 'false';

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'enterprise','active')
      ON CONFLICT (id) DO NOTHING`,
      [orgId, 'Bootstrap test org']
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1,$2,$3,'x','ADMIN','active','Boot','Strap')
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, `${userId}@local.test`]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
      [membershipId, orgId, userId]
    );

    mockUser = { id: userId, role: 'ADMIN', organizationId: orgId };
    app = await buildApp();
  });

  afterAll(async () => {
    if (!connected) return; // beforeAll threw before connecting — nothing to clean up.
    // outputType='report' promotions (the "restart + reopen" test) create
    // report_builder_reports/sections rows that FK-reference organizations.
    // These must go before the organizations DELETE below, or that DELETE
    // fails with a FK violation that a bare `.catch(() => {})` would
    // silently swallow, leaking the org/user/session rows into the
    // container permanently.
    await client
      .query(
        `DELETE FROM report_builder_sections WHERE report_id IN (
           SELECT id FROM report_builder_reports WHERE organization_id = $1
         )`,
        [orgId]
      )
      .catch(() => {});
    await client
      .query(`DELETE FROM report_builder_reports WHERE organization_id = $1`, [orgId])
      .catch(() => {});
    await client
      .query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [
        `tool-bootstrap-${suffix}%`,
      ])
      .catch(() => {});
    await client
      .query(`DELETE FROM initiatives WHERE organization_id = $1`, [orgId])
      .catch(() => {});
    await client.query(`DELETE FROM audit_log WHERE organization_id = $1`, [orgId]).catch(() => {});
    await client
      .query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [orgId])
      .catch(() => {});
    await client.query(`DELETE FROM organization_members WHERE id = $1`, [membershipId]);
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    const residue = await client.query(
      `SELECT
         (SELECT count(*)::int FROM organization_members WHERE id=$1) memberships,
         (SELECT count(*)::int FROM users WHERE id=$2) users,
         (SELECT count(*)::int FROM organizations WHERE id=$3) organizations`,
      [membershipId, userId, orgId]
    );
    expect(residue.rows[0]).toEqual({ memberships: 0, users: 0, organizations: 0 });
    await client.end();
  });

  // ── 4. dependency inventory — every table promoteToOutput needs exists ────
  it('the migrated schema has every table promoteToOutput depends on', async () => {
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [REQUIRED_TABLES as unknown as string[]]
    );
    const present = new Set(rows.map((r: any) => r.table_name));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
    expect(missing, `missing tables: ${missing.join(', ')}`).toEqual([]);
  });

  // ── 5. real promoteToOutput HTTP request does not 42P01 ───────────────────
  it('POST /api/tools/:toolId/promote (outputType=initiative) does not return 42P01', async () => {
    await insertFreshToolSession(toolSessionId);

    const res = await request(app)
      .post(`/api/tools/${toolSessionId}/promote`)
      .send({ outputType: 'initiative', title: 'Bootstrap promotion candidate' });

    assertPromotionBranchReached(res);

    // The historical bug: 500 with SQLSTATE 42P01. Assert both the status
    // AND that no 42P01 leaked through in the body, so a regression that
    // changes the status code but keeps the underlying relation error would
    // still be caught.
    expect(String(res.status)).not.toBe('500');
    expect(JSON.stringify(res.body)).not.toMatch(/42P01/);
    expect(JSON.stringify(res.body)).not.toMatch(/relation .* does not exist/i);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      outputType: 'initiative',
      sourceSessionId: toolSessionId,
    });
    expect(typeof res.body.id).toBe('string');

    // Traceability row landed (this is also the fixture C14's org-scope
    // migration backfills from).
    const { rows: linkRows } = await client.query(
      `SELECT tool_session_id, batch_id, initiative_id FROM tool_initiative_links WHERE tool_session_id = $1`,
      [toolSessionId]
    );
    expect(linkRows).toHaveLength(1);
    expect(linkRows[0].batch_id).toBe('promote-initiative');

    // The initiative itself actually exists and is org-scoped correctly.
    const { rows: initiativeRows } = await client.query(
      `SELECT id, organization_id, name FROM initiatives WHERE id = $1`,
      [res.body.id]
    );
    expect(initiativeRows).toHaveLength(1);
    expect(initiativeRows[0].organization_id).toBe(orgId);
  });

  // ── 6. restart the API layer (fresh import) and repeat promotion + reopen ─
  it('a fresh import of the router repeats promotion (dedup) and survives reopen', async () => {
    // "Restart the API layer": brand-new module graph, not a cached one.
    const restartedApp = await buildApp();

    // Title MUST match the original promotion call exactly. Since this
    // branch's C15/C16 idempotency work (docs/program/METHOD_TOOLS_2026-08-13/IDP_SEMANTICS.md),
    // `promoteToOutput` hashes `{ title }` as the payload identity for a
    // given idempotency key (default: `promote-<outputType>`) — the SAME
    // key with a DIFFERENT title now correctly returns 409 "Idempotency
    // key already used with a different payload" instead of silently
    // deduplicating. The original ported test used a deliberately
    // different title here ("... (repeat)") to prove dedup-despite-retry;
    // that assumption predates payload-identity checking and would now
    // legitimately 409. Kept identical to the first call's title so this
    // test still proves the dedup path this suite is named for.
    const dedupRes = await request(restartedApp)
      .post(`/api/tools/${toolSessionId}/promote`)
      .send({ outputType: 'initiative', title: 'Bootstrap promotion candidate' });

    assertPromotionBranchReached(dedupRes);
    expect(dedupRes.status).toBe(200);
    expect(dedupRes.body.deduplicated).toBe(true);
    expect(JSON.stringify(dedupRes.body)).not.toMatch(/42P01/);

    // Reopen: send the session back toward DRAFT, then re-approve and
    // promote again under a different outputType — still no 42P01, and a
    // second, independent tool_initiative_links row is written (different
    // batch_id: 'promote-report').
    await client.query(
      `UPDATE tool_sessions SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
      [toolSessionId]
    );

    const reopenedApp = await buildApp();
    const secondRes = await request(reopenedApp)
      .post(`/api/tools/${toolSessionId}/promote`)
      .send({ outputType: 'report', title: 'Bootstrap promotion candidate (report)' });

    assertPromotionBranchReached(secondRes);
    expect(secondRes.status).toBe(200);
    expect(JSON.stringify(secondRes.body)).not.toMatch(/42P01/);

    const { rows } = await client.query(
      `SELECT DISTINCT batch_id FROM tool_initiative_links WHERE tool_session_id = $1 ORDER BY batch_id`,
      [toolSessionId]
    );
    expect(rows.map((r: any) => r.batch_id)).toEqual(['promote-initiative', 'promote-report']);
  });
});
