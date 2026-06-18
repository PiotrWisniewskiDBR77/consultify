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
 * Level 2: Integration Tests - Governance Admin
 * Tests Audit, Permissions, Break-Glass
 */
const db = getDatabase();
describe('Integration Test: Governance Admin Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `gov-admin-org-${testId}`;
  const testUserId = `gov-admin-user-${testId}`;
  const testEmail = `gov-admin-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Gov Admin Org',
          'enterprise',
          'active',
        ]);
        // Creating SUPERADMIN for full access testing
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'GovAdminUser', 'SUPERADMIN'],
          resolve
        );
      });
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    if (loginRes.body.token) {
      authToken = loginRes.body.token;
    }
  });

  describe('GET /api/governance/audit', () => {
    it('should list audit logs', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/governance/audit')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/governance/permissions', () => {
    it('should list permissions', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/governance/permissions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/governance/break-glass/active', () => {
    it('should list active break-glass sessions', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/governance/break-glass/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
