import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// @vitest-environment node

/**
 * Level 2: Integration Tests - Capacity
 * Tests capacity calculation and overload detection
 */
const db = getDatabase();
describe('Integration Test: Capacity Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `capacity-org-${testId}`;
  const testUserId = `capacity-user-${testId}`;
  const testProjectId = `capacity-proj-${testId}`;
  const testEmail = `capacity-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
      testOrgId,
      'Capacity Test Org',
      'enterprise',
      'active',
    ]);
    await db.run(
      'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, testOrgId, testEmail, hash, 'CapacityUser', 'ADMIN']
    );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
      testProjectId,
      testOrgId,
      'Capacity Project',
      'active',
    ]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await db.run('DELETE FROM projects WHERE id = ?', [testProjectId]);
    await db.run('DELETE FROM users WHERE id = ?', [testUserId]);
    await db.run('DELETE FROM organizations WHERE id = ?', [testOrgId]);
  });

  describe('GET /api/capacity/user/:userId', () => {
    it('should calculate user capacity', async () => {
      const res = await request(app)
        .get(`/api/capacity/user/${testUserId}?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/capacity/project/:projectId/overloads', () => {
    it('should detect overloads', async () => {
      const res = await request(app)
        .get(`/api/capacity/project/${testProjectId}/overloads`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/capacity/project/:projectId/summary', () => {
    it('should return capacity summary', async () => {
      const res = await request(app)
        .get(`/api/capacity/project/${testProjectId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
