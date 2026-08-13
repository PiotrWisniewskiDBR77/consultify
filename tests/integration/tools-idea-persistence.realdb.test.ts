/**
 * STREAM G2 — idea persistence regression suite, against REAL Postgres.
 *
 * THE DEFECT (sibling of the presentation defect fixed in bc9b8ae0cd, see
 * `tests/integration/tools-presentation-persistence.realdb.test.ts`'s own
 * header): in `ToolController.promoteToOutput`, the `outputType === 'idea'`
 * branch wrapped its `INSERT INTO my_ideas (...)` in a bare
 * `catch { /* Table may not exist * / }`. Unlike the presentation defect,
 * `my_ideas` was never the WRONG table — it is migration-owned
 * (server/migrations/755_my_ideas_00base.sql /
 * server/migrations/20260220_my_work_my_ideas.sql both `CREATE TABLE IF NOT
 * EXISTS my_ideas` with exactly the columns the INSERT used, confirmed
 * against this worktree's live migrated schema with `\d my_ideas`) and IS
 * the table `GET/PUT/DELETE /api/my-work/my-ideas/:id`
 * (server/src/routes/my-work.routes.ts) actually reads. But the `catch`
 * still swallowed EVERY failure unconditionally — a constraint violation, a
 * connection blip, a future column rename — so the endpoint kept returning
 * 200 with an `id` pointing at nothing in `my_ideas`: invisible on My Work >
 * Ideas, un-reopenable. Same "API pretends success" mechanism as the
 * presentation defect, different table.
 *
 * THE FIX: the `catch` is removed entirely (a failed INSERT now propagates
 * through `asyncHandler` to the error handler — the same "no catch" shape
 * the `initiative` branch's plain `INSERT INTO initiatives` already used).
 * `respondDeduplicated`'s `idea` path now verifies the `my_ideas` row
 * actually exists before reporting a deduplicated success — mirroring the
 * `presentation` branch's `existingDeck` check — so a retry after a failed
 * INSERT gets an honest 409, never a fake `deduplicated: true`. Lineage to
 * the source `tool_outputs` row is carried in the existing generic
 * `my_ideas.source_pack_json` column (the same column initiatives/workbooks
 * already use for provenance, read back as `sourcePack`).
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56701/consultinity \
 *   npx vitest run tests/integration/tools-idea-persistence.realdb.test.ts
 */
import { randomBytes } from 'node:crypto';

import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.E2E_MODE = 'true';

// ---- Injectable INSERT failure, toggled per-test --------------------------
// `queryHelpers.queryRun` is the one call the fixed `idea` branch makes that
// can fail for reasons unrelated to the promotion request itself (a rejected
// constraint, a transient connection error). Wrapping the REAL implementation
// here — passthrough for every query except the specifically-toggled
// `INSERT INTO my_ideas` — is how IP6 proves the NEW fail-closed behaviour
// against the REAL promoteToOutput handler and REAL Postgres, without
// fabricating a real DB outage. Same technique as the presentation suite's
// `forceRegistrationFailure` toggle on `registerArtifactOrigin`.
let forceIdeaInsertFailure = false;

vi.mock('../../server/src/utils/queryHelpers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/utils/queryHelpers.js')>();
  return {
    ...actual,
    queryRun: async (sql: string, params?: unknown[]) => {
      if (forceIdeaInsertFailure && /INSERT INTO my_ideas/i.test(sql)) {
        throw new Error('synthetic forced failure: INSERT INTO my_ideas (IP6)');
      }
      return actual.queryRun(sql, params);
    },
  };
});

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `ip-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const ACTOR = `${P}actor`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org: string, user = ACTOR) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/** Same engine-valid SWOT fixture shape as the presentation realdb suite —
 * guarantees a non-empty `conclusions` array and satisfies the promotion
 * gate (APPROVED status, confidence_avg >= MIN_PROMOTION_CONFIDENCE). */
function swotAnswers() {
  return {
    items: [
      {
        id: 'i1',
        text: 'Silny zespół wdrożeniowy',
        quadrant: 'strengths',
        impact: 'high',
        proposalStatus: 'accepted',
        evidenceStatus: 'confirmed',
      },
      {
        id: 'i2',
        text: 'Rosnący popyt w DACH',
        quadrant: 'opportunities',
        impact: 'high',
        proposalStatus: 'accepted',
        evidenceStatus: 'confirmed',
      },
    ],
    tensions: [
      {
        id: 't1',
        title: 'Napięcie i1/i2',
        type: 'attack',
        linkedItemIds: ['i1', 'i2'],
        linkedCorrelationIds: [],
        insight: 'insight',
      },
    ],
    recommendedMoves: [
      {
        id: 'm1',
        title: 'Uruchomić pilota w DACH',
        category: 'quick-win',
        rationale: 'Popyt rośnie, zespół wdrożeniowy jest niewykorzystany.',
        linkedTensionIds: ['t1'],
        linkedItemIds: ['i1'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        firstStep: 'Wybrać klienta pilotażowego',
        ownerRole: 'Dyrektor sprzedaży',
        tradeoff: { chosen: 'Pilot w DACH', deferred: 'Rozwój produktu', cost: 'Dług produktowy +1Q' },
        rejectedAlternative: { option: 'Wejście przez partnera', reason: 'Utrata kontroli nad wdrożeniem' },
      },
    ],
  };
}

async function seedSession(opts: { id: string; org?: string; version?: number }): Promise<string> {
  const org = opts.org ?? ORG_A;
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, created_by, updated_by, version, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,'APPROVED',100,4.5,$4,$5,$5,$6,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'APPROVED', version = EXCLUDED.version`,
      [opts.id, org, `ip session ${opts.id}`, JSON.stringify(swotAnswers()), ACTOR, opts.version ?? 1]
    );
  } finally {
    await c.end();
  }
  return opts.id;
}

