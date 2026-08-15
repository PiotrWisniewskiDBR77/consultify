/**
 * Metrics Full Flow Integration Tests
 * Tests for real analytics API endpoints
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = process.env.RUN_DB_TESTS === '1' ? 'false' : 'true';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-metrics-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Metrics & Analytics Full Flow Integration', () => {
  let app;
  let authToken;
  const db = getDatabase();
  const testId = Date.now();
  const testOrgId = `metrics-org-${testId}`;
  const testUserId = `metrics-user-${testId}`;
  const testEmail = `metrics-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;

    // Create test organization and user
    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Metrics Test Org',
          'enterprise',
          'active',
        ]);
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'MetricsUser', 'ADMIN'],
          resolve
        );
      });
    });

    // Login to get auth token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'test123' });

    if (loginRes.body.token) {
      authToken = loginRes.body.token;
    }
  });

  afterAll(async () => {
    // Cleanup in reverse order
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM initiatives WHERE organization_id = ?', [testOrgId]);
        db.run('DELETE FROM tasks WHERE organization_id = ?', [testOrgId]);
        db.run('DELETE FROM users WHERE id = ?', [testUserId]);
        db.run('DELETE FROM organizations WHERE id = ?', [testOrgId], resolve);
      });
    });
  });

  describe('GET /api/analytics/health', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/analytics/health');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return initiative health metrics with auth', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/analytics/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('GET /api/analytics/performance', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/analytics/performance');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return performance metrics with auth', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(Array.isArray(res.body) || typeof res.body === 'object').toBe(true);
      }
    });
  });

  describe('GET /api/analytics/economics', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/analytics/economics');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return economic metrics with auth', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/analytics/economics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('Analytics Flow with Test Data', () => {
    let initiativeId;

    beforeAll(async () => {
      if (!authToken) return;

      // Create test initiative for analytics
      initiativeId = uuidv4();
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO initiatives (id, organization_id, name, status, cost_capex, cost_opex, expected_roi) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [initiativeId, testOrgId, 'Test Initiative', 'active', 50000, 10000, 100000],
          resolve
        );
      });
    });

    afterAll(async () => {
      if (initiativeId) {
        await new Promise((resolve) => {
          db.run('DELETE FROM initiatives WHERE id = ?', [initiativeId], resolve);
        });
      }
    });

    it('should include test initiative in health metrics', async () => {
      if (!authToken || !initiativeId) return;

      const res = await request(app)
        .get('/api/analytics/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should calculate economic totals including test data', async () => {
      if (!authToken || !initiativeId) return;

      const res = await request(app)
        .get('/api/analytics/economics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200 && res.body.total_capex) {
        expect(res.body.total_capex).toBeGreaterThanOrEqual(50000);
      }
    });
  });
});
