/**
 * AI Routes Integration Tests - Real HTTP Implementation
 * @module tests/integration/routes/ai.test.js
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
  process.env.SQLITE_PATH = `./test-ai-routes-${workerId}.db`;
});

describe('AI Routes Integration Tests', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testProjectId;
  let testToken;
  const testEmail = `ai-routes-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    if (db.initPromise) await db.initPromise;

    // Create organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'AI Test Org', 'professional', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create project
    testProjectId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO projects (id, organization_id, name, owner_id, status) VALUES (?, ?, ?, ?, ?)`,
        [testProjectId, testOrgId, 'AI Test Project', testUserId, 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'TestPass123!' });
    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    await new Promise((r) =>
      db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], () => r())
    );
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('GET /api/ai/context', () => {
    it('should return AI context for authenticated user', async () => {
      const res = await request(app)
        .get('/api/ai/context')
        .set('Authorization', `Bearer ${testToken}`);

      // Accept various valid status codes
      expect(res.status).toBe(200);
      if (res.status === 200 && res.body) {
        expect(res.body.platform || res.body.context).toBeDefined();
      }
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/ai/context');

      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/ai/context/:projectId', () => {
    it('should build AI context for specific project', async () => {
      const res = await request(app)
        .get(`/api/ai/context/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });

    it('should handle non-existent project', async () => {
      const res = await request(app)
        .get('/api/ai/context/non-existent-project-id')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).not.toContain(testOrgId);
    });
  });

  describe('POST /api/ai/chat', () => {
    it('should handle chat request', async () => {
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          message: 'Hello AI',
          projectId: testProjectId,
        });

      // Accept various status codes
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/ai/policy', () => {
    it('should return AI policy configuration', async () => {
      const res = await request(app)
        .get('/api/ai/policy')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/ai/memory/project/:projectId', () => {
    it('should retrieve project memory', async () => {
      const res = await request(app)
        .get(`/api/ai/memory/project/${testProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project IDs gracefully', async () => {
      const res = await request(app)
        .get('/api/ai/context/invalid-id-!@#$%')
        .set('Authorization', `Bearer ${testToken}`);

      // Should return error status, not crash
      expect(res.status).toBe(400);
    });

    it('should reject requests without token', async () => {
      const res = await request(app).post('/api/ai/chat').send({ message: 'Test' });

      expect([401, 403, 404]).toContain(res.status);
    });
  });
});
