/**
 * Proves the immutability/idempotency/lineage properties of the canonical
 * `tool_outputs` snapshot (migrations 946/947) against REAL Postgres.
 *
 * Scope: `ToolController.promoteToOutput` now calls
 * `ensureToolOutputSnapshot` (server/src/services/tools/toolOutputSnapshotService.ts)
 * before touching Report/Presentation/Initiative — this suite exercises that
 * exact HTTP path (never the domain layer directly for the promotion tests;
 * `correctToolOutput` has no route yet, so that one property is proven by
 * calling the service function directly — see the "correction" describe
 * block, which says so explicitly).
 *
 * Run (this worktree's disposable container only — see task brief):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56103/consultinity \
 *   npx vitest run tests/integration/tools-outputs-immutable.realdb.test.ts
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

// vitest.config.ts's `test.env` hardcodes DB_TYPE=sqlite for the whole
// project (every other *.realdb.test.ts in this repo overrides it the same
// way, at the top of the file, before touching the DB — see
// tools-promote-characterization.realdb.test.ts). Must happen BEFORE the
// environment assertion below, or the assertion fails on vitest's default
// instead of checking what this file actually needs.
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// PRE-EXISTING, UNRELATED BUG discovered while writing this suite: on a
// freshly `migrate.postgres.ts`-bootstrapped database, `247_initiative_enhancements.sql`
// (sole producer of `initiatives.priority_order`) is never applied — it is
// absent from `schema_migrations` and not in the runner's numbered-phase
// file list, unlike the DATED bugfix migrations that touch the same table.
// With the funnel flag off, `promoteToOutput`'s direct
// `INSERT INTO initiatives (..., priority_order, ...)` then fails with
// `column "priority_order" of relation "initiatives" does not exist` on ANY
// outputType:'initiative' promotion — independent of everything this task
// touches. Reported as a gap in the final report, NOT fixed here (out of
// scope: shared migration-ordering infra, not tool_outputs). Routing around
// it via the funnel path (which never references priority_order in its own
// INSERT) so this suite can still prove the initiative-promotion wiring.
process.env.INITIATIVE_FUNNEL_ENABLED = 'true';

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `imm-${Date.now()}-`;
const ORG = `${P}org`;
const ACTOR = `${P}actor`;

let app: Express;
let correctToolOutput: (typeof import('../../server/src/services/tools/toolOutputSnapshotService.js'))['correctToolOutput'];
let getToolOutputById: (typeof import('../../server/src/services/tools/toolOutputSnapshotService.js'))['getToolOutputById'];

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org = ORG, user = ACTOR) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/**
 * Seeds a dynamic-swot session with a REAL, engine-valid payload (matching
 * the fixtures in src/toolOutputs/__tests__/buildSwotOutput.test.ts): two
 * accepted items, one tension linking both, one move that clears the W2 gate
 * (tradeoff + rejectedAlternative present). `confidence_avg` is 0-5 — a
 * previous session on this project used 0.9 here and every promotion-gated
 * assertion passed vacuously as a result; see assertRealPostgres.ts header.
 */
