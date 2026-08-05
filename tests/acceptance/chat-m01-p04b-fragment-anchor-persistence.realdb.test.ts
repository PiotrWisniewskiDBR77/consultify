import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * M01-P04B — fragment anchor + source-access-status persist through a fresh
 * conversation reopen. Extends the CHAT-03 provenance acceptance pattern
 * (`chat-003-citation-provenance-readback.realdb.test.ts`) with the two new
 * fields this packet adds to a citation: `fragmentIndex` (GF-CHAT-02) and
 * `status` (GF-CHAT-08). Packet §3.5 requires this as a maintained regression
 * — "panel źródeł przeżywa fresh reopen" was already PASS before this packet;
 * this test proves the NEW fields ride along without a schema/serialization
 * change (they are plain properties on the same persisted `citations` array).
 */
const PREFIX = 'M01-P04B fragment-anchor acceptance';

let app: Express;
let token: string;
let conversationId = '';
let messageId = '';

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const conversations = await client.query(
      `SELECT id FROM conversations WHERE user_id = $1 AND title LIKE $2`,
      [SEED.USER_ID, `${PREFIX}%`]
    );
    const ids = conversations.rows.map((row) => String(row.id));
    if (ids.length) {
      await client.query(
        `DELETE FROM conversation_message_attachments WHERE conversation_id = ANY($1::text[])`,
        [ids]
      );
      await client.query(`DELETE FROM conversation_messages WHERE conversation_id = ANY($1::text[])`, [
        ids,
      ]);
      await client.query(`DELETE FROM conversation_sessions WHERE conversation_id = ANY($1::text[])`, [
        ids,
      ]);
      await client.query(`DELETE FROM conversations WHERE id = ANY($1::text[])`, [ids]);
    }
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  await seed();
  await cleanup();
  token = mintToken();
  const router = (await import('../../server/src/routes/conversations.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/conversations', router);
});

afterAll(cleanup);

describe('M01-P04B — fragment anchor + source status survive fresh reopen', () => {
  it('ASSERTS (not assumes) that knowledge_chunks.chunk_index — the real fragment-anchor source column — exists on this DB', async () => {
    // Per the lane's shared finding (schema drift confirmed twice this
    // round): never assume a column exists just because code references it.
    // `ragService.ts`'s bm25Search/_vectorSearch/searchRelevantChunks
    // fragment-anchor plumbing is guarded by `ensureKnowledgeChunksColumns()`
    // precisely BECAUSE this can drift — this test proves the guard has
    // something real to find on THIS database, not just that the guard
    // fails closed gracefully when it doesn't.
    const client = pgClient();
    await client.connect();
    try {
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_chunks'`
      );
      const names = cols.rows.map((r) => String(r.column_name));
      expect(names).toContain('chunk_index');
      expect(names).toContain('content');
      expect(names).toContain('doc_id');
    } finally {
      await client.end();
    }
  });

  it('persists fragmentIndex and status on citations through a fresh conversation read', async () => {
    const created = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${PREFIX} ${Date.now()}`, language: 'en' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    conversationId = String(created.body.id);

    // Distinct fragmentIndex per citation (0 and 3 — never both 0) plus one
    // `ready` and one `failed` (ACL-safe: no title/excerpt on the failed one,
    // mirroring what `citationAccessStatus.buildCitationStatusPayload` and
    // `CitationList#getSafeCitationView` enforce at the producing/consuming
    // ends respectively).
    const citations = [
      {
        id: 'doc-1#chunk-0',
        type: 'document',
        title: 'Operating model',
        reference: 'doc-1',
        excerpt: 'Five workstreams are governed by one supervisor.',
        fragmentIndex: 0,
        status: 'ready',
      },
      {
        id: 'doc-2#chunk-3',
        type: 'document',
        title: 'Governance appendix',
        reference: 'doc-2',
        excerpt: 'Appendix C covers escalation paths.',
        fragmentIndex: 3,
        status: 'ready',
      },
      {
        id: 'doc-3#chunk-1',
        type: 'document',
        title: '', // producing side never sends a title for a failed source
        reference: '',
        fragmentIndex: 1,
        status: 'failed',
      },
    ];

    const saved = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ai',
        content: 'The operating model uses five workstreams [1], see also [2].',
        messageType: 'text',
        clientMessageId: 'chat-m01-p04b-ai-answer',
        metadata: { citations },
      });
    expect(saved.status, JSON.stringify(saved.body)).toBe(201);
    messageId = String(saved.body.id);

    const reopened = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(200);
    const message = reopened.body.messages.find((row: any) => row.id === messageId);
    const metadata =
      typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;

    expect(metadata.citations).toHaveLength(3);
    const byId = Object.fromEntries(metadata.citations.map((c: any) => [c.id, c]));
    expect(byId['doc-1#chunk-0'].fragmentIndex).toBe(0);
    expect(byId['doc-2#chunk-3'].fragmentIndex).toBe(3);
    expect(byId['doc-3#chunk-1'].fragmentIndex).toBe(1);
    // Distinct fragments, never collapsed to a single value.
    const fragmentIndexes = metadata.citations.map((c: any) => c.fragmentIndex);
    expect(new Set(fragmentIndexes).size).toBe(3);
    expect(byId['doc-1#chunk-0'].status).toBe('ready');
    expect(byId['doc-3#chunk-1'].status).toBe('failed');
    // The failed citation's title/excerpt were never sent — reopen must not
    // resurrect them from anywhere else either.
    expect(byId['doc-3#chunk-1'].title).toBe('');

    // Byte-level DB check (mirrors CHAT-03's pattern) — not just the HTTP
    // response shape, the actual persisted row.
    const client = pgClient();
    await client.connect();
    try {
      const persisted = await client.query(
        `SELECT metadata FROM conversation_messages WHERE id = $1 AND conversation_id = $2`,
        [messageId, conversationId]
      );
      const sqlMetadata =
        typeof persisted.rows[0].metadata === 'string'
          ? JSON.parse(persisted.rows[0].metadata)
          : persisted.rows[0].metadata;
      const sqlById = Object.fromEntries(sqlMetadata.citations.map((c: any) => [c.id, c]));
      expect(sqlById['doc-2#chunk-3'].fragmentIndex).toBe(3);
      expect(sqlById['doc-3#chunk-1'].status).toBe('failed');
    } finally {
      await client.end();
    }
  });
});
