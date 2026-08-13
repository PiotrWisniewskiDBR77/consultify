/**
 * STREAM 2 — presentation persistence regression suite, against REAL Postgres.
 *
 * THE DEFECT (confirmed by a browser+SQL E2E run, not theory): in
 * `ToolController.promoteToOutput`, the `outputType === 'presentation'`
 * branch used to INSERT into `v8_artifact_runs` with a column set
 * (id/artifact_type/output_type/status/config_json/result_json) that does
 * not exist on that table at all — verified below in PP1 against the real
 * schema. A `try/catch { /* Table may not exist * / }` around it silently
 * swallowed the resulting error, so the HTTP call returned 200/201 while
 * writing NOTHING that made the presentation visible: `tool_reports` /
 * `tool_report_sources` lineage was written correctly, but no
 * `presentation_decks` row and no `v8_output_artifacts` registration ever
 * existed, so the deck was invisible in every Outputs/Reports-and-
 * Presentations list, get and reopen surface.
 *
 * THE FIX: `v8_artifact_runs` is a chat-driven artifact PLANNING/RETRY
 * envelope (server/migrations/20260324_v81_artifact_runs_wave1.sql owns it;
 * requires execution_run_id/context_snapshot_id/trigger_type/plan_json —
 * none of which this promotion has) — this branch stops writing to it
 * entirely. It now materializes a real, deterministic `presentation_decks`
 * row (+ `presentation_cards`) via the same canonical
 * `buildDeckDocumentFromStructuredSlides` builder MAT-007/009 introduced,
 * and registers it in `v8_output_artifacts` via
 * `artifactRegistryService.registerArtifactOrigin` — the table that
 * ACTUALLY backs the Outputs/Reports-and-Presentations list/get/reopen
 * surfaces (confirmed by presentations.routes.ts's own
 * `syncArtifactRegistryForDeck`, and by artifacts.routes.ts's
 * `buildActionTargetPayload`, which routes `originRuntime: 'presentation'`
 * to `/presentations/builder/${originRecordId}` for reopen). A failed
 * registration now throws (fail closed) instead of being swallowed.
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56600/consultinity \
 *   npx vitest run tests/integration/tools-presentation-persistence.realdb.test.ts
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

// ---- Injectable registry failure, toggled per-test -------------------------
// `artifactRegistryService.registerArtifactOrigin` is the one call in the
// fixed branch that can fail for reasons unrelated to the promotion request
// itself (a rejected constraint, a re-read miss — see its own doc comment on
// `DbPromise`'s `fallback: true` default). Mocking it here, against the REAL
// promoteToOutput handler and REAL Postgres, is how PP6 proves the NEW
// fail-closed behaviour without needing to fabricate a real DB outage.
let forceRegistrationFailure = false;

vi.mock('../../server/src/services/v8/artifactRegistryService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../server/src/services/v8/artifactRegistryService.js')>();
  return {
    ...actual,
    registerArtifactOrigin: async (...args: Parameters<typeof actual.registerArtifactOrigin>) => {
      if (forceRegistrationFailure) return null;
      return actual.registerArtifactOrigin(...args);
    },
  };
});

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `pp-${Date.now()}-`;
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

/** Same engine-valid SWOT fixture shape used by the sibling realdb suites —
 * guarantees a non-empty `conclusions` array (needed for the slide builder
 * to produce more than the "no conclusions" fallback slide). */
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
      [opts.id, org, `pp session ${opts.id}`, JSON.stringify(swotAnswers()), ACTOR, opts.version ?? 1]
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
}, 30_000);

