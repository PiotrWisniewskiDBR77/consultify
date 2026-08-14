/**
 * TLS-04 — Teresa-assisted SWOT: full proposal lifecycle acceptance E2E.
 *
 * Teresa (AI) may PROPOSE SWOT edits (add/update/remove a quadrant item), but a
 * proposal is a durable, reviewable `swot_proposals` row that NEVER auto-saves.
 * The user must explicitly accept/edit/reject before anything touches the real
 * SWOT data in `tool_sessions.answers_json`, with full audit and safe
 * concurrency. This suite proves the WHOLE lifecycle against REAL Postgres
 * through the REAL `server/src/controllers/ToolController.ts` +
 * `server/src/routes/tools.routes.ts` + `server/src/validators/tool.validators.ts`
 * + `server/src/services/ai/swotProposalService.ts` + `queryHelpers.withPgTransaction`.
 *
 * The ONLY mock in this file is the outbound model call itself
 * (`server/src/services/ai/llmService.js`'s `llmService.call`) — reached via
 * `swotProposalService.ts`'s `getLLM()` dynamic `import('./llmService.js')`.
 * The controller, the service function, and the real zod validation all run
 * for real.
 *
 * Fixture prefix: `odbior--tls04--`. Two real orgs (A, B) with real seeded
 * users/JWTs (pattern mirrors `h65-rbac.e2e.test.ts`'s `seedTenant` /
 * `mintTokenFor`). Full cleanup in `afterAll`, independently verified with a
 * raw SQL count query.
 *
 * ── RED→GREEN negative controls ──────────────────────────────────────────
 * Six of the assertions below were verified load-bearing by temporarily
 * neutralizing the specific guard in `server/src/controllers/ToolController.ts`
 * that makes them true, rerunning ONLY that test (`vitest -t "<name>"`),
 * confirming a genuine RED failure, then restoring the file byte-for-byte
 * (`git checkout -- server/src/controllers/ToolController.ts`, verified with
 * `git diff`) and confirming GREEN again. Each pair is documented in a comment
 * directly above the test it covers:
 *   1. T5  "concurrent accept — exactly one winner"
 *   2. T6  "stale version → 409 STALE_VERSION, proposal stays pending"
 *   3. T7c "cross-tenant: accept foreign pending proposal → 404"
 *   4. T7a "cross-tenant: list proposals for foreign session → 404"
 *   5. T8a "malformed model response → 502 INVALID_MODEL_RESPONSE, zero rows"
 *   6. T1  "generate → reject → no change" (reject-never-touches-SWOT half)
 */
import { randomUUID } from 'crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { getJwtSecret, requireLocalDbUrl } from './harness.js';

// ── Mock ONLY the outbound model call — everything else is real. ───────────
const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }));
vi.mock('../../server/src/services/ai/llmService.js', () => ({
  llmService: { call: (...args: unknown[]) => callMock(...args) },
  default: { call: (...args: unknown[]) => callMock(...args) },
}));

const P = 'odbior--tls04--';
const ORG_A = `${P}org-A`;
const USER_A = `${P}user-A`;
const EMAIL_A = `${P}owner-a@acceptance.local`;
const ORG_B = `${P}org-B`;
const USER_B = `${P}user-B`;
const EMAIL_B = `${P}owner-b@acceptance.local`;

function evidence(line: string): void {
  // eslint-disable-next-line no-console
  console.log(line);
}

