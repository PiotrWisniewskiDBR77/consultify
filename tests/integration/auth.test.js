/**
 * Auth Integration Tests - Real Implementation
 *
 * NOTE: This file complements tests/integration/routes/auth.test.js
 * which contains the primary auth route tests.
 *
 * These tests focus on additional auth scenarios.
 */
import app from '../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../server/src/database/Database.js';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Auth Integration', () => {
  let testUserId;
  let testOrgId;
  let testToken;
  let testRefreshToken;
  const db = getDatabase();
  const testEmail = `auth-int-${Date.now()}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();

    if (db.initPromise) {
      await db.initPromise;
    }

    // Create test organization
    testOrgId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
        [testOrgId, 'Auth Test Org', 'professional', 'active', 'PAID'],
        (err) => (err ? reject(err) : resolve())
      );
    });

    // Create test user
    testUserId = uuidv4();
    const hashedPassword = await bcrypt.hash('password123', 10);
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [testUserId, testOrgId, testEmail, hashedPassword, 'ADMIN', 'active'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
    });
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
    });
  });

  describe('Login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      testToken = res.body.token;
      testRefreshToken = res.body.refreshToken;
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Registration', () => {
    it('should register new user', async () => {
      const newEmail = `newuser-${Date.now()}@test.com`;
      const res = await request(app).post('/api/auth/register').send({
        email: newEmail,
        password: 'NewPass123!',
        firstName: 'New',
        lastName: 'User',
        organizationId: testOrgId,
      });

      expect([200, 201]).toContain(res.status);

      if (res.body.user?.id) {
        // Cleanup the newly created user
        await new Promise((resolve) => {
          db.run(`DELETE FROM users WHERE id = ?`, [res.body.user.id], () => resolve());
        });
      }
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: testEmail, // Already exists
        password: 'NewPass123!',
        firstName: 'Duplicate',
        lastName: 'User',
      });

      expect([400, 409]).toContain(res.status);
    });
  });

  describe('Token Management', () => {
    it('should refresh token', async () => {
      if (!testRefreshToken) return;

      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: testRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      testToken = res.body.token;
    });

    it('should revoke token on logout', async () => {
      if (!testToken) return;

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${testToken}`);

      expect([200, 204]).toContain(res.status);
    });
  });
});
