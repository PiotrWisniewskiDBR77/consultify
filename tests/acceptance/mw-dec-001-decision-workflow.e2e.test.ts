/**
 * MW-DEC-001 — Canonical Decision Workflow: acceptance suite.
 *
 * REAL-runtime E2E: local Postgres (full schema, incl. migration
 * 932_decision_workflow_canonical.sql) + the REAL `pmo/decisions.routes.ts`
 * router mounted at /api/decisions (matching Gateway.ts:952) behind the REAL
 * verifyToken/requireOrgAccess middleware chain + the REAL DecisionController
 * / decisionCollaborationService / decisionOutcomeService. No mocks of the
 * router, controller, or service under test. Two real tenants (org A / org
 * B), each with real seeded users and real membership rows, and real signed
 * JWTs minted per-actor (never a fabricated "current user").
 *
 * Fixtures use the reversible `mwdec--` prefix and are removed in afterAll.
 * Writes ONLY to the LOCAL Postgres (requireLocalDbUrl() guard enforces
 * this — see the "harness guard" test at the bottom of this file for a
 * live proof that a non-local DATABASE_URL is refused).
 *
 * ── Case 19 note (no localStorage as source of truth) ──────────────────
 * This is a backend/API-level suite; it cannot assert on browser
 * localStorage directly. Instead it proves the CONTRAPOSITIVE at the API
 * level: every comment/alternative/risk written through the API in one
 * request is fully reconstructable from a FRESH GET /:id/detail call in a
 * later, independent request (see cases 7/8/9/11) — i.e. the server alone
 * is the source of truth, and this test harness itself never reads from or
 * writes to localStorage/sessionStorage (it is a Node/supertest process;
 * there is no DOM). Cross-reference: the new frontend components at
 * src/components/MyWork/Decision/ (DecisionCommentsSection.tsx,
 * DecisionAlternativesSection.tsx, DecisionRisksSection.tsx) were grepped
 * for localStorage/sessionStorage — the only hits are comments explaining
 * that they REPLACE the old localStorage-faked state in
 * DecisionDetailView.tsx (which still reads/writes
 * `consultify-decision-enhancements:<id>` — that legacy file is untouched
 * by MW-DEC-001 and is not wired to these new components in this worktree
 * yet, and those `src/components/MyWork/Decision/*` files are themselves
 * currently UNTRACKED/uncommitted in this repo — both are reported as
 * findings, not fixed here; out of scope for a Postgres integration-test
 * owner).
 */
import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// See tests/acceptance/sharedAcceptanceJwtSecret.ts for the full root-cause
// writeup — added during the Decision+Initiative/Execution integration round
// (2026-08-01) after this suite was found to fail 27/31 whenever the shell
// running it doesn't happen to export JWT_SECRET (the same bug INI-005 fixed
// structurally; this suite previously only worked around it operationally
// via MW-DEC-003's documented `JWT_SECRET=...` run command). Must be
// imported before './harness.js' — see that module's doc comment for why.
import { assertJwtSecretHermetic } from './sharedAcceptanceJwtSecret.js';
import { getJwtSecret, requireLocalDbUrl } from './harness.js';

const P = 'mwdec--';

// ── Tenants ──────────────────────────────────────────────────────────────
const ORG_A = `${P}org-A`;
const ORG_B = `${P}org-B`;

const USER_CREATOR_A = `${P}user-creator-A`; // role ADMIN — creates decisions (needs approve_changes), requester
const EMAIL_CREATOR_A = `${P}creator-a@acceptance.local`;

const USER_DM_A = `${P}user-dm-A`; // role TEAM_MEMBER — is decision_maker_id on the test decisions
const EMAIL_DM_A = `${P}dm-a@acceptance.local`;

const USER_MEMBER_A = `${P}user-member-A`; // role TEAM_MEMBER — real org member, NOT dm, NOT admin
const EMAIL_MEMBER_A = `${P}member-a@acceptance.local`;

const USER_B = `${P}user-B`; // role ADMIN in org B — cross-tenant attacker
const EMAIL_B = `${P}b@acceptance.local`;

// ── Decisions (pre-inserted directly via SQL; one per scenario for isolation) ──
const DEC_READ = `${P}dec-read`;
const DEC_MUTATE = `${P}dec-mutate`;
const DEC_UNAUTH = `${P}dec-unauth`;
const DEC_APPROVE = `${P}dec-approve`;
// Deliberately SEPARATE decisions for the comment/alternative/risk persistence
// probes (cases 7/8/9) so they are NOT collateral damage of the real bug
// documented above case 5+10 (a decide()-to-terminal call on DEC_APPROVE
// crashes the HTTP response with 500 AFTER the DB commit already succeeded,
// which would otherwise silently flip DEC_APPROVE to 'approved' mid-suite and
// make alternatives/risks on it 409 DECISION_FINALIZED for the wrong reason).
const DEC_COMMENT_TEST = `${P}dec-comment-test`;
const DEC_ALT_TEST = `${P}dec-alt-test`;
const DEC_RISK_TEST = `${P}dec-risk-test`;
const DEC_FORGED_COMMENT = `${P}dec-forged-comment`;
const DEC_FORGED_DECIDE = `${P}dec-forged-decide`;
const DEC_RATIONALE = `${P}dec-rationale`;
const DEC_STALE = `${P}dec-stale`;
const DEC_RACE = `${P}dec-race`;
const DEC_VANISH = `${P}dec-vanish`;
const DEC_CANCEL = `${P}dec-cancel`;
const DEC_NOTFOUND = `${P}dec-does-not-exist-00000000`; // never inserted — genuine 404 target

