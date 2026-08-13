/**
 * S3-Teresa sprint — Teresa kernel contract tests, against a REAL,
 * one-shot PostgreSQL (fail-closed via assertRealPostgresTestEnvironment,
 * never `describe.skip`).
 *
 * Run:
 *   RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgres://consultinity:test@localhost:56502/consultinity \
 *     npx vitest run tests/integration/teresa/teresaKernel.realdb.test.ts
 *
 * Proves, positively AND negatively, the frozen contract in
 * src/method-core/contracts/teresa.ts:
 *  - commit without a preview is rejected (previewId required + kernel check)
 *  - an expired preview is rejected
 *  - an already-consumed preview is rejected, but a retried commit with the
 *    SAME idempotency key replays the same result instead of erroring
 *  - Teresa can never hold a TERESA_FORBIDDEN_EFFECTS capability (data-level
 *    AND kernel-level)
 *  - an accepted proposal records actorKind='human' while AI authorship
 *    (the originating 'teresa' event) stays queryable
 *  - a rejected proposal writes NO ARTIFACT_UPDATED event
 *  - K1 (swotTensionEngine output) is unchanged by any Teresa action
 */
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres';

const DATABASE_URL = process.env.DATABASE_URL || '';

let teresaKernel: typeof import('../../../server/src/services/teresa/teresaKernel');
let teresaCapabilities: typeof import('../../../server/src/services/teresa/teresaCapabilities');
let teresaVoice: typeof import('../../../server/src/services/teresa/teresaVoiceService');
let teresaContract: typeof import('../../../src/method-core/contracts/teresa');
let swotTensionEngine: typeof import('../../../src/config/swot/swotTensionEngine');

const PREFIX = `s3teresa-${Date.now()}-`;
const ORG = `${PREFIX}org`;
const SESSION_ID = `${PREFIX}session`;
const HUMAN_USER = `${PREFIX}human`;
const METHOD_PACK_VERSION = 'dynamic-swot@test-1';

let db: Client;

async function events(sessionId = SESSION_ID) {
  const res = await db.query(`SELECT * FROM tool_session_events WHERE tool_session_id = $1 ORDER BY created_at ASC`, [
    sessionId,
  ]);
  return res.rows as Array<Record<string, unknown>>;
}

function baseItems(): import('../../../src/store/useToolStore').SWOTItem[] {
  return [
    { id: 'it-strength-1', text: 'Silny zespół wdrożeniowy', impact: 'high', quadrant: 'strengths' },
    { id: 'it-weakness-1', text: 'Brak własnego zespołu wdrożeniowego', impact: 'medium', quadrant: 'weaknesses' },
    { id: 'it-opportunity-1', text: 'Rosnący popyt regionalny', impact: 'high', quadrant: 'opportunities' },
    { id: 'it-threat-1', text: 'Nowy regulator branżowy', impact: 'medium', quadrant: 'threats' },
  ];
}

function session(items = baseItems()) {
  return { sessionId: SESSION_ID, organizationId: ORG, methodPackVersion: METHOD_PACK_VERSION, items };
}

function commitCtx() {
  return { organizationId: ORG, toolSessionId: SESSION_ID, methodPackVersion: METHOD_PACK_VERSION };
}

beforeAll(async () => {
  await assertRealPostgresTestEnvironment({ expectedDatabase: 'consultinity' });
  process.env.DATABASE_URL = DATABASE_URL;
  process.env.DB_TYPE = 'postgres';

  teresaKernel = await import('../../../server/src/services/teresa/teresaKernel');
  teresaCapabilities = await import('../../../server/src/services/teresa/teresaCapabilities');
  teresaVoice = await import('../../../server/src/services/teresa/teresaVoiceService');
  teresaContract = await import('../../../src/method-core/contracts/teresa');
  swotTensionEngine = await import('../../../src/config/swot/swotTensionEngine');

  db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
}, 30_000);

afterAll(async () => {
  if (db) {
    await db.query(`DELETE FROM tool_session_events WHERE organization_id = $1`, [ORG]);
    await db.end();
  }
});

