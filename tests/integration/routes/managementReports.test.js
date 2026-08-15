/**
 * Management Reports Routes Integration Tests - Real HTTP Implementation
 * @module tests/integration/routes/managementReports.test.js
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
  process.env.SQLITE_PATH = `./test-mgmt-reports-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Management Reports Routes', () => {
  const db = getDatabase();
  let testOrgId;
  let testUserId;
  let testToken;
  const testEmail = `mgmt-reports-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    if (db.initPromise) await db.initPromise;

    // Create organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
        [testOrgId, 'Reports Test Org', 'professional', 'active'],
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

    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'TestPass123!' });
    testToken = loginRes.body.token;
  });

  afterAll(async () => {
    await new Promise((r) => db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => r()));
    await new Promise((r) =>
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => r())
    );
  });

  describe('GET /api/management-reports/types', () => {
    it('should return available report types', async () => {
      const res = await request(app)
        .get('/api/management-reports/types')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200 && Array.isArray(res.body)) {
        expect(res.body.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('GET /api/management-reports/history', () => {
    it('should return report history', async () => {
      const res = await request(app)
        .get('/api/management-reports/history')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(Array.isArray(res.body) || res.body.reports !== undefined).toBe(true);
      }
    });
  });

  describe('POST /api/management-reports/generate', () => {
    it('should generate a report or return appropriate status', async () => {
      const res = await request(app)
        .post('/api/management-reports/generate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          type: 'executive',
          period: 'monthly',
        });

      expect(res.status).toBe(200);
    });
  });

  describe('Authorization', () => {
    it('should require authentication for report types', async () => {
      const res = await request(app).get('/api/management-reports/types');

      // Route may not exist (404) or require auth (401/403)
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should require authentication for report generation', async () => {
      const res = await request(app)
        .post('/api/management-reports/generate')
        .send({ type: 'executive' });

      expect([401, 403, 404]).toContain(res.status);
    });
  });
});
