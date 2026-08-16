/**
 * Lane C (closure) — CHAT-BVP-001 / CHAT-NFR-001: `chatHandoffService.ts`
 * acceptance evidence, against a REAL local Postgres (no mocks).
 *
 * Lives under `server/src/services/chatHandoff/__tests__/` — not
 * `tests/<newdir>/` — specifically so the ROOT `vitest.config.ts` collects it
 * via its existing glob
 * `server/src/services/**\/__tests__/**\/*.{test,spec}.{js,ts,jsx,tsx}` (same
 * reasoning as `handoffSpine.pg.test.ts` / `meetingBoundaryService.pg.test.ts`,
 * which this suite deliberately mirrors in structure).
 *
 * ── WHAT THIS EXERCISES AGAINST THE REAL DB ────────────────────────────
 * Every write this suite makes — `artifact_handoff_proposals` /
 * `artifact_handoff_receipts` (via the shared spine), plus the small
 * `organizations` / `users` / `conversations` / `conversation_messages`
 * fixture rows one test needs to exercise the REAL `pgChatMessageSourceProvider`
 * SQL join — happens against a real local Postgres connection. No table or
 * behavior in `chatHandoffService.ts` is mocked.
 *
 * For the negative "provider is unavailable/failing" paths (CHAT-NFR-001)
 * this suite injects a throwing/empty `ChatMessageSourceProvider` via
 * `createChatProposal`'s `sourceProvider` DI seam rather than taking the
 * real database down — the same reasoning `handoffSpineService.ts`'s
 * `markExportUnavailable` test uses an explicit call rather than simulating
 * a real provider outage: it is the deterministic way to prove the fail-
 * closed CODE PATH, and the seam itself (an injectable interface, not a
 * hardcoded `import`) is precisely what CHAT-NFR-001 asks this file to have.
 *
 * Every fixture id is prefixed `claude_c_<runId>-...`; `afterAll` deletes
 * every row this file created, verified by a final COUNT(*) across every
 * table touched — demo data is the product's face; this suite leaves zero
 * rows behind.
 *
 * Run (root config, no --config flag; MOCK_DB=false required — see
 * `handoffSpine.pg.test.ts`'s header for why):
 *   export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity"
 *   export DB_TYPE=postgres CI=true MOCK_DB=false RUN_DB_TESTS=1
 *   npx vitest run server/src/services/chatHandoff --no-file-parallelism --maxWorkers=1 --retry=0
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  canonicalSourceHash,
  createProposal as spineCreateProposal,
  materializeProposal,
} from '../../artifactHandoff/handoffSpineService.js';
import {
  approveChatProposal,
  ChatHandoffError,
  createChatProposal,
  getChatProposal,
  listChatProposalsForConversation,
  pgChatMessageSourceProvider,
  rejectChatProposal,
  type ChatMessageSource,
  type ChatMessageSourceProvider,
} from '../chatHandoffService.js';

function requireLocalDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `chatHandoffService.pg.test.ts requires a LOCAL DATABASE_URL (got: ${url || '(unset)'}). ` +
        'This suite writes real rows and must never point at a shared/demo/prod database.'
    );
  }
  return url;
}

const RUN_ID = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const PREFIX = `claude_c_${RUN_ID}-`;
const ORG_A = `${PREFIX}org-a`;
const ORG_B = `${PREFIX}org-b`;
const USER_A = `${PREFIX}user-a`;
const USER_B = `${PREFIX}user-b`;

const pool = new Pool({ connectionString: requireLocalDatabaseUrl() });

/** A fixed, in-memory provider — used everywhere the test's point is the
 * governance/spine behavior, not the real SQL join (that gets its own test
 * below, against real fixture rows). */
function fixedProvider(source: ChatMessageSource): ChatMessageSourceProvider {
  return { resolve: async () => source };
}