function mintTokenFor(userId: string, orgId: string, email: string): string {
  return jwt.sign(
    { id: userId, email, organizationId: orgId, organization_id: orgId, role: 'OWNER' },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

async function seedTenant(
  c: pg.Client,
  orgId: string,
  userId: string,
  email: string
): Promise<void> {
  const now = new Date().toISOString();
  await c.query(
    `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
     VALUES ($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
    [orgId, `TLS04 ${orgId}`, now]
  );
  await c.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
     VALUES ($1,$2,$3,'x','ADMIN','active','TLS04','Test',$4) ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, email, now]
  );
  await c.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
     SELECT $4,$1,$2,'OWNER','ACTIVE',$3
     WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2)`,
    [orgId, userId, now, `${P}mem-${userId}`]
  );
}

async function buildToolsApp(): Promise<Express> {
  const toolsRouter = (await import('../../server/src/routes/tools.routes.js')).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/tools', toolsRouter);
  return app;
}

// ── Proposal fixtures — must satisfy swotProposalService.ts's zod schema ───
type RawProposal = {
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  operation: 'add' | 'update' | 'remove';
  targetItemId?: string | null;
  proposedText?: string | null;
  rationale?: string;
  sourceRefs?: string[] | null;
  isAssumption: boolean;
  confidence: number;
};

function addProposal(overrides: Partial<RawProposal> = {}): RawProposal {
  return {
    quadrant: 'opportunities',
    operation: 'add',
    targetItemId: null,
    proposedText: 'Nowa szansa: ekspansja oferty na segment MŚP w regionie DACH',
    rationale: 'Rosnący popyt na automatyzację w MŚP otwiera nowy kanał przychodu.',
    // Must be a REAL id from baseItems() -- Codex BLOCKER 4's semantic
    // validation now rejects a non-assumption proposal whose sourceRefs
    // don't match anything the model was actually given.
    sourceRefs: ['strengths-1'],
    isAssumption: false,
    confidence: 0.72,
    ...overrides,
  };
}

function updateProposal(targetItemId: string, overrides: Partial<RawProposal> = {}): RawProposal {
  return {
    quadrant: 'strengths',
    operation: 'update',
    targetItemId,
    proposedText: 'AI PROPOSED: mocniejsza pozycja rynkowa dzięki koncentracji na B2B',
    rationale: 'Ostrzejsze sformułowanie oddaje faktyczną przewagę liczbową segmentu B2B.',
    sourceRefs: [targetItemId],
    isAssumption: false,
    confidence: 0.75,
    ...overrides,
  };
}

/** Violates GeneratedProposalSchema: operation 'update' without targetItemId. */
function malformedProposal(): Record<string, unknown> {
  return {
    quadrant: 'strengths',
    operation: 'update',
    targetItemId: null,
    proposedText: 'broken proposal — update with no target',
    rationale: 'this proposal is intentionally schema-invalid',
    sourceRefs: ['x'],
    isAssumption: false,
    confidence: 0.5,
  };
}

function mockLlmResolveOnce(proposals: unknown): void {
  callMock.mockResolvedValueOnce({ object: proposals });
}
function mockLlmRejectOnce(message = 'transport failure'): void {
  callMock.mockRejectedValueOnce(new Error(message));
}

function baseItems() {
  return [
    {
      id: 'strengths-1',
      text: 'RAW: silna pozycja rynkowa — segment B2B odpowiada za 61% przychodu',
      quadrant: 'strengths',
      impact: 'high',
      source: 'user',
      confidence: 4,
      proposalStatus: 'accepted',
    },
    {
      id: 'weaknesses-1',
      text: 'Przestarzały system ERP ogranicza raportowanie w czasie rzeczywistym',
      quadrant: 'weaknesses',
      impact: 'medium',
      source: 'user',
      confidence: 3,
      proposalStatus: 'accepted',
    },
  ];
}

let app: Express;
let tokenA: string;
let tokenB: string;
let pgc: pg.Client;

const createdToolSessionIds: string[] = [];

/** Create a real dynamic-swot session (via POST) with seeded items (via PUT). */
async function createSwotSession(
  token: string,
  items: unknown[],
  name: string
): Promise<string> {
  const createRes = await request(app)
    .post('/api/tools')
    .set('Authorization', `Bearer ${token}`)
    .send({ toolType: 'dynamic-swot', name });
  expect(createRes.status).toBe(200);
  const sessionId: string = createRes.body.id;
  createdToolSessionIds.push(sessionId);

  // STREAM G1 (2026-08-13): `expectedVersion` is REQUIRED on every PUT (CAS —
  // see `server/src/validators/tool.validators.ts`'s `UpdateToolSessionSchema`
  // comment and `ToolController.updateToolSession`'s 428 guard). This helper
  // was missing it entirely -- verified that BEFORE this fix, every single
  // test in this file failed this first PUT with 428, and that this had been
  // silently masked (all 33 tests reporting "skipped", never "failed") by the
  // unrelated `@` alias collection-time crash fixed in
  // `vitest.acceptance.config.ts` -- two independent, stacked breakages that
  // together meant this entire acceptance file asserted nothing for some time.
  // `createToolSession` (above) always returns version 1 for a fresh session.
  const putRes = await request(app)
    .put(`/api/tools/${sessionId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      status: 'IN_PROGRESS',
      completionPercent: 40,
      confidenceAvg: 3,
      answers: { items },
      expectedVersion: 1,
    });
  expect(putRes.status).toBe(200);

  return sessionId;
}

beforeAll(async () => {
  requireLocalDbUrl();
  pgc = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await pgc.connect();

  await seedTenant(pgc, ORG_A, USER_A, EMAIL_A);
  await seedTenant(pgc, ORG_B, USER_B, EMAIL_B);

  app = await buildToolsApp();
  tokenA = mintTokenFor(USER_A, ORG_A, EMAIL_A);
  tokenB = mintTokenFor(USER_B, ORG_B, EMAIL_B);
}, 60_000);

afterAll(async () => {
  if (!pgc) return;
  try {
    if (createdToolSessionIds.length) {
      await pgc
        .query('DELETE FROM swot_proposals WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await pgc
        .query('DELETE FROM tool_initiative_links WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await pgc
        .query('DELETE FROM tool_decisions WHERE tool_session_id = ANY($1)', [
          createdToolSessionIds,
        ])
        .catch(() => {});
      await pgc.query('DELETE FROM tool_sessions WHERE id = ANY($1)', [createdToolSessionIds]);
    }
    await pgc
      .query('DELETE FROM audit_events WHERE org_id = ANY($1)', [[ORG_A, ORG_B]])
      .catch(() => {});
    await pgc.query('DELETE FROM organization_members WHERE user_id = ANY($1)', [
      [USER_A, USER_B],
    ]);
    await pgc.query('DELETE FROM users WHERE id = ANY($1)', [[USER_A, USER_B]]);
    await pgc.query('DELETE FROM organizations WHERE id = ANY($1)', [[ORG_A, ORG_B]]);

    // Independently VERIFY cleanup with raw SQL — do not just trust the deletes above ran.
    const remainingSessions = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM tool_sessions WHERE id LIKE $1 OR name LIKE $1`,
      [`${P}%`]
    );
    const remainingProposals = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE organization_id = ANY($1)`,
      [[ORG_A, ORG_B]]
    );
    const remainingOrgs = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM organizations WHERE id = ANY($1)`,
      [[ORG_A, ORG_B]]
    );
    const remainingUsers = await pgc.query(`SELECT COUNT(*)::int AS c FROM users WHERE id LIKE $1`, [
      `${P}%`,
    ]);
    evidence(
      `[tls04] cleanup verify — sessions=${remainingSessions.rows[0].c} proposals=${remainingProposals.rows[0].c} orgs=${remainingOrgs.rows[0].c} users=${remainingUsers.rows[0].c}`
    );
    expect(remainingSessions.rows[0].c).toBe(0);
    expect(remainingProposals.rows[0].c).toBe(0);
    expect(remainingOrgs.rows[0].c).toBe(0);
    expect(remainingUsers.rows[0].c).toBe(0);
  } finally {
    await pgc.end();
  }
}, 30_000);

