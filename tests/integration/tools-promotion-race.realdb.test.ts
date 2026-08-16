/**
 * C15/C16 close-out — real concurrent-race proof for
 * `ToolController.promoteToOutput`, against the real controller and a real
 * Postgres instance (not mocks, not SQLite).
 *
 * This is the TASK 3 deliverable for the C15/C16 idempotency work
 * (docs/program/METHOD_TOOLS_2026-08-13/IDP_SEMANTICS.md). It supersedes
 * the lenient characterization in `tools-promote-characterization.realdb
 * .test.ts`'s `C16` test (which only *logs* whether a duplicate occurred —
 * `expect(n).toBeGreaterThanOrEqual(0)` — because at the time it was
 * written there was no DB-level protection to assert against). This suite
 * asserts the hard invariant the new `uq_tool_initiative_links_promotion`
 * unique index (server/migrations/948_tool_promotion_idempotency.sql) is
 * supposed to guarantee.
 *
 * Bootstrap requirement: the FULL migration set, not the controller's own
 * `ensureToolsSchema()` self-bootstrap. FAZA 0's `C7` test found that a
 * minimal, controller-only-bootstrapped schema 500s on the `permissions`
 * table before ever reaching the idempotency-relevant code — confirmed
 * again while building this suite. Run:
 *
 *   docker run -d --name cfy-wt-idem -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_USER=consultinity -e POSTGRES_DB=consultinity \
 *     -p 56102:5432 pgvector/pgvector:pg15
 *   NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56102/consultinity \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56102/consultinity \
 *     npx vitest run tests/integration/tools-promotion-race.realdb.test.ts
 *
 * (plain `postgres:15-alpine` also works IF the migration set's one
 * `vector`-extension-dependent file is not needed for this suite's tables —
 * `pgvector/pgvector:pg15` is used here so the FULL set applies cleanly,
 * per the note in 948's own header about `291_tools_initiatives.sql` never
 * running under the strict/managed migration path.)
 *
 * WHY `outputType: 'idea'` (and `'presentation'`) here, not `'initiative'`:
 * running this suite against a fully-migrated schema surfaced a genuine,
 * PRE-EXISTING, unrelated bug — `ToolController.promoteToOutput`'s
 * non-funnel initiative branch (and `ToolInitiativeService
 * .persistInitiatives`) INSERTs a `priority_order` column into
 * `initiatives`, but the canonical strict/managed schema's `initiatives`
 * table has no such column (the migration that used to add it,
 * `247_initiative_enhancements.sql`, is < 500 and excluded from the strict
 * migration path by `migrate.postgres.ts`'s `isSqliteOnlyMigration()` — the
 * same class of gap `948_tool_promotion_idempotency.sql`'s header documents
 * for `291_tools_initiatives.sql`). Every `outputType: 'initiative'`
 * promotion (funnel disabled) 500s on `column "priority_order" of relation
 * "initiatives" does not exist` against this schema. That bug is orthogonal
 * to C15/C16 (it would 500 on a SINGLE, non-concurrent promotion too) and
 * is out of this task's scope — flagged separately, not silently patched
 * here. `idea` (writes `my_ideas`) and `presentation` (writes
 * `v8_artifact_runs`) exercise the exact same claim-then-create code path
 * in `promoteToOutput` without hitting that unrelated defect, so they are
 * used here to prove the actual thing this suite is responsible for.
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

const DATABASE_URL = process.env.DATABASE_URL || '';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Exercise the claim-before-create path deliberately (see IDP_SEMANTICS.md
// §11 / 948's header): funnel-enabled initiatives mint their own id and
// cannot be pre-claimed, so a race there could still leave one orphan
// initiative row even with the ledger constraint doing its job. Disabling
// it here means the primary race assertion below proves BOTH "one ledger
// row" and "one underlying content row" — not just the former.
delete process.env.INITIATIVE_FUNNEL_ENABLED;

const P = `race-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const USER = `${P}user`;

// vitest.config.ts sets `retry: 1` locally / `3` in CI — a retried `it()`
// re-runs the SAME callback in the SAME process, but `P` above is computed
// ONCE at module load. A fixed-per-file session id (e.g. uid('s-race'))
// would let a retry silently reuse committed state from the first,
// possibly-flaky attempt (e.g. every request on the retry sees the
// already-promoted row and reports `deduplicated:true`, breaking "exactly
// one fresh create" for a reason that has nothing to do with idempotency).
// Generate a genuinely fresh id per CALL instead, so every attempt —
// original or retried — starts from a clean session.
let uidCounter = 0;
const uid = (label: string): string => `${P}${label}-${Date.now()}-${uidCounter++}`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

/**
 * confidence_avg is 0-5 (NOT 0-1) — seeding e.g. 0.9 keeps every promotion
 * below MIN_PROMOTION_CONFIDENCE and gate-blocks it forever (FAZA 0's
 * documented false-green trap). 4.5 is comfortably above the >= 3 gate.
 */