function makeSource(overrides: Partial<ChatMessageSource> = {}): ChatMessageSource {
  return {
    messageId: `${PREFIX}msg-${randomUUID()}`,
    conversationId: `${PREFIX}conv-fixed`,
    organizationId: ORG_A,
    role: 'ai',
    content: 'See [1] and [Source: Q3 Plan] plus https://example.test/report for details.',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function countAllFixtureRows(): Promise<{
  proposals: number;
  receipts: number;
  conversationMessages: number;
  conversations: number;
  users: number;
  organizations: number;
}> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM artifact_handoff_proposals WHERE organization_id LIKE $1) AS proposals,
       (SELECT COUNT(*)::int FROM artifact_handoff_receipts  WHERE organization_id LIKE $1) AS receipts,
       (SELECT COUNT(*)::int FROM conversation_messages WHERE id LIKE $1) AS conversation_messages,
       (SELECT COUNT(*)::int FROM conversations WHERE id LIKE $1) AS conversations,
       (SELECT COUNT(*)::int FROM users WHERE id LIKE $1) AS users,
       (SELECT COUNT(*)::int FROM organizations WHERE id LIKE $1) AS organizations`,
    [`${PREFIX}%`]
  );
  const row = result.rows[0];
  return {
    proposals: row.proposals,
    receipts: row.receipts,
    conversationMessages: row.conversation_messages,
    conversations: row.conversations,
    users: row.users,
    organizations: row.organizations,
  };
}

beforeAll(async () => {
  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('artifact_handoff_proposals', 'artifact_handoff_receipts')`
  );
  if (tables.rows.length !== 2) {
    throw new Error(
      `chatHandoffService.pg.test.ts requires server/migrations/20260912_claude_c_handoff_spine.sql ` +
        `to be applied. Found ${tables.rows.length}/2 spine tables.`
    );
  }
});

afterAll(async () => {
  try {
    await pool.query(`DELETE FROM artifact_handoff_receipts WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(
      `DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1 AND producer_kind = 'chat'`,
      [`${PREFIX}%`]
    );
    // Any non-'chat' proposals this suite created directly via the spine
    // (boundary-proof fixture) also carry the prefix — clean those too.
    await pool.query(`DELETE FROM artifact_handoff_proposals WHERE organization_id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM conversation_messages WHERE id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM conversations WHERE id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]);
    await pool.query(`DELETE FROM organizations WHERE id LIKE $1`, [`${PREFIX}%`]);

    const remaining = await countAllFixtureRows();
    expect(remaining).toEqual({
      proposals: 0,
      receipts: 0,
      conversationMessages: 0,
      conversations: 0,
      users: 0,
      organizations: 0,
    });
  } finally {
    await pool.end();
  }
});

describe('createChatProposal — happy path (fixed provider)', () => {
  it('creates a pending chat proposal with server-extracted citations, hash-pinned', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-happy` });
    const result = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      note: 'turn this into a doc',
      clientCitations: [{ bogus: 'client data — must not be authoritative' }],
      sourceProvider: fixedProvider(source),
    });

    expect(result.replayed).toBe(false);
    expect(result.proposal.state).toBe('pending');
    expect(result.proposal.producerKind).toBe('chat');
    expect(result.proposal.producerRecordId).toBe(source.messageId);
    // Server-extracted citations are non-empty and independent of the
    // (bogus) client-supplied ones.
    expect(result.citations.length).toBeGreaterThan(0);

    const payload = result.proposal.payload as any;
    expect(payload.schemaVersion).toBe('v1');
    expect(payload.conversationId).toBe(source.conversationId);
    expect(payload.messageId).toBe(source.messageId);
    expect(payload.content).toBe(source.content);
    expect(payload.citations.length).toBe(result.citations.length);
    expect(payload.clientCitations).toEqual([{ bogus: 'client data — must not be authoritative' }]);
    expect(payload.note).toBe('turn this into a doc');

    // The hash a human approves is the canonical hash of THIS payload.
    expect(result.proposal.sourceContentHash).toBe(canonicalSourceHash(payload));
  });

  it('same idempotency key twice yields ONE proposal, marked replayed', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-idem` });
    const idempotencyKey = `${PREFIX}idem-chat`;
    const input = {
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document' as const,
      idempotencyKey,
      sourceProvider: fixedProvider(source),
    };

    const first = await createChatProposal(input);
    const second = await createChatProposal(input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.proposal.proposalId).toBe(first.proposal.proposalId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND idempotency_key = $2`,
      [ORG_A, idempotencyKey]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('citations survive a cold, independent re-query of the row', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-cold` });
    const created = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      sourceProvider: fixedProvider(source),
    });

    const cold = await pool.query(`SELECT payload_json FROM artifact_handoff_proposals WHERE proposal_id = $1`, [
      created.proposal.proposalId,
    ]);
    const payload = JSON.parse(cold.rows[0].payload_json);
    expect(Array.isArray(payload.citations)).toBe(true);
    expect(payload.citations.length).toBe(created.citations.length);
    expect(payload.citations).toEqual(created.citations);
  });
});