// ===========================================================================
// T1 — generate → reject → no change
// ===========================================================================
describe('TLS-04 — generate → reject → no change', () => {
  // RED→GREEN #6 (reject-never-touches-SWOT): `rejectSwotProposal` has no
  // boolean "guard" to disable (its correctness is the ABSENCE of any
  // tool_sessions write) — so instead we temporarily INJECTED the exact bug
  // this test guards against: a spurious
  // `UPDATE tool_sessions SET answers_json = '{"items":[{"id":"BUG-INJECTED",...}]}'`
  // inside `rejectSwotProposal`'s transaction, right after the reject UPDATE
  // succeeds. RED (actually observed): `expect(getAfter.body.answers.items)
  // .toEqual(items)` failed — the diff showed the two real seeded items
  // (`strengths-1`, `weaknesses-1`) replaced by the single injected
  // `BUG-INJECTED` item, proving the test would catch a reject handler that
  // mutated SWOT. Restored `ToolController.ts` byte-for-byte via
  // `git checkout --`, verified with `git diff` (no residual change), reran →
  // GREEN.
  it('reject never applies the proposal — answers.items unchanged before and after reject', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t1-reject-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(createRes.status).toBe(201);
    expect(createRes.body.proposals).toHaveLength(1);
    const proposalId: string = createRes.body.proposals[0].id;

    const rawRow = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      proposalId,
    ]);
    expect(rawRow.rows[0].status).toBe('pending');

    const getBefore = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getBefore.status).toBe(200);
    expect(getBefore.body.answers.items).toEqual(items);

    const rejectRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/reject`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.proposal.status).toBe('rejected');

    const rawRowAfter = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      proposalId,
    ]);
    expect(rawRowAfter.rows[0].status).toBe('rejected');

    const getAfter = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getAfter.status).toBe(200);
    expect(getAfter.body.answers.items).toEqual(items);
    evidence(`[tls04-t1] reject leaves answers.items literally unchanged: ${JSON.stringify(items.map((i: any) => i.id))}`);
  });
});

// ===========================================================================
// T2 — generate → edit → accept → read-back → hard reload (same session)
// ===========================================================================
describe('TLS-04 — generate → edit → accept → read-back → hard reload', () => {
  it('accepting WITH an edit persists the EDITED text (not the raw AI proposal), and a fresh reload of the same session returns it again', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t2-edit-accept-session`);

    mockLlmResolveOnce([updateProposal('strengths-1')]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(createRes.status).toBe(201);
    const proposal = createRes.body.proposals[0];
    expect(proposal.operation).toBe('update');
    expect(proposal.targetItemId).toBe('strengths-1');
    const expectedVersion: number = proposal.expectedVersion;
    // 2, not 1: createSwotSession's own seed PUT (setting the initial items)
    // is itself a real answers_json write and bumps version 1 -> 2 (Codex
    // BLOCKER 1 fix) before this proposal is ever generated.
    expect(expectedVersion).toBe(2);

    const editedText =
      'USER EDITED: przewaga rynkowa w B2B ugruntowana kontraktami wieloletnimi';
    // Codex BLOCKER 3: editedAfter may ONLY ever carry `text` -- the server
    // is `.strict()` and 400s on any other key (id/quadrant/source/
    // confidence/proposalStatus are server-owned provenance, never
    // client-settable). This matches exactly what the shipped UI sends.
    const editedAfter = { text: editedText };

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion, editedAfter });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.session.version).toBe(expectedVersion + 1);
    expect(acceptRes.body.proposal.finalAfter.text).toBe(editedText);
    // Never the raw AI text — proves edit-before-accept wins over the proposal.
    expect(acceptRes.body.proposal.finalAfter.text).not.toBe(
      acceptRes.body.proposal.proposedAfter.text
    );

    // Independent follow-up request — read-back proof.
    const readBack = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(readBack.status).toBe(200);
    const readBackItem = (readBack.body.answers.items as any[]).find(
      (it) => it.id === 'strengths-1'
    );
    expect(readBackItem).toBeTruthy();
    expect(readBackItem.text).toBe(editedText);
    expect(readBackItem.text).not.toContain('AI PROPOSED');

    // Hard reload — a FRESH, independent GET of the SAME sessionId, same content.
    const hardReload = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(hardReload.status).toBe(200);
    expect(hardReload.body.id).toBe(sessionId);
    const hardReloadItem = (hardReload.body.answers.items as any[]).find(
      (it) => it.id === 'strengths-1'
    );
    expect(hardReloadItem.text).toBe(editedText);
    expect(hardReload.body.answers.items).toHaveLength(2);
    evidence(`[tls04-t2] hard reload of sessionId=${sessionId} returns edited text again`);
  });

  // Regression for an adversarial-review finding (post-build fix): the
  // SHIPPED frontend only ever sends `editedAfter: { text: <edited> }` (never
  // the full item shape the test above hand-builds for thoroughness). A first
  // cut of acceptSwotProposal did a bare COALESCE(editedAfter, proposed_after)
  // REPLACE, so a partial editedAfter silently stripped id/quadrant/impact/
  // source/confidence/proposalStatus from the persisted item -- it would
  // vanish from every quadrant grid (quadrant undefined matches none of the 4
  // fixed quadrants) with no id left to ever find/remove it again. Fixed to
  // MERGE editedAfter onto proposed_after_json server-side (defense-in-depth,
  // independent of what any given caller sends). This test sends EXACTLY what
  // the real UI sends -- a partial `{ text }` -- and proves the persisted item
  // still has its quadrant/id/other fields intact.
  it('accepting with a PARTIAL editedAfter ({ text } only, matching what the real UI sends) merges onto the proposal, never strips quadrant/id', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t2b-partial-edit-session`);

    mockLlmResolveOnce([updateProposal('strengths-1')]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(createRes.status).toBe(201);
    const proposal = createRes.body.proposals[0];
    const expectedVersion: number = proposal.expectedVersion;

    const editedText = 'PARTIAL-EDIT: only the text field is sent, like the real UI does';
    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion, editedAfter: { text: editedText } });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.proposal.finalAfter.text).toBe(editedText);
    // The merge must have preserved these from proposed_after_json -- a bare
    // replace would leave them undefined.
    expect(acceptRes.body.proposal.finalAfter.quadrant).toBe('strengths');
    expect(acceptRes.body.proposal.finalAfter.id).toBe('strengths-1');

    const readBack = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(readBack.status).toBe(200);
    const items2 = readBack.body.answers.items as any[];
    // Must still have exactly 2 items (strengths-1 updated in place, not lost
    // and not duplicated) and the edited item must still carry its quadrant,
    // so it still renders in the Strengths column.
    expect(items2).toHaveLength(2);
    const readBackItem = items2.find((it) => it.id === 'strengths-1');
    expect(readBackItem).toBeTruthy();
    expect(readBackItem.text).toBe(editedText);
    expect(readBackItem.quadrant).toBe('strengths');
    evidence(
      `[tls04-t2b] partial editedAfter merged correctly — quadrant/id survived, item still findable`
    );
  });
});

// ===========================================================================
// T3 — idempotent accept retry (second call after success → 409, no double-apply)
// ===========================================================================
describe('TLS-04 — idempotent accept retry', () => {
  it('retrying accept with the SAME expectedVersion after it already succeeded → 409 ALREADY_DECIDED, item never applied twice', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t3-idempotent-accept-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];
    const expectedVersion: number = proposal.expectedVersion;

    const firstAccept = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion });
    expect(firstAccept.status).toBe(200);
    expect(firstAccept.body.session.version).toBe(expectedVersion + 1);

    const secondAccept = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion });
    expect(secondAccept.status).toBe(409);
    expect(secondAccept.body.code).toBe('ALREADY_DECIDED');

    const finalGet = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(finalGet.body.answers.items).toHaveLength(3); // 2 base + exactly 1 added
    const addedCount = (finalGet.body.answers.items as any[]).filter(
      (it) => it.text === addProposal().proposedText
    ).length;
    expect(addedCount).toBe(1);

    const versionRow = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(versionRow.rows[0].version).toBe(expectedVersion + 1); // not +2
    evidence(`[tls04-t3] retried accept safely returns 409, session.version stayed at ${versionRow.rows[0].version}`);
  });
});

// ===========================================================================
// T4 — idempotent generate retry after PROVIDER_ERROR
// ===========================================================================
describe('TLS-04 — idempotent generate retry after PROVIDER_ERROR', () => {
  it('a failed generate (transport error, both internal attempts) creates zero rows; a manually-retried second call creates exactly one clean batch', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t4-generate-retry-session`);

    // Both of the SERVICE's internal attempts throw — distinct from the
    // controller-level HTTP retry the test performs below.
    mockLlmRejectOnce();
    mockLlmRejectOnce();
    const failedRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(failedRes.status).toBe(503);
    expect(failedRes.body.code).toBe('PROVIDER_ERROR');

    const zeroRows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(zeroRows.rows[0].c).toBe(0);

    // Distinct top-level HTTP retry — this time the service succeeds on its
    // first internal attempt.
    mockLlmResolveOnce([addProposal()]);
    const retryRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.proposals).toHaveLength(1);

    const oneCleanBatch = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(oneCleanBatch.rows[0].c).toBe(1); // not duplicated, not partial
    evidence('[tls04-t4] first attempt: 0 rows persisted on PROVIDER_ERROR; retry: exactly 1 clean batch');
  });
});

