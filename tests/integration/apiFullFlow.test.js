/**
 * API Full Flow Integration Tests - Real Implementation
 *
 * Tests complete user journeys through the API:
 * 1. User Registration Flow
 * 2. Project Creation Flow
 * 3. Assessment Flow
 * 4. Report Generation Flow
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

describe('API Full Flow Integration', () => {
  let testUserId;
  let testOrgId;
  let testToken;
  let testProjectId;
  const db = getDatabase();
  const testEmail = `fullflow-${Date.now()}@test.com`;
  const testPassword = 'TestPass123!';

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
        [testOrgId, 'FullFlow Test Org', 'professional', 'active', 'PAID'],
        (err) => (err ? reject(err) : resolve())
      );
    });
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (testProjectId) {
      await new Promise((resolve) => {
        db.run(`DELETE FROM projects WHERE id = ?`, [testProjectId], () => resolve());
      });
    }
    if (testUserId) {
      await new Promise((resolve) => {
        db.run(`DELETE FROM users WHERE id = ?`, [testUserId], () => resolve());
      });
    }
    await new Promise((resolve) => {
      db.run(`DELETE FROM organizations WHERE id = ?`, [testOrgId], () => resolve());
    });
  });

  describe('User Registration Flow', () => {
    it('should complete user registration flow', async () => {
      // Step 1: Register new user
      const registerRes = await request(app).post('/api/auth/register').send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
        organizationId: testOrgId,
      });

      // Accept 200/201 for success, 400/409 for validation errors, 404/500/501 for missing endpoints
      expect(registerRes.status).toBe(200);

      if (registerRes.status === 200 || registerRes.status === 201) {
        testUserId = registerRes.body.user?.id;
      }

      // Step 2: Login with registered credentials
      const loginRes = await request(app).post('/api/auth/login').send({
        email: testEmail,
        password: testPassword,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
      testToken = loginRes.body.token;
    });
  });

  describe('Project Creation Flow', () => {
    it('should complete project creation flow', async () => {
      // Skip if no token from previous test
      if (!testToken) {
        // Create a test user directly for this test
        testUserId = uuidv4();
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO users (id, organization_id, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              testUserId,
              testOrgId,
              `projtest-${Date.now()}@test.com`,
              hashedPassword,
              'ADMIN',
              'active',
            ],
            (err) => (err ? reject(err) : resolve())
          );
        });

        const loginRes = await request(app)
          .post('/api/auth/login')
          .send({ email: `projtest-${Date.now()}@test.com`, password: testPassword });

        if (loginRes.body.token) {
          testToken = loginRes.body.token;
        }
      }

      if (!testToken) return; // Skip if still no token

      // Create project
      const createRes = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          name: 'Integration Test Project',
          description: 'Created by full flow test',
          status: 'active',
        });

      expect(createRes.status).toBe(201);

      if (createRes.status === 200 || createRes.status === 201) {
        testProjectId = createRes.body.project?.id || createRes.body.id;
        expect(testProjectId).toBeDefined();
      }
    });
  });

  describe('Assessment Flow', () => {
    it('should complete assessment flow', async () => {
      if (!testToken || !testProjectId) return; // Skip if prerequisites not met

      // Get assessment overview
      const overviewRes = await request(app)
        .get(`/api/sessions/${testProjectId}/assessment-overview`)
        .set('Authorization', `Bearer ${testToken}`);

      // Accept various status codes as endpoints may vary
      expect(overviewRes.status).toBe(200);

      if (overviewRes.status === 200) {
        expect(overviewRes.body).toBeDefined();
      }
    });
  });

  describe('Report Generation Flow', () => {
    it('should complete report generation flow', async () => {
      if (!testToken || !testProjectId) return; // Skip if prerequisites not met

      // Get available reports
      const reportsRes = await request(app)
        .get(`/api/projects/${testProjectId}/reports`)
        .set('Authorization', `Bearer ${testToken}`);

      // Accept various status codes
      // The retired project-nested reports route must remain fail-closed.
      expect(reportsRes.status).toBe(404);
      expect(reportsRes.body).not.toHaveProperty('reports');

      if (reportsRes.status === 200) {
        expect(Array.isArray(reportsRes.body) || reportsRes.body.reports).toBeTruthy();
      }
    });
  });
});