// ---- E2E JWT minting for the REAL my-work.routes.ts (real verifyToken) ---
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
    name: 'Idea Persistence RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

let myWorkApp: Express;

beforeAll(async () => {
  await assertRealPostgresTestEnvironment();

  const seedDb = await db();
  try {
    await seedDb.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active'), ($3,$4,'free','active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_A, `${P}orgA`, ORG_B, `${P}orgB`]
    );
    await seedDb.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1,$2,$3,'admin','active') ON CONFLICT (id) DO NOTHING`,
      [ACTOR, ORG_A, `${P}actor@example.test`]
    );
  } finally {
    await seedDb.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const orgHeader = req.header('x-test-org');
    const userHeader = req.header('x-test-user');
    if (orgHeader || userHeader) {
      (req as any).user = {
        id: userHeader || ACTOR,
        organizationId: orgHeader || ORG_A,
        role: req.header('x-test-role') || 'admin',
        email: `${P}u@example.test`,
      };
    }
    next();
  });
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });

  const { default: myWorkRoutes } = await import('../../server/src/routes/my-work.routes.js');
  myWorkApp = express();
  myWorkApp.use(express.json());
  myWorkApp.use('/api/my-work', myWorkRoutes);
}, 30_000);

afterEach(() => {
  forceIdeaInsertFailure = false;
});

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM my_idea_maps WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
    await c.query(`DELETE FROM my_ideas WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM organization_members WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
    await c.query(`DELETE FROM users WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('IP1 — OLD behaviour reproduction (root-cause mechanism)', () => {
  it('an INSERT INTO my_ideas failure wrapped in `catch {}` is silently swallowed and nothing lands in the table — the exact shape of the removed code', async () => {
    const c = await db();
    try {
      const badInsert = () =>
        c.query(
          // Deliberately wrong column (mirrors the removed code's own stale
          // "Table may not exist" premise: SOME future/latent schema drift
          // makes this INSERT fail) — the important thing under test is the
          // swallow shape, not which specific error triggers it.
          `INSERT INTO my_ideas (id, user_id, organization_id, title, this_column_does_not_exist)
           VALUES ($1,$2,$3,$4,$5)`,
          [`${P}repro-idea`, ACTOR, ORG_A, 'repro', 'x']
        );

      await expect(badInsert()).rejects.toThrow(/column .* does not exist/i);

      let swallowed = false;
      try {
        await badInsert();
      } catch {
        swallowed = true;
      }
      expect(swallowed).toBe(true);

      const rows = await c.query(`SELECT COUNT(*)::int n FROM my_ideas WHERE id = $1`, [
        `${P}repro-idea`,
      ]);
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });
});

describe('IP2 — NEW behaviour: full transaction completes, correct persistence, lineage', () => {
  it('the idea endpoint responds, persists a real reopenable idea, and lineage points at the exact tool_output_id', async () => {
    const id = await seedSession({ id: `${P}s-happy` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'IP2 idea', description: 'idea body' });

    assertPromotionBranchReached({ status: res.status, body: res.body });
    const ideaId = res.body.id as string;
    expect(ideaId).toBeTruthy();

    const c = await db();
    try {
      const idea = await c.query(
        `SELECT user_id, organization_id, title, body, source_type, source_pack_json FROM my_ideas WHERE id = $1`,
        [ideaId]
      );
      expect(idea.rows.length).toBe(1);
      expect(idea.rows[0].user_id).toBe(ACTOR);
      expect(idea.rows[0].organization_id).toBe(ORG_A);
      expect(idea.rows[0].title).toBe('IP2 idea');
      expect(idea.rows[0].body).toBe('idea body');
      expect(idea.rows[0].source_type).toBe('tool');

      const sourcePack = JSON.parse(idea.rows[0].source_pack_json);

      const output = await c.query(`SELECT id, status FROM tool_outputs WHERE tool_session_id = $1`, [
        id,
      ]);
      expect(output.rows.length).toBe(1);
      expect(output.rows[0].status).toBe('approved'); // "current", not superseded
      expect(sourcePack.tool_output_id).toBe(output.rows[0].id);
      expect(sourcePack.tool_session_id).toBe(id);

      const links = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'idea'`,
        [id]
      );
      expect(links.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });
});

