/**
 * TLS-BVP-001 — Dynamic SWOT business-value path, proven against REAL
 * Postgres (not mocks, not SQLite).
 *
 * Closes the gap the task inventory found: `requireDoD`/`getPromotionBlockers`
 * (server/src/controllers/ToolController.ts) only ever checked
 * completion_percent/confidence_avg — neither inspected items/tensions/
 * conclusions length — so an approved-and-frozen `tool_outputs` row with
 * EMPTY lineage was a legal state. The fix lives in
 * `ensureToolOutputSnapshot` (server/src/services/tools/
 * toolOutputSnapshotService.ts) via `EmptyToolOutputError`, thrown from
 * `buildOutputForSession` BEFORE `submitForReview`/`approveOutput` run and
 * before any `tool_outputs` row is written. Scope: `dynamic-swot` only (the
 * one MVP tool with a real engine bridge) — see that class's doc comment for
 * the full justification and blast radius.
 *
 * This suite proves, in order:
 *   1. NEGATIVE — an empty-lineage dynamic-swot session is refused (409
 *      EMPTY_TOOL_OUTPUT), no tool_outputs row created.
 *   2. POSITIVE CONTROL — a real-content dynamic-swot session still freezes,
 *      proving the guard didn't just break freezing outright.
 *   3. SCOPE BOUNDARY — a non-swot (bridge-less) tool type is NOT blocked by
 *      this guard (documents the blast radius is exactly what was decided).
 *   4/5. CAS 428 (missing expectedVersion) / 409 (stale expectedVersion), no
 *      write on either rejection.
 *   6. Immutability — mutating a frozen output via the domain layer throws
 *      ImmutableOutputError; the stored row is byte-identical afterwards.
 *   7. Reopen — creates a NEW revision, marks the original superseded,
 *      never mutates the original row's content.
 *   8. Race — N concurrent promote calls for the same session converge on
 *      exactly ONE frozen tool_outputs row.
 *   9. Tenant negative — org B cannot read or freeze org A's session/output.
 *  10. Cold readback — a brand-new, independent pg.Client (no shared pool/
 *      process state with the app) still sees the frozen output.
 *
 * Run (this worktree's disposable database only):
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34914/consultinity \
 *   DB_TYPE=postgres CI=true RUN_DB_TESTS=1 MOCK_DB=false \
 *   npx vitest run server/src/services/toolFreeze/__tests__/tls-bvp-001-nonempty-lineage.realdb.test.ts --retry=0
 *
 * Lives under server/src/services/toolFreeze/__tests__/ (not tests/toolFreeze/)
 * because root vitest.config.ts's `include` list — integrator-owned, not
 * editable from this lane — has no glob covering a top-level tests/toolFreeze
 * directory, so a file there is silently uncollectable (0 tests run,
 * reported as if nothing was wrong). The services-tree __tests__ glob (see
 * vitest.config.ts's `include` array, the "server/src/services" entries) IS
 * in that list, so this location is real acceptance evidence.
 * NOTE: this comment deliberately avoids writing the glob's literal
 * asterisk-asterisk-slash text inline — that exact sequence closes a block
 * comment early and corrupts the file (hit once while writing this header).
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertPromotionBranchReached,
  assertRealPostgresTestEnvironment,
} from '../../../../../tests/integration/_helpers/assertRealPostgres.js';

// vitest.config.ts hardcodes DB_TYPE=sqlite project-wide — override BEFORE
// the environment assertion below, same convention as every other
// *.realdb.test.ts in this repo (see tools-outputs-immutable.realdb.test.ts).
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
// Route the 'initiative' outputType through the funnel so this suite is not
// tripped by the PRE-EXISTING, unrelated `initiatives.priority_order`
// migration-ordering gap documented at the top of
// tests/integration/tools-outputs-immutable.realdb.test.ts (same repo-wide
// issue, not something TLS-BVP-001 touches).
process.env.INITIATIVE_FUNNEL_ENABLED = 'true';

const DATABASE_URL = process.env.DATABASE_URL as string;

const P = `bvp001-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const ACTOR = `${P}actor`;
const ACTOR_B = `${P}actorB`;

let uidCounter = 0;
const uid = (label: string): string => `${P}${label}-${uidCounter++}`;

let app: Express;
let EmptyToolOutputError: (typeof import(
  '../../tools/toolOutputSnapshotService.js'
))['EmptyToolOutputError'];
let getToolOutputById: (typeof import(
  '../../tools/toolOutputSnapshotService.js'
))['getToolOutputById'];
let correctToolOutput: (typeof import(
  '../../tools/toolOutputSnapshotService.js'
))['correctToolOutput'];
let mutateConclusions: (typeof import(
  '../../../sharedRuntime/toolOutputs/outputLifecycle.js'
))['mutateConclusions'];
let ImmutableOutputError: (typeof import(
  '../../../sharedRuntime/toolOutputs/outputLifecycle.js'
))['ImmutableOutputError'];

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org: string, user = ACTOR) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/** A dynamic-swot session with NO accepted content — the negative fixture. */
async function seedEmptySwotSession(id: string, org: string, actor: string): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,'APPROVED',100,4.5,'{}',1,$4,$4,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = 'APPROVED', answers_json = '{}', version = 1`,
      [id, org, `bvp001 empty ${id}`, actor]
    );
  } finally {
    await c.end();
  }
}

/**
 * A dynamic-swot session with a real, engine-valid payload: one accepted
 * item pair forming one tension, and one recommended move that clears the
 * W2 gate (tradeoff + rejectedAlternative present) — matching the fixture
 * shape in src/toolOutputs/__tests__/buildSwotOutput.test.ts and the
 * reference suite tests/integration/tools-outputs-immutable.realdb.test.ts.
 */
async function seedRealSwotSession(
  id: string,
  org: string,
  actor: string,
  version = 1,
  status: string = 'APPROVED'
): Promise<void> {
  const answers = {
    items: [
      {
        id: 'i1',
        text: 'Silny zespół dostawczy',
        quadrant: 'strengths',
        impact: 'high',
        proposalStatus: 'accepted',
        evidenceStatus: 'confirmed',
      },
      {
        id: 'i2',
        text: 'Rosnący popyt regionalny',
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
        title: 'Uruchomić pilota regionalnego',
        category: 'quick-win',
        rationale: 'Popyt rośnie, zespół dostawczy ma wolną moc.',
        linkedTensionIds: ['t1'],
        linkedItemIds: ['i1'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        firstStep: 'Wybrać klienta pilotażowego',
        ownerRole: 'Dyrektor sprzedaży',
        tradeoff: { chosen: 'Pilot regionalny', deferred: 'Rozwój produktu', cost: 'Dług produktowy +1Q' },
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
       VALUES ($1,$2,NULL,'dynamic-swot',$3,$7,100,4.5,$4,$5,$6,$6,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status, answers_json = EXCLUDED.answers_json, version = EXCLUDED.version`,
      [id, org, `bvp001 real ${id}`, JSON.stringify(answers), version, actor, status]
    );
  } finally {
    await c.end();
  }
}

