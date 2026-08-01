/**
 * Acceptance E2E — INI-005: canonical SCHEDULED→EXECUTING gate (H16 fix, 2026-08-01).
 *
 * REAL runtime only: real Express router, real verifyToken auth, real Postgres
 * (local :5442, full schema). Zero business-logic mocks. Proves the NEW contract
 * implemented in server/src/controllers/InitiativeController.ts:
 *
 *   - `executeInitiativeTransition` is the SOLE transition engine (row-locked
 *     read via `SELECT … FOR UPDATE` inside `queryHelpers.withPgTransaction`,
 *     atomic state UPDATE + `initiative_status_history` INSERT +
 *     `initiative_history` INSERT on the same pinned client).
 *   - `hasApprovedGateDecision` only lets the MOST RECENT decision row for a
 *     (org, initiative, pmoDomain) tuple satisfy a gate (decision-currency fix).
 *   - SCHEDULED→EXECUTING now requires a current approved
 *     GOVERNANCE_DECISION_MAKING decision (previously ZERO decision check).
 *   - `startExecution`/`approveInitiative` are thin adapters over the same
 *     engine as the canonical `PATCH /:id/status` — no more silent
 *     APPROVED→EXECUTING bypass, no more independent role tables.
 *   - `POST /:id/reject` is deleted entirely (confirmed by route-file diff).
 *
 * Role model used by fixtures below (server/src/services/initiative/
 * initiativeAccessResolver.ts): the seeded acceptance user (SEED.USER_ID) has
 * `users.role='ADMIN'` and an 'OWNER' JWT claim, both of which resolve to the
 * ADMIN effective role — i.e. it bypasses every gate/RBAC check by design.
 * That is USELESS for proving real RBAC, so this suite mints DISTINCT actors
 * with non-privileged system roles and grants gate authority the same way the
 * app does in production: a `project_members.project_role` row ('PMO' /
 * 'PROJECT_SPONSOR') on the initiative's own project, resolved by
 * `resolveInitiativeAccessContext` into `effectiveRoles`. A actor with NO such
 * row and a non-elevated system role genuinely has no gate authority.
 *
 * All fixture rows use the reversible `odbior--ini005--` prefix; the probe
 * cleans up after itself in `afterAll` (and pre-cleans in `beforeAll` in case
 * a previous interrupted run left rows behind).
 */
// INI-005 JWT hermeticity: MUST be imported first — sets process.env.JWT_SECRET
// to a fixed value before any dynamic import can load server/src/config/Config.ts.
// See tests/acceptance/ini005TestSecret.ts for the full root-cause writeup.
import { assertJwtSecretHermetic } from './ini005TestSecret.js';

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--ini005--';
const ORG_A = SEED.ORG_ID;
const ORG_B = `${PREFIX}org-b`;
const PROJECT_A = `${PREFIX}project-a`;
const PROJECT_B = `${PREFIX}project-b`;
const PMO_USER = `${PREFIX}user-pmo`;
const SPONSOR_USER = `${PREFIX}user-sponsor`;
const NOROLE_USER = `${PREFIX}user-norole`;
const ORGB_USER = `${PREFIX}user-orgb`;

let seqCounter = 0;
function nextId(kind: string): string {
  seqCounter += 1;
  return `${PREFIX}${kind}-${Date.now()}-${seqCounter}`;
}

// ---------------------------------------------------------------------------
// App under test
// ---------------------------------------------------------------------------
async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const initiativesRouter = (await import('../../server/src/routes/pmo/initiatives.routes.js'))
    .default;
  const executionRouter = (await import('../../server/src/routes/pmo/execution.routes.js'))
    .default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/initiatives', verifyToken as any, initiativesRouter);
  app.use('/api/execution', verifyToken as any, executionRouter);
  // Minimal error middleware ONLY so an uncaught throw (case 18's deliberate
  // real Postgres UNIQUE violation) surfaces as a coded JSON 5xx instead of
  // Express's default HTML error page. Does not change production behavior —
  // asyncHandler already forwards to `next(err)` in the real app too; the
  // real Gateway just has its own equivalent error middleware we're not
  // pulling in here (see harness.ts doc comment on why we mount routers
  // directly instead of booting the whole server).
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    res
      .status(Number(err?.statusCode) || 500)
      .json({ error: String(err?.message || err || 'Internal error') });
  });
  return app;
}