// ===========================================================================
// T5 — concurrent accept — exactly one winner
// ===========================================================================
describe('TLS-04 — concurrent accept', () => {
  // RED→GREEN #1 (concurrent-accept single-winner): temporarily removed the
  // `AND status = 'pending'` clause from the conditional UPDATE in
  // `acceptSwotProposal` (server/src/controllers/ToolController.ts), so BOTH
  // concurrent requests' UPDATE statements could match the same row instead
  // of only the first. RED (actually observed): `expect(loser.body.code)
  // .toBe('ALREADY_DECIDED')` failed with `Received: "STALE_VERSION"` — the
  // second request no longer got the correct "someone else already decided
  // this" signal; instead it fell through to the version-CAS branch and hit
  // a confusing STALE_VERSION, proving the status guard is what makes the
  // "exactly one winner, clean ALREADY_DECIDED for the loser" contract hold.
  // Restored `ToolController.ts` byte-for-byte via `git checkout --`,
  // verified with `git diff` (no residual change), reran → GREEN.
  it('two genuinely concurrent accept requests for the same pending proposal → exactly one 200, one 409, applied exactly once', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t5-concurrent-accept-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];
    const expectedVersion: number = proposal.expectedVersion;

    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ expectedVersion }),
      request(app)
        .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ expectedVersion }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = resA.status === 409 ? resA : resB;
    expect(loser.body.code).toBe('ALREADY_DECIDED');

    const acceptedRows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE id = $1 AND status = 'accepted'`,
      [proposal.id]
    );
    expect(acceptedRows.rows[0].c).toBe(1); // exactly ONE row transitioned

    const sessionRow = await pgc.query(
      `SELECT version, answers_json FROM tool_sessions WHERE id = $1`,
      [sessionId]
    );
    expect(sessionRow.rows[0].version).toBe(expectedVersion + 1); // incremented by exactly 1, not 2
    const finalItems = JSON.parse(sessionRow.rows[0].answers_json).items;
    expect(finalItems).toHaveLength(3); // base 2 + exactly 1 added, never duplicated
    const addedCount = finalItems.filter(
      (it: any) => it.text === addProposal().proposedText
    ).length;
    expect(addedCount).toBe(1);
    evidence(`[tls04-t5] concurrent accept: statuses=${statuses.join(',')} version=${sessionRow.rows[0].version} items=${finalItems.length}`);
  });
});

// ===========================================================================
// T6 — stale version → 409, proposal stays pending
// ===========================================================================
describe('TLS-04 — stale version', () => {
  // RED→GREEN #2 (stale-version rollback-both-together): temporarily
  // neutralized the `AND version = $4` optimistic-concurrency clause in the
  // `tool_sessions` UPDATE inside `acceptSwotProposal`'s transaction
  // (replaced with the tautology `AND $4::int IS NOT NULL`, keeping the bind
  // parameter referenced so Postgres doesn't reject it at the protocol
  // level), so the session write always succeeds regardless of the caller's
  // expectedVersion. RED (actually observed): `expect(acceptRes.status)
  // .toBe(409)` failed with `Received: 200` — the proposal was ACCEPTED on
  // stale data instead of being rejected and rolled back. Restored
  // `ToolController.ts` byte-for-byte via `git checkout --`, verified with
  // `git diff` (no residual change), reran → GREEN.
  it('accepting with a stale expectedVersion → 409 STALE_VERSION with the true currentVersion, proposal stays pending (rollback of BOTH the proposal flip and the session write)', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t6-stale-version-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];
    const staleVersion: number = proposal.expectedVersion; // 2 (see t2's note)
    expect(staleVersion).toBe(2);

    // Simulate an intervening edit from elsewhere — bump the session version
    // WITHOUT going through the proposal flow at all.
    await pgc.query(`UPDATE tool_sessions SET version = version + 1 WHERE id = $1`, [sessionId]);
    const bumped = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [sessionId]);
    expect(bumped.rows[0].version).toBe(staleVersion + 1);

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: staleVersion });
    expect(acceptRes.status).toBe(409);
    expect(acceptRes.body.code).toBe('STALE_VERSION');
    expect(acceptRes.body.currentVersion).toBe(staleVersion + 1);

    // Single most important correctness assertion: BOTH the proposal-status
    // flip AND the session write were rolled back together — the proposal is
    // still pending for a legitimate retry, never left half-accepted.
    const pendingCheck = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      proposal.id,
    ]);
    expect(pendingCheck.rows[0].status).toBe('pending');

    const itemsCheck = await pgc.query(`SELECT answers_json FROM tool_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(JSON.parse(itemsCheck.rows[0].answers_json).items).toEqual(items); // untouched
    evidence(`[tls04-t6] stale accept rolled back atomically — proposal.status=${pendingCheck.rows[0].status}, currentVersion=${acceptRes.body.currentVersion}`);
  });
});

// ===========================================================================
// T7 — cross-tenant, fail-closed
// ===========================================================================
describe('TLS-04 — cross-tenant fail-closed', () => {
  let foreignSessionId: string;
  let foreignPendingProposalId: string;
  let foreignPendingProposalVersion: number;

  beforeAll(async () => {
    const items = baseItems();
    foreignSessionId = await createSwotSession(tokenA, items, `${P}t7-foreign-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${foreignSessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(createRes.status).toBe(201);
    foreignPendingProposalId = createRes.body.proposals[0].id;
    foreignPendingProposalVersion = createRes.body.proposals[0].expectedVersion;
  }, 30_000);

  // RED→GREEN #4 (cross-tenant fail-closed on LIST): temporarily neutralized
  // the `AND organization_id = ?` clause in `listSwotProposals`'s session
  // lookup SELECT (replaced with the tautology `AND (? IS NOT NULL)`, same
  // placeholder count). RED (actually observed): `expect(res.status)
  // .toBe(404)` failed with `Received: 500` (the DB driver couldn't infer a
  // type for the now-untyped bare placeholder) — a different failure mode
  // than a clean 200-with-leak, but still a hard proof the org filter on the
  // session-existence check is required for this endpoint to behave at all;
  // the second query (fetching the actual proposal rows) kept its OWN
  // `organization_id` filter throughout, so even in this broken state no
  // proposal body ever left the process. Restored `ToolController.ts`
  // byte-for-byte via `git checkout --`, verified with `git diff` (no
  // residual change), reran → GREEN.
  it('list: org B cannot list proposals for org A foreign session → 404, nothing leaks', async () => {
    const res = await request(app)
      .get(`/api/tools/${foreignSessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(foreignPendingProposalId);
  });

  it('generate: org B cannot generate proposals against org A foreign session → 404, zero rows created', async () => {
    const before = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [foreignSessionId]
    );
    const res = await request(app)
      .post(`/api/tools/${foreignSessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(res.status).toBe(404);
    const after = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [foreignSessionId]
    );
    expect(after.rows[0].c).toBe(before.rows[0].c); // no new rows
  });

  // RED→GREEN #3 (cross-tenant fail-closed on ACCEPT): temporarily
  // neutralized the `AND organization_id = $5` clause in the FIRST
  // conditional UPDATE inside `acceptSwotProposal` (replaced with the
  // tautology `AND ($5::text IS NOT NULL)`, keeping the bind parameter
  // referenced). RED (actually observed): `expect(res.status).toBe(404)`
  // failed with `Received: 500` — org B's request flipped org A's proposal
  // to 'accepted' (step 1 no longer org-scoped), then crashed inside the
  // SAME transaction when step 2's still-org-scoped session lookup found no
  // row for org B — an uncaught `SWOT_PROPOSAL_PARENT_SESSION_MISSING`,
  // proving the org filter on step 1 is exactly what stops a foreign accept
  // from ever reaching (and partially mutating) another tenant's data.
  // Restored `ToolController.ts` byte-for-byte via `git checkout --`,
  // verified with `git diff` (no residual change), reran → GREEN.
  it('accept: org B cannot accept org A foreign PENDING proposal → 404, proposal stays pending, session untouched', async () => {
    const res = await request(app)
      .post(`/api/tools/${foreignSessionId}/swot-proposals/${foreignPendingProposalId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ expectedVersion: foreignPendingProposalVersion });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('accepted');

    const row = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      foreignPendingProposalId,
    ]);
    expect(row.rows[0].status).toBe('pending');

    const sessionRow = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [
      foreignSessionId,
    ]);
    expect(sessionRow.rows[0].version).toBe(foreignPendingProposalVersion); // unchanged
  });

  it('reject: org B cannot reject org A foreign PENDING proposal → 404, proposal stays pending', async () => {
    const res = await request(app)
      .post(`/api/tools/${foreignSessionId}/swot-proposals/${foreignPendingProposalId}/reject`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});
    expect(res.status).toBe(404);

    const row = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      foreignPendingProposalId,
    ]);
    expect(row.rows[0].status).toBe('pending');
  });
});

// ===========================================================================
// T8 — malformed model response → no proposal created, retryable error
// ===========================================================================
describe('TLS-04 — malformed model response, no fake success', () => {
  // RED→GREEN #5 (malformed-response zero-rows): temporarily changed
  // `if (!generation.ok) { ... return; }` to `if (false) { ... return; }` in
  // `createSwotProposals` (server/src/controllers/ToolController.ts),
  // neutralizing the early-return guard so control flow falls through to
  // `generation.proposals.map(...)` even though `generation` is
  // `{ok:false, code:'INVALID_MODEL_RESPONSE'}` (no `.proposals` field). RED
  // (actually observed): `expect(res.status).toBe(502)` failed with
  // `Received: 500` — the request crashed with an uncaught exception instead
  // of returning the clean, documented 502, proving the guard is the only
  // thing standing between a genuine validation failure and either a crash
  // or (with a differently-shaped bug) a fabricated proposal. Restored
  // `ToolController.ts` byte-for-byte via `git checkout --`, verified with
  // `git diff` (no residual change), reran → GREEN.
  it('schema-invalid response on BOTH service attempts → 502 INVALID_MODEL_RESPONSE, retryable:true, zero rows created', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t8a-malformed-session`);

    mockLlmResolveOnce([malformedProposal()]);
    mockLlmResolveOnce([malformedProposal()]);
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_MODEL_RESPONSE');
    expect(res.body.retryable).toBe(true);

    const rows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('transport error (throw) on BOTH service attempts → 503 PROVIDER_ERROR, zero rows created', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}t8b-provider-error-session`);

    mockLlmRejectOnce();
    mockLlmRejectOnce();
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PROVIDER_ERROR');
    expect(res.body.retryable).toBe(true);

    const rows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows[0].c).toBe(0);
  });
});

// ===========================================================================
// CODEX FIX PACKET (2026-08-02) — BLOCKER 1: version guard must observe
// ordinary SWOT writes, not just accept. Required real flow: generate at V ->
// real PUT/autosave changes SWOT -> session V+1 -> accept the OLD proposal ->
// 409 STALE_VERSION -> proposal stays pending -> the MANUAL change survives,
// never overwritten by the stale AI text.
// ===========================================================================
describe('TLS-04 fix packet — BLOCKER 1: ordinary PUT/autosave bumps version, protecting against a stale proposal', () => {
  it('generate at V -> real PUT changes SWOT -> V+1 -> accept stale proposal -> 409, proposal pending, manual edit survives untouched', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b1-real-autosave-session`);

    // Proposal generated against whatever version createSwotSession's own
    // seed PUT already left the session at.
    mockLlmResolveOnce([updateProposal('strengths-1')]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(createRes.status).toBe(201);
    const proposal = createRes.body.proposals[0];
    const generatedAgainstVersion: number = proposal.expectedVersion;

    // A REAL ordinary PUT/autosave — not raw SQL — manually changes the SAME
    // item this proposal targets, to something the AI text must NOT clobber.
    const manualText = 'MANUALLY EDITED BY USER — this must survive, never the stale AI text';
    const manuallyEditedItems = items.map((it) =>
      it.id === 'strengths-1' ? { ...it, text: manualText } : it
    );
    const manualPut = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: { items: manuallyEditedItems }, expectedVersion: generatedAgainstVersion });
    expect(manualPut.status).toBe(200);

    const bumped = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [sessionId]);
    // Codex BLOCKER 1's core fix: an ordinary answers_json-writing PUT bumps
    // version by exactly 1 -- before this fix it would NOT have moved at all.
    expect(bumped.rows[0].version).toBe(generatedAgainstVersion + 1);

    // Accept the OLD proposal (still recorded against the pre-edit version).
    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: generatedAgainstVersion });
    expect(acceptRes.status).toBe(409);
    expect(acceptRes.body.code).toBe('STALE_VERSION');
    expect(acceptRes.body.currentVersion).toBe(generatedAgainstVersion + 1);

    const pendingCheck = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      proposal.id,
    ]);
    expect(pendingCheck.rows[0].status).toBe('pending');

    // The manual edit is STILL there -- the stale AI proposal never applied.
    const readBack = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const readBackItem = (readBack.body.answers.items as any[]).find(
      (it) => it.id === 'strengths-1'
    );
    expect(readBackItem.text).toBe(manualText);
    expect(readBackItem.text).not.toContain('AI PROPOSED');
    evidence(
      `[tls04-b1] ordinary PUT bumped version ${generatedAgainstVersion} -> ${generatedAgainstVersion + 1}; stale accept correctly rejected; manual edit intact`
    );
  });
});

