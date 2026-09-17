/**
 * CHAT-IMG P2 — near-boundary image metadata survives the real conversation
 * POST -> PostgreSQL JSONB -> GET path without truncation.
 *
 * This is deliberately a transport/persistence test. The dedicated
 * `/api/ai/chat/images` family already proves that uploaded bytes are a valid,
 * supported image. Here the base64 body is opaque so the fixture can exercise
 * the exact 5 MiB decoded boundary without image generation or provider calls.
 *
 * Run only against an isolated, disposable PostgreSQL database with the full
 * migration set applied. The test owns and removes every row it creates.
 */

import { createHash, randomBytes } from 'node:crypto';

import express from 'express';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import conversationsRoutes from '../../../server/src/routes/conversations.routes.js';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const PROBE_TIMEOUT_MS = 2_000;
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;
const JSON_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
const REQUIRED_TABLES = [
  'conversations',
  'conversation_messages',
  'organizations',
  'users',
] as const;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 15_000,
    };
  }

  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 15_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((row) => row.table_name));
  return names.every((name) => found.has(name));
}

function base64UrlEncode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'CHAT-IMG RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function buildApp() {
  const app = express();
  // Match the production parser in server/src/index.ts. Express defaults to
  // 100 KiB, which would make this test exercise the wrong boundary.
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/conversations', conversationsRoutes);
  return app;
}

interface Harness {
  client: Client;
  orgId: string;
  userId: string;
  conversationId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => undefined);
      return null;
    }
  } catch {
    await client.end().catch(() => undefined);
    return null;
  }

  const tag = suffix();
  const orgId = `org_chat_img_${tag}`;
  const userId = `user_chat_img_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status)
     VALUES ($1, 'CHAT-IMG RealDB Org', 'enterprise', 'active')`,
    [orgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'ChatImage', 'Test')`,
    [userId, orgId, `${userId}@local.test`]
  );
  const conversation = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, orgId, `CHAT-IMG persistence ${tag}`]
  );
  const conversationId = conversation.rows[0].id;

  const cleanup = async () => {
    try {
      await client.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [
        conversationId,
      ]);
      await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    } finally {
      await client.end().catch(() => undefined);
    }
  };

  return { client, orgId, userId, conversationId, cleanup };
}

describe('CHAT-IMG P2 — conversation image metadata RealPG roundtrip', () => {
  let harness: Harness | null = null;

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) {
      throw new Error(
        'REALPG_REQUIRED: isolated PostgreSQL is unavailable or its schema is incomplete'
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (harness) await harness.cleanup();
    harness = null;
  });

  it('persists and reads back a 5 MiB decoded image data URL without truncation', async () => {
    if (!harness) {
      throw new Error('REALPG_REQUIRED: test harness was not initialized');
    }

    const dataUrl = `data:image/png;base64,${randomBytes(MAX_CHAT_IMAGE_BYTES).toString('base64')}`;
    const metadata = {
      images: [
        {
          name: 'near-boundary.png',
          mimeType: 'image/png',
          dataUrl,
          width: 2048,
          height: 2048,
          size: MAX_CHAT_IMAGE_BYTES,
        },
      ],
    };
    const payload = {
      role: 'user' as const,
      content: 'Near-boundary governed chat image',
      messageType: 'text' as const,
      metadata,
      clientMessageId: `chat-img-${suffix()}`,
    };
    const serializedRequestBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    expect(serializedRequestBytes).toBeGreaterThan(6.5 * 1024 * 1024);
    expect(serializedRequestBytes).toBeLessThan(JSON_BODY_LIMIT_BYTES);

    const app = buildApp();
    const token = makeE2EToken(harness.userId, harness.orgId);
    const expectedDigest = sha256(dataUrl);

    const created = await request(app)
      .post(`/api/conversations/${harness.conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.metadata.images).toHaveLength(1);
    expect(created.body.metadata.images[0]).toMatchObject({
      name: 'near-boundary.png',
      mimeType: 'image/png',
      width: 2048,
      height: 2048,
      size: MAX_CHAT_IMAGE_BYTES,
    });
    expect(sha256(created.body.metadata.images[0].dataUrl)).toBe(expectedDigest);

    const stored = await harness.client.query<{
      images_type: string;
      data_url: string;
      declared_size: string;
      mime_type: string;
      metadata_bytes: number;
    }>(
      `SELECT jsonb_typeof(metadata->'images') AS images_type,
                metadata->'images'->0->>'dataUrl' AS data_url,
                metadata->'images'->0->>'size' AS declared_size,
                metadata->'images'->0->>'mimeType' AS mime_type,
                octet_length(metadata::text) AS metadata_bytes
           FROM conversation_messages
          WHERE id = $1 AND conversation_id = $2`,
      [created.body.id, harness.conversationId]
    );

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].images_type).toBe('array');
    expect(stored.rows[0].mime_type).toBe('image/png');
    expect(Number(stored.rows[0].declared_size)).toBe(MAX_CHAT_IMAGE_BYTES);
    expect(Number(stored.rows[0].metadata_bytes)).toBeGreaterThan(6.5 * 1024 * 1024);
    expect(sha256(stored.rows[0].data_url)).toBe(expectedDigest);

    const reopened = await request(app)
      .get(`/api/conversations/${harness.conversationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(reopened.status).toBe(200);
    const reopenedMessage = reopened.body.messages.find(
      (message: { id?: string }) => message.id === created.body.id
    );
    expect(reopenedMessage).toBeTruthy();
    expect(reopenedMessage.metadata.images[0]).toMatchObject({
      name: 'near-boundary.png',
      mimeType: 'image/png',
      width: 2048,
      height: 2048,
      size: MAX_CHAT_IMAGE_BYTES,
    });
    expect(sha256(reopenedMessage.metadata.images[0].dataUrl)).toBe(expectedDigest);
  }, 60_000);
});
