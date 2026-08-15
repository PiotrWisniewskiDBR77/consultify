/**
 * MW-DEC-001 — independent final-falsification-reviewer probes.
 *
 * Deliberately separate from mw-dec-001-decision-workflow.e2e.test.ts (own
 * tenant prefix `zzfals--`, own fixtures, own fresh pg.Client per assertion
 * where the point is to prove persistence independent of any connection the
 * app or the main suite already opened) — this suite exists to try to BREAK
 * the claims in the main suite, not to re-confirm them with the same
 * fixtures. It caught two real, severe defects the main suite's fixtures
 * didn't exercise: `GET /api/decisions` (T1a/T1b) and the decide()
 * post-commit block-refresh cascade (see the comment above
 * refreshTaskDecisionBlock in DecisionController.ts) 500'd/silently-failed
 * on every real-Postgres call because of a genuine cross-migration type
 * conflict on `decision_impacts.is_blocker` (INTEGER via 292/297 vs BOOLEAN
 * via 728, same `CREATE TABLE IF NOT EXISTS`) compounded by
 * PostgresDatabase.ts's auto-generated ALWAYS_BOOLEAN_COLUMNS list
 * unconditionally rewriting `is_blocker = 1` back to `is_blocker = TRUE`.
 * Fixed with an `::text IN ('1','true')` predicate, immune to that rewriter
 * and correct against either underlying column type — see DecisionController.ts.
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// See tests/acceptance/sharedAcceptanceJwtSecret.ts for the full root-cause
// writeup — added during the Decision+Initiative/Execution integration round
// (2026-08-01); see the identical note in mw-dec-001-decision-workflow.e2e.test.ts.
import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = 'zzfals--';
const ORG_A = `${P}org-A`;
const ORG_B = `${P}org-B`;
const USER_A = `${P}user-A`;
const USER_A_MEMBER = `${P}user-A-member`;
const USER_B = `${P}user-B`;
const EMAIL_A = `${P}a@acceptance.local`;
const EMAIL_A_MEMBER = `${P}a-member@acceptance.local`;
const EMAIL_B = `${P}b@acceptance.local`;

const DEC_A1 = `${P}dec-a1`;
const DEC_A2 = `${P}dec-a2`;
const DEC_RACE = `${P}dec-race`;
const DEC_REFRESH = `${P}dec-refresh`;

let client: pg.Client;
let app: Express;
let tokenA: string;
let tokenAMember: string;
let tokenB: string;

function mintTokenFor(userId: string, orgId: string, email: string, role: string): string {
  return jwt.sign(
    { id: userId, email, organizationId: orgId, organization_id: orgId, role },
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
    [orgId, `ZZ-FALSIFY ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x',$4,'active','Falsify','Test',$5) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, role, now]
  );
  const membershipRole = role === 'TEAM_MEMBER' ? 'MEMBER' : role;
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $5,$1,$2,$3,'ACTIVE',$4
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, membershipRole, now, `${P}mem-${userId}`]
  );
}

async function insertDecision(
  c: pg.Client,
  opts: { id: string; orgId: string; title: string; decisionMakerId: string; createdBy: string; status?: string }
): Promise<void> {
  await c.query(
    `INSERT INTO decisions
       (id, organization_id, title, description, type, decision_maker_id, status, created_by,
        priority, impact, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'GENERAL',$5,$6,$7,'MEDIUM','MEDIUM',NOW(),NOW())
     ON CONFLICT (id) DO NOTHING`,
    [opts.id, opts.orgId, opts.title, `${opts.title} — desc`, opts.decisionMakerId, opts.status || 'pending', opts.createdBy]
  );
}

function buildApp(decisionsRouter: express.Router): Express {
  const a = express();
  a.use(express.json({ limit: '5mb' }));
  a.use('/api/decisions', decisionsRouter);
  return a;
}

describe('ZZ-FALSIFY — independent adversarial probes on MW-DEC-001', () => {
  beforeAll(async () => {
    await assertJwtSecretHermetic();
    requireLocalDbUrl();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await seedTenant(client, ORG_A, USER_A, EMAIL_A, 'ADMIN');
    await seedTenant(client, ORG_A, USER_A_MEMBER, EMAIL_A_MEMBER, 'TEAM_MEMBER');
    await seedTenant(client, ORG_B, USER_B, EMAIL_B, 'ADMIN');

    await insertDecision(client, { id: DEC_A1, orgId: ORG_A, title: 'ZZ FALSIFY A1', decisionMakerId: USER_A, createdBy: USER_A });
    await insertDecision(client, { id: DEC_A2, orgId: ORG_A, title: 'ZZ FALSIFY A2', decisionMakerId: USER_A, createdBy: USER_A });
    await insertDecision(client, { id: DEC_RACE, orgId: ORG_A, title: 'ZZ FALSIFY RACE', decisionMakerId: USER_A, createdBy: USER_A });
    await insertDecision(client, { id: DEC_REFRESH, orgId: ORG_A, title: 'ZZ FALSIFY REFRESH', decisionMakerId: USER_A, createdBy: USER_A });

    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';
    const decisionsRouter = (await import('../../server/src/routes/pmo/decisions.routes.js')).default;
    app = buildApp(decisionsRouter as unknown as express.Router);

    tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A, 'ADMIN');
    tokenAMember = mintTokenFor(USER_A_MEMBER, ORG_A, EMAIL_A_MEMBER, 'TEAM_MEMBER');
    tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B, 'ADMIN');
  });

  afterAll(async () => {
    await client.query(`DELETE FROM decision_history WHERE decision_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM decision_comments WHERE decision_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM decision_alternatives WHERE decision_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM decision_risks WHERE decision_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM decisions WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organization_members WHERE organization_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
    await client.end();
  });

  // ── TARGET 1: tenancy — list endpoint enumeration ──────────────────────
  it('T1a: GET /api/decisions (list) as org B does not leak org A titles/ids', async () => {
    const res = await request(app).get('/api/decisions').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(DEC_A1);
    expect(raw).not.toContain('ZZ FALSIFY A1');
  });

  it('T1b: GET /api/decisions?relatedObjectId=<org-A-id> as org B returns nothing from org A', async () => {
    const res = await request(app)
      .get(`/api/decisions?relatedObjectId=${DEC_A1}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('ZZ FALSIFY A1');
  });

  it('T1c: GET /api/decisions/bottlenecks as org B does not include org A decisions', async () => {
    const res = await request(app).get('/api/decisions/bottlenecks').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('ZZ FALSIFY A1');
  });

  // ── TARGET 2: authorization — verb-alias / param-pollution on decide ───
  it('T2a: PUT /:id/decide (the documented alias) enforces the SAME inline ownership check as PATCH', async () => {
    // Org A member (not owner, not admin) tries the PUT alias directly.
    const res = await request(app)
      .put(`/api/decisions/${DEC_A2}/decide`)
      .set('Authorization', `Bearer ${tokenAMember}`)
      .send({ status: 'APPROVED', rationale: 'member trying PUT alias' });
    expect(res.status).toBe(403);
    const row = await client.query(`SELECT status FROM decisions WHERE id=$1`, [DEC_A2]);
    expect(row.rows[0].status).toBe('pending');
  });

  it('T2b: decisionId param pollution (array) on decide does not bypass ownership/tenant checks', async () => {
    // supertest / express: sending id[]=... in query string alongside route param is not directly
    // possible since :id comes from the path, but try a duplicated path segment / trailing slash trick.
    const res = await request(app)
      .patch(`/api/decisions/${DEC_A2}/decide/`) // trailing slash
      .set('Authorization', `Bearer ${tokenAMember}`)
      .send({ status: 'APPROVED', rationale: 'trailing slash trick' });
    // Either 403 (still routed & still checked) or 404 (route didn't match) — never 200.
    expect(res.status).not.toBe(200);
  });

  it('T2c: cross-tenant decide via known id (org B actor, org A decision) -> 404, not 403 (no existence leak), no mutation', async () => {
    const res = await request(app)
      .patch(`/api/decisions/${DEC_A2}/decide`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'APPROVED', rationale: 'org B trying to decide org A decision' });
    expect(res.status).toBe(404);
    const row = await client.query(`SELECT status FROM decisions WHERE id=$1`, [DEC_A2]);
    expect(row.rows[0].status).toBe('pending');
  });

  // ── TARGET 3: persistence via a FRESH pg.Client (not the test's own) ───
  it('T3: comment/alternative/risk/approve all independently verifiable via a brand-new pg connection', async () => {
    const commentRes = await request(app)
      .post(`/api/decisions/${DEC_A1}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'ZZ-FALSIFY persistence comment' });
    expect(commentRes.status).toBe(201);

    const altRes = await request(app)
      .post(`/api/decisions/${DEC_A1}/alternatives`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'ZZ-FALSIFY persistence alt' });
    expect(altRes.status).toBe(201);

    const riskRes = await request(app)
      .post(`/api/decisions/${DEC_A1}/risks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ description: 'ZZ-FALSIFY persistence risk' });
    expect(riskRes.status).toBe(201);

    const decideRes = await request(app)
      .patch(`/api/decisions/${DEC_A1}/decide`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'APPROVED', rationale: 'ZZ-FALSIFY persistence approve' });
    expect(decideRes.status).toBe(200);

    // Brand-new connection, never used by the app or the test's own `client`.
    const freshClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await freshClient.connect();
    try {
      const c = await freshClient.query(`SELECT body FROM decision_comments WHERE id=$1`, [commentRes.body.id]);
      expect(c.rows[0]?.body).toBe('ZZ-FALSIFY persistence comment');

      const a = await freshClient.query(`SELECT title FROM decision_alternatives WHERE id=$1`, [altRes.body.id]);
      expect(a.rows[0]?.title).toBe('ZZ-FALSIFY persistence alt');

      const r = await freshClient.query(`SELECT description FROM decision_risks WHERE id=$1`, [riskRes.body.id]);
      expect(r.rows[0]?.description).toBe('ZZ-FALSIFY persistence risk');

      const d = await freshClient.query(
        `SELECT status, decision_rationale, decided_by, decided_at FROM decisions WHERE id=$1`,
        [DEC_A1]
      );
      expect(d.rows[0]?.status).toBe('approved');
      expect(d.rows[0]?.decision_rationale).toBe('ZZ-FALSIFY persistence approve');
      expect(d.rows[0]?.decided_by).toBe(USER_A);
      expect(d.rows[0]?.decided_at).toBeTruthy();

      const h = await freshClient.query(
        `SELECT count(*)::int AS n FROM decision_history WHERE decision_id=$1 AND new_status='approved'`,
        [DEC_A1]
      );
      expect(h.rows[0].n).toBeGreaterThanOrEqual(1);
    } finally {
      await freshClient.end();
    }
  });

  // ── TARGET 5: concurrency — own race, fresh decision ────────────────────
  it('T5: two simultaneous decide() calls on a fresh decision -> exactly one 200, one non-200, exactly one decision_history row', async () => {
    const [r1, r2] = await Promise.all([
      request(app)
        .patch(`/api/decisions/${DEC_RACE}/decide`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'APPROVED', rationale: 'race winner attempt A' }),
      request(app)
        .patch(`/api/decisions/${DEC_RACE}/decide`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'REJECTED', rationale: 'race winner attempt B' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).not.toBe(200);

    const freshClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await freshClient.connect();
    try {
      const h = await freshClient.query(
        `SELECT count(*)::int AS n FROM decision_history WHERE decision_id=$1`,
        [DEC_RACE]
      );
      expect(h.rows[0].n).toBe(1);
      const d = await freshClient.query(`SELECT status FROM decisions WHERE id=$1`, [DEC_RACE]);
      expect(['approved', 'rejected']).toContain(d.rows[0].status);
    } finally {
      await freshClient.end();
    }
  });

  // ── TARGET 7: refresh under interleaved write ───────────────────────────
  it('T7: GET /detail, POST comment, GET /detail again from a fresh agent -> comment appears exactly once, no torn read on interleave', async () => {
    const get1 = await request(app)
      .get(`/api/decisions/${DEC_REFRESH}/detail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(get1.status).toBe(200);
    const before = (get1.body.comments || []).length;

    // Fresh supertest agent (new TCP-level request, not reusing the first agent).
    const post = await request(app)
      .post(`/api/decisions/${DEC_REFRESH}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'ZZ-FALSIFY refresh probe comment' });
    expect(post.status).toBe(201);

    const get2 = await request(app)
      .get(`/api/decisions/${DEC_REFRESH}/detail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(get2.status).toBe(200);
    expect((get2.body.comments || []).length).toBe(before + 1);
    const bodies = (get2.body.comments || []).map((c: any) => c.body);
    expect(bodies.filter((b: string) => b === 'ZZ-FALSIFY refresh probe comment').length).toBe(1);

    // Interleaved: fire a second POST and a GET concurrently, inspect for sanity
    // (no duplication, no crash, count is monotonic).
    const [interleavedPost, interleavedGet] = await Promise.all([
      request(app)
        .post(`/api/decisions/${DEC_REFRESH}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ body: 'ZZ-FALSIFY interleaved comment' }),
      request(app).get(`/api/decisions/${DEC_REFRESH}/detail`).set('Authorization', `Bearer ${tokenA}`),
    ]);
    expect(interleavedPost.status).toBe(201);
    expect(interleavedGet.status).toBe(200);
    const finalGet = await request(app)
      .get(`/api/decisions/${DEC_REFRESH}/detail`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect((finalGet.body.comments || []).length).toBe(before + 2);
  });
});
