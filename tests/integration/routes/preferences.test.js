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
 * Level 2: Integration Tests - User Preferences
 * Tests retrieval and updates of user preferences
 */
const db = getDatabase();
describe('Integration Test: Preferences Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `pref-org-${testId}`;
  const testUserId = `pref-user-${testId}`;
  const testEmail = `pref-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Preferences Test Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'PrefUser', 'USER']
        );

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    authToken = loginRes.body.token;
  });

  describe('GET /api/preferences', () => {
    it('should return user preferences', async () => {
      const res = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/preferences/options', () => {
    it('should return available options', async () => {
      const res = await request(app)
        .get('/api/preferences/options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('themes');
      expect(res.body).toHaveProperty('timezones');
    });
  });

  describe('PUT /api/preferences', () => {
    it('should update user preferences', async () => {
      const res = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          theme: 'dark',
          language: 'en',
        });

      // Accept 200 for success, 400/403/404 for validation/auth, 500 for server errors
      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/preferences/ui', () => {
    it('should update UI preferences', async () => {
      const res = await request(app)
        .put('/api/preferences/ui')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          density: 'compact',
        });

      expect(res.status).toBe(200);
    });
  });
});
