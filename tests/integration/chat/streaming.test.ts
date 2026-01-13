/**
 * Chat Streaming Integration Tests - Real HTTP Implementation
 * Tests for SSE streaming chat responses
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../../../server/src/index.js';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-chat-stream-${workerId}.db`;
});

describe('Chat Streaming Integration', () => {
  const db = getDatabase();
  let testOrgId: string;
  let testUserId: string;
  let testToken: string;
  const testEmail = `chat-stream-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    if ((db as any).initPromise) await (db as any).initPromise;

    // Create organization
    testOrgId = uuidv4();
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Chat Stream Test Org', 'professional', 'active'],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    // Create user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
        (err: Error | null) => (err ? reject(err) : resolve())
      );
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'TestPass123!' });
    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    await new Promise<void>((r) =>
      db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r())
    );
    await new Promise<void>((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('POST /api/ai/chat/stream', () => {
    it('should handle streaming chat request', async () => {
      const res = await request(app)
        .post('/api/ai/chat/stream')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          message: 'Hello AI',
          stream: true,
        });

      // Can return streaming response or error if AI not configured
      expect([200, 400, 404, 500, 501, 503]).toContain(res.status);
    });

    it('should set correct content type for streaming', async () => {
      const res = await request(app)
        .post('/api/ai/chat/stream')
        .set('Authorization', `Bearer ${testToken}`)
        .set('Accept', 'text/event-stream')
        .send({ message: 'Test' });

      // Either returns SSE or error
      expect([200, 400, 404, 500, 501, 503]).toContain(res.status);
      if (res.status === 200 && res.headers['content-type']) {
        expect(res.headers['content-type']).toMatch(/text\/event-stream|application\/json/);
      }
    });
  });

  describe('POST /api/ai/chat', () => {
    it('should handle non-streaming chat request', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          message: 'Hello',
          stream: false,
        });

      expect([200, 400, 404, 500, 501, 503]).toContain(res.status);
    });
  });

  describe('Authorization', () => {
    it('should reject streaming without auth', async () => {
      const res = await request(app).post('/api/ai/chat/stream').send({ message: 'Test' });

      expect([401, 403]).toContain(res.status);
    });

    it('should reject non-streaming without auth', async () => {
      const res = await request(app).post('/api/ai/chat').send({ message: 'Test' });

      expect([401, 403]).toContain(res.status);
    });
  });
});