describe('CHAT-NFR-001 — provider fail-closed', () => {
  it('a throwing provider produces an explicit PROVIDER_UNAVAILABLE failure and NO phantom proposal', async () => {
    const messageId = `${PREFIX}msg-provider-throws`;
    const throwingProvider: ChatMessageSourceProvider = {
      resolve: async () => {
        throw new Error('simulated provider outage');
      },
    };

    await expect(
      createChatProposal({
        organizationId: ORG_A,
        userId: USER_A,
        conversationId: `${PREFIX}conv-fixed`,
        messageId,
        targetKind: 'document',
        sourceProvider: throwingProvider,
      })
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', httpStatus: 503 });

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND producer_record_id = $2`,
      [ORG_A, messageId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('a provider that resolves nothing yields SOURCE_NOT_FOUND and NO phantom proposal', async () => {
    const messageId = `${PREFIX}msg-provider-null`;
    const emptyProvider: ChatMessageSourceProvider = { resolve: async () => null };

    await expect(
      createChatProposal({
        organizationId: ORG_A,
        userId: USER_A,
        conversationId: `${PREFIX}conv-fixed`,
        messageId,
        targetKind: 'document',
        sourceProvider: emptyProvider,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND', httpStatus: 404 });

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND producer_record_id = $2`,
      [ORG_A, messageId]
    );
    expect(rows.rows[0].n).toBe(0);
  });

  it('an empty-content message yields EMPTY_SOURCE and NO phantom/empty proposal', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-empty`, content: '   ' });

    await expect(
      createChatProposal({
        organizationId: ORG_A,
        userId: USER_A,
        conversationId: source.conversationId,
        messageId: source.messageId,
        targetKind: 'document',
        sourceProvider: fixedProvider(source),
      })
    ).rejects.toMatchObject({ code: 'EMPTY_SOURCE', httpStatus: 422 });

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_proposals WHERE organization_id = $1 AND producer_record_id = $2`,
      [ORG_A, source.messageId]
    );
    expect(rows.rows[0].n).toBe(0);
  });
});

describe('approveChatProposal / rejectChatProposal', () => {
  it('two CONCURRENT approvals converge on one decision, and a subsequent materialize yields exactly one receipt', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-approve-race` });
    const created = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      sourceProvider: fixedProvider(source),
    });

    const [a1, a2] = await Promise.all([
      approveChatProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_A }),
      approveChatProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_B }),
    ]);
    expect(a1.state).toBe('approved');
    expect(a1.decidedBy).toBe(a2.decidedBy);

    // Materialization is owned by the lane that creates the actual document
    // row (see chatHandoffService.ts's CROSS-LANE CONTRACT) — simulated here
    // by calling the spine directly, exactly as that lane would.
    const [m1, m2] = await Promise.all([
      materializeProposal({
        organizationId: ORG_A,
        proposalId: created.proposal.proposalId,
        targetRecordId: `${PREFIX}doc-approve-race`,
        materializedBy: USER_A,
      }),
      materializeProposal({
        organizationId: ORG_A,
        proposalId: created.proposal.proposalId,
        targetRecordId: `${PREFIX}doc-approve-race`,
        materializedBy: USER_B,
      }),
    ]);
    expect(m1.receipt.receiptId).toBe(m2.receipt.receiptId);

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM artifact_handoff_receipts WHERE proposal_id = $1`,
      [created.proposal.proposalId]
    );
    expect(rows.rows[0].n).toBe(1);
  });

  it('rejects an empty or system actor — human approval is required', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-bad-actor` });
    const created = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      sourceProvider: fixedProvider(source),
    });

    await expect(
      approveChatProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: 'system' })
    ).rejects.toMatchObject({ code: 'NOT_A_HUMAN_ACTOR' });
    await expect(
      approveChatProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: '' })
    ).rejects.toBeInstanceOf(ChatHandoffError);

    const row = await getChatProposal(ORG_A, created.proposal.proposalId);
    expect(row.state).toBe('pending');
  });

  it('a rejected proposal cannot later be approved', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-reject-then-approve` });
    const created = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      sourceProvider: fixedProvider(source),
    });

    const rejected = await rejectChatProposal({
      organizationId: ORG_A,
      proposalId: created.proposal.proposalId,
      decidedBy: USER_A,
      reason: 'not needed',
    });
    expect(rejected.state).toBe('rejected');

    await expect(
      approveChatProposal({ organizationId: ORG_A, proposalId: created.proposal.proposalId, decidedBy: USER_B })
    ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
  });
});

