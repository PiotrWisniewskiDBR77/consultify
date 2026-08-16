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
 * Level 2: Integration Tests - Reports Routes
 * Tests standard report overview endpoints (executive, org)
 */
const db = getDatabase();
describe('Integration Test: Reports Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `reports-org-${testId}`;
  const testUserId = `reports-user-${testId}`;
  const testEmail = `reports-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Reports Test Org',
          'pro',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'ReportUser', 'USER']
        );

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    authToken = loginRes.body.token;
  });

  describe('GET /api/reports/executive-overview', () => {
    it('should return executive overview', async () => {
      const res = await request(app)
        .get('/api/reports/executive-overview')
        .set('Authorization', `Bearer ${authToken}`);

      // 200 if successful, 500 if dependent services (like DB complexity queries) fail but are handled.
      // Since we mocked basic DB, it should ideally be 200, but 500 is also acceptable if logic is complex.
      // However, verify status is valid HTTP.
      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('GET /api/reports/org-overview', () => {
    it('should return organization overview', async () => {
      const res = await request(app)
        .get('/api/reports/org-overview')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });
});
