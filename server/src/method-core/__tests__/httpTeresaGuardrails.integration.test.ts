/**
 * @vitest-environment node
 *
 * Shared Method Kernel — Teresa Intent -> Preview -> Human confirmation ->
 * Commit -> Settle, real PostgreSQL.
 *
 * S7 / Task B: proves the cycle is FULL and not bypassable, over the real
 * HTTP surface (`POST /sessions/:id/teresa/preview`,
 * `POST /sessions/:id/teresa/commit`), against real Postgres — same harness
 * as `http.integration.test.ts`.
 *
 * Most of the underlying guardrails (commit-without-preview unrepresentable,
 * expired/consumed preview refused) were ALREADY implemented in
 * `TeresaProposalService`/`method-core.routes.ts` before this task — see
 * `TeresaProposalService.test.ts` for the service-level (mocked-DB) proof.
 * This file adds the HTTP-level proof (the actual boundary a client hits)
 * plus what was genuinely missing: a per-effect test that
 * `TERESA_FORBIDDEN_EFFECTS` cannot reach a preview at all, and a real-DB
 * proof that Teresa's AI authorship stays visible after a human commits.
 *
 * Run (from the worktree ROOT):
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
 *   DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:5439/consultify_asm_s7" \
 *   npx vitest run server/src/method-core/__tests__/httpTeresaGuardrails.integration.test.ts
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TERESA_CAPABILITIES, TERESA_FORBIDDEN_EFFECTS } from '../contracts/index.js';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

describe.skipIf(!REAL_DB)('Teresa Intent -> Preview -> Commit — real PostgreSQL', () => {
  let app: Express;
  let pool: import('pg').Pool;

  const SUFFIX = randomUUID().slice(0, 8);
  const ORG = `org-s7-teresa-${SUFFIX}`;
  const OWNER = `user-s7-teresa-owner-${SUFFIX}`;

  const PACK_ID = `s7-teresa-pack-${SUFFIX}`;
  const PACK_VERSION = 'v1';

  let ownerToken = '';

  beforeAll(async () => {
    if (!REAL_DB) {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real postgres DATABASE_URL.');
    }

    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
      ORG,
      'S7 Teresa guardrails test org',
    ]);
    await pool.query(
      `INSERT INTO users (id, organization_id, email, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [OWNER, ORG, `${OWNER}@example.test`, 'user']
    );

    const { default: config } = await import('../../config/Config.js');
    ownerToken = jwt.sign({ id: OWNER, organizationId: ORG, role: 'user' }, config.JWT_SECRET, {
      expiresIn: '15m',
      ...(config.JWT_ISSUER ? { issuer: config.JWT_ISSUER } : {}),
      ...(config.JWT_AUDIENCE ? { audience: config.JWT_AUDIENCE } : {}),
    });

    const { methodPackRegistry } = await import('../MethodPackRegistry.js');
    await methodPackRegistry.register({
      organizationId: ORG,
      packId: PACK_ID,
      version: PACK_VERSION,
      name: 'S7 Teresa test pack (released)',
      readiness: 'released',
    });

    const { default: methodCoreRoutes } = await import('../../routes/method-core.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/method', methodCoreRoutes);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM users WHERE id = $1`, [OWNER]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
    await pool.end();
  });

  // -- helpers ----------------------------------------------------------------

  async function createSession(): Promise<string> {
    const res = await request(app)
      .post('/api/method/sessions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', `create:${randomUUID()}`)
      .send({
        module: 'assessment',
        methodPackId: PACK_ID,
        methodPackVersion: PACK_VERSION,
        mode: 'guided_manual',
        projectId: null,
      });
    expect(res.status).toBe(201);
    return res.body.session.id;
  }

  async function createPreview(
    sessionId: string,
    overrides: Record<string, unknown> = {}
  ): Promise<{ status: number; body: Record<string, any> }> {
    const res = await request(app)
      .post(`/api/method/sessions/${sessionId}/teresa/preview`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        capabilityId: 'draft_score_proposal',
        unitId: '1A',
        level: 3,
        invokedBy: 'local_action',
        statements: [{ kind: 'proposal', text: 'Proponowany poziom 3 dla 1A.', sourceRefs: [] }],
        proposedChanges: [{ target: 'score_proposal', targetId: '1A', before: null, after: 3 }],
        quality: { verdict: 'valid', failedChecks: [] },
        ...overrides,
      });
    return { status: res.status, body: res.body };
  }

  async function commit(
    sessionId: string,
    body: Record<string, unknown>,
    idemKey = `commit:${randomUUID()}`
  ) {
    return request(app)
      .post(`/api/method/sessions/${sessionId}/teresa/commit`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Idempotency-Key', idemKey)
      .send(body);
  }

  // ---------------------------------------------------------------------------
  // 1. commit without a preview is unrepresentable — 400, not a 500 or a
  //    silent no-op.
  // ---------------------------------------------------------------------------
  it('1. HTTP: committing with NO previewId at all is refused with 400 ("commit without a preview is unrepresentable")', async () => {
    const sessionId = await createSession();
    const res = await commit(sessionId, { decision: 'accept' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('previewId is required');

    const events = await pool.query(`SELECT type FROM method_events WHERE session_id = $1`, [sessionId]);
    expect(events.rows.some((r) => r.type.startsWith('TERESA_PROPOSAL'))).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. expired preview -> 409
  // ---------------------------------------------------------------------------
  it('2. HTTP: committing an EXPIRED preview is refused with 409 preview_expired', async () => {
    const sessionId = await createSession();
    const preview = await createPreview(sessionId, { ttlMs: -1000 });
    expect(preview.status).toBe(201);

    const res = await commit(sessionId, { previewId: preview.body.preview.previewId, decision: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('preview_expired');
  });

  // ---------------------------------------------------------------------------
  // 3. already-consumed preview -> second commit refused
  // ---------------------------------------------------------------------------
  it('3. HTTP: committing the SAME preview twice refuses the second call with 409 preview_already_consumed', async () => {
    const sessionId = await createSession();
    const preview = await createPreview(sessionId);
    const previewId = preview.body.preview.previewId;

    const first = await commit(sessionId, { previewId, decision: 'accept' }, `commit:first:${randomUUID()}`);
    expect(first.status).toBe(200);

    const second = await commit(sessionId, { previewId, decision: 'accept' }, `commit:second:${randomUUID()}`);
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('preview_already_consumed');

    // Only ONE TERESA_PROPOSAL_ACCEPTED event landed, not two.
    const accepted = await pool.query(
      `SELECT id FROM method_events WHERE session_id = $1 AND type = 'TERESA_PROPOSAL_ACCEPTED'`,
      [sessionId]
    );
    expect(accepted.rows).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 4. TERESA_FORBIDDEN_EFFECTS — each one individually, as data. Teresa can
  //    never even START an intent for these: they are not in the closed
  //    TERESA_CAPABILITIES set the preview endpoint validates against.
  // ---------------------------------------------------------------------------
  describe('TERESA_FORBIDDEN_EFFECTS — each effect individually refused at the Intent boundary', () => {
    for (const effect of TERESA_FORBIDDEN_EFFECTS) {
      it(`refuses '${effect}' as a capabilityId (400 — not in the closed TERESA_CAPABILITIES set)`, async () => {
        const sessionId = await createSession();
        const res = await createPreview(sessionId, { capabilityId: effect });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('TERESA_CAPABILITIES');

        // No preview row, no TERESA_PROPOSAL_CREATED event — the refusal is
        // total, not a partial write.
        const previews = await pool.query(
          `SELECT id FROM method_teresa_previews WHERE session_id = $1`,
          [sessionId]
        );
        expect(previews.rows).toHaveLength(0);
        const events = await pool.query(`SELECT type FROM method_events WHERE session_id = $1`, [sessionId]);
        expect(events.rows).toHaveLength(0);
      });
    }
  });

  it('4b. the closed capability/forbidden-effect sets never overlap — a data invariant, not just runtime behaviour', () => {
    const capabilitySet = new Set<string>(TERESA_CAPABILITIES);
    for (const effect of TERESA_FORBIDDEN_EFFECTS) {
      expect(capabilitySet.has(effect)).toBe(false);
    }
  });

  // ---------------------------------------------------------------------------
  // 5. provenance: AI authorship stays visible after a human accepts
  // ---------------------------------------------------------------------------
  it('5. after a human accepts, actorKind on the commit is human but Teresa\'s original AI authorship is still discoverable via the linked preview event', async () => {
    const sessionId = await createSession();
    const preview = await createPreview(sessionId);
    const previewId = preview.body.preview.previewId;

    const commitRes = await commit(sessionId, { previewId, decision: 'accept' });
    expect(commitRes.status).toBe(200);

    const events = await pool.query(
      `SELECT type, actor_kind, actor_user_id, payload_json FROM method_events WHERE session_id = $1 ORDER BY occurred_at ASC`,
      [sessionId]
    );

    const createdEvent = events.rows.find((r) => r.type === 'TERESA_PROPOSAL_CREATED');
    const acceptedEvent = events.rows.find((r) => r.type === 'TERESA_PROPOSAL_ACCEPTED');
    expect(createdEvent).toBeTruthy();
    expect(acceptedEvent).toBeTruthy();

    // The committing actor is recorded as human...
    expect(acceptedEvent.actor_kind).toBe('human');
    expect(acceptedEvent.actor_user_id).toBe(OWNER);

    // ...but the ORIGINAL proposal is recorded as Teresa's, and the two
    // events are linked by the SAME proposalId — so "who actually proposed
    // this" never disappears just because a human accepted it.
    expect(createdEvent.actor_kind).toBe('teresa');
    expect(createdEvent.payload_json.proposalId).toBe(previewId);
    expect(acceptedEvent.payload_json.proposalId).toBe(previewId);
    // actorKind differs between the two linked events even though a human
    // was involved in both (invoking + accepting) — actorKind is never
    // conflated with actorUserId, exactly as the contract requires.
    expect(createdEvent.actor_kind).not.toBe(acceptedEvent.actor_kind);
  });

  // ---------------------------------------------------------------------------
  // 6. draft_score_proposal never approves anything by itself
  // ---------------------------------------------------------------------------
  it('6. accepting a draft_score_proposal preview does NOT transition the session or write anything beyond the event — "proponuje poziom ale go nie zatwierdza"', async () => {
    const sessionId = await createSession();
    const before = await pool.query(`SELECT state, version, updated_at FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);

    const preview = await createPreview(sessionId); // capabilityId: draft_score_proposal by default
    const commitRes = await commit(sessionId, { previewId: preview.body.preview.previewId, decision: 'accept' });
    expect(commitRes.status).toBe(200);

    const after = await pool.query(`SELECT state, version, updated_at FROM method_sessions WHERE id = $1`, [
      sessionId,
    ]);
    // The session row is completely untouched by a Teresa commit — no
    // approve/transition side effect snuck in.
    expect(after.rows[0]).toEqual(before.rows[0]);

    // No ANSWER_CONFIRMED / DECISION_APPROVED event materialized either —
    // the ONLY effect of a commit is the TERESA_PROPOSAL_ACCEPTED event
    // itself; approving the level for real is a SEPARATE, explicit human
    // action this route never performs on Teresa's behalf.
    const events = await pool.query(`SELECT type FROM method_events WHERE session_id = $1`, [sessionId]);
    const types = events.rows.map((r) => r.type);
    expect(types).not.toContain('DECISION_APPROVED');
    expect(types.filter((t) => t === 'TERESA_PROPOSAL_ACCEPTED')).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 7. reject decision produces the REJECTED event type
  // ---------------------------------------------------------------------------
  it('7. a "reject" decision records TERESA_PROPOSAL_REJECTED, not ACCEPTED', async () => {
    const sessionId = await createSession();
    const preview = await createPreview(sessionId);
    const res = await commit(sessionId, { previewId: preview.body.preview.previewId, decision: 'reject' });
    expect(res.status).toBe(200);

    const events = await pool.query(`SELECT type FROM method_events WHERE session_id = $1`, [sessionId]);
    const types = events.rows.map((r) => r.type);
    expect(types).toContain('TERESA_PROPOSAL_REJECTED');
    expect(types).not.toContain('TERESA_PROPOSAL_ACCEPTED');
  });

  // ---------------------------------------------------------------------------
  // 8. commit against a frozen session is refused, over real HTTP
  // ---------------------------------------------------------------------------
  it('8. HTTP: committing a preview against a FROZEN session is refused with 409 session_frozen', async () => {
    const sessionId = await createSession();
    const preview = await createPreview(sessionId);

    // Drive to frozen directly via SQL (role wiring for a full transition
    // chain is exercised elsewhere — http.integration.test.ts's
    // driveToInReview/freeze path; here we only need the STATE to be
    // 'frozen' for this specific refusal).
    await pool.query(`UPDATE method_sessions SET state = 'frozen' WHERE id = $1`, [sessionId]);

    const res = await commit(sessionId, { previewId: preview.body.preview.previewId, decision: 'accept' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('session_frozen');
  });

  // ---------------------------------------------------------------------------
  // 9. capabilityId outside the closed set entirely (not even a plausible
  //    forbidden effect, just garbage) is refused the same way.
  // ---------------------------------------------------------------------------
  it('9. an unknown capabilityId (not a real capability, not a forbidden effect either) is refused with 400', async () => {
    const sessionId = await createSession();
    const res = await createPreview(sessionId, { capabilityId: 'not_a_real_capability' });
    expect(res.status).toBe(400);
  });
});