async function seedApprovedSwotSession(id: string, version = 1): Promise<void> {
  const answers = {
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

  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,'APPROVED',100,4.5,$4,$5,$6,$6,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = 'APPROVED', answers_json = EXCLUDED.answers_json, version = EXCLUDED.version`,
      [id, ORG, `imm session ${id}`, JSON.stringify(answers), version, ACTOR]
    );
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  // FAIL, never skip: throws immediately if this isn't a real, opted-in
  // Postgres run (RUN_DB_TESTS=1, MOCK_DB=false, a live SELECT version()).
  // Must happen before any DB work below.
  await assertRealPostgresTestEnvironment();

  const c = await db();
  try {
    // `initiatives.organization_id` (and other tables) carry a real FK to
    // `organizations` on this schema — unlike the characterization test's
    // minimal self-bootstrapped schema, a full migrate.postgres.ts run
    // enforces it, so the test org must actually exist.
    await c.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG, `${P}org`]
    );
    // `audit_log.user_id` and `report_builder_reports.created_by` both carry
    // real FKs to `users` on this schema.
    await c.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1,$2,$3,'admin','active') ON CONFLICT (id) DO NOTHING`,
      [ACTOR, ORG, `${P}actor@example.test`]
    );
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;
  const svc = await import('../../server/src/services/tools/toolOutputSnapshotService.js');
  correctToolOutput = svc.correctToolOutput;
  getToolOutputById = svc.getToolOutputById;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || ACTOR,
      organizationId: req.header('x-test-org') || ORG,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error('[test app error handler]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
}, 30_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_output_initiative_proposals WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_report_sources WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_reports WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM report_builder_sections WHERE report_id IN
      (SELECT id FROM report_builder_reports WHERE organization_id = $1)`, [ORG]);
    await c.query(`DELETE FROM report_builder_reports WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG]);
    await c.query(`DELETE FROM projects WHERE organization_id = $1`, [ORG]).catch(() => undefined);
    await c.query(`DELETE FROM users WHERE id = $1`, [ACTOR]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id = $1`, [ORG]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('tool_outputs — canonical immutable snapshot (real Postgres)', () => {
  it('P1: promotion creates exactly one tool_outputs row with the expected shape', async () => {
    const sessionId = `${P}s1`;
    await seedApprovedSwotSession(sessionId, 1);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'initiative', title: 'P1 initiative' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const rows = await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(rows.rows.length).toBe(1);
      const row = rows.rows[0];
      expect(row.organization_id).toBe(ORG);
      expect(row.tool_type).toBe('dynamic-swot');
      expect(row.status).toBe('approved');
      expect(row.version).toBe(1);
      expect(row.supersedes_id).toBeNull();
      expect(row.content_hash).toBeTruthy();
      expect(row.approved_by).toBe(ACTOR);
      expect(row.approved_at).toBeTruthy();
      expect(row.frozen_at).toBeTruthy();

      const payload = row.payload_json;
      expect(payload.items).toHaveLength(2);
      expect(payload.tensions).toHaveLength(1);
      expect(payload.conclusions).toHaveLength(1);
    } finally {
      await c.end();
    }
  });

  it('P2: source revision and pack/engine version are recorded on the snapshot', async () => {
    const sessionId = `${P}s2`;
    await seedApprovedSwotSession(sessionId, 7);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'initiative', title: 'P2 initiative' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const row = (
        await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId])
      ).rows[0];
      expect(row.method_pack_version).toBe('1.0.0');
      expect(row.payload_json.sourceRevision).toBe(7);
      expect(row.payload_json.engineVersion).toBe('1.0.0');
    } finally {
      await c.end();
    }
  });

  it('P3: editing the SESSION after promotion does NOT change the snapshot', async () => {
    const sessionId = `${P}s3`;
    await seedApprovedSwotSession(sessionId, 1);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'initiative', title: 'P3 initiative' });
    assertPromotionBranchReached(res);

    const c = await db();
    let before: { content_hash: string; payload_json: any };
    try {
      before = (
        await c.query(`SELECT content_hash, payload_json FROM tool_outputs WHERE tool_session_id = $1`, [
          sessionId,
        ])
      ).rows[0];
      expect(before.payload_json.items).toHaveLength(2);

      // Mutate the SOURCE SESSION directly — a third item, different title,
      // bumped version. If the snapshot were re-derived from the session on
      // read, this would show up. It must not.
      const mutatedAnswers = {
        items: [
          { id: 'i1', text: 'ZMIENIONE', quadrant: 'strengths', impact: 'low', proposalStatus: 'accepted', evidenceStatus: 'confirmed' },
        ],
        tensions: [],
        recommendedMoves: [],
      };
      await c.query(
        `UPDATE tool_sessions SET answers_json = $1, version = 99, name = 'MUTATED NAME' WHERE id = $2`,
        [JSON.stringify(mutatedAnswers), sessionId]
      );

      const after = (
        await c.query(`SELECT content_hash, payload_json, title FROM tool_outputs WHERE tool_session_id = $1`, [
          sessionId,
        ])
      ).rows[0];

      expect(after.content_hash).toBe(before.content_hash);
      expect(after.payload_json).toEqual(before.payload_json);
      expect(after.payload_json.items).toHaveLength(2); // still the ORIGINAL two, not the mutated one
      // The snapshot's own `title` is the SESSION name at build time (not the
      // per-promotion artifact title like "initiative"/"report" — see
      // buildOutputForSession) — it must stay the ORIGINAL session name,
      // not the "MUTATED NAME" written to tool_sessions afterwards.
      expect(after.title).toBe(`imm session ${sessionId}`);
    } finally {
      await c.end();
    }
  });

  it('P4: re-promoting after a session mutation does not recompute — dedup returns the SAME snapshot untouched', async () => {
    const sessionId = `${P}s4`;
    await seedApprovedSwotSession(sessionId, 1);
    const body = { outputType: 'initiative', title: 'P4 initiative' };

    const r1 = await request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body);
    assertPromotionBranchReached(r1);

    const c = await db();
    try {
      const beforeHash = (
        await c.query(`SELECT content_hash FROM tool_outputs WHERE tool_session_id = $1`, [sessionId])
      ).rows[0].content_hash;

      await c.query(`UPDATE tool_sessions SET answers_json = '{"items":[]}' WHERE id = $1`, [sessionId]);

      const r2 = await request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body);
      assertPromotionBranchReached(r2);
      expect(r2.body.deduplicated).toBe(true);
      expect(r2.body.id).toBe(r1.body.id);

      const rows = await c.query(`SELECT content_hash FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ]);
      expect(rows.rows.length).toBe(1); // never auto-recomputed into a second row
      expect(rows.rows[0].content_hash).toBe(beforeHash);
    } finally {
      await c.end();
    }
  });

  it('P5: reopening (re-reading) the Output returns identical content AND identical hash', async () => {
    const sessionId = `${P}s5`;
    await seedApprovedSwotSession(sessionId, 1);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'initiative', title: 'P5 initiative' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const outputId = (
        await c.query(`SELECT id FROM tool_outputs WHERE tool_session_id = $1`, [sessionId])
      ).rows[0].id;

      const readA = (await c.query(`SELECT payload_json, content_hash FROM tool_outputs WHERE id = $1`, [outputId])).rows[0];
      const readB = (await c.query(`SELECT payload_json, content_hash FROM tool_outputs WHERE id = $1`, [outputId])).rows[0];

      expect(readA.content_hash).toBe(readB.content_hash);
      expect(readA.payload_json).toEqual(readB.payload_json);

      // Same property through the domain-layer reader used by the service.
      const viaServiceA = await getToolOutputById(outputId, ORG);
      const viaServiceB = await getToolOutputById(outputId, ORG);
      expect(viaServiceA?.contentHash).toBe(viaServiceB?.contentHash);
      expect(viaServiceA).toEqual(viaServiceB);
    } finally {
      await c.end();
    }
  });

  it('P6: duplicate promotion (sequential retries) does not create a second snapshot', async () => {
    const sessionId = `${P}s6`;
    await seedApprovedSwotSession(sessionId, 1);
    const body = { outputType: 'initiative', title: 'P6 initiative' };

    const r1 = await request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body);
    assertPromotionBranchReached(r1);
    const r2 = await request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body);
    assertPromotionBranchReached(r2);
    const r3 = await request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body);
    assertPromotionBranchReached(r3);

    expect(r1.body.id).toBe(r2.body.id);
    expect(r1.body.id).toBe(r3.body.id);

    const c = await db();
    try {
      const rows = await c.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ]);
      expect(rows.rows[0].n).toBe(1);

      const approvals = await c.query(
        `SELECT action, COUNT(*)::int n FROM tool_output_approvals a
           JOIN tool_outputs o ON o.id = a.tool_output_id
          WHERE o.tool_session_id = $1 GROUP BY action`,
        [sessionId]
      );
      // Approval trail must not grow with retries either — it was written
      // once, when the row was created, not once per HTTP call.
      approvals.rows.forEach((r: { action: string; n: number }) => expect(r.n).toBe(1));
    } finally {
      await c.end();
    }
  });

  it('P7: concurrent promote requests converge on exactly one snapshot (DB-enforced, not just app logic)', async () => {
    const sessionId = `${P}s7`;
    await seedApprovedSwotSession(sessionId, 1);
    const body = { outputType: 'initiative', title: 'P7 initiative' };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(`/api/tools/${sessionId}/promote`).set(as()).send(body))
    );
    results.forEach((r, i) => assertPromotionBranchReached(r));

    const ids = new Set(results.map((r) => r.body.id));
    expect(ids.size).toBe(1); // all five requests agree on the same created record

    const c = await db();
    try {
      const rows = await c.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ]);
      // This is the property 946 alone could NOT guarantee (no unique
      // constraint on tool_outputs) — 947's partial unique index is what
      // makes this assertion safe to make under real concurrency.
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  });

  it('P8: report promotion is fed FROM the snapshot, not from a fresh session read', async () => {
    const sessionId = `${P}s8`;
    await seedApprovedSwotSession(sessionId, 1);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'report', title: 'P8 report' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const output = (await c.query(`SELECT id FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]))
        .rows[0];
      const reportSources = await c.query(
        `SELECT tool_report_id, tool_output_id FROM tool_report_sources WHERE tool_output_id = $1`,
        [output.id]
      );
      expect(reportSources.rows.length).toBe(1);

      const report = (
        await c.query(`SELECT kind, content_hash FROM tool_reports WHERE id = $1`, [
          reportSources.rows[0].tool_report_id,
        ])
      ).rows[0];
      expect(report.kind).toBe('report');
      expect(report.content_hash).toBeTruthy();

      const sections = await c.query(
        `SELECT generated_content FROM report_builder_sections WHERE report_id = $1`,
        [res.body.id]
      );
      // Legacy section content must mention the snapshot's own item text —
      // proving it was rendered from the frozen Output, not straight from
      // session.answers_json (both happen to agree right after promotion;
      // P3 above is what actually isolates the two).
      const joined = sections.rows.map((r: { generated_content: string }) => r.generated_content).join('\n');
      expect(joined).toMatch(/Silny zespół wdrożeniowy|Rosnący popyt w DACH|Uruchomić pilota w DACH/);
    } finally {
      await c.end();
    }
  });

  it('P9: initiative promotion records a traceable proposal from the snapshot conclusion', async () => {
    const sessionId = `${P}s9`;
    await seedApprovedSwotSession(sessionId, 1);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as())
      .send({ outputType: 'initiative', title: 'P9 initiative' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const output = (await c.query(`SELECT id FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]))
        .rows[0];
      const proposals = await c.query(
        `SELECT initiative_id, status, source_conclusion_id FROM tool_output_initiative_proposals WHERE tool_output_id = $1`,
        [output.id]
      );
      expect(proposals.rows.length).toBe(1);
      expect(proposals.rows[0].initiative_id).toBe(res.body.id);
      expect(proposals.rows[0].status).toBe('accepted');
      expect(proposals.rows[0].source_conclusion_id).toBe('m1');
    } finally {
      await c.end();
    }
  });

  describe('correction flow (service-level — no HTTP route exists yet, see gap notes)', () => {
    it('P10: a correction creates a NEW revision that supersedes the original, never mutating it', async () => {
      const sessionId = `${P}s10`;
      await seedApprovedSwotSession(sessionId, 1);

      const res = await request(app)
        .post(`/api/tools/${sessionId}/promote`)
        .set(as())
        .send({ outputType: 'initiative', title: 'P10 initiative' });
      assertPromotionBranchReached(res);

      const c = await db();
      let originalId: string;
      let originalHash: string;
      let originalPayload: unknown;
      try {
        const row = (
          await c.query(`SELECT id, content_hash, payload_json FROM tool_outputs WHERE tool_session_id = $1`, [
            sessionId,
          ])
        ).rows[0];
        originalId = row.id;
        originalHash = row.content_hash;
        originalPayload = row.payload_json;
      } finally {
        await c.end();
      }

      const original = await getToolOutputById(originalId, ORG);
      expect(original).toBeTruthy();
      const editedConclusion = {
        ...original!.conclusions[0],
        k2Meaning: 'SKORYGOWANE uzasadnienie po przeglądzie.',
      };

      const { superseded, revision } = await correctToolOutput({
        approvedOutputId: originalId,
        organizationId: ORG,
        actor: { id: ACTOR },
        now: new Date().toISOString(),
        nextConclusions: [editedConclusion],
      });

      expect(superseded.id).toBe(originalId);
      expect(revision.id).not.toBe(originalId);
      expect(revision.version).toBe(2);
      expect(revision.supersedesId).toBe(originalId);
      expect(revision.status).toBe('approved');
      expect(revision.contentHash).not.toBe(originalHash); // content genuinely changed

      const c2 = await db();
      try {
        const originalRowAfter = (
          await c2.query(`SELECT status, content_hash, payload_json FROM tool_outputs WHERE id = $1`, [
            originalId,
          ])
        ).rows[0];
        // The ORIGINAL row: status flips, but content is byte-identical to
        // before the correction — this is the "never a mutation" proof.
        expect(originalRowAfter.status).toBe('superseded');
        expect(originalRowAfter.content_hash).toBe(originalHash);
        expect(originalRowAfter.payload_json).toEqual(originalPayload);

        const revisionRow = (
          await c2.query(`SELECT status, supersedes_id, version FROM tool_outputs WHERE id = $1`, [
            revision.id,
          ])
        ).rows[0];
        expect(revisionRow.status).toBe('approved');
        expect(revisionRow.supersedes_id).toBe(originalId);
        expect(revisionRow.version).toBe(2);

        // Exactly one ACTIVE (non-superseded) snapshot per session, still —
        // the partial unique index holds across a correction too.
        const active = await c2.query(
          `SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1 AND status <> 'superseded'`,
          [sessionId]
        );
        expect(active.rows[0].n).toBe(1);
      } finally {
        await c2.end();
      }
    });
  });
});