describe('TERESA_FORBIDDEN_EFFECTS — data + kernel level', () => {
  it('no capability in the closed set is a forbidden effect', () => {
    for (const capability of teresaContract.TERESA_CAPABILITIES) {
      expect((teresaContract.TERESA_FORBIDDEN_EFFECTS as readonly string[]).includes(capability)).toBe(false);
    }
    expect(teresaCapabilities.CAPABILITIES_ARE_NEVER_FORBIDDEN).toBe(true);
  });

  it('the kernel guard throws for every forbidden effect, defensively', () => {
    for (const effect of teresaContract.TERESA_FORBIDDEN_EFFECTS) {
      expect(() => teresaCapabilities.assertCapabilityNotForbidden(effect)).toThrow();
    }
    expect(teresaKernel.isForbiddenEffect('approve_score')).toBe(true);
    expect(teresaKernel.isForbiddenEffect('freeze_session')).toBe(true);
    expect(teresaKernel.isForbiddenEffect('publish_output')).toBe(true);
    expect(teresaKernel.isForbiddenEffect('register_initiative')).toBe(true);
    expect(teresaKernel.isForbiddenEffect('create_evidence')).toBe(true);
    expect(teresaKernel.isForbiddenEffect('draft_finding')).toBe(false);
  });
});

describe('commit without a preview', () => {
  it('is rejected: preview_not_found', async () => {
    const result = await teresaKernel.commit(
      {
        previewId: 'does-not-exist',
        decision: 'accept',
        actorUserId: HUMAN_USER,
        idempotencyKey: `${PREFIX}nf-1`,
      },
      commitCtx()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.kind).toBe('preview_not_found');
  });
});

describe('propose -> preview -> commit(accept) — happy path, S/W/O/T classification', () => {
  it('draft_finding: proposes a classification pointing at the exact fragment, accept settles with human actor + AI authorship retained', async () => {
    const preview = await teresaKernel.propose(
      {
        capabilityId: 'draft_finding',
        sessionId: SESSION_ID,
        unitId: 'strengths',
        utterance: 'Silny zespół wdrożeniowy',
        invokedBy: 'conversation',
        actorUserId: 'teresa-invoker',
      },
      session()
    );

    expect(preview.previewId).toBeTruthy();
    expect(preview.quality.verdict).toBe('valid');
    expect(preview.proposedChanges).toHaveLength(1);
    // Points at the exact existing fragment (the matching accepted item).
    expect(preview.proposedChanges[0].target).toBe('finding');
    expect(preview.proposedChanges[0].targetId).toBe('it-strength-1');

    const rowsAfterPropose = await events();
    const createEvent = rowsAfterPropose.find((r) => r.id === preview.previewId);
    expect(createEvent).toBeTruthy();
    expect(createEvent!.event_type).toBe('TERESA_PROPOSAL_CREATED');
    expect(createEvent!.actor_kind).toBe('teresa');
    expect(createEvent!.organization_id).toBe(ORG);
    expect(createEvent!.method_pack_version).toBe(METHOD_PACK_VERSION);

    const result = await teresaKernel.commit(
      {
        previewId: preview.previewId,
        decision: 'accept',
        actorUserId: HUMAN_USER,
        idempotencyKey: `${PREFIX}accept-1`,
      },
      commitCtx()
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.eventIds.length).toBe(2); // TERESA_PROPOSAL_ACCEPTED + ARTIFACT_UPDATED

    const rows = await events();
    const acceptedEvent = rows.find((r) => r.event_type === 'TERESA_PROPOSAL_ACCEPTED' && r.supersedes_id === preview.previewId);
    expect(acceptedEvent).toBeTruthy();
    expect(acceptedEvent!.actor_kind).toBe('human');
    expect(acceptedEvent!.actor_user_id).toBe(HUMAN_USER);

    const artifactEvent = rows.find((r) => r.event_type === 'ARTIFACT_UPDATED');
    expect(artifactEvent).toBeTruthy();
    expect(artifactEvent!.actor_kind).toBe('human'); // confirming human is the actor
    const artifactPayload = artifactEvent!.payload_json as Record<string, unknown>;
    expect(artifactPayload.teresaAuthored).toBe(true); // AI authorship stays visible
    expect(artifactPayload.sourceProposalId).toBe(preview.previewId);

    // AI authorship is retrievable: the original proposal is still there, actorKind='teresa'.
    const originEvent = rows.find((r) => r.id === preview.previewId);
    expect(originEvent!.actor_kind).toBe('teresa');
  });
});

