/**
 * Roadmap Routes Integration Tests - Real HTTP Implementation
 * Tests roadmap waves, baselines, and initiative assignment
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
  process.env.SQLITE_PATH = `./test-roadmap-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Roadmap Routes', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testProjectId;
  let testToken;
  const testEmail = `roadmap-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    if (db.initPromise) await db.initPromise;

    // Create organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Roadmap Test Org', 'professional', 'active'],
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
        [testProjectId, testOrgId, 'Roadmap Test Project', testUserId, 'active'],
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

  describe('GET /api/roadmap/:projectId/waves', () => {
    it('should return project waves', async () => {
      const res = await request(app)
        .get(`/api/roadmap/${testProjectId}/waves`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(Array.isArray(res.body) || res.body.waves !== undefined).toBe(true);
      }
    });
  });

  describe('POST /api/roadmap/:projectId/waves', () => {
    it('should create a new wave or return appropriate status', async () => {
      const res = await request(app)
        .post(`/api/roadmap/${testProjectId}/waves`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Test Wave',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
        });

      expect([200, 201]).toContain(res.status);
    });
  });

  describe('GET /api/roadmap/:projectId/summary', () => {
    it('should return roadmap summary', async () => {
      const res = await request(app)
        .get(`/api/roadmap/${testProjectId}/summary`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/roadmap/:projectId/baseline', () => {
    it.skip('should update roadmap baseline (endpoint not implemented by current roadmap owner)', async () => {
      const res = await request(app)
        .put(`/api/roadmap/${testProjectId}/baseline`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          version: 1,
          description: 'Initial baseline',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Authorization', () => {
    it('should require authentication or return data for waves', async () => {
      const res = await request(app).get(`/api/roadmap/${testProjectId}/waves`);

      // Some routes may be public, some require auth
      expect(res.status).toBe(401);
    });

    it('should require authentication or return data for summary', async () => {
      const res = await request(app).get(`/api/roadmap/${testProjectId}/summary`);

      expect(res.status).toBe(401);
    });
  });
});