// ===========================================================================
// CODEX FIX PACKET — BLOCKER 2: the CAS source of truth is
// swot_proposals.expected_version, NEVER a client-supplied expectedVersion.
// A client that fetches the live (newer) version and sends THAT must still
// be rejected -- it cannot "refresh" a stale proposal by lying about which
// version it thinks it's operating against.
// ===========================================================================
describe('TLS-04 fix packet — BLOCKER 2: malicious/confused currentVersion cannot bypass staleness', () => {
  it('proposal generated at V, session bumped to V+1, caller sends expectedVersion=V+1 (the CURRENT version, not the proposal\'s own) -> still 409 STALE_VERSION, zero changes', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b2-malicious-bypass-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];
    const proposalOwnVersion: number = proposal.expectedVersion;

    // Real intervening edit (not raw SQL) bumps the session forward.
    const bumpPut = await request(app)
      .put(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: { items }, expectedVersion: proposalOwnVersion });
    expect(bumpPut.status).toBe(200);
    const liveVersionRow = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [
      sessionId,
    ]);
    const liveVersion: number = liveVersionRow.rows[0].version;
    expect(liveVersion).toBeGreaterThan(proposalOwnVersion);

    // The attack: the caller fetched the CURRENT live version and sends THAT
    // as expectedVersion, hoping the server naively trusts it as fresh.
    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: liveVersion });
    expect(acceptRes.status).toBe(409);
    expect(acceptRes.body.code).toBe('STALE_VERSION');

    const pendingCheck = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
      proposal.id,
    ]);
    expect(pendingCheck.rows[0].status).toBe('pending');
    const versionAfter = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [
      sessionId,
    ]);
    expect(versionAfter.rows[0].version).toBe(liveVersion); // unchanged by the rejected accept
    evidence(
      `[tls04-b2] client-supplied expectedVersion=${liveVersion} (matching the LIVE session, not the proposal's own ${proposalOwnVersion}) correctly rejected`
    );
  });

  it('an expectedVersion assertion that matches the proposal\'s own recorded version still succeeds normally', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b2-honest-assertion-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: proposal.expectedVersion });
    expect(acceptRes.status).toBe(200);
  });

  it('omitting expectedVersion entirely still uses the proposal\'s own recorded version as the real CAS source', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b2-omitted-assertion-session`);

    mockLlmResolveOnce([addProposal()]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({}); // no expectedVersion at all
    expect(acceptRes.status).toBe(200);
  });
});

// ===========================================================================
// CODEX FIX PACKET — BLOCKER 3: editedAfter is `.strict()` -- ONLY `text` is
// accepted. Any system/provenance field (id/quadrant/source/confidence/
// proposalStatus) or a prototype-pollution attempt is rejected with 400,
// BEFORE the request ever reaches the controller. The proposal must remain
// pending and the session untouched.
// ===========================================================================
describe('TLS-04 fix packet — BLOCKER 3: editedAfter is immutable except text', () => {
  const attackCases: Array<{ label: string; editedAfter: Record<string, unknown> }> = [
    { label: 'quadrant', editedAfter: { text: 'x', quadrant: 'threats' } },
    { label: 'id', editedAfter: { text: 'x', id: 'someone-elses-id' } },
    { label: 'source', editedAfter: { text: 'x', source: 'user' } },
    { label: 'confidence', editedAfter: { text: 'x', confidence: 0.99 } },
    { label: 'proposalStatus', editedAfter: { text: 'x', proposalStatus: 'accepted' } },
    { label: 'constructor', editedAfter: { text: 'x', constructor: { polluted: true } } },
  ];

  for (const { label, editedAfter } of attackCases) {
    it(`editedAfter with a "${label}" key -> 400, proposal stays pending, session untouched`, async () => {
      const items = baseItems();
      const sessionId = await createSwotSession(tokenA, items, `${P}b3-${label}-session`);

      mockLlmResolveOnce([updateProposal('strengths-1')]);
      const createRes = await request(app)
        .post(`/api/tools/${sessionId}/swot-proposals`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      const proposal = createRes.body.proposals[0];
      const versionBefore = proposal.expectedVersion;

      const acceptRes = await request(app)
        .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ expectedVersion: versionBefore, editedAfter });
      expect(acceptRes.status).toBe(400);

      const pendingCheck = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
        proposal.id,
      ]);
      expect(pendingCheck.rows[0].status).toBe('pending');
      const versionAfter = await pgc.query(`SELECT version FROM tool_sessions WHERE id = $1`, [
        sessionId,
      ]);
      expect(versionAfter.rows[0].version).toBe(versionBefore);
    });
  }

  // `__proto__` is handled separately from the loop above: a genuine own
  // property literally named "__proto__" (as produced by JSON.parse, per the
  // ECMAScript spec) survives an HTTP JSON round-trip intact -- confirmed
  // directly (node -e JSON.parse/stringify round-trip keeps it as an own,
  // enumerable key, and never mutates the REAL Object.prototype by itself).
  // Whether the validation layer's `.strict()` treats that specific key name
  // as "unrecognized" (400) or not is a property of the zod/JSON-parsing
  // stack, not something this test should assert blindly. What actually
  // matters -- and what the controller's design guarantees regardless of the
  // validation outcome -- is that NO prototype pollution occurs and the
  // server-side merge (Codex BLOCKER 3) only ever reads `editedAfter.text`
  // explicitly, never spreading the object, so a "__proto__" key can never
  // leak into the persisted item or the response.
  it('editedAfter with a "__proto__" key never pollutes Object.prototype and never leaks into the persisted item', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b3-proto-session`);

    mockLlmResolveOnce([updateProposal('strengths-1')]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];
    const versionBefore = proposal.expectedVersion;

    const maliciousEditedAfter = JSON.parse('{"text":"safe text","__proto__":{"polluted":true}}');
    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore, editedAfter: maliciousEditedAfter });

    // The real security property: no global pollution, ever.
    expect(({} as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();

    if (acceptRes.status === 200) {
      // Accepted as an ordinary text-only edit -- the "__proto__" attempt was
      // inert. The persisted item must be clean: real text, real quadrant/id
      // from the proposal, no stray "polluted" field anywhere.
      expect(acceptRes.body.proposal.finalAfter.text).toBe('safe text');
      expect(acceptRes.body.proposal.finalAfter.quadrant).toBe('strengths');
      expect(acceptRes.body.proposal.finalAfter.id).toBe('strengths-1');
      expect(acceptRes.body.proposal.finalAfter.polluted).toBeUndefined();
      const readBack = await request(app)
        .get(`/api/tools/${sessionId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      const item = (readBack.body.answers.items as any[]).find((it) => it.id === 'strengths-1');
      expect(item.polluted).toBeUndefined();
    } else {
      // Or rejected outright -- also an acceptable, safe outcome.
      expect(acceptRes.status).toBe(400);
      const pendingCheck = await pgc.query(`SELECT status FROM swot_proposals WHERE id = $1`, [
        proposal.id,
      ]);
      expect(pendingCheck.rows[0].status).toBe('pending');
    }
  });

  it('editedAfter with ONLY text still works normally (the one field the real UI actually sends)', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b3-valid-text-only-session`);

    mockLlmResolveOnce([updateProposal('strengths-1')]);
    const createRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    const proposal = createRes.body.proposals[0];

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposal.id}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: proposal.expectedVersion, editedAfter: { text: 'valid edit' } });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.proposal.finalAfter.text).toBe('valid edit');
    expect(acceptRes.body.proposal.finalAfter.quadrant).toBe('strengths');
    expect(acceptRes.body.proposal.finalAfter.id).toBe('strengths-1');
  });
});