describe('expired preview', () => {
  it('is rejected: preview_expired', async () => {
    const preview = await teresaKernel.propose(
      {
        capabilityId: 'ask_next_best_question',
        sessionId: SESSION_ID,
        invokedBy: 'conversation',
        actorUserId: 'teresa-invoker',
      },
      session()
    );

    // Force expiry directly on the persisted row — proves the kernel reads
    // expiresAt from the ACTUAL row, not from an in-memory TTL timer.
    await db.query(
      `UPDATE tool_session_events
         SET payload_json = jsonb_set(payload_json, '{expiresAt}', to_jsonb((NOW() - interval '1 hour')::text))
       WHERE id = $1`,
      [preview.previewId]
    );

    const result = await teresaKernel.commit(
      {
        previewId: preview.previewId,
        decision: 'reject',
        actorUserId: HUMAN_USER,
        idempotencyKey: `${PREFIX}expired-1`,
      },
      commitCtx()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.kind).toBe('preview_expired');
  });
});

describe('already-consumed preview vs. idempotent retry', () => {
  it('a second commit with a DIFFERENT idempotency key is refused; the SAME key replays the same result', async () => {
    const preview = await teresaKernel.propose(
      {
        capabilityId: 'challenge_coverage_and_scale',
        sessionId: SESSION_ID,
        invokedBy: 'local_action',
        actorUserId: 'teresa-invoker',
      },
      session()
    );

    const idemKey = `${PREFIX}consumed-1`;
    const first = await teresaKernel.commit(
      { previewId: preview.previewId, decision: 'accept', actorUserId: HUMAN_USER, idempotencyKey: idemKey },
      commitCtx()
    );
    expect(first.ok).toBe(true);

    const retrySameKey = await teresaKernel.commit(
      { previewId: preview.previewId, decision: 'accept', actorUserId: HUMAN_USER, idempotencyKey: idemKey },
      commitCtx()
    );
    expect(retrySameKey.ok).toBe(true);
    if (first.ok && retrySameKey.ok) {
      expect(retrySameKey.eventIds.sort()).toEqual(first.eventIds.sort());
    }

    const differentKey = await teresaKernel.commit(
      {
        previewId: preview.previewId,
        decision: 'accept',
        actorUserId: HUMAN_USER,
        idempotencyKey: `${PREFIX}consumed-2`,
      },
      commitCtx()
    );
    expect(differentKey.ok).toBe(false);
    if (!differentKey.ok) expect(differentKey.refusal.kind).toBe('preview_already_consumed');
  });
});

describe('quality gate — invalid preview cannot be committed', () => {
  it('summarize_response_without_invention with no utterance is invalid, and commit refuses it', async () => {
    const preview = await teresaKernel.propose(
      {
        capabilityId: 'summarize_response_without_invention',
        sessionId: SESSION_ID,
        invokedBy: 'conversation',
        actorUserId: 'teresa-invoker',
        // no utterance on purpose
      },
      session()
    );
    expect(preview.quality.verdict).toBe('invalid');

    const result = await teresaKernel.commit(
      { previewId: preview.previewId, decision: 'accept', actorUserId: HUMAN_USER, idempotencyKey: `${PREFIX}invalid-1` },
      commitCtx()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.kind).toBe('quality_invalid');
    }
  });
});

describe('reject changes nothing', () => {
  it('a rejected proposal writes TERESA_PROPOSAL_REJECTED but NO ARTIFACT_UPDATED event', async () => {
    const preview = await teresaKernel.propose(
      {
        capabilityId: 'draft_finding',
        sessionId: SESSION_ID,
        unitId: 'weaknesses',
        utterance: 'Nowa niepotwierdzona słabość',
        invokedBy: 'conversation',
        actorUserId: 'teresa-invoker',
      },
      session()
    );

    const result = await teresaKernel.commit(
      { previewId: preview.previewId, decision: 'reject', actorUserId: HUMAN_USER, idempotencyKey: `${PREFIX}reject-1` },
      commitCtx()
    );
    expect(result.ok).toBe(true);

    const rows = await events();
    const rejectedEvent = rows.find((r) => r.event_type === 'TERESA_PROPOSAL_REJECTED' && r.supersedes_id === preview.previewId);
    expect(rejectedEvent).toBeTruthy();
    expect(rejectedEvent!.actor_kind).toBe('human');

    const artifactEventsForThisProposal = rows.filter(
      (r) =>
        r.event_type === 'ARTIFACT_UPDATED' &&
        (r.payload_json as Record<string, unknown>)?.sourceProposalId === preview.previewId
    );
    expect(artifactEventsForThisProposal).toHaveLength(0);
  });
});

