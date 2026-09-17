import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

import { createHash, randomBytes } from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PREFIX = 'CHAT-IMG-P2 metadata persistence';
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const originalChatImagesFlag = process.env.ENABLE_CHAT_IMAGES;

let app: Express;
let token = '';
let conversationId = '';

function parseMetadata(value: unknown): Record<string, any> {
  return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, any>);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function cleanup(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    const conversations = await client.query(
      `SELECT id FROM conversations WHERE user_id = $1 AND title LIKE $2`,
      [SEED.USER_ID, `${PREFIX}%`]
    );
    const ids = conversations.rows.map((row) => String(row.id));
    if (ids.length > 0) {
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
  process.env.ENABLE_CHAT_IMAGES = 'true';
  await seed();
  await cleanup();
  token = mintToken();
  const router = (await import('../../server/src/routes/conversations.routes.js')).default;
  app = express();
  // Mirrors server/src/index.ts. Express' 100 KiB default would reject the
  // legitimate ~6.67 MiB JSON envelope before the production router runs.
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/conversations', router);
});

afterAll(async () => {
  await cleanup();
  if (originalChatImagesFlag === undefined) delete process.env.ENABLE_CHAT_IMAGES;
  else process.env.ENABLE_CHAT_IMAGES = originalChatImagesFlag;
});

describe('CHAT-IMG-P2 — near-boundary image metadata survives real Postgres', () => {
  it('round-trips one 5 MiB image through HTTP POST, JSONB and a fresh HTTP GET', async () => {
    const created = await request(app)
      .post('/api/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: `${PREFIX} ${Date.now()}`, language: 'en' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    conversationId = String(created.body.id);

    // High-entropy bytes avoid a misleadingly tiny TOAST-compressed fixture.
    // This test covers the persistence transport; upload-route tests cover
    // image magic bytes and Sharp decoding separately.
    const originalBytes = randomBytes(MAX_CHAT_IMAGE_BYTES);
    const dataUrl = `data:image/png;base64,${originalBytes.toString('base64')}`;
    const image = {
      name: 'near-boundary.png',
      mimeType: 'image/png',
      dataUrl,
      width: 2048,
      height: 2048,
      size: originalBytes.length,
    };
    const body = {
      role: 'user',
      content: 'Near-boundary persisted image',
      messageType: 'text',
      clientMessageId: `chat-img-p2-${Date.now()}`,
      metadata: { images: [image] },
    };
    const serializedBytes = Buffer.byteLength(JSON.stringify(body));
    expect(serializedBytes).toBeGreaterThan(6 * 1024 * 1024);
    expect(serializedBytes).toBeLessThan(10 * 1024 * 1024);

    const saved = await request(app)
      .post(`/api/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    expect(saved.status, JSON.stringify(saved.body).slice(0, 1000)).toBe(201);
    const messageId = String(saved.body.id);

    const reopened = await request(app)
      .get(`/api/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(reopened.status, JSON.stringify(reopened.body).slice(0, 1000)).toBe(200);
    const reopenedMessage = reopened.body.messages.find((row: any) => row.id === messageId);
    expect(reopenedMessage).toBeTruthy();
    const reopenedImage = parseMetadata(reopenedMessage.metadata).images[0];

    const client = pgClient();
    await client.connect();
    try {
      const persisted = await client.query(
        `SELECT metadata, octet_length(metadata::text) AS metadata_text_bytes
             FROM conversation_messages
            WHERE id = $1 AND conversation_id = $2`,
        [messageId, conversationId]
      );
      expect(persisted.rows).toHaveLength(1);
      const persistedMetadata = parseMetadata(persisted.rows[0].metadata);
      const persistedImage = persistedMetadata.images[0];
      const expectedHash = sha256(dataUrl);

      expect(Number(persisted.rows[0].metadata_text_bytes)).toBeGreaterThan(6 * 1024 * 1024);
      expect(sha256(persistedImage.dataUrl)).toBe(expectedHash);
      expect(sha256(reopenedImage.dataUrl)).toBe(expectedHash);
      expect(Buffer.from(persistedImage.dataUrl.split(',')[1], 'base64')).toHaveLength(
        MAX_CHAT_IMAGE_BYTES
      );
      expect(Buffer.from(reopenedImage.dataUrl.split(',')[1], 'base64')).toHaveLength(
        MAX_CHAT_IMAGE_BYTES
      );
      expect(persistedMetadata.images).toHaveLength(1);
    } finally {
      await client.end();
    }
  }, 60_000);
});
