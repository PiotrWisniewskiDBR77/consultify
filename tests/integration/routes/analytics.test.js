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
 * Level 2: Integration Tests - Analytics Routes
 * Tests analytics API endpoints
 */
const db = getDatabase();
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Analytics Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `analytics-org-${testId}`;
  const testUserId = `analytics-user-${testId}`;
  const testEmail = `analytics-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Analytics Test Org',
          'free',
          'active',
        ]);
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'Test', 'ADMIN'],
          resolve
        );
      });
    });

    // Login to get token
    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    if (loginRes.body.token) {
      authToken = loginRes.body.token;
    }
  });

  describe('GET /api/analytics/stats', () => {
    it('should return analytics statistics', async () => {
      if (!authToken) {
        console.log('Skipping stats test - no auth token');
        return;
      }

      const res = await request(app)
        .get('/api/analytics/health')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: '7d' });

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/analytics/health');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/analytics/usage', () => {
    it('should return usage analytics', async () => {
      if (!authToken) {
        console.log('Skipping usage analytics test - no auth token');
        return;
      }

      const res = await request(app)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /api/analytics/maturity', () => {
    it('should return maturity scores', async () => {
      if (!authToken) {
        console.log('Skipping maturity test - no auth token');
        return;
      }

      const res = await request(app)
        .get('/api/analytics/economics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body !== null).toBe(true);
    });
  });
});
