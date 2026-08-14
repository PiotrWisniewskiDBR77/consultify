/**
 * CONTROLLER MERGE — failure-injection suite for the reconciled
 * `ToolController.promoteToOutput` (idempotency wave + tool_outputs
 * canonical-snapshot wave), against REAL Postgres.
 *
 * The three suites already covering the happy/idempotent paths are:
 *   - tests/integration/tools-promotion-race.realdb.test.ts (B: idempotency ledger)
 *   - tests/integration/tools-outputs-immutable.realdb.test.ts (C: canonical snapshot)
 *   - tests/integration/tools-promote-characterization.realdb.test.ts (FAZA 0 baseline)
 *
 * This file adds the explicit FAILURE-MODE coverage the merge task called
 * for: API/downstream unavailability, timeout, duplicate submit/freeze/
 * Output-creation, stale revision, unauthorized access, cross-org
 * read/write, interruption between freeze and Output, Report generation
 * error + duplicate-free retry, and the Initiative-Proposal-needs-an-
 * approved-Output invariant.
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56202/consultinity \
 *   npx vitest run tests/integration/tools-promotion-failure-injection.realdb.test.ts
 */
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
// Route the `initiative` outputType through the funnel path — same
// pre-existing, unrelated `initiatives.priority_order` gap documented in
// tools-outputs-immutable.realdb.test.ts's header (247_initiative_enhancements.sql
// never applies on a fresh strict migration run). Only IJ10 below promotes
// to `initiative`; every other test uses `idea`/`report`/`presentation`.
process.env.INITIATIVE_FUNNEL_ENABLED = 'true';

// ---- Injectable Report Builder failure, toggled per-test -------------------
// `reportBuilderService.createReport` is this controller's one call to
// something that behaves like an external dependency from promoteToOutput's
// point of view (it can fail for reasons unrelated to the promotion request
// itself) — mocking it here is the most honest way to simulate "the Report
// Builder API is unavailable" / "the downstream call timed out" against the
// REAL promoteToOutput handler and REAL Postgres ledger/snapshot writes,
// without touching product code.
let reportFailureMode: 'none' | 'unavailable' | 'timeout' = 'none';

vi.mock('../../server/src/services/reportBuilderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/src/services/reportBuilderService.js')>();
  return {
    ...actual,
    createReport: async (...args: Parameters<typeof actual.createReport>) => {
      if (reportFailureMode === 'unavailable') {
        throw new Error('ECONNREFUSED: Report Builder service unavailable');
      }
      if (reportFailureMode === 'timeout') {
        throw new Error('ETIMEDOUT: downstream report generation timed out');
      }
      return actual.createReport(...args);
    },
  };
});

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `fi-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const ACTOR = `${P}actor`;

let app: Express;
let ensureToolOutputSnapshot: (typeof import(
  '../../server/src/services/tools/toolOutputSnapshotService.js'
))['ensureToolOutputSnapshot'];

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org: string, user = ACTOR) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/** Same engine-valid SWOT fixture shape as tools-outputs-immutable's — guarantees
 * a non-empty `conclusions` array (IJ10 needs a real conclusion to point at). */
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

async function seedSession(opts: {
  id: string;
  org?: string;
  version?: number;
  toolType?: string;
  withAnswers?: boolean;
}): Promise<string> {
  const org = opts.org ?? ORG_A;
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, created_by, updated_by, version, created_at, updated_at)
       VALUES ($1,$2,NULL,$3,$4,'APPROVED',100,4.5,$5,$6,$6,$7,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'APPROVED', version = EXCLUDED.version`,
      [
        opts.id,
        org,
        opts.toolType ?? 'dynamic-swot',
        `fi session ${opts.id}`,
        opts.withAnswers === false ? '{}' : JSON.stringify(swotAnswers()),
        ACTOR,
        opts.version ?? 1,
      ]
    );
  } finally {
    await c.end();
  }
  return opts.id;
}

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
  const svc = await import('../../server/src/services/tools/toolOutputSnapshotService.js');
  ensureToolOutputSnapshot = svc.ensureToolOutputSnapshot;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const orgHeader = req.header('x-test-org');
    const userHeader = req.header('x-test-user');
    // IJ8 (unauthorized): a request with NO auth headers at all gets NO
    // `req.user` — exactly what an unauthenticated caller looks like to this
    // handler (`if (!user) res.status(401)`).
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
}, 30_000);