async function seedSession(opts: {
  id: string;
  org: string;
  status?: string;
  toolType?: string;
  version?: number;
}): Promise<string> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, created_by, updated_by, version, created_at, updated_at)
       VALUES ($1,$2,NULL,$3,$4,$5,100,4.5,$6,$7,$7,$8,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
      [
        opts.id,
        opts.org,
        opts.toolType ?? 'dynamic-swot',
        `race ${opts.id}`,
        opts.status ?? 'APPROVED',
        JSON.stringify({
          items: [
            {
              id: 's1',
              text: 'Verified customer retention strength',
              quadrant: 'strengths',
              proposalStatus: 'accepted',
              evidenceStatus: 'confirmed',
            },
          ],
        }),
        USER,
        opts.version ?? 1,
      ]
    );
  } finally {
    await c.end();
  }
  return opts.id;
}

function as(org: string, role = 'admin', user = USER) {
  return { 'x-test-org': org, 'x-test-role': role, 'x-test-user': user };
}

beforeAll(async () => {
  // Hard fail (not skip) on a misconfigured run — proves the connection
  // with real queries (SELECT version()/current_database()), not just env
  // var presence. See assertRealPostgres.ts.
  await assertRealPostgresTestEnvironment({ expectedDatabase: 'consultinity' });

  // `audit_log.organization_id` has a real FK to `organizations` — without
  // a matching row, every promotion's (self-swallowed, see `logAudit`'s own
  // try/catch) audit insert fails and logs noise. Not required for
  // correctness, but keeps the test run's console signal-to-noise sane.
  const seedDb = await db();
  try {
    await seedDb.query(
      `INSERT INTO organizations (id, name) VALUES ($1, $1), ($2, $2) ON CONFLICT (id) DO NOTHING`,
      [ORG_A, ORG_B]
    );
  } catch {
    // If `organizations.name` isn't a real/required column on some schema
    // variant, the audit-log noise is harmless — don't fail setup over it.
  } finally {
    await seedDb.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || USER,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // JSON error surface instead of Express's default HTML handler, so a
  // regression shows up as a readable message/code in the response body
  // rather than an opaque empty body.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message || 'unknown', code: err?.code });
  });
}, 60_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_initiative_links WHERE organization_id IN ($1,$2)`, [
      ORG_A,
      ORG_B,
    ]);
    await c.query(
      `DELETE FROM my_ideas WHERE organization_id IN ($1,$2) AND source_type = 'tool'`,
      [ORG_A, ORG_B]
    );
    // NOTE: no `v8_artifact_runs` cleanup — see the `presentation` finding
    // below. The controller's INSERT into that table (ToolController.ts,
    // outputType === 'presentation' branch) targets columns
    // (id, artifact_type, output_type, status, config_json, result_json,
    // created_by, updated_at) that do NOT exist on the real, fully-migrated
    // `v8_artifact_runs` schema (real columns: run_id, execution_run_id,
    // context_snapshot_id, trigger_type, requested_by_user_id, plan_json,
    // run_status, ...) — a pre-existing, unrelated mismatch caught by the
    // branch's own `catch { /* Table may not exist */ }`, so it silently
    // no-ops rather than 500ing. Confirmed nothing is ever written there by
    // this suite's `presentation` promotion. Out of scope for C15/C16;
    // flagged separately.
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c
      .query(`DELETE FROM audit_log WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
    await c
      .query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B])
      .catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('C15/C16 — tool_initiative_links promotion idempotency (real Postgres)', () => {
  it('genuinely concurrent identical promotions converge on exactly ONE ledger row and ONE output row, with no 500s and complete lineage', async () => {
    const id = await seedSession({ id: uid('s-race'), org: ORG_A });
    const body = { outputType: 'idea', title: 'race winner' };
    const CONCURRENCY = 25;

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body)
      )
    );

    // 1) Prove every one of the concurrent requests actually reached the
    //    promotion branch — none bounced off the eligibility gate (which
    //    would make every assertion below pass vacuously). Every response
    //    here is expected to be a genuine success (fresh create or
    //    deduplicated replay), so this must hold for ALL of them, not just
    //    one.
    results.forEach((r) => assertPromotionBranchReached({ status: r.status, body: r.body }));

    // 2) No hidden 500s. Every response must be a definite outcome: 2xx
    //    (won the race or got the deduplicated result) — never an
    //    unhandled crash surfaced as 500.
    const serverErrors = results.filter((r) => r.status >= 500);
    if (serverErrors.length > 0) {
      throw new Error(
        `${serverErrors.length}/${CONCURRENCY} requests 500'd: ` +
          JSON.stringify(serverErrors[0].body).slice(0, 500)
      );
    }
    results.forEach((r) => expect(r.status).toBeLessThan(300));

    // 3) Every response converges on the SAME id — the winner's id, for
    //    every single one of the N concurrent callers.
    const ids = new Set(results.map((r) => r.body?.id));
    expect(ids.size).toBe(1);
    const canonicalId = [...ids][0];
    expect(canonicalId).toBeTruthy();

    // Exactly one of the N responses should be the "fresh create"
    // (deduplicated undefined/false); the rest must say deduplicated: true.
    const fresh = results.filter((r) => !r.body?.deduplicated);
    const deduped = results.filter((r) => r.body?.deduplicated === true);
    expect(fresh.length).toBe(1);
    expect(deduped.length).toBe(CONCURRENCY - 1);

    const c = await db();
    try {
      // 4) Exactly ONE ledger row for this (org, session, revision,
      //    output_type, idempotency_key) — the actual C15 guarantee.
      const linkRows = await c.query(
        `SELECT id, initiative_id, organization_id, tool_session_id, source_revision, output_type, idempotency_key
           FROM tool_initiative_links
          WHERE organization_id = $1 AND tool_session_id = $2 AND output_type = 'idea'`,
        [ORG_A, id]
      );
      expect(linkRows.rows.length).toBe(1);
      expect(linkRows.rows[0].initiative_id).toBe(canonicalId);
      // Lineage: session id + org on the ledger row match the source session.
      expect(linkRows.rows[0].tool_session_id).toBe(id);
      expect(linkRows.rows[0].organization_id).toBe(ORG_A);

      // 5) Exactly ONE underlying `my_ideas` row — proving the
      //    claim-before-create ordering for this output type actually
      //    prevented orphan content, not just a duplicate ledger entry.
      const ideaRows = await c.query(
        `SELECT id, organization_id, source_type FROM my_ideas
          WHERE id = $1 AND organization_id = $2`,
        [canonicalId, ORG_A]
      );
      expect(ideaRows.rows.length).toBe(1);
      expect(ideaRows.rows[0].organization_id).toBe(ORG_A);
      expect(ideaRows.rows[0].source_type).toBe('tool');

      // No orphans: confirm there is NOT some other my_ideas row sharing
      // this test's exact title (would indicate the claim-before-create
      // ordering did not actually prevent content creation on a losing
      // request — a loser must never reach the `INSERT INTO my_ideas`
      // statement at all).
      const allIdeasWithThisTitle = await c.query(
        `SELECT COUNT(*)::int n FROM my_ideas WHERE organization_id = $1 AND title = $2`,
        [ORG_A, body.title]
      );
      expect(allIdeasWithThisTitle.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  }, 30_000);

  it('a retry AFTER the race has fully settled still returns the same id (idempotent replay, not a second create)', async () => {
    const id = await seedSession({ id: uid('s-replay'), org: ORG_A });
    const body = { outputType: 'idea', title: 'replay target' };

    const first = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(first.status).toBeLessThan(300);

    const second = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(second.status).toBeLessThan(300);
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links
          WHERE organization_id = $1 AND tool_session_id = $2 AND output_type = 'idea'`,
        [ORG_A, id]
      );
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  }, 20_000);

  it('the SAME idempotency key with a DIFFERENT payload is rejected with 409, not silently swapped', async () => {
    const id = await seedSession({ id: uid('s-conflict'), org: ORG_A });

    const first = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'original title' });
    expect(first.status).toBeLessThan(300);

    const conflicting = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'DIFFERENT title, same implicit key' });

    expect(conflicting.status).toBe(409);
    expect(String(conflicting.body.error)).toMatch(/different payload/i);

    const c = await db();
    try {
      // No second row was created by the rejected request.
      const rows = await c.query(
        `SELECT COUNT(*)::int n, array_agg(initiative_id) ids FROM tool_initiative_links
          WHERE organization_id = $1 AND tool_session_id = $2 AND output_type = 'idea'`,
        [ORG_A, id]
      );
      expect(rows.rows[0].n).toBe(1);
      // The original title's idea is untouched (the rejected request never
      // got the chance to overwrite it).
      const idea = await c.query(`SELECT title FROM my_ideas WHERE id = $1`, [rows.rows[0].ids[0]]);
      expect(idea.rows[0].title).toBe('original title');
    } finally {
      await c.end();
    }
  }, 20_000);

  it('a DIFFERENT output_type for the same session coexists — does not collide with an existing promotion', async () => {
    const id = await seedSession({ id: uid('s-multitype'), org: ORG_A });

    const asIdea = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'multi-type idea' });
    expect(asIdea.status).toBeLessThan(300);

    const asPresentation = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'presentation', title: 'multi-type presentation' });
    expect(asPresentation.status).toBeLessThan(300);

    expect(asPresentation.body.id).not.toBe(asIdea.body.id);

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT output_type, COUNT(*)::int n FROM tool_initiative_links
          WHERE organization_id = $1 AND tool_session_id = $2
          GROUP BY output_type ORDER BY output_type`,
        [ORG_A, id]
      );
      expect(rows.rows).toEqual([
        { output_type: 'idea', n: 1 },
        { output_type: 'presentation', n: 1 },
      ]);
    } finally {
      await c.end();
    }
  }, 20_000);

  it('a different source_revision (session edited after promotion) creates a NEW row instead of returning the stale one', async () => {
    const id = await seedSession({ id: uid('s-revision'), org: ORG_A, version: 1 });

    const v1 = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'revision 1' });
    expect(v1.status).toBeLessThan(300);
    expect(v1.body.sourceVersion).toBe(1);

    const c = await db();
    try {
      await c.query(`UPDATE tool_sessions SET version = 2 WHERE id = $1`, [id]);
    } finally {
      await c.end();
    }

    const v2 = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'revision 2' });
    expect(v2.status).toBeLessThan(300);
    expect(v2.body.sourceVersion).toBe(2);
    expect(v2.body.deduplicated).not.toBe(true);
    expect(v2.body.id).not.toBe(v1.body.id);

    const c2 = await db();
    try {
      const rows = await c2.query(
        `SELECT source_revision, initiative_id FROM tool_initiative_links
          WHERE organization_id = $1 AND tool_session_id = $2 AND output_type = 'idea'
          ORDER BY source_revision ASC`,
        [ORG_A, id]
      );
      expect(rows.rows.map((r: any) => r.source_revision)).toEqual([1, 2]);
      expect(rows.rows[0].initiative_id).toBe(v1.body.id);
      expect(rows.rows[1].initiative_id).toBe(v2.body.id);
    } finally {
      await c2.end();
    }
  }, 20_000);

  it('organizations do not share the idempotency-key namespace', async () => {
    // Deliberately create sessions in TWO different orgs with the exact
    // same session id suffix pattern is not possible (tool_sessions.id is
    // globally unique) — the real cross-tenant risk this constraint guards
    // against is a SHARED idempotency_key value (e.g. a client-supplied one)
    // being reused across two different organizations' sessions and, absent
    // organization_id in the key, colliding. Simulate that directly: two
    // sessions (one per org) promoted with the SAME explicit idempotencyKey.
    const idA = await seedSession({ id: uid('s-tenantA'), org: ORG_A });
    const idB = await seedSession({ id: uid('s-tenantB'), org: ORG_B });
    const sharedKey = `${P}shared-key`;

    const resA = await request(app)
      .post(`/api/tools/${idA}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'org A promotion', idempotencyKey: sharedKey });
    const resB = await request(app)
      .post(`/api/tools/${idB}/promote`)
      .set(as(ORG_B))
      .send({ outputType: 'idea', title: 'org B promotion', idempotencyKey: sharedKey });

    expect(resA.status).toBeLessThan(300);
    expect(resB.status).toBeLessThan(300);
    expect(resA.body.deduplicated).not.toBe(true);
    expect(resB.body.deduplicated).not.toBe(true);
    expect(resA.body.id).not.toBe(resB.body.id);

    const c = await db();
    try {
      const rows = await c.query(
        `SELECT organization_id, tool_session_id FROM tool_initiative_links WHERE idempotency_key = $1 ORDER BY organization_id`,
        [sharedKey]
      );
      expect(rows.rows.length).toBe(2);
      expect(rows.rows.map((r: any) => r.organization_id).sort()).toEqual([ORG_A, ORG_B].sort());
    } finally {
      await c.end();
    }
  }, 20_000);
});