// ===========================================================================
// CODEX FIX PACKET — BLOCKER 4: semantic validation + provenance honesty.
// Shape-valid JSON is not the same as semantically valid: a hallucinated
// targetItemId, a target claimed in the wrong quadrant, or a fabricated
// sourceRef must all be treated as INVALID_MODEL_RESPONSE, with zero rows
// persisted -- never silently accepted.
// ===========================================================================
describe('TLS-04 fix packet — BLOCKER 4: semantic validation of the model response', () => {
  it('model returns a targetItemId that does not exist in the current SWOT -> 502 INVALID_MODEL_RESPONSE, zero rows', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b4-nonexistent-target-session`);

    mockLlmResolveOnce([updateProposal('this-id-does-not-exist')]);
    mockLlmResolveOnce([updateProposal('this-id-does-not-exist')]);
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_MODEL_RESPONSE');

    const rows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('model claims a real item but in the WRONG quadrant -> 502 INVALID_MODEL_RESPONSE, zero rows', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b4-wrong-quadrant-session`);

    // strengths-1 is a real id, but claimed under "threats" -- semantically
    // impossible, must be rejected even though the shape is schema-valid.
    const wrongQuadrant = updateProposal('strengths-1', { quadrant: 'threats' });
    mockLlmResolveOnce([wrongQuadrant]);
    mockLlmResolveOnce([wrongQuadrant]);
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_MODEL_RESPONSE');

    const rows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('model cites a fabricated sourceRef (not present in the input SWOT) on a non-assumption proposal -> 502 INVALID_MODEL_RESPONSE, zero rows', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b4-fabricated-source-session`);

    const fabricated = addProposal({ sourceRefs: ['totally-made-up-id-42'], isAssumption: false });
    mockLlmResolveOnce([fabricated]);
    mockLlmResolveOnce([fabricated]);
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('INVALID_MODEL_RESPONSE');

    const rows = await pgc.query(
      `SELECT COUNT(*)::int AS c FROM swot_proposals WHERE tool_session_id = $1`,
      [sessionId]
    );
    expect(rows.rows[0].c).toBe(0);
  });

  it('an isAssumption:true proposal needs no sourceRefs and is accepted as a genuine assumption, never mislabeled anthropic', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}b4-honest-assumption-session`);

    mockLlmResolveOnce([
      addProposal({ isAssumption: true, sourceRefs: null, confidence: 0.4 }),
    ]);
    const res = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(201);
    const proposal = res.body.proposals[0];
    expect(proposal.isAssumption).toBe(true);

    // Provenance honesty: runtime has no real provider/model metadata from
    // llm.call's structured path (see swotProposalService.ts) -- must NEVER
    // assert a specific provider (e.g. 'anthropic') it did not observe.
    expect(proposal.modelMetadata.provider).toBe('unknown');
    expect(proposal.modelMetadata.model).toBe('unknown');
    expect(proposal.modelMetadata.requestedPolicy).toBe('premium');
    expect(JSON.stringify(proposal.modelMetadata).toLowerCase()).not.toContain('anthropic');
  });
});

