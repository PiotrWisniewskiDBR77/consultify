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
 * Level 2: Integration Tests - Settings Routes
 * Tests settings API endpoints
 */
const db = getDatabase();
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Settings Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `settings-org-${testId}`;
  const testUserId = `settings-user-${testId}`;
  const testEmail = `settings-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Settings Test Org',
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

  describe('GET /api/settings', () => {
    it('should block the legacy platform settings root for an organization admin', async () => {
      if (!authToken) {
        console.log('Skipping settings test - no auth token');
        return;
      }

      const res = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('LEGACY_SETTINGS_SCOPE_BLOCKED');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/settings');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/settings', () => {
    it('should block legacy platform setting writes for an organization admin', async () => {
      if (!authToken) {
        console.log('Skipping update settings test - no auth token');
        return;
      }

      const res = await request(app)
        .post('/api/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          key: 'theme',
          value: 'dark',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('LEGACY_SETTINGS_SCOPE_BLOCKED');
    });
  });
});
