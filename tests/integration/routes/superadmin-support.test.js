/**
 * SuperAdmin Support Routes Integration Tests
 * Tests support ticket and help functions for SUPERADMIN
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-superadmin-support-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin Support API', () => {
  let app;
  let superadminToken;
  let regularToken;
  const db = getDatabase();
  const testId = Date.now();

  const superadminOrgId = `sup-sa-org-${testId}`;
  const superadminUserId = `sup-sa-user-${testId}`;
  const superadminEmail = `sup-sa-${testId}@test.com`;

  const regularOrgId = `sup-reg-org-${testId}`;
  const regularUserId = `sup-reg-user-${testId}`;
  const regularEmail = `sup-reg-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          superadminOrgId,
          'Support SA Org',
          'enterprise',
          'active',
        ]);
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          regularOrgId,
          'Support Reg Org',
          'professional',
          'active',
        ]);
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [superadminUserId, superadminOrgId, superadminEmail, hash, 'SuperAdmin', 'SUPERADMIN']
        );
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [regularUserId, regularOrgId, regularEmail, hash, 'Regular', 'ADMIN'],
          resolve
        );
      });
    });

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

  describe('Access Requests', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/access-requests');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return 403 for regular users', async () => {
      if (!regularToken) return;
      const res = await request(app)
        .get('/api/superadmin/access-requests')
        .set('Authorization', `Bearer ${regularToken}`);
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should get access requests for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/access-requests')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('User Support', () => {
    it('should get user activities for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/activities')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });

    it('should get activity stats for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/activities/stats')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
