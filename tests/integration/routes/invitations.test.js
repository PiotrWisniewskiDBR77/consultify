import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { getDatabase, resetConnection } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  // Use unique DB per worker to avoid concurrency issues
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
});

import { initTestDb } from '../../helpers/dbHelper.cjs';

/**
 * Integration Tests for Invitation Routes
 */

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Invitation Routes', () => {
  let db;
  let testOrgId;
  let testAdminId;
  let testPlanId;

  // Setup test infrastructure
  beforeAll(async () => {
    await resetConnection();
    await initTestDb();
    db = getDatabase();

    // Force reset and re-init once for this worker
    process.env.RESET_DB = 'true';
    await initializeDatabase();
    process.env.RESET_DB = 'false';
  });

  // ISOLATION: Clean tables before each test
  beforeEach(async () => {
    // Use a fresh tenant identity per test. The old SQLite cleanup helper issues
    // unordered PRAGMA/DELETE calls and is not a valid PostgreSQL isolation seam.
    testOrgId = uuidv4();
    testAdminId = uuidv4();
    testPlanId = uuidv4();
    process.env.TEST_USER_ID = testAdminId;
    process.env.TEST_ORG_ID = testOrgId;

    // PostgreSQL's compatibility adapter does not serialize asynchronous
    // statements. Seed parents in awaited FK order and use the current schema.
    await db.run(
      `INSERT INTO subscription_plans (id, name, price_monthly, seats_included) VALUES (?, ?, ?, ?)`,
      [testPlanId, 'Test Plan', 0, 100]
    );
    await db.run(
      `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
      [testOrgId, 'Test Org', 'enterprise', 'active', 'PAID']
    );
    await db.run(
      `INSERT INTO organization_billing (id, organization_id, subscription_plan_id, status) VALUES (?, ?, ?, ?)`,
      [uuidv4(), testOrgId, testPlanId, 'active']
    );
    await db.run(
      `INSERT INTO organization_seats (id, organization_id, base_seats_included, total_seats_available, seats_used) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), testOrgId, 100, 100, 1]
    );
    await db.run(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testAdminId,
        testOrgId,
        `admin-${testAdminId}@test.com`,
        'hashed',
        'Admin',
        'User',
        'owner',
        'active',
      ]
    );
  });

  describe('POST /api/invitations/org', () => {
    it('should create an organization invitation', async () => {
      const email = `newuser-${uuidv4()}@test.com`;
      const res = await request(app).post('/api/invitations/org').send({
        email,
        role: 'USER',
      });

      if (res.statusCode !== 201) {
        console.log('DEBUG: POST /api/invitations/org failed', res.body);
      }

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.invitation.email).toBe(email);
    });

    it('should reject duplicate invitation for same email', async () => {
      const email = `dup-${uuidv4()}@test.com`;
      // First one
      const res1 = await request(app).post('/api/invitations/org').send({ email, role: 'USER' });

      if (res1.statusCode !== 201) {
        console.log('DEBUG: First invitation failed', res1.body);
      }
      expect(res1.statusCode).toBe(201);

      // Second one (duplicate)
      const res2 = await request(app).post('/api/invitations/org').send({ email, role: 'USER' });

      expect(res2.statusCode).toBe(400);
      expect(res2.body).toMatchObject({
        status: 'fail',
        error: { code: 'INVITATION_CREATE_VALIDATION_FAILED' },
      });
    });
  });

  describe('GET /api/invitations/org', () => {
    it('should list organization invitations', async () => {
      const email = `list-${uuidv4()}@test.com`;
      await request(app).post('/api/invitations/org').send({ email, role: 'USER' });

      const res = await request(app).get('/api/invitations/org');

      if (res.statusCode !== 200) {
        console.log('DEBUG: GET /api/invitations/org failed', res.body);
      }

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((inv) => inv.email === email)).toBe(true);
    });
  });

  describe('Token Operations', () => {
    it('should validate and accept invitation', async () => {
      const email = `accept-${uuidv4()}@test.com`;
      const createRes = await request(app)
        .post('/api/invitations/org')
        .send({ email, role: 'USER' });

      if (createRes.statusCode !== 201) {
        console.log('DEBUG: Token Ops create failed', createRes.body);
      }
      expect(createRes.statusCode).toBe(201);

      const token = createRes.body.invitation.token;
      expect(token).toBeDefined();

      // Validate
      const valRes = await request(app).get(`/api/invitations/validate/${token}`);
      expect(valRes.statusCode).toBe(200);
      expect(valRes.body.valid).toBe(true);

      // Accept
      const accRes = await request(app).post('/api/invitations/accept').send({
        token,
        email,
        firstName: 'Test',
        lastName: 'User',
        password: 'password123',
      });

      expect(accRes.statusCode).toBe(200);
      expect(accRes.body.success).toBe(true);
    });
  });

  describe('Management Operations', () => {
    it('should resend and revoke invitation', async () => {
      const email = `manage-${uuidv4()}@test.com`;
      const createRes = await request(app)
        .post('/api/invitations/org')
        .send({ email, role: 'USER' });

      if (createRes.statusCode !== 201) {
        console.log('DEBUG: Management Ops create failed', createRes.body);
      }
      expect(createRes.statusCode).toBe(201);

      const invId = createRes.body.invitation.id;

      // Resend
      const resendRes = await request(app).post(`/api/invitations/${invId}/resend`);
      expect(resendRes.statusCode).toBe(200);

      // Revoke
      const revokeRes = await request(app).post(`/api/invitations/${invId}/revoke`);
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.body.invitation.status).toBe('revoked');
    });
  });

  describe('Enterprise+ Security', () => {
    it('should block invitations from DEMO organizations', async () => {
      // Setup demo org
      const demoOrgId = `demo-${uuidv4()}`;
      await new Promise((resolve) => {
        db.run(
          `INSERT INTO organizations (id, name, organization_type, status) VALUES (?, ?, ?, ?)`,
          [demoOrgId, 'Demo Org', 'DEMO', 'active'],
          () => resolve()
        );
      });

      // Switch context to demo org
      process.env.TEST_ORG_ID = demoOrgId;

      const res = await request(app)
        .post('/api/invitations/org')
        .send({
          email: `demo-invite-${uuidv4()}@test.com`,
          role: 'USER',
        });

      expect(res.statusCode).toBe(400);
      // The public envelope intentionally does not disclose tenant policy
      // internals, while preserving a stable validation code.
      expect(res.body).toMatchObject({
        status: 'fail',
        error: { code: 'INVITATION_CREATE_VALIDATION_FAILED' },
      });

      // Revert context
      process.env.TEST_ORG_ID = testOrgId;
    });
  });
});