describe('explain / ask capabilities — no artifact change, just statements', () => {
  it('explain_question_plainly and ask_next_best_question produce valid previews with no proposed changes', async () => {
    const explain = await teresaKernel.propose(
      {
        capabilityId: 'explain_question_plainly',
        sessionId: SESSION_ID,
        unitId: 'opportunities',
        utterance: 'Jaka jest szansa rynkowa?',
        invokedBy: 'conversation',
        actorUserId: 'teresa-invoker',
      },
      session()
    );
    expect(explain.statements.length).toBeGreaterThan(0);
    expect(explain.proposedChanges).toHaveLength(0);

    const ask = await teresaKernel.propose(
      { capabilityId: 'ask_next_best_question', sessionId: SESSION_ID, invokedBy: 'conversation', actorUserId: 'teresa-invoker' },
      session()
    );
    expect(ask.statements[0].kind).toBe('proposal');
  });
});

describe('K1 invariance', () => {
  it('deterministic SWOT tensions are unchanged by any number of Teresa propose/commit cycles', async () => {
    const items = baseItems();
    const before = swotTensionEngine.deriveTensionCandidates(items);

    // Run several Teresa capabilities, including accepted commits, against
    // the SAME items array. The kernel never mutates `items` and writes only
    // to tool_session_events — it has no code path back into the engine's input.
    const p1 = await teresaKernel.propose(
      { capabilityId: 'draft_finding', sessionId: SESSION_ID, unitId: 'threats', utterance: 'Nowe cło importowe', invokedBy: 'conversation', actorUserId: 'teresa-invoker' },
      session(items)
    );
    await teresaKernel.commit(
      { previewId: p1.previewId, decision: 'accept', actorUserId: HUMAN_USER, idempotencyKey: `${PREFIX}k1-1` },
      commitCtx()
    );

    const p2 = await teresaKernel.propose(
      { capabilityId: 'detect_contradiction', sessionId: SESSION_ID, invokedBy: 'conversation', actorUserId: 'teresa-invoker' },
      session(items)
    );
    await teresaKernel.commit(
      { previewId: p2.previewId, decision: 'reject', actorUserId: HUMAN_USER, idempotencyKey: `${PREFIX}k1-2` },
      commitCtx()
    );

    const after = swotTensionEngine.deriveTensionCandidates(items);
    expect(after).toEqual(before);
  });
});

describe('voice — transcript -> draft -> preview -> confirm, same kernel path', () => {
  it('drafts a note from a transcript and commits it through teresaKernel.commit', async () => {
    expect(teresaVoice.REAL_AUDIO_NOT_VERIFIED).toBe(true);

    const preview = await teresaVoice.draftNoteFromTranscript(
      { transcript: 'Klient potwierdził wdrożenie nowego CRM w Q3.', sessionId: SESSION_ID, actorUserId: 'teresa-invoker' },
      session()
    );
    expect(preview.quality.verdict).toBe('valid');
    expect(preview.proposedChanges[0].target).toBe('note');

    const result = await teresaVoice.confirmVoiceNote(
      { previewId: preview.previewId, decision: 'accept', actorUserId: HUMAN_USER, idempotencyKey: `${PREFIX}voice-1` },
      commitCtx()
    );
    expect(result.ok).toBe(true);

    const rows = await events();
    const noteEvent = rows.find(
      (r) => r.event_type === 'ARTIFACT_UPDATED' && (r.payload_json as Record<string, unknown>)?.target === 'note'
    );
    expect(noteEvent).toBeTruthy();
    expect(((noteEvent!.payload_json as Record<string, unknown>).after as Record<string, unknown>).text).toBe(
      'Klient potwierdził wdrożenie nowego CRM w Q3.'
    );
  });
});