describe('IP3 — reopen after a fresh API import ("restart")', () => {
  it('a freshly-mounted my-work.routes.ts app (simulating a process restart) can GET the idea back by id — from Postgres, no in-memory state', async () => {
    const id = await seedSession({ id: `${P}s-restart` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'IP3 idea' });
    assertPromotionBranchReached({ status: res.status, body: res.body });
    const ideaId = res.body.id as string;

    const token = makeE2EToken(ACTOR, ORG_A);
    const got = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${ideaId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(got.status).toBe(200);
    expect(got.body.title).toBe('IP3 idea');
    expect(got.body.id).toBe(ideaId);
  });
});

describe('IP4 — organization isolation', () => {
  it('org B cannot promote org A\'s session (404), and cannot GET org A\'s idea by id', async () => {
    const id = await seedSession({ id: `${P}s-crossorg`, org: ORG_A });

    const crossOrgAttempt = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_B))
      .send({ outputType: 'idea', title: 'cross-org attempt' });
    expect(crossOrgAttempt.status).toBe(404);

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'IP4 idea' });
    assertPromotionBranchReached({ status: res.status, body: res.body });
    const ideaId = res.body.id as string;

    const c = await db();
    try {
      const inOrgB = await c.query(`SELECT COUNT(*)::int n FROM my_ideas WHERE id = $1 AND organization_id = $2`, [
        ideaId,
        ORG_B,
      ]);
      expect(inOrgB.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }

    // A different real user in a different real org, via the REAL my-work
    // auth path, gets a 404 (private-per-user + org-scoped lookup), not the
    // idea's content.
    const otherUser = `${P}other-user`;
    const tokenOrgB = makeE2EToken(otherUser, ORG_B);
    const got = await request(myWorkApp)
      .get(`/api/my-work/my-ideas/${ideaId}`)
      .set('Authorization', `Bearer ${tokenOrgB}`);
    expect(got.status).toBe(404);
  });
});

describe('IP5 — retry without duplication', () => {
  it('two promotions with the same idempotency key converge on ONE idea, ONE ledger row', async () => {
    const id = await seedSession({ id: `${P}s-retry` });
    const body = { outputType: 'idea', title: 'IP5 idea', idempotencyKey: `${P}retry-key` };

    const first = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: first.status, body: first.body });

    const second = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: second.status, body: second.body });
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const c = await db();
    try {
      const ideas = await c.query(`SELECT COUNT(*)::int n FROM my_ideas WHERE id = $1`, [first.body.id]);
      expect(ideas.rows[0].n).toBe(1);

      const links = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'idea'`,
        [id]
      );
      expect(links.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });
});

describe('IP6 — explicit error when persistence fails (never a false success)', () => {
  it('a forced my_ideas INSERT failure fails the request closed, and a retry with the same key is a controlled 409 — never a fake dedup success', async () => {
    const id = await seedSession({ id: `${P}s-failclosed` });
    const body = { outputType: 'idea', title: 'IP6 idea', idempotencyKey: `${P}failclosed-key` };

    forceIdeaInsertFailure = true;
    const failed = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(failed.status).toBeGreaterThanOrEqual(500);

    const c = await db();
    try {
      const ideas = await c.query(`SELECT COUNT(*)::int n FROM my_ideas WHERE organization_id = $1 AND title = $2`, [
        ORG_A,
        'IP6 idea',
      ]);
      expect(ideas.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }

    // The ledger row WAS claimed up front (canClaimUpfront) before the
    // my_ideas INSERT failed — same documented residual gap as the
    // presentation branch (see ToolController.ts's `respondDeduplicated`
    // comment on its `idea` block). What must NEVER happen is reporting
    // that retry as a success.
    forceIdeaInsertFailure = false;
    const retried = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(retried.status).toBe(409);
    expect(retried.body.deduplicated).not.toBe(true);

    // A genuinely NEW attempt (fresh idempotency key) still succeeds cleanly —
    // the earlier failure does not permanently block this session.
    const freshKeyBody = { ...body, idempotencyKey: `${P}failclosed-key-2` };
    const ok = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(freshKeyBody);
    assertPromotionBranchReached({ status: ok.status, body: ok.body });

    const c2 = await db();
    try {
      const idea = await c2.query(`SELECT COUNT(*)::int n FROM my_ideas WHERE id = $1`, [ok.body.id]);
      expect(idea.rows[0].n).toBe(1);
    } finally {
      await c2.end();
    }
  });
});
