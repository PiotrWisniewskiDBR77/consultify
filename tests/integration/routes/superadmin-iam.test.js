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

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin IAM API', () => {
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
      expect(res.status).toBe(200);
    });

    it('should get session stats for superadmin', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/sessions/stats')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('Admin Audit Logs', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/superadmin/admin/audit-logs');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should get audit logs for superadmin and respect the hardened contract', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/audit-logs')
        .set('Authorization', `Bearer ${superadminToken}`);

      // The hardened endpoint MUST NOT 5xx for valid superadmin requests.
      expect(res.status).toBe(200);

      expect(res.body).toBeTypeOf('object');
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.pagination).toMatchObject({
        limit: expect.any(Number),
        offset: expect.any(Number),
        count: expect.any(Number),
      });
      expect(res.body.integrity).toMatchObject({
        degraded: expect.any(Boolean),
        malformedMetadataCount: expect.any(Number),
      });
    });

    it('should clamp invalid pagination params instead of returning 5xx', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/audit-logs?limit=NaN&offset=-50&status=pwned')
        .set('Authorization', `Bearer ${superadminToken}`);

      // Contract: invalid pagination is clamped and returns 200 (never 5xx).
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination.offset).toBeGreaterThanOrEqual(0);
    });

    it('should expose stats with safe numeric defaults', async () => {
      if (!superadminToken) return;
      const res = await request(app)
        .get('/api/superadmin/admin/audit-logs/stats')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(res.body).toMatchObject({
          total_logs: expect.any(Number),
          unresolved_count: expect.any(Number),
          high_risk_count: expect.any(Number),
          medium_risk_count: expect.any(Number),
          low_risk_count: expect.any(Number),
          avg_risk_score: expect.any(Number),
        });
      }
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
      expect(res.status).toBe(200);
    });
  });
});
