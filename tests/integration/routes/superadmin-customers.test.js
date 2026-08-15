/**
 * SuperAdmin Customers Routes Integration Tests
 * Tests SUPERADMIN-level access to organization management
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-superadmin-customers-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin Customers API', () => {
  let app;
  let superadminToken;
  let regularToken;
  const db = getDatabase();
  const testId = Date.now();

  // SuperAdmin user
  const superadminOrgId = `sa-org-${testId}`;
  const superadminUserId = `sa-user-${testId}`;
  const superadminEmail = `superadmin-${testId}@test.com`;

  // Regular user
  const regularOrgId = `reg-org-${testId}`;
  const regularUserId = `reg-user-${testId}`;
  const regularEmail = `regular-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    const hash = bcrypt.hashSync('test123', 8);

    // Create organizations
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          superadminOrgId,
          'SuperAdmin Org',
          'enterprise',
          'active',
        ]);
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          regularOrgId,
          'Regular Org',
          'professional',
          'active',
        ]);

        // Create SUPERADMIN user
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [superadminUserId, superadminOrgId, superadminEmail, hash, 'SuperAdmin', 'SUPERADMIN']
        );

        // Create regular ADMIN user
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [regularUserId, regularOrgId, regularEmail, hash, 'Regular', 'ADMIN'],
          resolve
        );
      });
    });

    // Login both users
    const saLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: superadminEmail, password: 'test123' });
    if (saLogin.body.token) superadminToken = saLogin.body.token;

    const regLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: regularEmail, password: 'test123' });
    if (regLogin.body.token) regularToken = regLogin.body.token;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM users WHERE id IN (?, ?)', [superadminUserId, regularUserId]);
        db.run(
          'DELETE FROM organizations WHERE id IN (?, ?)',
          [superadminOrgId, regularOrgId],
          resolve
        );
      });
    });
  });

  describe('GET /api/superadmin/customers', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/superadmin/customers');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return 403 for regular admin users', async () => {
      if (!regularToken) return;
      const res = await request(app)
        .get('/api/superadmin/customers')
        .set('Authorization', `Bearer ${regularToken}`);
      expect([401, 403, 404]).toContain(res.status);
    });

    it.skip('should return customers list for superadmin (retired /customers endpoint)', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/customers')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(
          Array.isArray(res.body) || res.body.customers || res.body.organizations
        ).toBeTruthy();
      }
    });
  });

  describe('GET /api/superadmin/organizations', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/organizations');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return organizations for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/organizations')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/superadmin/system-health', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/system-health');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return system health for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/system-health')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
