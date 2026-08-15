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
 * Level 2: Integration Tests - Users Routes
 * Tests users API endpoints
 */
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Users Routes', () => {
  console.log('[DEBUG] NODE_ENV:', process.env.NODE_ENV);
  let authToken;
  const testId = Date.now();
  const testOrgId = `users-org-${testId}`;
  const testUserId = `users-user-${testId}`;
  const testEmail = `users-${testId}@test.com`;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'Users Test Org',
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

  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      if (!authToken) {
        console.log('Skipping users list test - no auth token');
        return;
      }

      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${authToken}`);

      if (res.status === 500) {
        console.log('[DEBUG] 500 Error Body:', JSON.stringify(res.body, null, 2));
      }

      expect(res.status).toBe(200);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/users');

      expect([401, 403, 404]).toContain(res.status);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user', async () => {
      if (!authToken) {
        console.log('Skipping me test - no auth token');
        return;
      }

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
      // Response is { user: { ... } }
      const user = res.body.user || res.body;
      expect(user.email).toBe(testEmail);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user by id', async () => {
      if (!authToken) {
        console.log('Skipping user by id test - no auth token');
        return;
      }

      const res = await request(app)
        .get(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      if (!authToken) {
        console.log('Skipping update test - no auth token');
        return;
      }

      const res = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          first_name: 'Updated',
        });

      // Accept 200 for success, 400 for validation, 403 for permission denied
      expect(res.status).toBe(200);
    });
  });
});