// ===========================================================================
// STREAM G1 (2026-08-13) — the ONE canonical accept gate
// (src/config/swot/swotAcceptGate.ts) now runs INSIDE acceptSwotProposal,
// before any write. Today's real `swotProposalService.ts` generation shape
// (`GeneratedProposal` -> `proposedAfter` in `createSwotProposals`) never
// carries a `classification` field, so the generate-then-accept flow above
// can never itself produce a proposal the gate would block — that is a
// genuinely reassuring finding, not a gap in this suite. To prove the gate
// is real defense-in-depth (not dead code that merely happens to never
// fire), these tests insert a `swot_proposals` row directly via SQL with a
// `proposed_after_json` shaped like a future/alternate generation path that
// DOES carry `classification` — exactly the shape the client-side chat
// mentor (`hooks/discovery/toolAi/dynamicSwot.ts`) already produces today
// for items proposed inline in the Build Phase (a different, client-only
// code path fixed separately in `SWOTBuildPhase.tsx`'s `acceptProposal`).
// ===========================================================================
async function insertRawSwotProposal(
  sessionId: string,
  organizationId: string,
  expectedVersion: number,
  proposedAfter: Record<string, unknown>
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await pgc.query(
    `INSERT INTO swot_proposals (
       id, tool_session_id, organization_id, quadrant, operation, target_item_id,
       before_json, proposed_after_json, final_after_json, rationale, source_refs_json,
       is_assumption, confidence, model_metadata_json, status, expected_version,
       created_by, created_at
     ) VALUES ($1,$2,$3,$4,'add',NULL,NULL,$5,NULL,$6,NULL,false,0.9,$7,'pending',$8,$9,$10)`,
    [
      id,
      sessionId,
      organizationId,
      proposedAfter.quadrant,
      JSON.stringify(proposedAfter),
      'STREAM G1 defense-in-depth test fixture',
      JSON.stringify({ provider: 'unknown', model: 'unknown', requestedPolicy: 'premium' }),
      expectedVersion,
      USER_A,
      now,
    ]
  );
  return id;
}

