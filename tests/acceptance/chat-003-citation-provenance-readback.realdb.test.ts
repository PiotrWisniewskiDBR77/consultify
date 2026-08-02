import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'CHAT-03 provenance acceptance';

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
      await client.query(
        `DELETE FROM conversation_messages WHERE conversation_id = ANY($1::text[])`,
        [ids]
      );
      await client.query(
        `DELETE FROM conversation_sessions WHERE conversation_id = ANY($1::text[])`,
        [ids]
      );
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

describe('CHAT-03 — durable citation provenance', () => {
  it('persists citations and the governed source ledger through a fresh conversation read', async () => {
    const created = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${PREFIX} ${Date.now()}`, language: 'en' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    conversationId = String(created.body.id);

    const citations = [
      {
        id: 'doc-1#chunk-4',
        type: 'document',
        title: 'Operating model',
        reference: 'doc-1',
        excerpt: 'Five workstreams are governed by one supervisor.',
      },
    ];
    const sourceLedger = {
      type: 'source_ledger',
      decisionId: 'policy-decision-1',
      used_sources: [
        { id: 'doc-1', type: 'document', title: 'Operating model', reference: 'doc-1' },
      ],
      blocked_sources: [{ category: 'cross_tenant', reason: 'forbidden_by_policy' }],
      degraded: null,
      scope_resolution: { privateMode: false, knowledgeSources: { pmoDocuments: true } },
    };

    const saved = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ai',
        content: 'The operating model uses five workstreams [1].',
        messageType: 'text',
        clientMessageId: 'chat-003-ai-answer',
        metadata: { citations, sourceLedger },
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
    expect(metadata.citations).toEqual(citations);
    expect(metadata.sourceLedger).toEqual(sourceLedger);

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
      expect(sqlMetadata.citations[0].id).toBe('doc-1#chunk-4');
      expect(sqlMetadata.sourceLedger.used_sources[0].id).toBe('doc-1');
      expect(sqlMetadata.sourceLedger.blocked_sources[0]).toEqual({
        category: 'cross_tenant',
        reason: 'forbidden_by_policy',
      });
    } finally {
      await client.end();
    }
  });
});