describe('tenant isolation', () => {
  it('org B cannot read, approve, or reject an org A chat proposal', async () => {
    const source = makeSource({ messageId: `${PREFIX}msg-tenant`, organizationId: ORG_A });
    const created = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: source.conversationId,
      messageId: source.messageId,
      targetKind: 'document',
      sourceProvider: fixedProvider(source),
    });

    await expect(getChatProposal(ORG_B, created.proposal.proposalId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      approveChatProposal({ organizationId: ORG_B, proposalId: created.proposal.proposalId, decidedBy: USER_B })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      rejectChatProposal({ organizationId: ORG_B, proposalId: created.proposal.proposalId, decidedBy: USER_B })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const stillPending = await getChatProposal(ORG_A, created.proposal.proposalId);
    expect(stillPending.state).toBe('pending');
  });
});

describe('producer-kind boundary', () => {
  it('a non-chat proposal (e.g. producer_kind = idea) is invisible to the chat surface', async () => {
    const nonChat = await spineCreateProposal({
      organizationId: ORG_A,
      producerKind: 'idea',
      producerRecordId: `${PREFIX}idea-not-chat`,
      targetKind: 'document',
      payload: { note: 'not a chat proposal' },
      createdBy: USER_A,
    });

    await expect(getChatProposal(ORG_A, nonChat.proposal.proposalId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      approveChatProposal({ organizationId: ORG_A, proposalId: nonChat.proposal.proposalId, decidedBy: USER_A })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listChatProposalsForConversation', () => {
  it('lists only this conversation, this org, newest first', async () => {
    const conversationId = `${PREFIX}conv-list`;
    const first = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId,
      messageId: `${PREFIX}msg-list-1`,
      targetKind: 'document',
      sourceProvider: fixedProvider(makeSource({ messageId: `${PREFIX}msg-list-1`, conversationId })),
    });
    const second = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId,
      messageId: `${PREFIX}msg-list-2`,
      targetKind: 'presentation',
      sourceProvider: fixedProvider(makeSource({ messageId: `${PREFIX}msg-list-2`, conversationId })),
    });
    // Different conversation, same org — must not leak into the list below.
    await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId: `${PREFIX}conv-other`,
      messageId: `${PREFIX}msg-list-other`,
      targetKind: 'document',
      sourceProvider: fixedProvider(
        makeSource({ messageId: `${PREFIX}msg-list-other`, conversationId: `${PREFIX}conv-other` })
      ),
    });

    const listedA = await listChatProposalsForConversation(ORG_A, conversationId);
    const ids = listedA.map((p) => p.proposalId);
    expect(ids).toContain(first.proposal.proposalId);
    expect(ids).toContain(second.proposal.proposalId);
    expect(ids.length).toBe(2);
    // Newest first.
    expect(listedA[0].proposalId).toBe(second.proposal.proposalId);

    const listedB = await listChatProposalsForConversation(ORG_B, conversationId);
    expect(listedB).toEqual([]);
  });
});

describe('real pgChatMessageSourceProvider — actual SQL join against real fixture rows', () => {
  const conversationId = `${PREFIX}conv-real`;
  const messageId = `${PREFIX}msg-real`;
  const messageContent = 'Real DB content with a citation [1] and a link https://example.test/x';

  beforeAll(async () => {
    await pool.query(`INSERT INTO organizations (id) VALUES ($1), ($2)`, [ORG_A, ORG_B]);
    await pool.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      USER_A,
      ORG_A,
      `${USER_A}@example.test`,
    ]);
    await pool.query(`INSERT INTO conversations (id, user_id, organization_id, title) VALUES ($1, $2, $3, $4)`, [
      conversationId,
      USER_A,
      ORG_A,
      `${PREFIX}conversation`,
    ]);
    await pool.query(
      `INSERT INTO conversation_messages (id, conversation_id, role, content) VALUES ($1, $2, 'ai', $3)`,
      [messageId, conversationId, messageContent]
    );
  });

  it('resolves real content for the owning org and returns null for a different org', async () => {
    const resolved = await pgChatMessageSourceProvider.resolve({
      organizationId: ORG_A,
      conversationId,
      messageId,
    });
    expect(resolved).not.toBeNull();
    expect(resolved?.content).toBe(messageContent);
    expect(resolved?.role).toBe('ai');

    const crossTenant = await pgChatMessageSourceProvider.resolve({
      organizationId: ORG_B,
      conversationId,
      messageId,
    });
    expect(crossTenant).toBeNull();
  });

  it('createChatProposal end-to-end with the REAL default provider (no sourceProvider override)', async () => {
    const result = await createChatProposal({
      organizationId: ORG_A,
      userId: USER_A,
      conversationId,
      messageId,
      targetKind: 'document',
    });
    expect(result.proposal.state).toBe('pending');
    expect(result.citations.length).toBeGreaterThan(0);
    const payload = result.proposal.payload as any;
    expect(payload.content).toBe(messageContent);
  });
});
