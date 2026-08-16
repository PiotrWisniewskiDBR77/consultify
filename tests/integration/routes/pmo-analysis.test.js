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
 * Level 2: Integration Tests - PMO Analysis
 * Tests AI analysis, dependencies, and portfolio checks
 */
const db = getDatabase();
describe('Integration Test: PMO Analysis Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `pmo-an-org-${testId}`;
  const testUserId = `pmo-an-user-${testId}`;
  const testProjectId = `pmo-an-proj-${testId}`;
  const testEmail = `pmo-an-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
      testOrgId,
      'PMO Analysis Org',
      'enterprise',
      'active',
    ]);
    await db.run(
      'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, testOrgId, testEmail, hash, 'PMOAnalysisUser', 'ADMIN']
    );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
      testProjectId,
      testOrgId,
      'PMO Analysis Project',
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

  describe('GET /api/pmo-analysis/:projectId', () => {
    it('should return project analysis', async () => {
      const res = await request(app)
        .get(`/api/pmo-analysis/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/pmo-analysis/:projectId/progress', () => {
    it('should return project progress', async () => {
      const res = await request(app)
        .get(`/api/pmo-analysis/${testProjectId}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/pmo-analysis/:projectId/dependencies', () => {
    it('should return dependency graph', async () => {
      const res = await request(app)
        .get(`/api/pmo-analysis/${testProjectId}/dependencies`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