/** A bridge-less (non-swot) tool session — the scope-boundary fixture. */
async function seedGenericSession(id: string, org: string, actor: string): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'market-forces',$3,'APPROVED',100,4.5,'{}',1,$4,$4,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'APPROVED', answers_json = '{}', version = 1`,
      [id, org, `bvp001 generic ${id}`, actor]
    );
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  // FAIL, never skip: throws immediately unless this is a real, opted-in
  // Postgres run. See assertRealPostgres.ts header.
  await assertRealPostgresTestEnvironment();

  const c = await db();
  try {
    await c.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,'free','active'), ($3,$4,'free','active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_A, `${P}orgA`, ORG_B, `${P}orgB`]
    );
    await c.query(
      `INSERT INTO users (id, organization_id, email, role, status)
       VALUES ($1,$2,$3,'admin','active'), ($4,$5,$6,'admin','active')
       ON CONFLICT (id) DO NOTHING`,
      [ACTOR, ORG_A, `${P}actor@example.test`, ACTOR_B, ORG_B, `${P}actorb@example.test`]
    );
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../../controllers/ToolController.js')).default;
  const svc = await import('../../tools/toolOutputSnapshotService.js');
  EmptyToolOutputError = svc.EmptyToolOutputError;
  getToolOutputById = svc.getToolOutputById;
  correctToolOutput = svc.correctToolOutput;

  const lifecycle = await import('../../../sharedRuntime/toolOutputs/outputLifecycle.js');
  mutateConclusions = lifecycle.mutateConclusions;
  ImmutableOutputError = lifecycle.ImmutableOutputError;

  const { UpdateToolSessionSchema } = await import('../../../validators/tool.validators.js');
  const { validateBody } = await import('../../../middleware/validation.middleware.js');

  app = express();
  app.use(express.json());
  // Same header-driven synthetic auth as every other *.realdb.test.ts in
  // this repo (tool-sessions-cas / tools-outputs-immutable /
  // tools-promotion-race) — bypasses verifyToken/requireOrgAccess, which are
  // orthogonal to what this suite proves.
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || ACTOR,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.get('/api/tools/:toolId', ToolController.getToolSession);
  app.put('/api/tools/:toolId', validateBody(UpdateToolSessionSchema), ToolController.updateToolSession);
  app.post('/api/tools/:toolId/promote', ToolController.promoteToOutput);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message || 'unknown', code: err?.code });
  });
}, 30_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_output_initiative_proposals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_output_approvals WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_session_events WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_outputs WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_initiative_links WHERE tool_session_id LIKE $1`, [`${P}%`]);
    await c.query(`DELETE FROM initiatives WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM my_ideas WHERE organization_id IN ($1,$2) AND source_type = 'tool'`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM users WHERE id IN ($1,$2)`, [ACTOR, ACTOR_B]).catch(() => undefined);
    await c.query(`DELETE FROM organizations WHERE id IN ($1,$2)`, [ORG_A, ORG_B]).catch(() => undefined);
  } finally {
    await c.end();
  }
});

describe('TLS-BVP-001 — nonempty-lineage guard on tool_outputs freeze (real Postgres)', () => {
  it('1. NEGATIVE: promoting an empty-lineage dynamic-swot session is refused (409 EMPTY_TOOL_OUTPUT), no row created', async () => {
    const sessionId = uid('empty');
    await seedEmptySwotSession(sessionId, ORG_A, ACTOR);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Empty lineage attempt' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMPTY_TOOL_OUTPUT');
    expect(String(res.body.error)).toMatch(/nonempty lineage/i);

    const c = await db();
    try {
      const rows = await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(rows.rows.length).toBe(0);
      // Belt-and-braces: no ledger row either (claim-before-create must
      // never have gotten far enough to claim on a refused promotion —
      // 'idea' isn't a pre-claimed outputType, so this is chiefly a sanity
      // check, not the primary proof).
      const links = await c.query(`SELECT * FROM tool_initiative_links WHERE tool_session_id = $1`, [sessionId]);
      expect(links.rows.length).toBe(0);
    } finally {
      await c.end();
    }
  });

  it('2. POSITIVE CONTROL: a real-content dynamic-swot session still freezes; the persisted row is nonempty', async () => {
    const sessionId = uid('real');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Real lineage promotion' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const rows = await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(rows.rows.length).toBe(1);
      const row = rows.rows[0];
      expect(row.status).toBe('approved');
      expect(row.frozen_at).toBeTruthy();
      const payload = row.payload_json;
      expect(payload.items.length).toBeGreaterThan(0);
      expect(payload.tensions.length).toBeGreaterThan(0);
      expect(payload.conclusions.length).toBeGreaterThan(0);
    } finally {
      await c.end();
    }
  });

  it('3. SCOPE BOUNDARY: a non-swot (bridge-less) tool type is NOT blocked by this guard — freezes empty, as documented', async () => {
    const sessionId = uid('generic');
    await seedGenericSession(sessionId, ORG_A, ACTOR);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Generic bridge-less promotion' });
    assertPromotionBranchReached(res);

    const c = await db();
    try {
      const rows = await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(rows.rows.length).toBe(1);
      const row = rows.rows[0];
      expect(row.tool_type).toBe('market-forces');
      expect(row.status).toBe('approved');
      const payload = row.payload_json;
      expect(payload.items).toEqual([]);
      expect(payload.tensions).toEqual([]);
      expect(payload.conclusions).toEqual([]);
    } finally {
      await c.end();
    }
  });

  it('4. CAS 428: update without expectedVersion is refused, no write happens', async () => {
    const sessionId = uid('cas428');
    // DRAFT, not APPROVED: an APPROVED session hits the pre-existing
    // content-lock 409 (updateToolSession's own immutability gate) before
    // the CAS check ever runs — see tool-sessions-cas.realdb.test.ts's
    // header note on that gate being intentionally checked FIRST. This test
    // is about the CAS precondition itself, so it needs an editable session.
    await seedRealSwotSession(sessionId, ORG_A, ACTOR, 1, 'DRAFT');

    const res = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set(as(ORG_A))
      .send({ completionPercent: 50 });

    expect(res.status).toBe(428);
    expect(res.body.code).toBe('MISSING_EXPECTED_VERSION');

    const c = await db();
    try {
      const row = (await c.query(`SELECT version, completion_percent FROM tool_sessions WHERE id = $1`, [sessionId]))
        .rows[0];
      expect(Number(row.version)).toBe(1);
      expect(Number(row.completion_percent)).toBe(100);
    } finally {
      await c.end();
    }
  });

  it('5. CAS 409: update with a stale expectedVersion is refused, and the row is NOT modified', async () => {
    const sessionId = uid('cas409');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR, 1, 'DRAFT');

    const first = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set(as(ORG_A))
      .send({ completionPercent: 60, expectedVersion: 1 });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(2);

    const stale = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set(as(ORG_A))
      .send({ completionPercent: 10, expectedVersion: 1 });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
    expect(stale.body.current.version).toBe(2);

    const c = await db();
    try {
      const row = (await c.query(`SELECT version, completion_percent FROM tool_sessions WHERE id = $1`, [sessionId]))
        .rows[0];
      expect(Number(row.version)).toBe(2);
      expect(Number(row.completion_percent)).toBe(60); // the stale write never landed
    } finally {
      await c.end();
    }
  });

  it('6. IMMUTABILITY: a mutation attempt on a frozen output is rejected; the stored row is byte-identical afterwards', async () => {
    const sessionId = uid('immutable');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);

    const promoteRes = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Immutability target' });
    assertPromotionBranchReached(promoteRes);

    const c = await db();
    let outputId: string;
    let before: { content_hash: string; payload_json: unknown; status: string };
    try {
      const row = (await c.query(`SELECT id, content_hash, payload_json, status FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ])).rows[0];
      outputId = row.id;
      before = { content_hash: row.content_hash, payload_json: row.payload_json, status: row.status };
      expect(before.status).toBe('approved');
    } finally {
      await c.end();
    }

    const frozen = await getToolOutputById(outputId, ORG_A);
    expect(frozen).toBeTruthy();
    expect(() => mutateConclusions(frozen!, [])).toThrow(ImmutableOutputError);

    const c2 = await db();
    try {
      const after = (await c2.query(`SELECT content_hash, payload_json, status FROM tool_outputs WHERE id = $1`, [
        outputId,
      ])).rows[0];
      expect(after.status).toBe(before.status);
      expect(after.content_hash).toBe(before.content_hash);
      expect(after.payload_json).toEqual(before.payload_json);
    } finally {
      await c2.end();
    }
  });

  it('7. REOPEN: creates a NEW revision, marks the original superseded, and never mutates the original row', async () => {
    const sessionId = uid('reopen');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);

    const promoteRes = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Reopen target' });
    assertPromotionBranchReached(promoteRes);

    const c = await db();
    let originalId: string;
    let originalHash: string;
    let originalPayload: unknown;
    try {
      const row = (await c.query(`SELECT id, content_hash, payload_json FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ])).rows[0];
      originalId = row.id;
      originalHash = row.content_hash;
      originalPayload = row.payload_json;
    } finally {
      await c.end();
    }

    const original = await getToolOutputById(originalId, ORG_A);
    expect(original).toBeTruthy();
    expect(original!.conclusions.length).toBeGreaterThan(0);
    const editedConclusion = { ...original!.conclusions[0], k2Meaning: 'SKORYGOWANE po TLS-BVP-001.' };

    const { superseded, revision } = await correctToolOutput({
      approvedOutputId: originalId,
      organizationId: ORG_A,
      actor: { id: ACTOR },
      now: new Date().toISOString(),
      nextConclusions: [editedConclusion],
    });

    expect(superseded.id).toBe(originalId);
    expect(revision.id).not.toBe(originalId);
    expect(revision.version).toBe(2);
    expect(revision.supersedesId).toBe(originalId);
    expect(revision.contentHash).not.toBe(originalHash);

    const c2 = await db();
    try {
      const originalAfter = (await c2.query(`SELECT status, content_hash, payload_json FROM tool_outputs WHERE id = $1`, [
        originalId,
      ])).rows[0];
      expect(originalAfter.status).toBe('superseded');
      expect(originalAfter.content_hash).toBe(originalHash); // never mutated
      expect(originalAfter.payload_json).toEqual(originalPayload);

      const revisionRow = (await c2.query(`SELECT status, supersedes_id, version FROM tool_outputs WHERE id = $1`, [
        revision.id,
      ])).rows[0];
      expect(revisionRow.status).toBe('approved');
      expect(revisionRow.supersedes_id).toBe(originalId);
      expect(revisionRow.version).toBe(2);

      const active = await c2.query(
        `SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1 AND status <> 'superseded'`,
        [sessionId]
      );
      expect(active.rows[0].n).toBe(1);
    } finally {
      await c2.end();
    }
  });

  it('8. RACE: concurrent promote calls for the same real-content session converge on exactly ONE frozen row', async () => {
    const sessionId = uid('race');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);
    const body = { outputType: 'idea', title: 'Race target' };

    const CONCURRENCY = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        request(app).post(`/api/tools/${sessionId}/promote`).set(as(ORG_A)).send(body)
      )
    );
    results.forEach((r) => assertPromotionBranchReached(r));
    const ids = new Set(results.map((r) => r.body.id));
    expect(ids.size).toBe(1);

    const c = await db();
    try {
      const rows = await c.query(`SELECT COUNT(*)::int n FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(rows.rows[0].n).toBe(1);
    } finally {
      await c.end();
    }
  }, 30_000);

  it('9. TENANT NEGATIVE: org B cannot promote or read org A session/output', async () => {
    const sessionId = uid('tenant');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);

    // Cross-org promote attempt.
    const crossPromote = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_B, ACTOR_B))
      .send({ outputType: 'idea', title: 'attacker payload' });
    expect(crossPromote.status).toBe(404);

    const c = await db();
    let outputId: string | undefined;
    try {
      const noRow = await c.query(`SELECT * FROM tool_outputs WHERE tool_session_id = $1`, [sessionId]);
      expect(noRow.rows.length).toBe(0); // org B's attempt created nothing

      // Now legitimately freeze it as org A, then prove org B still cannot read it.
      const legit = await request(app)
        .post(`/api/tools/${sessionId}/promote`)
        .set(as(ORG_A))
        .send({ outputType: 'idea', title: 'legit org A promotion' });
      assertPromotionBranchReached(legit);
      outputId = (await c.query(`SELECT id FROM tool_outputs WHERE tool_session_id = $1`, [sessionId])).rows[0].id;
    } finally {
      await c.end();
    }

    const crossRead = await getToolOutputById(outputId!, ORG_B);
    expect(crossRead).toBeNull();

    const c2 = await db();
    try {
      const scoped = await c2.query(`SELECT id FROM tool_outputs WHERE id = $1 AND organization_id = $2`, [
        outputId,
        ORG_B,
      ]);
      expect(scoped.rows.length).toBe(0);
    } finally {
      await c2.end();
    }
  });

  it('10. COLD READBACK: a brand-new, independent connection still sees the frozen, nonempty output', async () => {
    const sessionId = uid('cold');
    await seedRealSwotSession(sessionId, ORG_A, ACTOR);

    const res = await request(app)
      .post(`/api/tools/${sessionId}/promote`)
      .set(as(ORG_A))
      .send({ outputType: 'idea', title: 'Cold readback target' });
    assertPromotionBranchReached(res);

    // A brand-new pg.Client sharing no pool/process state with the app's own
    // queryHelpers connection — the same "proves it's not in-process state"
    // technique as tool-sessions-cas.realdb.test.ts's restart-survival test.
    const independent = new Client({ connectionString: DATABASE_URL });
    await independent.connect();
    try {
      const row = (await independent.query(`SELECT status, frozen_at, payload_json FROM tool_outputs WHERE tool_session_id = $1`, [
        sessionId,
      ])).rows[0];
      expect(row.status).toBe('approved');
      expect(row.frozen_at).toBeTruthy();
      expect(row.payload_json.conclusions.length).toBeGreaterThan(0);
    } finally {
      await independent.end();
    }
  });
});