describe('STREAM G1 — canonical accept gate blocks an unvalidated externally-claimed classification', () => {
  it('accepting a strengths proposal claiming core-competency with ZERO evidence -> 422, proposal stays pending, session untouched', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}g1-blocked-classification-session`);

    const sessionBefore = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const versionBefore: number = sessionBefore.body.version;
    const itemsBefore = sessionBefore.body.answers.items;

    const proposalId = await insertRawSwotProposal(sessionId, ORG_A, versionBefore, {
      id: randomUUID(),
      text: 'We are unmatched in the market — no one can replicate this',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 0.9,
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
      // Deliberately NO linkedSignalIds and NO evidenceNote.
    });

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore });

    expect(acceptRes.status).toBe(422);
    expect(acceptRes.body.code).toBe('UNVALIDATED_CLASSIFICATION');
    expect(acceptRes.body.message.pl).toBeTruthy();
    expect(acceptRes.body.message.en).toBeTruthy();

    // Never write partially: the proposal is still 'pending', not flipped to
    // 'accepted' and not left in any half-applied state.
    const proposalRow = await pgc.query(`SELECT status, final_after_json FROM swot_proposals WHERE id = $1`, [
      proposalId,
    ]);
    expect(proposalRow.rows[0].status).toBe('pending');
    expect(proposalRow.rows[0].final_after_json).toBeNull();

    // Session completely untouched — same version, same items.
    const sessionAfter = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(sessionAfter.body.version).toBe(versionBefore);
    expect(sessionAfter.body.answers.items).toEqual(itemsBefore);

    evidence(
      `[g1-block] 422 UNVALIDATED_CLASSIFICATION; proposal stayed pending; session version stayed at ${versionBefore}`
    );
  });

  it('the SAME proposal succeeds once a linked signal is added, and the applied item is stamped evidenceStatus: "confirmed"', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}g1-allowed-classification-session`);

    const sessionBefore = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const versionBefore: number = sessionBefore.body.version;

    const proposalId = await insertRawSwotProposal(sessionId, ORG_A, versionBefore, {
      id: randomUUID(),
      text: 'Client-confirmed pricing power in enterprise deals',
      quadrant: 'strengths',
      impact: 'high',
      source: 'ai',
      confidence: 0.9,
      proposalStatus: 'ai-proposed',
      classification: 'core-competency',
      linkedSignalIds: ['strengths-1'],
    });

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore });

    expect(acceptRes.status).toBe(200);

    const proposalRow = await pgc.query(`SELECT status, final_after_json FROM swot_proposals WHERE id = $1`, [
      proposalId,
    ]);
    expect(proposalRow.rows[0].status).toBe('accepted');
    const finalItem = JSON.parse(proposalRow.rows[0].final_after_json);
    // The engine recomputed this — never trusted from the inserted row.
    expect(finalItem.evidenceStatus).toBe('confirmed');
    expect(finalItem.status).toBe('accepted');
    expect(finalItem.proposalStatus).toBe('accepted');

    const sessionAfter = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const applied = (sessionAfter.body.answers.items as any[]).find(
      (i) => i.text === 'Client-confirmed pricing power in enterprise deals'
    );
    expect(applied).toBeTruthy();
    expect(applied.evidenceStatus).toBe('confirmed');
    expect(applied.status).toBe('accepted');
    expect(applied.proposalStatus).toBe('accepted');

    evidence('[g1-allow] 200; applied item carries engine-recomputed evidenceStatus: confirmed');
  });

  it('a proposal with NO classification claim is stamped evidenceStatus: "declared" honestly on accept (never blocked)', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}g1-declared-honesty-session`);

    const sessionBefore = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const versionBefore: number = sessionBefore.body.version;

    const proposalId = await insertRawSwotProposal(sessionId, ORG_A, versionBefore, {
      id: randomUUID(),
      text: 'Emerging regulatory tailwind in the EU market',
      quadrant: 'opportunities',
      impact: 'medium',
      source: 'ai',
      confidence: 0.6,
      proposalStatus: 'ai-proposed',
      // No classification, no linked evidence, no evidence note.
    });

    const acceptRes = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore });

    expect(acceptRes.status).toBe(200);
    const proposalRow = await pgc.query(`SELECT final_after_json FROM swot_proposals WHERE id = $1`, [
      proposalId,
    ]);
    const finalItem = JSON.parse(proposalRow.rows[0].final_after_json);
    expect(finalItem.evidenceStatus).toBe('declared');

    evidence('[g1-honest] 200; no-evidence item honestly stamped evidenceStatus: declared (not blocked)');
  });

  it('duplicate accept of the SAME (now-blocked-then-fixed) proposal id is idempotent: second call never double-applies', async () => {
    const items = baseItems();
    const sessionId = await createSwotSession(tokenA, items, `${P}g1-idempotent-blocked-session`);

    const sessionBefore = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const versionBefore: number = sessionBefore.body.version;

    const proposalId = await insertRawSwotProposal(sessionId, ORG_A, versionBefore, {
      id: randomUUID(),
      text: 'Repeat-purchase loyalty across the top accounts',
      quadrant: 'strengths',
      impact: 'medium',
      source: 'ai',
      confidence: 0.8,
      proposalStatus: 'ai-proposed',
      evidenceNote: 'Renewal data for the last 4 quarters shows >90% repeat rate.',
    });

    const first = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/tools/${sessionId}/swot-proposals/${proposalId}/accept`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ expectedVersion: versionBefore });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('ALREADY_DECIDED');

    const finalGet = await request(app)
      .get(`/api/tools/${sessionId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const matches = (finalGet.body.answers.items as any[]).filter(
      (i) => i.text === 'Repeat-purchase loyalty across the top accounts'
    );
    expect(matches).toHaveLength(1); // exactly one — never double-applied
    expect(finalGet.body.version).toBe(versionBefore + 1); // not +2

    evidence('[g1-idempotent] duplicate accept -> 409 ALREADY_DECIDED; item applied exactly once');
  });
});