let app: Express;
let adminToken: string;
let pmoToken: string;
let sponsorToken: string;
let noroleToken: string;
let orgBToken: string;

// ---------------------------------------------------------------------------
// DB helpers (open/close a dedicated client per call — matches the existing
// suite convention in h16-start-execution.e2e.test.ts / harness.ts).
// ---------------------------------------------------------------------------
async function pgQuery<T = any>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  const c = pgClient();
  await c.connect();
  try {
    return await c.query(sql, params as any[]);
  } finally {
    await c.end();
  }
}

async function upsertUser(
  id: string,
  opts: { orgId: string; email: string; role: string }
): Promise<void> {
  await pgQuery(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1, $2, $3, 'x', $4, 'active', 'Odbior', 'Ini005', CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, organization_id = EXCLUDED.organization_id`,
    [id, opts.orgId, opts.email, opts.role]
  );
}

async function upsertOrgMembership(userId: string, orgId: string, role = 'MEMBER'): Promise<void> {
  await pgQuery(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     VALUES ($1, $2, $3, $4, 'ACTIVE', CURRENT_TIMESTAMP)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'ACTIVE'`,
    [`${userId}--mem`, orgId, userId, role]
  );
}

async function upsertProject(id: string, orgId: string): Promise<void> {
  await pgQuery(
    `INSERT INTO projects (id, organization_id, name, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [id, orgId, `${PREFIX} project`]
  );
}

async function upsertProjectMember(
  projectId: string,
  userId: string,
  projectRole: string
): Promise<void> {
  await pgQuery(
    `INSERT INTO project_members (id, project_id, user_id, project_role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET project_role = EXCLUDED.project_role`,
    [`${projectId}--${userId}--member`, projectId, userId, projectRole]
  );
}

async function insertInitiative(opts: {
  id: string;
  orgId?: string;
  projectId?: string;
  status: string;
  ownerExecutionId?: string;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  createdBy?: string;
}): Promise<string> {
  const {
    id,
    orgId = ORG_A,
    projectId = PROJECT_A,
    status,
    ownerExecutionId = SEED.USER_ID,
    plannedStart = null,
    plannedEnd = null,
    createdBy = SEED.USER_ID,
  } = opts;
  await pgQuery(
    `INSERT INTO initiatives
       (id, organization_id, project_id, name, title, status, owner_execution_id,
        planned_start_date, planned_end_date, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, project_id = EXCLUDED.project_id,
       owner_execution_id = EXCLUDED.owner_execution_id,
       planned_start_date = EXCLUDED.planned_start_date,
       planned_end_date = EXCLUDED.planned_end_date,
       execution_started_at = NULL, baseline_version = 0, schedule_baseline_id = NULL`,
    [id, orgId, projectId, `${PREFIX} initiative ${id}`, status, ownerExecutionId, plannedStart, plannedEnd, createdBy]
  );
  return id;
}

async function insertDecision(opts: {
  id: string;
  orgId?: string;
  initiativeId: string;
  pmoDomain: string;
  status?: string;
  decisionMakerId?: string;
  deadline?: string | null;
  decidedAt?: string | null;
  createdAt?: string;
}): Promise<string> {
  const {
    id,
    orgId = ORG_A,
    initiativeId,
    pmoDomain,
    status = 'approved',
    decisionMakerId = SEED.USER_ID,
    deadline = '2026-08-15T00:00:00.000Z',
    decidedAt = null,
    createdAt = new Date().toISOString(),
  } = opts;
  await pgQuery(
    `INSERT INTO decisions
       (id, organization_id, initiative_id, title, type, decision_maker_id, deadline,
        status, pmo_domain, decided_at, created_by, created_at)
     VALUES ($1, $2, $3, $4, 'GO_NO_GO', $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, deadline = EXCLUDED.deadline, decided_at = EXCLUDED.decided_at,
       pmo_domain = EXCLUDED.pmo_domain, decision_maker_id = EXCLUDED.decision_maker_id`,
    [id, orgId, initiativeId, `${PREFIX} decision ${id}`, decisionMakerId, deadline, status, pmoDomain, decidedAt, decisionMakerId, createdAt]
  );
  return id;
}

async function insertMilestone(opts: { id: string; orgId?: string; initiativeId: string }): Promise<void> {
  const { id, orgId = ORG_A, initiativeId } = opts;
  await pgQuery(
    `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, target_date, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_DATE, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [id, initiativeId, orgId, `${PREFIX} milestone`]
  );
}

async function getInitiative(id: string): Promise<Record<string, any> | null> {
  const r = await pgQuery(`SELECT * FROM initiatives WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

async function countHistory(
  initiativeId: string
): Promise<{ statusHistory: number; history: number }> {
  const sh = await pgQuery(
    `SELECT COUNT(*)::int AS n FROM initiative_status_history WHERE initiative_id = $1`,
    [initiativeId]
  );
  const h = await pgQuery(
    `SELECT COUNT(*)::int AS n FROM initiative_history WHERE initiative_id = $1`,
    [initiativeId]
  );
  return { statusHistory: sh.rows[0].n, history: h.rows[0].n };
}

/** SCHEDULED + a current APPROVED GOVERNANCE_DECISION_MAKING decision — the real happy-path fixture. */
async function makeScheduledWithGoDecision(kind = 'sched'): Promise<string> {
  const id = nextId(kind);
  await insertInitiative({
    id,
    status: 'SCHEDULED',
    plannedStart: '2026-09-01',
    plannedEnd: '2026-12-01',
  });
  await insertDecision({
    id: `${id}--decision`,
    initiativeId: id,
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
    status: 'approved',
  });
  return id;
}

/** REVIEW + a current APPROVED GOVERNANCE_DECISION_MAKING decision — for /approve parity cases. */
async function makeReviewWithGoDecision(kind = 'review'): Promise<string> {
  const id = nextId(kind);
  await insertInitiative({ id, status: 'REVIEW' });
  await insertDecision({
    id: `${id}--decision`,
    initiativeId: id,
    pmoDomain: 'GOVERNANCE_DECISION_MAKING',
    status: 'approved',
  });
  return id;
}

async function cleanup(): Promise<void> {
  const like = `${PREFIX}%`;
  await pgQuery(`DELETE FROM decisions WHERE id LIKE $1 OR initiative_id LIKE $1`, [like]);
  await pgQuery(
    `DELETE FROM initiative_schedule_baselines WHERE id LIKE $1 OR initiative_id LIKE $1`,
    [like]
  );
  await pgQuery(`DELETE FROM initiative_milestones WHERE id LIKE $1 OR initiative_id LIKE $1`, [
    like,
  ]);
  await pgQuery(`DELETE FROM initiative_status_history WHERE initiative_id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM initiative_history WHERE initiative_id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM initiatives WHERE id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM project_members WHERE id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM projects WHERE id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM organization_members WHERE user_id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM users WHERE id LIKE $1`, [like]);
  await pgQuery(`DELETE FROM organizations WHERE id LIKE $1`, [like]);
}

beforeAll(async () => {
  await assertJwtSecretHermetic();
  await seed();
  await cleanup();
  app = await buildApp();

  await pgQuery(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1, $2, 'enterprise', 'active', 1, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO NOTHING`,
    [ORG_B, `${PREFIX} org b`]
  );
  await upsertProject(PROJECT_A, ORG_A);
  await upsertProject(PROJECT_B, ORG_B);

  // PMO actor: non-privileged system role, gate authority comes ONLY from a
  // project_members row (mirrors production RBAC, not an ADMIN god-mode bypass).
  await upsertUser(PMO_USER, { orgId: ORG_A, email: `${PMO_USER}@acceptance.local`, role: 'CONSULTANT' });
  await upsertOrgMembership(PMO_USER, ORG_A, 'MEMBER');
  await upsertProjectMember(PROJECT_A, PMO_USER, 'PMO');

  // Sponsor actor: for ACCEPT gate (REVIEW->PROMOTED).
  await upsertUser(SPONSOR_USER, {
    orgId: ORG_A,
    email: `${SPONSOR_USER}@acceptance.local`,
    role: 'CONSULTANT',
  });
  await upsertOrgMembership(SPONSOR_USER, ORG_A, 'MEMBER');
  await upsertProjectMember(PROJECT_A, SPONSOR_USER, 'PROJECT_SPONSOR');

  // No-role actor: ACTIVE org member, but deliberately NO project_members row
  // and a non-elevated system role -> zero gate authority anywhere.
  await upsertUser(NOROLE_USER, {
    orgId: ORG_A,
    email: `${NOROLE_USER}@acceptance.local`,
    role: 'CONSULTANT',
  });
  await upsertOrgMembership(NOROLE_USER, ORG_A, 'MEMBER');

  // Tenant B actor: different org entirely.
  await upsertUser(ORGB_USER, { orgId: ORG_B, email: `${ORGB_USER}@acceptance.local`, role: 'CONSULTANT' });
  await upsertOrgMembership(ORGB_USER, ORG_B, 'MEMBER');

  adminToken = mintToken(); // SEED user: users.role=ADMIN + OWNER JWT hint -> effective ADMIN
  pmoToken = mintToken({
    id: PMO_USER,
    organizationId: ORG_A,
    organization_id: ORG_A,
    role: 'team_member',
    email: `${PMO_USER}@acceptance.local`,
  });
  sponsorToken = mintToken({
    id: SPONSOR_USER,
    organizationId: ORG_A,
    organization_id: ORG_A,
    role: 'team_member',
    email: `${SPONSOR_USER}@acceptance.local`,
  });
  noroleToken = mintToken({
    id: NOROLE_USER,
    organizationId: ORG_A,
    organization_id: ORG_A,
    role: 'team_member',
    email: `${NOROLE_USER}@acceptance.local`,
  });
  orgBToken = mintToken({
    id: ORGB_USER,
    organizationId: ORG_B,
    organization_id: ORG_B,
    role: 'team_member',
    email: `${ORGB_USER}@acceptance.local`,
  });
}, 60_000);

afterAll(async () => {
  await cleanup();
}, 60_000);

describe('INI-005 — canonical SCHEDULED→EXECUTING gate (20-case matrix)', () => {
  it('1) SCHEDULED + approved GO decision + authorized PMO actor -> EXECUTING (200)', async () => {
    const id = await makeScheduledWithGoDecision();
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.newStatus).toBe('EXECUTING');
    const row = await getInitiative(id);
    expect(row?.status).toBe('EXECUTING');
  });

  it('2) DRAFT -> EXECUTING via canonical PATCH is rejected (400 INVALID_TRANSITION)', async () => {
    const id = nextId('draft');
    await insertInitiative({ id, status: 'DRAFT' });
    const res = await request(app)
      .patch(`/api/initiatives/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EXECUTING' });
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('INVALID_TRANSITION');
  });

  it('3) APPROVED (not SCHEDULED) -> EXECUTING rejected BOTH via canonical PATCH and via /start-execution (core regression proof)', async () => {
    const idPatch = nextId('approved-patch');
    await insertInitiative({ id: idPatch, status: 'APPROVED' });
    const patchRes = await request(app)
      .patch(`/api/initiatives/${idPatch}/status`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({ status: 'EXECUTING' });
    expect(patchRes.status).toBe(400);
    expect(patchRes.body.rule).toBe('INVALID_TRANSITION');

    const idStart = nextId('approved-start');
    await insertInitiative({ id: idStart, status: 'APPROVED' });
    const startRes = await request(app)
      .post(`/api/initiatives/${idStart}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    // Before the fix this returned 200 (silent APPROVED->EXECUTING bypass).
    expect(startRes.status).toBe(400);
    expect(startRes.body.rule).toBe('INVALID_TRANSITION');
  });

  it('4) SCHEDULED with NO GOVERNANCE_DECISION_MAKING decision row at all -> 400 GATE_DECISION_REQUIRED', async () => {
    const id = nextId('sched-nodecision');
    await insertInitiative({ id, status: 'SCHEDULED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('GATE_DECISION_REQUIRED');
  });

  it('5) SCHEDULED with a NO-GO/rejected decision (most recent row) -> 400 GATE_DECISION_REQUIRED', async () => {
    const id = nextId('sched-nogo');
    await insertInitiative({ id, status: 'SCHEDULED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    await insertDecision({
      id: `${id}--decision`,
      initiativeId: id,
      pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      status: 'rejected',
    });
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('GATE_DECISION_REQUIRED');
  });

  it('6) SCHEDULED: OLD approved decision superseded by a NEWER non-approved decision -> 400 (decision-currency fix — the critical case)', async () => {
    const id = nextId('sched-superseded');
    await insertInitiative({ id, status: 'SCHEDULED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    const older = new Date(Date.now() - 2 * 86400000).toISOString();
    const newer = new Date(Date.now() - 1 * 86400000).toISOString();
    // Older row: APPROVED, decided_at set (older).
    await insertDecision({
      id: `${id}--old`,
      initiativeId: id,
      pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      status: 'approved',
      decidedAt: older,
      createdAt: older,
    });
    // Newer row: still pending (no decided_at) but created MORE recently ->
    // COALESCE(decided_at, created_at) makes it sort first. Without the fix
    // (the old `.some()` over ALL rows), the stale APPROVED row would
    // incorrectly keep satisfying the gate and this would return 200.
    await insertDecision({
      id: `${id}--new`,
      initiativeId: id,
      pmoDomain: 'GOVERNANCE_DECISION_MAKING',
      status: 'pending',
      decidedAt: null,
      createdAt: newer,
    });
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.rule).toBe('GATE_DECISION_REQUIRED');
  });

  it('7) SCHEDULED + valid GO decision but actor lacks PMO/ADMIN role -> 403', async () => {
    const id = await makeScheduledWithGoDecision('sched-norole');
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${noroleToken}`)
      .send({});
    expect(res.status).toBe(403);
    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED');
  });

  it('8) Tenant B token cannot start tenant A initiative (404 — org-scoped SELECT hides it)', async () => {
    const id = await makeScheduledWithGoDecision('sched-tenantA');
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${orgBToken}`)
      .send({});
    expect(res.status).toBe(404);
    const row = await getInitiative(id);
    expect(row?.status).toBe('SCHEDULED'); // untouched
  });

  it('9) forged organizationId body field / x-organization-id header cannot redirect the transition to a different org', async () => {
    const id = await makeScheduledWithGoDecision('sched-forged-org');
    // PMO_USER only has an ACTIVE membership in ORG_A, so the x-organization-id
    // header for ORG_B is never confirmed by auth.middleware and the request
    // stays bound to ORG_A. The controller itself never reads req.body.organizationId
    // (grep-confirmed — orgId is always req.user?.organizationId). This call
    // must therefore transition ORG_A's OWN initiative, never a phantom ORG_B one.
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .set('x-organization-id', ORG_B)
      .send({ organizationId: ORG_B });
    expect(res.status).toBe(200);
    const row = await getInitiative(id);
    expect(row?.organization_id).toBe(ORG_A);
    expect(row?.status).toBe('EXECUTING');
  });

  it('10) successful transition: initiatives.status changes + exactly ONE status_history row + ONE history row, matching from/to/actor', async () => {
    const id = await makeScheduledWithGoDecision('sched-audit-ok');
    const before = await countHistory(id);
    expect(before).toEqual({ statusHistory: 0, history: 0 });

    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(200);

    const after = await countHistory(id);
    expect(after).toEqual({ statusHistory: 1, history: 1 });

    const shRow = (
      await pgQuery(`SELECT * FROM initiative_status_history WHERE initiative_id = $1`, [id])
    ).rows[0];
    expect(shRow.from_status).toBe('SCHEDULED');
    expect(shRow.to_status).toBe('EXECUTING');
    expect(shRow.changed_by).toBe(PMO_USER);

    const hRow = (
      await pgQuery(`SELECT * FROM initiative_history WHERE initiative_id = $1`, [id])
    ).rows[0];
    expect(hRow.changed_by).toBe(PMO_USER);
    expect(hRow.action).toBe('status_changed');
  });

  it('11) failed transition (400 GATE_DECISION_REQUIRED) writes ZERO new history rows', async () => {
    const id = nextId('sched-audit-fail');
    await insertInitiative({ id, status: 'SCHEDULED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(400);
    const after = await countHistory(id);
    expect(after).toEqual({ statusHistory: 0, history: 0 });
  });

  it('12) same successful request fired twice sequentially: 1st 200, 2nd sees new status -> 400 INVALID_TRANSITION; exactly ONE history row total', async () => {
    const id = await makeScheduledWithGoDecision('sched-idempotent');
    const first = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(second.status).toBe(400);
    expect(second.body.rule).toBe('INVALID_TRANSITION');

    const after = await countHistory(id);
    expect(after).toEqual({ statusHistory: 1, history: 1 });
  });

  it('13) two concurrent requests on the SAME fixture: exactly one succeeds (200), the other gets a deterministic 400 INVALID_TRANSITION; exactly ONE history row (row-lock concurrency proof — run for real, no assumptions)', async () => {
    const id = await makeScheduledWithGoDecision('sched-concurrent');
    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/initiatives/${id}/start-execution`)
        .set('Authorization', `Bearer ${pmoToken}`)
        .send({}),
      request(app)
        .post(`/api/initiatives/${id}/start-execution`)
        .set('Authorization', `Bearer ${pmoToken}`)
        .send({}),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 400]);
    const loser = r1.status === 400 ? r1 : r2;
    expect(loser.body.rule).toBe('INVALID_TRANSITION');

    const row = await getInitiative(id);
    expect(row?.status).toBe('EXECUTING');

    const after = await countHistory(id);
    expect(after).toEqual({ statusHistory: 1, history: 1 });
  });

  it('14) after successful transition, GET execution summary sees the same initiative id (executingCount +1)', async () => {
    const baseline = await request(app)
      .get(`/api/execution/${PROJECT_A}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(baseline.status).toBe(200);
    const before = baseline.body.executingCount;

    const id = await makeScheduledWithGoDecision('sched-summary');
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(200);

    const after = await request(app)
      .get(`/api/execution/${PROJECT_A}/summary`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(after.status).toBe(200);
    expect(after.body.projectId).toBe(PROJECT_A);
    expect(after.body.executingCount).toBe(before + 1);
  });

  it('15) direct /start-execution and /approve calls on illegal states are rejected, matching the equivalent canonical PATCH call on an identical fixture (bypass-closed proof)', async () => {
    // start-execution: APPROVED (not SCHEDULED)
    const idPatchA = nextId('bypass-start-patch');
    await insertInitiative({ id: idPatchA, status: 'APPROVED' });
    const idDirectA = nextId('bypass-start-direct');
    await insertInitiative({ id: idDirectA, status: 'APPROVED' });
    const patchA = await request(app)
      .patch(`/api/initiatives/${idPatchA}/status`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({ status: 'EXECUTING' });
    const directA = await request(app)
      .post(`/api/initiatives/${idDirectA}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(patchA.status).toBe(400);
    expect(directA.status).toBe(400);
    expect(patchA.body.rule).toBe(directA.body.rule);

    // approve: DRAFT (not REVIEW) — /approve always targets PROMOTED internally.
    const idPatchB = nextId('bypass-approve-patch');
    await insertInitiative({ id: idPatchB, status: 'DRAFT' });
    const idDirectB = nextId('bypass-approve-direct');
    await insertInitiative({ id: idDirectB, status: 'DRAFT' });
    const patchB = await request(app)
      .patch(`/api/initiatives/${idPatchB}/status`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({ status: 'PROMOTED' });
    const directB = await request(app)
      .post(`/api/initiatives/${idDirectB}/approve`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({});
    expect(patchB.status).toBe(400);
    expect(directB.status).toBe(400);
    expect(patchB.body.rule).toBe('INVALID_TRANSITION');
    expect(directB.body.rule).toBe('INVALID_TRANSITION');
  });

  it('16) /approve and PATCH {status:PROMOTED} on equivalent REVIEW+GO-decision fixtures produce the same resulting status and the same audit-row shape (legacy-adapter parity)', async () => {
    const idApprove = await makeReviewWithGoDecision('review-approve');
    const idPatch = await makeReviewWithGoDecision('review-patch');

    const approveRes = await request(app)
      .post(`/api/initiatives/${idApprove}/approve`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({});
    const patchRes = await request(app)
      .patch(`/api/initiatives/${idPatch}/status`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({ status: 'PROMOTED' });

    expect(approveRes.status).toBe(200);
    expect(patchRes.status).toBe(200);

    const rowApprove = await getInitiative(idApprove);
    const rowPatch = await getInitiative(idPatch);
    expect(rowApprove?.status).toBe('PROMOTED');
    expect(rowPatch?.status).toBe('PROMOTED');

    const histApprove = await countHistory(idApprove);
    const histPatch = await countHistory(idPatch);
    expect(histApprove).toEqual({ statusHistory: 1, history: 1 });
    expect(histPatch).toEqual({ statusHistory: 1, history: 1 });

    // Role-required parity: same actor requirement enforced identically.
    const idApprove2 = await makeReviewWithGoDecision('review-approve-norole');
    const idPatch2 = await makeReviewWithGoDecision('review-patch-norole');
    const approveNoRole = await request(app)
      .post(`/api/initiatives/${idApprove2}/approve`)
      .set('Authorization', `Bearer ${noroleToken}`)
      .send({});
    const patchNoRole = await request(app)
      .patch(`/api/initiatives/${idPatch2}/status`)
      .set('Authorization', `Bearer ${noroleToken}`)
      .send({ status: 'PROMOTED' });
    expect(approveNoRole.status).toBe(403);
    expect(patchNoRole.status).toBe(403);

    // Decision-required parity: same GO/NO-GO requirement enforced identically.
    const idApprove3 = nextId('review-approve-nodecision');
    await insertInitiative({ id: idApprove3, status: 'REVIEW' });
    const idPatch3 = nextId('review-patch-nodecision');
    await insertInitiative({ id: idPatch3, status: 'REVIEW' });
    const approveNoDecision = await request(app)
      .post(`/api/initiatives/${idApprove3}/approve`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({});
    const patchNoDecision = await request(app)
      .patch(`/api/initiatives/${idPatch3}/status`)
      .set('Authorization', `Bearer ${sponsorToken}`)
      .send({ status: 'PROMOTED' });
    expect(approveNoDecision.status).toBe(400);
    expect(patchNoDecision.status).toBe(400);
    expect(approveNoDecision.body.rule).toBe('GATE_DECISION_REQUIRED');
    expect(patchNoDecision.body.rule).toBe('GATE_DECISION_REQUIRED');
  });

  it('17) after any transition (success or failure), GET /api/initiatives/:id read-back matches Postgres exactly', async () => {
    const id = await makeScheduledWithGoDecision('sched-readback-ok');
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(res.status).toBe(200);
    const dbRow = await getInitiative(id);
    const getRes = await request(app)
      .get(`/api/initiatives/${id}`)
      .set('Authorization', `Bearer ${pmoToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(dbRow?.id);
    expect(getRes.body.status).toBe(dbRow?.status);
    expect(dbRow?.status).toBe('EXECUTING');

    const failId = nextId('sched-readback-fail');
    await insertInitiative({ id: failId, status: 'SCHEDULED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    const failRes = await request(app)
      .post(`/api/initiatives/${failId}/start-execution`)
      .set('Authorization', `Bearer ${pmoToken}`)
      .send({});
    expect(failRes.status).toBe(400);
    const dbFailRow = await getInitiative(failId);
    const getFailRes = await request(app)
      .get(`/api/initiatives/${failId}`)
      .set('Authorization', `Bearer ${pmoToken}`);
    expect(getFailRes.body.status).toBe(dbFailRow?.status);
    expect(dbFailRow?.status).toBe('SCHEDULED');
  });

  it('18) a real DB-level constraint failure inside the transaction does NOT produce a false-success response (rollback proof)', async () => {
    const id = nextId('approved-baseline-collision');
    await insertInitiative({ id, status: 'APPROVED', plannedStart: '2026-09-01', plannedEnd: '2026-12-01' });
    await insertDecision({
      id: `${id}--decision`,
      initiativeId: id,
      pmoDomain: 'SCHEDULE_MILESTONES',
      status: 'approved',
    });
    await insertMilestone({ id: `${id}--milestone`, initiativeId: id });
    // The fixture starts at baseline_version=0, so executeInitiativeTransition
    // will compute baselineVersion=1 and try to INSERT that row. Pre-insert a
    // COLLIDING (initiative_id, version=1) row so that real INSERT hits the
    // live UNIQUE constraint (idx_ini_schedule_baselines_unique) and throws —
    // a genuine Postgres failure, not a code-injected one.
    await pgQuery(
      `INSERT INTO initiative_schedule_baselines (id, organization_id, initiative_id, version, snapshot, created_at)
       VALUES ($1, $2, $3, 1, '{}', CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [`${id}--baseline-collision`, ORG_A, id]
    );

    const before = await countHistory(id);
    const res = await request(app)
      .patch(`/api/initiatives/${id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'SCHEDULED' });

    // No outer try/catch in executeInitiativeTransition on purpose (see its
    // doc comment) — the UNIQUE violation propagates to asyncHandler -> our
    // error middleware -> a coded 5xx. The one thing that must NEVER happen
    // is a 200 here.
    expect(res.status).toBeGreaterThanOrEqual(500);

    const row = await getInitiative(id);
    expect(row?.status).toBe('APPROVED'); // unchanged — the whole transaction rolled back
    const after = await countHistory(id);
    expect(after).toEqual(before); // no partial audit rows either
    expect(after).toEqual({ statusHistory: 0, history: 0 });
  });

  it('19) PATCH .../status, /start-execution and /approve on a nonexistent id -> honest 404', async () => {
    const fakeId = `${PREFIX}does-not-exist`;
    const patchRes = await request(app)
      .patch(`/api/initiatives/${fakeId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'EXECUTING' });
    expect(patchRes.status).toBe(404);

    const startRes = await request(app)
      .post(`/api/initiatives/${fakeId}/start-execution`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(startRes.status).toBe(404);

    const approveRes = await request(app)
      .post(`/api/initiatives/${fakeId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(approveRes.status).toBe(404);
  });

  it('20) actor with no role/capability produces ZERO audit rows (distinct fixture, pairs with case 11)', async () => {
    const id = await makeScheduledWithGoDecision('sched-norole-audit');
    const before = await countHistory(id);
    const res = await request(app)
      .post(`/api/initiatives/${id}/start-execution`)
      .set('Authorization', `Bearer ${noroleToken}`)
      .send({});
    expect(res.status).toBe(403);
    const after = await countHistory(id);
    expect(after).toEqual(before);
    expect(after).toEqual({ statusHistory: 0, history: 0 });
  });
});