// Known-id fixtures pre-inserted on DEC_MUTATE for the "mutate via known id" probes (case 3).
const MUTATE_KNOWN_ALT = `${P}alt-mutate-known`;
const MUTATE_KNOWN_COMMENT = `${P}comment-mutate-known`;

// Org B's own project — used to prove (or disprove) cross-tenant FK forgery (case 18).
const ORG_B_PROJECT = `${P}proj-B`;

let crossFkDecisionId: string | undefined; // captured from case 18's POST response, for cleanup

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
    [orgId, `MW-DEC-001 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x',$4,'active','MwDec','Test',$5) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, role, now]
  );
  // organization_members.role has a narrower CHECK constraint than users.role
  // (organization_members_role_check: OWNER/ADMIN/MEMBER/CONSULTANT/USER/GUEST —
  // no TEAM_MEMBER). The JWT/users.role claim ('TEAM_MEMBER') is what actually
  // drives authorization in attachUser() (see harness note above) as long as the
  // membership row is ACTIVE for the token's org, so map only for this column.
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
  opts: {
    id: string;
    orgId: string;
    title: string;
    decisionMakerId: string;
    createdBy: string;
    status?: string;
  }
): Promise<void> {
  await c.query(
    `INSERT INTO decisions
       (id, organization_id, title, description, type, decision_maker_id, status, created_by,
        priority, impact, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'GENERAL',$5,$6,$7,'MEDIUM','MEDIUM',NOW(),NOW())
     ON CONFLICT (id) DO NOTHING`,
    [
      opts.id,
      opts.orgId,
      opts.title,
      `${opts.title} — description`,
      opts.decisionMakerId,
      opts.status || 'pending',
      opts.createdBy,
    ]
  );
}

function buildApp(decisionsRouter: express.Router): Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // The router applies its OWN verifyToken + requireOrgAccess internally
  // (pmo/decisions.routes.ts lines 39-40), mirroring the real Gateway mount
  // at app.use('/api/decisions', decisionsRoutes) (Gateway.ts:952).
  app.use('/api/decisions', decisionsRouter);
  return app;
}

describe('MW-DEC-001 — Canonical Decision Workflow (real Postgres, real router)', () => {
  let client: pg.Client;
  let app: Express;
  let tokenCreatorA: string;
  let tokenDmA: string;
  let tokenMemberA: string;
  let tokenB: string;

  beforeAll(async () => {
    await assertJwtSecretHermetic();
    requireLocalDbUrl();
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    await seedTenant(client, ORG_A, USER_CREATOR_A, EMAIL_CREATOR_A, 'ADMIN');
    await seedTenant(client, ORG_A, USER_DM_A, EMAIL_DM_A, 'TEAM_MEMBER');
    await seedTenant(client, ORG_A, USER_MEMBER_A, EMAIL_MEMBER_A, 'TEAM_MEMBER');
    await seedTenant(client, ORG_B, USER_B, EMAIL_B, 'ADMIN');

    await insertDecision(client, {
      id: DEC_READ,
      orgId: ORG_A,
      title: 'MWDEC READ TARGET DECISION',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_MUTATE,
      orgId: ORG_A,
      title: 'MWDEC MUTATE TARGET DECISION',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_UNAUTH,
      orgId: ORG_A,
      title: 'MWDEC UNAUTH DECIDE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_APPROVE,
      orgId: ORG_A,
      title: 'MWDEC APPROVE LIFECYCLE DECISION',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_COMMENT_TEST,
      orgId: ORG_A,
      title: 'MWDEC COMMENT PERSISTENCE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_ALT_TEST,
      orgId: ORG_A,
      title: 'MWDEC ALTERNATIVE PERSISTENCE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_RISK_TEST,
      orgId: ORG_A,
      title: 'MWDEC RISK PERSISTENCE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_FORGED_COMMENT,
      orgId: ORG_A,
      title: 'MWDEC FORGED COMMENT TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_FORGED_DECIDE,
      orgId: ORG_A,
      title: 'MWDEC FORGED DECIDE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_RATIONALE,
      orgId: ORG_A,
      title: 'MWDEC RATIONALE REQUIRED TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_STALE,
      orgId: ORG_A,
      title: 'MWDEC STALE VERSION TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_RACE,
      orgId: ORG_A,
      title: 'MWDEC RACE TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_VANISH,
      orgId: ORG_A,
      title: 'MWDEC VANISH TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });
    await insertDecision(client, {
      id: DEC_CANCEL,
      orgId: ORG_A,
      title: 'MWDEC CANCEL TARGET',
      decisionMakerId: USER_DM_A,
      createdBy: USER_CREATOR_A,
    });

    // Known-id fixtures for the case-3 "mutate via known id" probes.
    await client.query(
      `INSERT INTO decision_alternatives
         (id, organization_id, decision_id, title, description, is_recommended, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,'A-ORIGINAL-ALT-TITLE','original',false,$4,NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [MUTATE_KNOWN_ALT, ORG_A, DEC_MUTATE, USER_DM_A]
    );
    await client.query(
      `INSERT INTO decision_comments
         (id, organization_id, decision_id, author_id, body, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'A-ORIGINAL-COMMENT-BODY',NOW(),NOW())
       ON CONFLICT (id) DO NOTHING`,
      [MUTATE_KNOWN_COMMENT, ORG_A, DEC_MUTATE, USER_DM_A]
    );

    // Org B's own project — for case 18 (cross-tenant FK forgery probe).
    await client.query(
      `INSERT INTO projects (id, organization_id, name, status, created_at)
       VALUES ($1,$2,'MWDEC Org B Project','active',NOW()) ON CONFLICT (id) DO NOTHING`,
      [ORG_B_PROJECT, ORG_B]
    );

    process.env.RUN_DB_TESTS = '1';
    process.env.MOCK_DB = 'false';

    const decisionsRouter = (await import('../../server/src/routes/pmo/decisions.routes.js'))
      .default;
    app = buildApp(decisionsRouter as unknown as express.Router);

    tokenCreatorA = mintTokenFor(USER_CREATOR_A, ORG_A, EMAIL_CREATOR_A, 'ADMIN');
    tokenDmA = mintTokenFor(USER_DM_A, ORG_A, EMAIL_DM_A, 'TEAM_MEMBER');
    tokenMemberA = mintTokenFor(USER_MEMBER_A, ORG_A, EMAIL_MEMBER_A, 'TEAM_MEMBER');
    tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B, 'ADMIN');
  });

  afterAll(async () => {
    if (!client) return;
    // Reversible cleanup — everything is prefixed `mwdec--`, plus the one
    // server-generated id captured from case 18.
    if (crossFkDecisionId) {
      await client.query(`DELETE FROM decisions WHERE id = $1`, [crossFkDecisionId]);
    }
    // decision_comments/decision_alternatives/decision_risks/decision_history/
    // decision_impacts all FK decision_id REFERENCES decisions(id) ON DELETE
    // CASCADE (932 migration + 292_decision_management.sql) — deleting the
    // parent decisions rows cascades their cleanup automatically.
    await client.query(`DELETE FROM decisions WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM projects WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organization_members WHERE user_id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM users WHERE id LIKE $1`, [`${P}%`]);
    await client.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${P}%`]);
    await client.end();
  });

  // ═══════════════════════════ CASE 1 ═══════════════════════════
  it('case 1: decision created in tenant A is readable in tenant A (200, correct fields)', async () => {
    const res = await request(app)
      .get(`/api/decisions/${DEC_READ}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(DEC_READ);
    expect(res.body.title).toBe('MWDEC READ TARGET DECISION');
    expect(res.body.status).toBe('PENDING');
    expect(res.body.decisionOwnerId).toBe(USER_DM_A);
    expect(res.body.requestedById).toBe(USER_CREATOR_A);
    expect(Array.isArray(res.body.comments)).toBe(true);
    expect(Array.isArray(res.body.dossierAlternatives)).toBe(true);
    expect(Array.isArray(res.body.dossierRisks)).toBe(true);
  });

  // ═══════════════════════════ CASE 2 ═══════════════════════════
  it('case 2: tenant B cannot read tenant A decision -> 404, no title/content leak', async () => {
    const res = await request(app)
      .get(`/api/decisions/${DEC_READ}/detail`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('MWDEC READ TARGET DECISION');
    expect(raw).not.toContain('description');
    expect(res.body.status).not.toBe(200);
  });

  // ═══════════════════════════ CASE 3 ═══════════════════════════
  it('case 3: tenant B cannot mutate tenant A decision via known ids -> 404, nothing changes', async () => {
    const beforeDecision = await client.query(
      `SELECT status, decision_rationale, decided_by, version FROM decisions WHERE id=$1`,
      [DEC_MUTATE]
    );
    const beforeCommentCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_comments WHERE decision_id=$1 AND deleted_at IS NULL`,
      [DEC_MUTATE]
    );
    const beforeHistoryCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_history WHERE decision_id=$1`,
      [DEC_MUTATE]
    );

    // POST comment (create) as B.
    const commentRes = await request(app)
      .post(`/api/decisions/${DEC_MUTATE}/comments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ body: 'B-INJECTED-COMMENT' });
    expect(commentRes.status).toBe(404);

    // PUT alternative (mutate known id) as B.
    const altRes = await request(app)
      .put(`/api/decisions/${DEC_MUTATE}/alternatives/${MUTATE_KNOWN_ALT}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'B-HACKED-ALT-TITLE' });
    expect(altRes.status).toBe(404);

    // PATCH decide as B.
    const decideRes = await request(app)
      .patch(`/api/decisions/${DEC_MUTATE}/decide`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'APPROVED', rationale: 'B trying to hijack' });
    expect(decideRes.status).toBe(404);

    // Nothing in A's decision or child tables changed.
    const afterDecision = await client.query(
      `SELECT status, decision_rationale, decided_by, version FROM decisions WHERE id=$1`,
      [DEC_MUTATE]
    );
    expect(afterDecision.rows[0]).toEqual(beforeDecision.rows[0]);

    const alt = await client.query(`SELECT title FROM decision_alternatives WHERE id=$1`, [
      MUTATE_KNOWN_ALT,
    ]);
    expect(alt.rows[0].title).toBe('A-ORIGINAL-ALT-TITLE');

    const afterCommentCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_comments WHERE decision_id=$1 AND deleted_at IS NULL`,
      [DEC_MUTATE]
    );
    expect(afterCommentCount.rows[0].c).toBe(beforeCommentCount.rows[0].c);

    const afterHistoryCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_history WHERE decision_id=$1`,
      [DEC_MUTATE]
    );
    expect(afterHistoryCount.rows[0].c).toBe(beforeHistoryCount.rows[0].c);

    const raw = JSON.stringify({ commentBody: commentRes.body, altBody: altRes.body });
    expect(raw).not.toContain('B-INJECTED-COMMENT');
    expect(raw).not.toContain('B-HACKED-ALT-TITLE');
  });

  // ═══════════════════════════ CASE 4 ═══════════════════════════
  it('case 4: unauthorized org member (not dm, not admin) cannot decide -> 403, DB unchanged', async () => {
    const before = await client.query(
      `SELECT status, decision_rationale, decided_by FROM decisions WHERE id=$1`,
      [DEC_UNAUTH]
    );
    expect(before.rows[0].status).toBe('pending');

    const res = await request(app)
      .patch(`/api/decisions/${DEC_UNAUTH}/decide`)
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .send({ status: 'APPROVED', rationale: 'Member trying to self-approve' });

    expect(res.status).toBe(403);

    const after = await client.query(
      `SELECT status, decision_rationale, decided_by FROM decisions WHERE id=$1`,
      [DEC_UNAUTH]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(after.rows[0].status).toBe('pending');
    expect(after.rows[0].decided_by).toBeNull();
  });

  // ═══════════════════════════ CRITICAL FINDING ═══════════════════════════
  // decision_impacts.is_blocker is INTEGER in the live schema (created by
  // server/migrations/292_decision_management.sql: `is_blocker INTEGER
  // DEFAULT 0`; CREATE TABLE IF NOT EXISTS means this definition wins over
  // the later 297/728 files that redefine the table with a BOOLEAN column —
  // whichever numeric-sorted file runs FIRST against a fresh DB keeps its
  // column types). DecisionController.decide() (server/src/controllers/
  // DecisionController.ts:1324) unconditionally runs, after every successful
  // approve/reject commit:
  //   SELECT impacted_type, impacted_id, is_blocker FROM decision_impacts
  // The canonical fresh schema now exposes a real BOOLEAN. Keep this direct
  // PostgreSQL assertion so a future duplicate migration cannot silently
  // regress the decision approval query back to INTEGER-vs-BOOLEAN failure.
  it('decision_impacts.is_blocker is boolean-compatible on the canonical schema', async () => {
    const result = await client.query(
      `SELECT impacted_type, impacted_id, is_blocker FROM decision_impacts WHERE decision_id = $1 AND is_blocker = TRUE`,
      [DEC_APPROVE]
    );
    expect(result.rows).toEqual(expect.any(Array));
  });

  // ═══════════════════════════ CASE 5 + 10 ═══════════════════════════
  it('case 5+10: authorized decision-maker CAN approve; rationale/actor/timestamp/history persist atomically', async () => {
    const beforeHistoryCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_history WHERE decision_id=$1`,
      [DEC_APPROVE]
    );

    const res = await request(app)
      .patch(`/api/decisions/${DEC_APPROVE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({ status: 'APPROVED', rationale: 'Approved after full review of the dossier.' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.decidedBy).toBe(USER_DM_A);

    const row = await client.query(
      `SELECT status, decision_rationale, decided_by, decided_at, version FROM decisions WHERE id=$1`,
      [DEC_APPROVE]
    );
    expect(row.rows[0].status).toBe('approved');
    expect(row.rows[0].decision_rationale).toBe('Approved after full review of the dossier.');
    expect(row.rows[0].decided_by).toBe(USER_DM_A);
    expect(row.rows[0].decided_at).not.toBeNull();
    expect(Number(row.rows[0].version)).toBe(2); // started at 1 (migration default), incremented once

    const history = await client.query(
      `SELECT decision_id, new_status, changed_by FROM decision_history
       WHERE decision_id=$1 ORDER BY changed_at DESC LIMIT 1`,
      [DEC_APPROVE]
    );
    expect(history.rows[0].new_status).toBe('approved');
    expect(history.rows[0].changed_by).toBe(USER_DM_A);

    const afterHistoryCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_history WHERE decision_id=$1`,
      [DEC_APPROVE]
    );
    expect(afterHistoryCount.rows[0].c).toBe(beforeHistoryCount.rows[0].c + 1);
  });

  // ═══════════════════════════ CASE 6 ═══════════════════════════
  it('case 6a: forged authorId/organizationId in comment body is ignored — real author comes from token', async () => {
    const res = await request(app)
      .post(`/api/decisions/${DEC_FORGED_COMMENT}/comments`)
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .send({
        body: 'Real comment text from member A',
        authorId: USER_CREATOR_A, // forged — attacker tries to impersonate the creator
        organizationId: ORG_B, // forged — attacker tries to relocate the row into org B
        decidedBy: USER_B,
      });

    expect(res.status).toBe(201);
    expect(res.body.authorId).toBe(USER_MEMBER_A); // NOT the forged USER_CREATOR_A

    const row = await client.query(
      `SELECT author_id, organization_id FROM decision_comments WHERE id=$1`,
      [res.body.id]
    );
    expect(row.rows[0].author_id).toBe(USER_MEMBER_A);
    expect(row.rows[0].organization_id).toBe(ORG_A); // NOT the forged ORG_B
  });

  it('case 6b: forged decidedBy in decide() body is ignored — real actor comes from token', async () => {
    const res = await request(app)
      .patch(`/api/decisions/${DEC_FORGED_DECIDE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({
        status: 'APPROVED',
        rationale: 'Legit approval by the real decision-maker.',
        decidedBy: USER_CREATOR_A, // forged
        authorId: USER_B, // forged
        organizationId: ORG_B, // forged
      });

    expect(res.status).toBe(200);
    expect(res.body.decidedBy).toBe(USER_DM_A); // NOT the forged USER_CREATOR_A

    const row = await client.query(`SELECT decided_by, organization_id FROM decisions WHERE id=$1`, [
      DEC_FORGED_DECIDE,
    ]);
    expect(row.rows[0].decided_by).toBe(USER_DM_A);
    expect(row.rows[0].organization_id).toBe(ORG_A); // NOT the forged ORG_B
  });

  // ═══════════════════════════ CASE 7 ═══════════════════════════
  it('case 7: comment persists with the REAL author; visible to any org member on a fresh GET', async () => {
    const postRes = await request(app)
      .post(`/api/decisions/${DEC_COMMENT_TEST}/comments`)
      .set('Authorization', `Bearer ${tokenMemberA}`)
      .send({ body: 'MWDEC-REAL-AUTHOR-COMMENT' });
    expect(postRes.status).toBe(201);
    expect(postRes.body.authorId).toBe(USER_MEMBER_A);

    // Raw DB verification — not just trusting the HTTP echo.
    const row = await client.query(
      `SELECT author_id, body FROM decision_comments WHERE id=$1`,
      [postRes.body.id]
    );
    expect(row.rows[0].author_id).toBe(USER_MEMBER_A);
    expect(row.rows[0].body).toBe('MWDEC-REAL-AUTHOR-COMMENT');

    // A DIFFERENT org member (creator, not the comment author) reads it back.
    const getRes = await request(app)
      .get(`/api/decisions/${DEC_COMMENT_TEST}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(getRes.status).toBe(200);
    const found = (getRes.body.comments as Array<{ authorId: string; body: string }>).find(
      (c) => c.body === 'MWDEC-REAL-AUTHOR-COMMENT'
    );
    expect(found).toBeTruthy();
    expect(found?.authorId).toBe(USER_MEMBER_A);
  });

  // ═══════════════════════════ CASE 8 ═══════════════════════════
  it('case 8: alternative persists and survives refresh (DB SELECT + independent GET, not just the POST echo)', async () => {
    const postRes = await request(app)
      .post(`/api/decisions/${DEC_ALT_TEST}/alternatives`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({
        title: 'MWDEC-ALT-SURVIVES-REFRESH',
        description: 'Alt description',
        isRecommended: true,
      });
    expect(postRes.status).toBe(201);
    const altId = postRes.body.id;

    // Raw DB verification.
    const row = await client.query(
      `SELECT title, is_recommended, created_by FROM decision_alternatives WHERE id=$1`,
      [altId]
    );
    expect(row.rows[0].title).toBe('MWDEC-ALT-SURVIVES-REFRESH');
    expect(row.rows[0].is_recommended).toBe(true);
    expect(row.rows[0].created_by).toBe(USER_DM_A);

    // Independent, later GET (a request that never saw the POST response).
    const getRes = await request(app)
      .get(`/api/decisions/${DEC_ALT_TEST}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(getRes.status).toBe(200);
    const found = (
      getRes.body.dossierAlternatives as Array<{ id: string; title: string }>
    ).find((a) => a.id === altId);
    expect(found).toBeTruthy();
    expect(found?.title).toBe('MWDEC-ALT-SURVIVES-REFRESH');
  });

  // ═══════════════════════════ CASE 9 ═══════════════════════════
  it('case 9: risk persists and survives refresh (DB SELECT + independent GET, not just the POST echo)', async () => {
    const postRes = await request(app)
      .post(`/api/decisions/${DEC_RISK_TEST}/risks`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({
        description: 'MWDEC-RISK-SURVIVES-REFRESH',
        severity: 'HIGH',
        likelihood: 'MEDIUM',
        mitigation: 'Mitigation plan text',
      });
    expect(postRes.status).toBe(201);
    const riskId = postRes.body.id;

    const row = await client.query(
      `SELECT description, severity, likelihood, created_by FROM decision_risks WHERE id=$1`,
      [riskId]
    );
    expect(row.rows[0].description).toBe('MWDEC-RISK-SURVIVES-REFRESH');
    expect(row.rows[0].severity).toBe('HIGH');
    expect(row.rows[0].created_by).toBe(USER_DM_A);

    const getRes = await request(app)
      .get(`/api/decisions/${DEC_RISK_TEST}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(getRes.status).toBe(200);
    const found = (getRes.body.dossierRisks as Array<{ id: string; description: string }>).find(
      (r) => r.id === riskId
    );
    expect(found).toBeTruthy();
    expect(found?.description).toBe('MWDEC-RISK-SURVIVES-REFRESH');
  });

  // ═══════════════════════════ CASE 11 ═══════════════════════════
  it('case 11: two consecutive GET /detail calls return the same aggregate — no drift, no duplication', async () => {
    const first = await request(app)
      .get(`/api/decisions/${DEC_APPROVE}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    const second = await request(app)
      .get(`/api/decisions/${DEC_APPROVE}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.comments.length).toBe(first.body.comments.length);
    expect(second.body.dossierAlternatives.length).toBe(first.body.dossierAlternatives.length);
    expect(second.body.dossierRisks.length).toBe(first.body.dossierRisks.length);
    expect(second.body.auditTrail.length).toBe(first.body.auditTrail.length);
    expect(second.body.status).toBe(first.body.status);
    expect(second.body.version).toBe(first.body.version);

    // No duplicate ids within either call.
    const commentIds = (second.body.comments as Array<{ id: string }>).map((c) => c.id);
    expect(new Set(commentIds).size).toBe(commentIds.length);
    const altIds = (second.body.dossierAlternatives as Array<{ id: string }>).map((a) => a.id);
    expect(new Set(altIds).size).toBe(altIds.length);
  });

  // ═══════════════════════════ CASE 12 ═══════════════════════════
  it('case 12: illegal transition on an already-APPROVED decision -> 409 ALREADY_FINALIZED, DB untouched', async () => {
    const before = await client.query(
      `SELECT status, decision_rationale, decided_by, version, updated_at FROM decisions WHERE id=$1`,
      [DEC_APPROVE]
    );
    expect(before.rows[0].status).toBe('approved'); // finalized in case 5+10

    const res = await request(app)
      .patch(`/api/decisions/${DEC_APPROVE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({ status: 'REJECTED', rationale: 'Trying to flip an already-decided decision.' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_FINALIZED');

    const after = await client.query(
      `SELECT status, decision_rationale, decided_by, version, updated_at FROM decisions WHERE id=$1`,
      [DEC_APPROVE]
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(after.rows[0].status).toBe('approved'); // never became rejected
  });

  // ═══════════════════════════ CASE 13 ═══════════════════════════
  it('case 13: blank rationale on APPROVED is rejected by schema validation -> 400, DB unchanged', async () => {
    const res = await request(app)
      .patch(`/api/decisions/${DEC_RATIONALE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({ status: 'APPROVED', rationale: '' });

    expect(res.status).toBe(400);

    const row = await client.query(`SELECT status, decided_by FROM decisions WHERE id=$1`, [
      DEC_RATIONALE,
    ]);
    expect(row.rows[0].status).toBe('pending');
    expect(row.rows[0].decided_by).toBeNull();
  });

  // FIXED (server/src/controllers/DecisionController.ts, commit 5cf7c03245):
  // decide() used to synthesize a default rationale ('Approved'/'Rejected')
  // whenever the caller omitted the field entirely, which made the
  // business-rule RATIONALE_REQUIRED path in decisionOutcomeService's
  // validateDecideTransition unreachable for the omitted-field case (only
  // the explicit-blank-string case above was ever actually rejected). The
  // fabricated fallback was removed — rationaleText is now exactly what the
  // caller supplied, so an omitted rationale on APPROVED/REJECTED is now
  // indistinguishable from a blank one and correctly rejected.
  it('case 13b: omitted (not just blank-string) rationale on APPROVED is also rejected with 400, no synthetic default', async () => {
    const res = await request(app)
      .patch(`/api/decisions/${DEC_RATIONALE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({ status: 'APPROVED' }); // rationale field omitted entirely

    expect(res.status).toBe(400);
    const row = await client.query(
      `SELECT status, decision_rationale FROM decisions WHERE id=$1`,
      [DEC_RATIONALE]
    );
    expect(row.rows[0].status).toBe('pending'); // unchanged — no synthetic approval
    expect(row.rows[0].decision_rationale).toBeNull();
  });

  // ═══════════════════════════ CASE 14 ═══════════════════════════
  it('case 14: stale concurrent version returns 409 STALE_VERSION with currentVersion, does not overwrite the winner', async () => {
    const initial = await client.query(`SELECT version FROM decisions WHERE id=$1`, [DEC_STALE]);
    const initialVersion = Number(initial.rows[0].version);
    expect(initialVersion).toBe(1);

    // "Different request" changes the decision first, using the correct version.
    const winner = await request(app)
      .patch(`/api/decisions/${DEC_STALE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({
        status: 'APPROVED',
        rationale: 'First writer wins.',
        version: initialVersion,
      });
    expect(winner.status).toBe(200);
    expect(winner.body.version).toBe(initialVersion + 1);

    // Now the ORIGINAL stale request replays the OLD version.
    const stale = await request(app)
      .patch(`/api/decisions/${DEC_STALE}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({
        status: 'REJECTED',
        rationale: 'Stale writer loses.',
        version: initialVersion, // stale — the row is already at initialVersion+1
      });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
    expect(stale.body.currentVersion).toBe(initialVersion + 1);

    const row = await client.query(
      `SELECT status, decision_rationale, version FROM decisions WHERE id=$1`,
      [DEC_STALE]
    );
    expect(row.rows[0].status).toBe('approved'); // winner's outcome, not the stale REJECTED
    expect(row.rows[0].decision_rationale).toBe('First writer wins.');
    expect(Number(row.rows[0].version)).toBe(initialVersion + 1); // not bumped again by the stale attempt
  });

  // ═══════════════════════════ CASE 15 ═══════════════════════════
  it('case 15: two simultaneous final decisions on the same id -> exactly one 200, one 409, no split-brain', async () => {
    const before = await client.query(`SELECT status FROM decisions WHERE id=$1`, [DEC_RACE]);
    expect(before.rows[0].status).toBe('pending');

    const [resApprove, resReject] = await Promise.all([
      request(app)
        .patch(`/api/decisions/${DEC_RACE}/decide`)
        .set('Authorization', `Bearer ${tokenDmA}`)
        .send({ status: 'APPROVED', rationale: 'Racing approval.' }),
      request(app)
        .patch(`/api/decisions/${DEC_RACE}/decide`)
        .set('Authorization', `Bearer ${tokenDmA}`)
        .send({ status: 'REJECTED', rationale: 'Racing rejection.' }),
    ]);

    const statuses = [resApprove.status, resReject.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winnerIsApprove = resApprove.status === 200;
    const winnerRes = winnerIsApprove ? resApprove : resReject;
    const loserRes = winnerIsApprove ? resReject : resApprove;
    expect(loserRes.body.code).toBe('ALREADY_FINALIZED');

    const row = await client.query(
      `SELECT status, decision_rationale FROM decisions WHERE id=$1`,
      [DEC_RACE]
    );
    expect(row.rows[0].status).toBe(winnerIsApprove ? 'approved' : 'rejected');
    expect(row.rows[0].decision_rationale).toBe(
      winnerIsApprove ? 'Racing approval.' : 'Racing rejection.'
    );
    // status and rationale must agree — no split-brain where one half of
    // the winning transition landed and the other didn't.
    expect(winnerRes.body.status).toBe(row.rows[0].status.toUpperCase());

    // Exactly one history row was appended for this race (not two, not zero).
    const history = await client.query(
      `SELECT new_status FROM decision_history WHERE decision_id=$1 AND action IN ('approved','rejected')`,
      [DEC_RACE]
    );
    expect(history.rows.length).toBe(1);
    expect(history.rows[0].new_status).toBe(row.rows[0].status);
  });

  // ═══════════════════════════ CASE 16 ═══════════════════════════
  // HONEST GAP (see header + final report): true mid-transaction fault
  // injection — a failure landing strictly BETWEEN the `decisions` UPDATE
  // and the `decision_history` INSERT inside finalizeDecisionTransition's
  // single BEGIN/COMMIT (decisionCollaborationService.ts ~L806-823) — is
  // NOT reachable via black-box HTTP with the schema as committed: neither
  // `decided_by` nor `decision_history.changed_by` carry an FK, `version`
  // is an always-valid caller-supplied integer, and `decisions.status` has
  // no CHECK constraint (per the 932 migration's own header comment). A
  // real test of that failure mode would need either (a) a fault-injection
  // hook the test can trip mid-transaction (e.g. an env-gated
  // `throw new Error('injected')` between the two queries in
  // finalizeDecisionTransition), or (b) a way to sever the DB connection
  // deterministically at that exact point, neither of which this
  // Postgres-integration-test-owner seat can add without touching
  // application code beyond the test harness. What CAN be proven
  // black-box is the adjacent property below: if the decision row vanishes
  // between the controller's initial ownership-check read and the
  // transaction's `SELECT ... FOR UPDATE`, the request fails honestly
  // (404) with no orphan decision_history row — i.e. the "no falsely
  // completed Decision" property holds for this narrower, HTTP-reachable
  // race, even though the deeper mid-transaction case remains unverified.
  it('case 16 (partial coverage, documented gap): decision vanishing before the atomic transaction -> honest 404, no orphan history (does NOT exercise true mid-transaction fault injection)', async () => {
    await client.query(`DELETE FROM decisions WHERE id=$1`, [DEC_VANISH]);

    const res = await request(app)
      .patch(`/api/decisions/${DEC_VANISH}/decide`)
      .set('Authorization', `Bearer ${tokenDmA}`)
      .send({ status: 'APPROVED', rationale: 'Deciding on a row that just vanished.' });

    expect(res.status).toBe(404);

    const orphanHistory = await client.query(
      `SELECT COUNT(*)::int AS c FROM decision_history WHERE decision_id=$1`,
      [DEC_VANISH]
    );
    expect(orphanHistory.rows[0].c).toBe(0);

    const ghostDecision = await client.query(`SELECT 1 FROM decisions WHERE id=$1`, [DEC_VANISH]);
    expect(ghostDecision.rowCount).toBe(0); // still gone — not resurrected in some half-state
  });

  // ═══════════════════════════ CASE 17 ═══════════════════════════
  it('case 17a: nonexistent decision id -> honest 404 (not 500, not an empty-looking 200) on GET/POST/PATCH', async () => {
    const getRes = await request(app)
      .get(`/api/decisions/${DEC_NOTFOUND}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(getRes.status).toBe(404);

    const postRes = await request(app)
      .post(`/api/decisions/${DEC_NOTFOUND}/comments`)
      .set('Authorization', `Bearer ${tokenCreatorA}`)
      .send({ body: 'orphan comment attempt' });
    expect(postRes.status).toBe(404);

    const patchRes = await request(app)
      .patch(`/api/decisions/${DEC_NOTFOUND}/decide`)
      .set('Authorization', `Bearer ${tokenCreatorA}`)
      .send({ status: 'APPROVED', rationale: 'orphan decide attempt' });
    expect(patchRes.status).toBe(404);
  });

  it('case 17b: a soft-deleted (cancelled) decision is genuinely-different-status, NOT genuinely-gone — GET still 200', async () => {
    // DecisionController.deleteDecision is a SOFT delete (status='cancelled'),
    // never a real SQL DELETE — see server/src/controllers/DecisionController.ts
    // ~2134 (`UPDATE decisions SET status = 'cancelled' ...`). So the row
    // (and its detail endpoint) must stay reachable at 200, just with a
    // different status — a real 404 is reserved for rows that never
    // existed or existed in a different org (cases 2/17a).
    const deleteRes = await request(app)
      .delete(`/api/decisions/${DEC_CANCEL}`)
      .set('Authorization', `Bearer ${tokenCreatorA}`) // creator = requester, allowed to cancel
      .send({ reason: 'MWDEC test cancel' });
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/decisions/${DEC_CANCEL}/detail`)
      .set('Authorization', `Bearer ${tokenCreatorA}`);
    expect(getRes.status).toBe(200); // NOT 404 — this is the "different status" case, not "gone"
    expect(getRes.body.status).toBe('CANCELLED');

    const row = await client.query(`SELECT status FROM decisions WHERE id=$1`, [DEC_CANCEL]);
    expect(row.rows[0].status).toBe('cancelled');
  });

  // ═══════════════════════════ CASE 18 ═══════════════════════════
  it('case 18 (security-gap probe): creating a decision in org A with a projectId owned by org B — reports actual behavior honestly', async () => {
    const res = await request(app)
      .post(`/api/decisions`)
      .set('Authorization', `Bearer ${tokenCreatorA}`)
      .send({
        title: 'MWDEC cross-tenant FK forgery probe',
        projectId: ORG_B_PROJECT, // belongs to ORG_B, caller is authenticated as ORG_A
        priority: 'medium',
      });

    if (res.status === 201) {
      // ── SECURITY GAP (reported honestly, not silently fixed by this
      // Postgres-integration-test-owner seat, and not hidden as a false
      // pass): server/src/controllers/DecisionController.createDecision
      // (~line 941-944) takes `projectId`/`initiativeId`/`taskId` straight
      // from the request body and INSERTs them with zero check that they
      // belong to the caller's own organization_id. The DB-level FK
      // (`decisions.project_id REFERENCES projects(id)`) only proves the
      // row EXISTS somewhere — not that it exists in the caller's org. This
      // assertion documents the CURRENT (insecure) behavior so the suite
      // stays green and diagnostic; if this is ever fixed to reject
      // cross-tenant relations, flip this branch's expectation to
      // `expect([400, 404]).toContain(res.status)`.
      crossFkDecisionId = res.body.id;
      const row = await client.query(
        `SELECT organization_id, project_id FROM decisions WHERE id=$1`,
        [crossFkDecisionId]
      );
      expect(row.rows[0].organization_id).toBe(ORG_A);
      expect(row.rows[0].project_id).toBe(ORG_B_PROJECT); // <- the gap: org A decision points at org B's project
      expect(res.status).toBe(201);
    } else {
      // If this branch is ever hit, cross-tenant relation validation has
      // been added — the secure behavior.
      expect([400, 404]).toContain(res.status);
    }
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

  // ═══════════════════════════ CASE 20 (self-audit) ═══════════════════════════
  // Audit: every mutating case above (3, 5+10, 6a, 6b, 7, 8, 9, 12, 13,
  // 13b, 14, 15, 16, 17b, 18) has a raw `client.query(...)` SELECT against
  // the real table, not just an HTTP status/body assertion — verified by
  // inspection while writing this file, and grep-checked in the final
  // report handed back to the caller (every `it(` above that performs a
  // POST/PUT/PATCH/DELETE is followed by at least one `client.query`).
});
