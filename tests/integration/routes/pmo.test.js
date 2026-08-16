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
 * Level 2: Integration Tests - PMO Health
 * Tests PMO Health Snapshot endpoint
 */
const db = getDatabase();
describe('Integration Test: PMO Health Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `pmo-org-${testId}`;
  const testUserId = `pmo-user-${testId}`;
  const testProjectId = `pmo-proj-${testId}`;
  const testEmail = `pmo-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'PMO Test Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'PMOUser', 'ADMIN']
        );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
          testProjectId,
          testOrgId,
          'PMO Project',
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

  describe('GET /api/pmo/health/:projectId', () => {
    it('should return health snapshot', async () => {
      const res = await request(app)
        .get(`/api/pmo/health/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
