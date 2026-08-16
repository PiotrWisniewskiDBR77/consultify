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
 * Level 2: Integration Tests - Governance (Standard)
 * Tests Change Requests and Policies
 */
const db = getDatabase();
describe('Integration Test: Governance Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `gov-org-${testId}`;
  const testUserId = `gov-user-${testId}`;
  const testProjectId = `gov-proj-${testId}`;
  const testEmail = `gov-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Governance Test Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'GovernanceUser', 'ADMIN']
        );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
          testProjectId,
          testOrgId,
          'Governance Project',
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

  describe('GET /api/governance/change-requests', () => {
    it('should list change requests', async () => {
      const res = await request(app)
        .get(`/api/governance/change-requests?projectId=${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/governance/change-requests', () => {
    it('should create change request', async () => {
      const res = await request(app)
        .post('/api/governance/change-requests')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          title: 'Test Change',
          description: 'Testing CR creation',
          impact: 'LOW',
        });

      // 403 or 500 depending on mock permissions but 201 is ideal
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('GET /api/governance/policies', () => {
    it('should list policies', async () => {
      const res = await request(app)
        .get('/api/governance/policies')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
