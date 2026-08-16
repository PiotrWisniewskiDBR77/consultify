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
 * Level 2: Integration Tests - Execution
 * Tests execution tracking, blockers, and gate checks
 */
const db = getDatabase();
describe('Integration Test: Execution Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `execution-org-${testId}`;
  const testUserId = `execution-user-${testId}`;
  const testProjectId = `execution-proj-${testId}`;
  const testEmail = `execution-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Execution Test Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'ExecutionUser', 'ADMIN']
        );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
          testProjectId,
          testOrgId,
          'Execution Project',
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

  describe('GET /api/execution/:projectId/summary', () => {
    it('should return execution summary', async () => {
      const res = await request(app)
        .get(`/api/execution/${testProjectId}/summary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/execution/:projectId/blockers', () => {
    it('should return blockers', async () => {
      const res = await request(app)
        .get(`/api/execution/${testProjectId}/blockers`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/execution/:projectId/gate-check', () => {
    it('should perform gate check', async () => {
      const res = await request(app)
        .post(`/api/execution/${testProjectId}/gate-check`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetPhase: 'phase2',
        });

      expect(res.status).toBe(200);
    });
  });
});