afterEach(() => {
  reportFailureMode = 'none';
});

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_output_initiative_proposals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_report_sources WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_reports WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM initiatives WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM my_ideas WHERE organization_id IN ($1,$2) AND source_type = 'tool'`, [ORG_A, ORG_B]);
    await c.query(
      `DELETE FROM report_builder_sections WHERE report_id IN
        (SELECT id FROM report_builder_reports WHERE organization_id IN ($1,$2))`,
      [ORG_A, ORG_B]
    );
    await c.query(`DELETE FROM report_builder_reports WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM users WHERE id = $1`, [ACTOR]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('Controller-merge failure injection — promoteToOutput', () => {
  it('IJ1: downstream Report Builder unavailable — fails closed, no orphan ledger row, canonical snapshot stays frozen (interruption BETWEEN freeze and Output)', async () => {
    const id = await seedSession({ id: `${P}s-unavail` });
    reportFailureMode = 'unavailable';

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'report', title: 'IJ1 report' });

    expect(res.status).toBeGreaterThanOrEqual(500);

    const c = await db();
    try {
      // The snapshot ("freeze") step runs BEFORE the report-creation call,
      // so it already committed — this is the "interruption between freeze
      // and Output" case: the freeze survives even though downstream failed.
      const output = await c.query(`SELECT status FROM tool_outputs WHERE tool_session_id = $1`, [id]);
      expect(output.rows.length).toBe(1);
      expect(output.rows[0].status).toBe('approved');

      // No ledger row: `report` is create-then-claim, and content creation
      // (createReport) failed BEFORE the claim insert was ever attempted —
      // a failed downstream call must not fabricate a promotion record.
      const link = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'report'`,
        [id]
      );
      expect(link.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('IJ2: downstream timeout — same fail-closed behavior as an outright failure', async () => {
    const id = await seedSession({ id: `${P}s-timeout` });
    reportFailureMode = 'timeout';

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'report', title: 'IJ2 report' });

    expect(res.status).toBeGreaterThanOrEqual(500);

    const c = await db();
    try {
      const link = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'report'`,
        [id]
      );
      expect(link.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('IJ3: report retry after the downstream failure clears succeeds and creates exactly ONE report (no duplication from the failed attempt)', async () => {
    const id = await seedSession({ id: `${P}s-retry` });
    const body = { outputType: 'report', title: 'IJ3 report' };

    reportFailureMode = 'unavailable';
    const failed = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(failed.status).toBeGreaterThanOrEqual(500);

    reportFailureMode = 'none';
    const retried = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: retried.status, body: retried.body });
    expect(retried.body.deduplicated).not.toBe(true);

    // A SECOND retry with the same payload must now dedupe against the
    // successful one, not create a third.
    const again = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: again.status, body: again.body });
    expect(again.body.deduplicated).toBe(true);
    expect(again.body.id).toBe(retried.body.id);

    const c = await db();
    try {
      const links = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'report'`,
        [id]
      );
      expect(links.rows[0].n).toBe(1);

      const reports = await c.query(
        `SELECT COUNT(*)::int n FROM report_builder_reports WHERE id = $1`,
        [retried.body.id]
      );
      expect(reports.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  it('IJ4: duplicate submit — two sequential identical HTTP promotions converge on the SAME id, one row', async () => {
    const id = await seedSession({ id: `${P}s-dupsubmit`, toolType: 'dynamic-swot' });
    const body = { outputType: 'idea', title: 'IJ4 duplicate submit' };

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
    } finally {
      await c.end();
    }
  });

  it('IJ5: duplicate freeze — calling ensureToolOutputSnapshot twice for the same session returns the identical snapshot, not a second freeze', async () => {
    const id = await seedSession({ id: `${P}s-dupfreeze` });

    const c1 = await db();
    let session: any;
    try {
      session = (await c1.query(`SELECT * FROM tool_sessions WHERE id = $1`, [id])).rows[0];
    } finally {
      await c1.end();
    }
    const sourceSession = {
      id: session.id,
      organization_id: session.organization_id,
      project_id: session.project_id,
      tool_type: session.tool_type,
      name: session.name,
      answers_json: session.answers_json,
      version: session.version,
    };

    const now = new Date().toISOString();
    const first = await ensureToolOutputSnapshot(sourceSession, { id: ACTOR }, now);
    const second = await ensureToolOutputSnapshot(sourceSession, { id: ACTOR }, new Date().toISOString());

    expect(second.id).toBe(first.id);
    expect(second.contentHash).toBe(first.contentHash);
    // `approvedAt` round-trips through pg as a `Date` object on repeated
    // reads — compare by value (ISO string), not by reference/`toBe`.
    expect(new Date(second.approvedAt as unknown as string).toISOString()).toBe(
      new Date(first.approvedAt as unknown as string).toISOString()
    );

    const c2 = await db();
    try {
      const rows = await c2.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [id]);
      expect(rows.rows[0].n).toBe(1);
      const approvals = await c2.query(
        `SELECT COUNT(*)::int n FROM tool_output_approvals a JOIN tool_outputs o ON o.id = a.tool_output_id
          WHERE o.tool_session_id = $1`,
        [id]
      );
      // Two actions (submitted + approved), written ONCE — not doubled by the
      // second ensureToolOutputSnapshot call.
      expect(approvals.rows[0].n).toBe(2);
    } finally {
      await c2.end();
    }
  });

  it('IJ6: duplicate Output creation — N concurrent ensureToolOutputSnapshot calls converge on exactly ONE tool_outputs row (DB-enforced)', async () => {
    const id = await seedSession({ id: `${P}s-dupoutput` });

    const c1 = await db();
    let session: any;
    try {
      session = (await c1.query(`SELECT * FROM tool_sessions WHERE id = $1`, [id])).rows[0];
    } finally {
      await c1.end();
    }
    const sourceSession = {
      id: session.id,
      organization_id: session.organization_id,
      project_id: session.project_id,
      tool_type: session.tool_type,
      name: session.name,
      answers_json: session.answers_json,
      version: session.version,
    };

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        ensureToolOutputSnapshot(sourceSession, { id: ACTOR }, new Date().toISOString())
      )
    );
    const ids = new Set(results.map((r) => r.id));
    expect(ids.size).toBe(1);

    const c2 = await db();
    try {
      const rows = await c2.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [id]);
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await c2.end();
    }
  });

  it('IJ7: stale revision — editing the session after a promotion never mutates/collides with the OLD revision\'s result, even when the SAME idempotency key is reused', async () => {
    const id = await seedSession({ id: `${P}s-stale`, version: 1 });
    const key = `${P}stale-key`;

    const v1 = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'stale v1', idempotencyKey: key });
    assertPromotionBranchReached({ status: v1.status, body: v1.body });
    expect(v1.body.sourceVersion).toBe(1);

    const c = await db();
    try {
      await c.query(`UPDATE tool_sessions SET version = 2 WHERE id = $1`, [id]);
    } finally {
      await c.end();
    }

    // `source_revision` is always read fresh from the CURRENT session state
    // at request time (never trusted from the client) — so reusing the SAME
    // explicit idempotencyKey after the session moved to revision 2 does NOT
    // collide with the revision-1 ledger row (which is keyed by
    // source_revision=1): it correctly starts a NEW, independent revision-2
    // promotion instead of silently returning — or worse, overwriting —
    // the stale revision-1 result.
    const sameKeyAtV2 = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'reused key at v2', idempotencyKey: key });
    assertPromotionBranchReached({ status: sameKeyAtV2.status, body: sameKeyAtV2.body });
    expect(sameKeyAtV2.body.sourceVersion).toBe(2);
    expect(sameKeyAtV2.body.deduplicated).not.toBe(true);
    expect(sameKeyAtV2.body.id).not.toBe(v1.body.id);

    // The OLD (revision-1) ledger row and its underlying content are
    // completely untouched by the revision-2 request that reused its key —
    // this is the actual "stale revision" guarantee: history is immutable.
    const c2 = await db();
    try {
      const v1Link = await c2.query(
        `SELECT source_revision, initiative_id FROM tool_initiative_links
          WHERE tool_session_id = $1 AND output_type = 'idea' AND source_revision = 1`,
        [id]
      );
      expect(v1Link.rows.length).toBe(1);
      expect(v1Link.rows[0].initiative_id).toBe(v1.body.id);

      const v1Idea = await c2.query(`SELECT title FROM my_ideas WHERE id = $1`, [v1.body.id]);
      expect(v1Idea.rows[0].title).toBe('stale v1');
    } finally {
      await c2.end();
    }

    // Idempotency still functions correctly going forward AT the new
    // revision: a genuine retry of the revision-2 request (same key, same
    // payload, session still at version 2) dedupes onto the SAME id.
    const retryAtV2 = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'reused key at v2', idempotencyKey: key });
    assertPromotionBranchReached({ status: retryAtV2.status, body: retryAtV2.body });
    expect(retryAtV2.body.deduplicated).toBe(true);
    expect(retryAtV2.body.id).toBe(sameKeyAtV2.body.id);
  });

  it('IJ8: unauthorized — a request with no user context is rejected with 401 before touching the database', async () => {
    const id = await seedSession({ id: `${P}s-unauth` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .send({ outputType: 'idea', title: 'no auth' });
    // No x-test-* headers => no req.user attached by the harness middleware.
    expect(res.status).toBe(401);

    const c = await db();
    try {
      const rows = await c.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [id]);
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('IJ9: cross-organization read/write — org B cannot see org A session (404) and writes NOTHING under either org', async () => {
    const id = await seedSession({ id: `${P}s-crossorg`, org: ORG_A });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_B))
      .send({ outputType: 'idea', title: 'cross-org attempt' });
    expect(res.status).toBe(404);

    const c = await db();
    try {
      const output = await c.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [id]);
      expect(output.rows[0].n).toBe(0);
      const link = await c.query(`SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1`, [
        id,
      ]);
      expect(link.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }

    // Org A (the real owner) can still promote it normally afterward — the
    // rejected cross-org attempt left the session fully usable.
    const ok = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'legit org A promotion' });
    assertPromotionBranchReached({ status: ok.status, body: ok.body });
  });

  it('IJ10: Initiative Proposal invariant — every tool_output_initiative_proposals row points at an APPROVED tool_outputs row, never draft/in_review', async () => {
    const id = await seedSession({ id: `${P}s-proposal` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'initiative', title: 'IJ10 initiative' });
    assertPromotionBranchReached({ status: res.status, body: res.body });

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT p.id AS proposal_id, o.status AS output_status
           FROM tool_output_initiative_proposals p
           JOIN tool_outputs o ON o.id = p.tool_output_id
          WHERE o.tool_session_id = $1`,
        [id]
      );
      expect(rows.rows.length).toBe(1);
      // The structural guarantee this proves: `recordInitiativeProposal` is
      // only ever invoked (from promoteToOutput) with the `canonicalOutput`
      // returned by `ensureToolOutputSnapshot`, which always runs
      // `submitForReview` -> `approveOutput` before persisting/returning —
      // there is no code path that reaches it with a draft/in_review output.
      expect(rows.rows[0].output_status).toBe('approved');
    } finally {
      await c.end();
    }
  });
});
