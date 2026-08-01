/**
 * MW-005/MW-006 — Real decision-creation acceptance suite.
 *
 * REAL-runtime E2E: local Postgres (schema already applied) + the REAL
 * `pmo/decisions.routes.ts` router mounted at /api/decisions behind the REAL
 * verifyToken/requireOrgAccess middleware chain + the REAL DecisionController
 * (`createDecision` / `getDecisionDetail`). No mocks of the router,
 * controller, or service under test.
 *
 * This suite proves, against a real Postgres container (never a mock — see
 * the harness-guard proof this file mirrors from mw-dec-001), that:
 *   1) an org-A ADMIN's POST /api/decisions genuinely lands a row (201 +
 *      raw-SQL-verified), and that same server-generated id round-trips
 *      through a LATER, independent GET /:id/detail call;
 *   2) a caller without `approve_changes` is fail-closed at 403, and no row
 *      is created under the bypass attempt;
 *   3) tenant B cannot read tenant A's decision by id (404, not a leak);
 *   4) tenant B cannot forge a decision against tenant A's real projectId
 *      (assertRelatedObjectsBelongToOrg rejects it with 400, nothing
 *      persists);
 *   5) a create call with no projectId/initiativeId/taskId is honestly
 *      refused with 400 ("Missing decision context"), never a 500.
 *
 * Fixtures use the reversible `mwlive--` prefix (distinct from `mwdec--`
 * used by tests/acceptance/mw-dec-001-decision-workflow.e2e.test.ts so the
 * two suites never collide on the shared local Postgres) and are removed in
 * afterAll.
 *
 * Harness conventions mirrored exactly from mw-dec-001-decision-workflow.e2e
 * .test.ts (read-only reference, not modified by this file): real orgs, real
 * users with real membership rows, real signed JWTs minted per-actor, a real
 * Express app mounting the REAL decisions router, raw `pg.Client` used for
 * independent DB verification alongside the HTTP assertions.
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Must be imported before './harness.js' — see that module's doc comment
// for the full root-cause writeup (harness vs Config JWT_SECRET fallback
// divergence). Mirrors mw-dec-001-decision-workflow.e2e.test.ts exactly.
import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = 'mwlive--';

// ── Tenants ──────────────────────────────────────────────────────────────
const ORG_A = `${P}org-A`;
const ORG_B = `${P}org-B`;

const USER_ADMIN_A = `${P}user-admin-A`; // role ADMIN in org A — HAS approve_changes
const EMAIL_ADMIN_A = `${P}admin-a@acceptance.local`;

const USER_MEMBER_A = `${P}user-member-A`; // role TEAM_MEMBER in org A — does NOT have approve_changes
const EMAIL_MEMBER_A = `${P}member-a@acceptance.local`;

const USER_ADMIN_B = `${P}user-admin-B`; // role ADMIN in org B — HAS approve_changes in its OWN org
const EMAIL_ADMIN_B = `${P}admin-b@acceptance.local`;

// ── Seeded parent object (assertRelatedObjectsBelongToOrg requires a real
// row in `projects` owned by the caller's own organization_id) ────────────
const PROJECT_A = `${P}project-A`;

// Captured across tests for cross-case use + cleanup.
let createdDecisionIdCase1: string | undefined;
let crossFkDecisionId: string | undefined; // would only be set if case 4 ever regresses to 201

function mintTokenFor(userId: string, orgId: string, email: string, role: string): string {
  return jwt.sign(
    {
      id: userId,
      email,
      organizationId: orgId,
      organization_id: orgId,
      role,
    },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function seedTenant(
  c: pg.Client,
  orgId: string,
  userId: string,
  email: string,
  role: string
): Promise<void> {
  const now = new Date().toISOString();
  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `MW-005-006 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x',$4,'active','MwLive','Test',$5) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, role, now]
  );
  // organization_members.role has a narrower CHECK constraint than users.role
  // (organization_members_role_check: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST —
  // no TEAM_MEMBER). The JWT/users.role claim is what actually drives
  // authorization via req.can() as long as the membership row is ACTIVE for
  // the token's org, so map only for this column (mirrors mw-dec-001).
  const membershipRole = role === 'TEAM_MEMBER' ? 'MEMBER' : role;
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $5,$1,$2,$3,'ACTIVE',$4
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, membershipRole, now, `${P}mem-${userId}`]
  );
}

function buildApp(decisionsRouter: express.Router): Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // The router applies its OWN verifyToken + requireOrgAccess internally
  // (pmo/decisions.routes.ts lines 39-40), mirroring the real Gateway mount
  // at app.use('/api/decisions', decisionsRoutes).
  app.use('/api/decisions', decisionsRouter);
  return app;
}

describe('MW-005/MW-006 — Real decision creation (real Postgres, real router)', () => {
  let client: pg.Client;
  let app: Express;
  let tokenAdminA: string;
  let tokenMemberA: string;
  let tokenAdminB: string;

  beforeAll(async () => {
    await assertJwtSecretHermetic();
    requireLocalDbUrl();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await seedTenant(client, ORG_A, USER_ADMIN_A, EMAIL_ADMIN_A, 'ADMIN');
    await seedTenant(client, ORG_A, USER_MEMBER_A, EMAIL_MEMBER_A, 'TEAM_MEMBER');
    await seedTenant(client, ORG_B, USER_ADMIN_B, EMAIL_ADMIN_B, 'ADMIN');

    // Real seeded project in org A — the minimal parent object
    // assertRelatedObjectsBelongToOrg requires for a valid projectId.
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at)
       VALUES ($1,$2,'MW-005-006 Org A Project','active',NOW()) ON CONFLICT (id) DO NOTHING`,
      [PROJECT_A, ORG_A]
    );

    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';

    const decisionsRouter = (await import('../../server/src/routes/pmo/decisions.routes.js'))
      .default;
    app = buildApp(decisionsRouter as unknown as express.Router);

    tokenAdminA = mintTokenFor(USER_ADMIN_A, ORG_A, EMAIL_ADMIN_A, 'ADMIN');
    tokenMemberA = mintTokenFor(USER_MEMBER_A, ORG_A, EMAIL_MEMBER_A, 'TEAM_MEMBER');
    tokenAdminB = mintTokenFor(USER_ADMIN_B, ORG_B, EMAIL_ADMIN_B, 'ADMIN');
  });

  afterAll(async () => {
    if (!client) return;
    if (createdDecisionIdCase1) {
      await client.query(`DELETE FROM decisions WHERE id = $1`, [createdDecisionIdCase1]);
    }
    if (crossFkDecisionId) {
      await client.query(`DELETE FROM decisions WHERE id = $1`, [crossFkDecisionId]);
    }
    // decision_history/decision_impacts FK decision_id REFERENCES
    // decisions(id) ON DELETE CASCADE — deleting parent decisions rows
    // cascades their cleanup automatically. This LIKE-prefix delete is a
    // belt-and-braces sweep in case any decision id was created without
    // being captured above (e.g. a case-2/5 bypass that unexpectedly
    // succeeded).
    await client.query(
      `DELETE FROM decisions WHERE organization_id IN ($1,$2) OR title LIKE $3`,
      [ORG_A, ORG_B, `${P}%`]
    );
    await client.query(`DELETE FROM projects WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organization_members WHERE user_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
    await client.end();
  });

  // ═══════════════════════════ CASE 1 ═══════════════════════════
  it('case 1: ADMIN in org A creates a decision -> 201, real id, reopens via GET /:id/detail with the SAME id, raw SQL confirms the row', async () => {
    const createRes = await request(app)
      .post('/api/decisions')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ projectId: PROJECT_A, title: `${P}Decision title` });

    expect(createRes.status).toBe(201);
    expect(typeof createRes.body.id).toBe('string');
    // UUID shape.
    expect(createRes.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(createRes.body.status).toBe('PENDING');
    expect(createRes.body.title).toBe(`${P}Decision title`);
    expect(createRes.body.projectId).toBe(PROJECT_A);

    createdDecisionIdCase1 = createRes.body.id;

    // Independent raw SQL confirmation — do not trust only the HTTP echo.
    const row = await client.query(
      `SELECT id, organization_id, created_by, title, status, project_id FROM decisions WHERE id = $1`,
      [createdDecisionIdCase1]
    );
    expect(row.rowCount).toBe(1);
    expect(row.rows[0].organization_id).toBe(ORG_A);
    expect(row.rows[0].created_by).toBe(USER_ADMIN_A);
    expect(row.rows[0].title).toBe(`${P}Decision title`);
    expect(row.rows[0].status).toBe('pending');
    expect(row.rows[0].project_id).toBe(PROJECT_A);

    // Reopen with the SAME id via a SEPARATE, later request — proves
    // server-side round-trip, not client-side fabrication.
    const detailRes = await request(app)
      .get(`/api/decisions/${createdDecisionIdCase1}/detail`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(createdDecisionIdCase1);
    expect(detailRes.body.title).toBe(`${P}Decision title`);
    expect(detailRes.body.status).toBe('PENDING');
  });

  // ═══════════════════════════ CASE 2 ═══════════════════════════
  it('case 2: fail-closed capability check — TEAM_MEMBER (no approve_changes) gets 403, no row created', async () => {
    const title = `${P}should-not-exist-member-attempt`;

    const beforeCount = await client.query(`SELECT COUNT(*)::int AS c FROM decisions WHERE title = $1`, [
      title,
    ]);
    expect(beforeCount.rows[0].c).toBe(0);

    const res = await request(app)
      .post('/api/decisions')
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .send({ projectId: PROJECT_A, title });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(201);

    const afterCount = await client.query(`SELECT COUNT(*)::int AS c FROM decisions WHERE title = $1`, [
      title,
    ]);
    expect(afterCount.rows[0].c).toBe(0);
  });

  // ═══════════════════════════ CASE 3 ═══════════════════════════
  it('case 3: tenant isolation on read — org B cannot GET org A decision by id -> 404, no leak', async () => {
    expect(createdDecisionIdCase1).toBeTruthy();

    const res = await request(app)
      .get(`/api/decisions/${createdDecisionIdCase1}/detail`)
      .set('Authorization', `Bearer ${tokenAdminB}`);

    expect(res.status).toBe(404);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(`${P}Decision title`);
    expect(res.body.status).not.toBe(200);
  });

  // ═══════════════════════════ CASE 4 ═══════════════════════════
  it('case 4: tenant isolation on create — org B ADMIN cannot forge a decision against org A\'s real projectId -> 400, nothing persists', async () => {
    const title = `${P}cross-tenant-forgery-attempt`;

    const res = await request(app)
      .post('/api/decisions')
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ projectId: PROJECT_A, title }); // PROJECT_A belongs to ORG_A, caller is ORG_B

    if (res.status === 201) {
      // Should never happen given assertRelatedObjectsBelongToOrg — but if
      // it does, capture and report, do not silently swallow the finding.
      crossFkDecisionId = res.body.id;
    }

    expect(res.status).toBe(400);
    expect(res.body.field).toBe('projectId');

    const row = await client.query(`SELECT COUNT(*)::int AS c FROM decisions WHERE title = $1`, [
      title,
    ]);
    expect(row.rows[0].c).toBe(0);

    // Independently confirm no decision anywhere references the foreign
    // projectId as a NEW row created by this call (PROJECT_A's only linked
    // decision should still be exactly the one from case 1, org A).
    const linked = await client.query(
      `SELECT organization_id FROM decisions WHERE project_id = $1`,
      [PROJECT_A]
    );
    for (const r of linked.rows) {
      expect(r.organization_id).toBe(ORG_A);
    }
  });

  // ═══════════════════════════ CASE 5 ═══════════════════════════
  it('case 5: missing decision context — org A ADMIN with no projectId/initiativeId/taskId -> honest 400, never 500', async () => {
    const title = `${P}no-context-attempt`;

    const res = await request(app)
      .post('/api/decisions')
      .set('Authorization', `Bearer ${tokenAdminA}`)
      .send({ title });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Missing decision context');

    const row = await client.query(`SELECT COUNT(*)::int AS c FROM decisions WHERE title = $1`, [
      title,
    ]);
    expect(row.rows[0].c).toBe(0);
  });

  // ═══════════════════════════ HARNESS SAFETY PROOF ═══════════════════════════
  it('harness guard: a non-local DATABASE_URL is refused loudly, never silently skipped', () => {
    const original = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL = 'postgres://user:pass@trolley.proxy.rlwy.net:28146/railway';
      expect(() => requireLocalDbUrl()).toThrow(/LOCAL DATABASE_URL/);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });
});
