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
 * Level 2: Integration Tests - Premium Reports
 * Tests premium report features (PDF extraction)
 */
const db = getDatabase();
describe('Integration Test: Premium Reports Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `premium-rep-org-${testId}`;
  const testUserId = `premium-rep-user-${testId}`;
  const testEmail = `premium-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Premium Reports Test Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'PremUser', 'ADMIN']
        );

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    authToken = loginRes.body.token;
  });

  describe('POST /api/reports/premium/:reportId/pdf', () => {
    it('should handle PDF export request for non-existent report gracefully', async () => {
      // Using a fake ID, expecting 500 (internal error/not found handled via error block) or 404
      const res = await request(app)
        .post('/api/reports/premium/fake-report-id/pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      // Endpoints often return 500 when PDF gen fails or ID not found if not excessively guarded
      expect(res.status).toBe(404);
    });
  });
});