afterEach(() => {
  forceRegistrationFailure = false;
});

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM v8_output_artifacts WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(
      `DELETE FROM presentation_cards WHERE deck_id IN
        (SELECT id FROM presentation_decks WHERE organization_id IN ($1,$2))`,
      [ORG_A, ORG_B]
    );
    await c.query(`DELETE FROM presentation_decks WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_report_sources WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_reports WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM v8_artifact_runs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM users WHERE id = $1`, [ACTOR]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('PP1 — OLD behaviour reproduction (root-cause mechanism)', () => {
  it('the removed v8_artifact_runs INSERT column set does not exist on the real table — proves WHY the old code always failed', async () => {
    const c = await db();
    try {
      // Verbatim column set the OLD promoteToOutput presentation branch used
      // (git history: server/src/controllers/ToolController.ts before this
      // fix). Run directly against the real schema this worktree bootstrapped
      // via migrate.postgres.ts.
      const oldInsert = () =>
        c.query(
          `INSERT INTO v8_artifact_runs (
             id, organization_id, artifact_type, output_type, status,
             config_json, result_json, created_by, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            `${P}repro-run`,
            ORG_A,
            'tool_promotion',
            'presentation',
            'completed',
            '{}',
            '{}',
            ACTOR,
            new Date().toISOString(),
            new Date().toISOString(),
          ]
        );

      await expect(oldInsert()).rejects.toThrow(/column .* does not exist/i);

      // Reproduce the OLD `catch { /* Table may not exist */ }` shape: the
      // error above is swallowed exactly like the removed code did, and
      // nothing lands in the table — this is the "API pretends success"
      // mechanism in miniature.
      let swallowed = false;
      try {
        await oldInsert();
      } catch {
        swallowed = true;
      }
      expect(swallowed).toBe(true);

      const rows = await c.query(`SELECT COUNT(*)::int n FROM v8_artifact_runs WHERE run_id = $1`, [
        `${P}repro-run`,
      ]);
      expect(rows.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });
});

describe('PP2 — NEW behaviour: full transaction completes, correct persistence, org scope, exact lineage', () => {
  it('the presentation endpoint responds, persists a real reopenable deck, registers it, and writes lineage to the exact tool_output_id — never touching v8_artifact_runs', async () => {
    const id = await seedSession({ id: `${P}s-happy` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'presentation', title: 'PP2 presentation' });

    assertPromotionBranchReached({ status: res.status, body: res.body });
    const artifactId = res.body.id as string;
    expect(artifactId).toBeTruthy();

    const c = await db();
    try {
      // 1. presentation_decks: a REAL, org-scoped, reopenable deck.
      const deck = await c.query(
        `SELECT organization_id, title, status, slide_count, deck_json FROM presentation_decks WHERE id = $1`,
        [artifactId]
      );
      expect(deck.rows.length).toBe(1);
      expect(deck.rows[0].organization_id).toBe(ORG_A);
      expect(deck.rows[0].title).toBe('PP2 presentation');
      expect(deck.rows[0].slide_count).toBeGreaterThan(0);
      const deckJson = JSON.parse(deck.rows[0].deck_json);
      expect(deckJson.schemaVersion).toBe(1);
      expect(Array.isArray(deckJson.cards)).toBe(true);
      expect(deckJson.cards.length).toBe(deck.rows[0].slide_count);

      // 2. presentation_cards: real per-slide rows, not just a count column.
      const cards = await c.query(
        `SELECT COUNT(*)::int n FROM presentation_cards WHERE deck_id = $1`,
        [artifactId]
      );
      expect(cards.rows[0].n).toBe(deck.rows[0].slide_count);

      // 3. v8_output_artifacts + v8_artifact_origin_links: the ACTUAL Outputs
      // registry (list/get/reopen backing table) — org-scoped, correct family.
      const link = await c.query(
        `SELECT l.artifact_id, l.organization_id, a.output_type, a.artifact_family, a.visibility_scope
           FROM v8_artifact_origin_links l
           JOIN v8_output_artifacts a ON a.artifact_id = l.artifact_id
          WHERE l.organization_id = $1 AND l.origin_runtime = 'presentation' AND l.origin_record_id = $2`,
        [ORG_A, artifactId]
      );
      expect(link.rows.length).toBe(1);
      expect(link.rows[0].output_type).toBe('presentation');
      expect(link.rows[0].artifact_family).toBe('presentation');

      // 4. Lineage to the EXACT tool_output_id: tool_report_sources must
      // point at the same tool_outputs row promoteToOutput actually froze
      // for this session (ensureToolOutputSnapshot's canonical snapshot).
      const output = await c.query(
        `SELECT id, status FROM tool_outputs WHERE tool_session_id = $1`,
        [id]
      );
      expect(output.rows.length).toBe(1);
      expect(output.rows[0].status).toBe('approved'); // "current", not superseded

      const source = await c.query(
        `SELECT tr.kind, trs.tool_output_id
           FROM tool_report_sources trs
           JOIN tool_reports tr ON tr.id = trs.tool_report_id
          WHERE trs.organization_id = $1 AND trs.tool_output_id = $2 AND tr.kind = 'presentation'`,
        [ORG_A, output.rows[0].id]
      );
      expect(source.rows.length).toBe(1);

      // 5. DECISION verification: this promotion never touches v8_artifact_runs
      // at all anymore (the table is the wrong home — see file header).
      const legacy = await c.query(
        `SELECT COUNT(*)::int n FROM v8_artifact_runs WHERE organization_id = $1`,
        [ORG_A]
      );
      expect(legacy.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });
});

describe('PP3 — list/get/reopen visibility after a fresh API import ("restart")', () => {
  it('a freshly re-imported artifactRegistryService (simulating a process restart) can list, get-by-origin and resolve the reopen target — all from Postgres, no in-memory state', async () => {
    const id = await seedSession({ id: `${P}s-restart` });

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'presentation', title: 'PP3 presentation' });
    assertPromotionBranchReached({ status: res.status, body: res.body });
    const artifactId = res.body.id as string;

    // Cache-busted re-import: a brand new module instance, no shared
    // in-process state with the one `app` was built from — the closest a
    // single test process can get to "restart the API and query again".
    const fresh = await import(
      /* @vite-ignore */ `../../server/src/services/v8/artifactRegistryService.js?restart=${Date.now()}`
    );

    const got = await fresh.getArtifactByOrigin({
      organizationId: ORG_A,
      originRuntime: 'presentation',
      originRecordId: artifactId,
      userId: ACTOR,
      roleKey: 'admin',
    });
    expect(got).not.toBeNull();
    expect(got!.artifactId).toBeTruthy();
    expect(got!.titleSnapshot).toBe('PP3 presentation');

    const listed = await fresh.listArtifactsForUser({
      organizationId: ORG_A,
      userId: ACTOR,
      roleKey: 'admin',
    });
    const found = listed.find((it: any) => it.originRecordId === artifactId);
    expect(found).toBeTruthy();

    // Reopen target: artifacts.routes.ts's buildActionTargetPayload maps
    // originRuntime 'presentation' to /presentations/builder/${originRecordId}
    // — prove that record id resolves to a REAL, non-empty deck.
    const c = await db();
    try {
      const deck = await c.query(
        `SELECT deck_json FROM presentation_decks WHERE id = $1 AND organization_id = $2`,
        [artifactId, ORG_A]
      );
      expect(deck.rows.length).toBe(1);
      const parsed = JSON.parse(deck.rows[0].deck_json);
      expect(parsed.cards.length).toBeGreaterThan(0);
    } finally {
      await c.end();
    }
  });
});

describe('PP4 — organization scope', () => {
  it('org B cannot see org A\'s promoted presentation via the registry, and cross-org promotion writes nothing', async () => {
    const id = await seedSession({ id: `${P}s-crossorg`, org: ORG_A });

    const crossOrgAttempt = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_B))
      .send({ outputType: 'presentation', title: 'cross-org attempt' });
    expect(crossOrgAttempt.status).toBe(404);

    const res = await request(app)
      .post(`/api/tools/${id}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'presentation', title: 'PP4 presentation' });
    assertPromotionBranchReached({ status: res.status, body: res.body });
    const artifactId = res.body.id as string;

    const artifactRegistryService = await import(
      '../../server/src/services/v8/artifactRegistryService.js'
    );
    const gotFromOrgB = await artifactRegistryService.getArtifactByOrigin({
      organizationId: ORG_B,
      originRuntime: 'presentation',
      originRecordId: artifactId,
      userId: ACTOR,
      roleKey: 'admin',
    });
    expect(gotFromOrgB).toBeNull();

    const c = await db();
    try {
      const deckInOrgB = await c.query(
        `SELECT COUNT(*)::int n FROM presentation_decks WHERE id = $1 AND organization_id = $2`,
        [artifactId, ORG_B]
      );
      expect(deckInOrgB.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }
  });
});

describe('PP5 — retry without duplication', () => {
  it('two promotions with the same idempotency key converge on ONE deck, ONE registry row, ONE ledger row', async () => {
    const id = await seedSession({ id: `${P}s-retry` });
    const body = { outputType: 'presentation', title: 'PP5 presentation', idempotencyKey: `${P}retry-key` };

    const first = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: first.status, body: first.body });

    const second = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    assertPromotionBranchReached({ status: second.status, body: second.body });
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    const c = await db();
    try {
      const decks = await c.query(`SELECT COUNT(*)::int n FROM presentation_decks WHERE id = $1`, [
        first.body.id,
      ]);
      expect(decks.rows[0].n).toBe(1);

      const links = await c.query(
        `SELECT COUNT(*)::int n FROM tool_initiative_links WHERE tool_session_id = $1 AND output_type = 'presentation'`,
        [id]
      );
      expect(links.rows[0].n).toBe(1);

      const registryLinks = await c.query(
        `SELECT COUNT(*)::int n FROM v8_artifact_origin_links WHERE origin_runtime = 'presentation' AND origin_record_id = $1`,
        [first.body.id]
      );
      expect(registryLinks.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });
});

describe('PP6 — explicit error when persistence fails (never a false success)', () => {
  it('a forced registry failure fails the request closed, rolls back the deck, and a retry with the same key is a controlled 409 — never a fake dedup success', async () => {
    const id = await seedSession({ id: `${P}s-failclosed` });
    const body = {
      outputType: 'presentation',
      title: 'PP6 presentation',
      idempotencyKey: `${P}failclosed-key`,
    };

    forceRegistrationFailure = true;
    const failed = await request(app).post(`/api/tools/${id}/promote`).set(as(ORG_A)).send(body);
    expect(failed.status).toBeGreaterThanOrEqual(500);

    const c = await db();
    try {
      // Rollback: no half-written deck left behind.
      const decks = await c.query(
        `SELECT COUNT(*)::int n FROM presentation_decks WHERE organization_id = $1 AND title = $2`,
        [ORG_A, 'PP6 presentation']
      );
      expect(decks.rows[0].n).toBe(0);

      const cards = await c.query(
        `SELECT COUNT(*)::int n FROM presentation_cards WHERE deck_id NOT IN (SELECT id FROM presentation_decks)`
      );
      expect(cards.rows[0].n).toBe(0);
    } finally {
      await c.end();
    }

    // The ledger row WAS claimed up front (canClaimUpfront) before content
    // creation failed — a documented residual gap (see the code comment on
    // `respondDeduplicated`'s presentation branch in ToolController.ts).
    // What must NEVER happen is reporting that retry as a success: it must
    // be an honest 409, not `deduplicated: true` pointing at nothing.
    forceRegistrationFailure = false;
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
      const deck = await c2.query(`SELECT COUNT(*)::int n FROM presentation_decks WHERE id = $1`, [
        ok.body.id,
      ]);
      expect(deck.rows[0].n).toBe(1);
    } finally {
      await c2.end();
    }
  });
});
