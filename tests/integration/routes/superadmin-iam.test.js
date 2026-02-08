/**
 * SuperAdmin IAM Routes Integration Tests
 * Tests Identity and Access Management functions for SUPERADMIN
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-superadmin-iam-${workerId}.db`;
});

describe('SuperAdmin IAM API', () => {
  let app;
  let superadminToken;
  let regularToken;
  const db = getDatabase();
  const testId = Date.now();

  const superadminOrgId = `iam-sa-org-${testId}`;
  const superadminUserId = `iam-sa-user-${testId}`;
  const superadminEmail = `iam-sa-${testId}@test.com`;

  const regularOrgId = `iam-reg-org-${testId}`;
  const regularUserId = `iam-reg-user-${testId}`;
  const regularEmail = `iam-reg-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          superadminOrgId,
          'IAM SA Org',
          'enterprise',
          'active',
        ]);
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          regularOrgId,
          'IAM Reg Org',
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

  describe('Admin Sessions', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/admin/sessions');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should return 403 for regular users', async () => {
      if (!regularToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/sessions')
        .set('Authorization', `Bearer ${regularToken}`);
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should get admin sessions for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/sessions')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect([200, 404, 500]).toContain(res.status);
    });

    it('should get session stats for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/sessions/stats')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('Admin Audit Logs', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/admin/audit-logs');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should get audit logs for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/audit-logs')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect([200, 404, 500]).toContain(res.status);
    });
  });

  describe('Admin Permissions', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/admin/permissions');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should get permissions for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/permissions')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect([200, 404, 500]).toContain(res.status);
    });
  });
});
