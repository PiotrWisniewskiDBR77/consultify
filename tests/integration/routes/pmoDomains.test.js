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
 * Level 2: Integration Tests - PMO Domains
 * Tests PMO Domain Registry and Standards Mapping
 */
const db = getDatabase();
describe('Integration Test: PMO Domains Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `pmo-dom-org-${testId}`;
  const testUserId = `pmo-dom-user-${testId}`;
  const testProjectId = `pmo-dom-proj-${testId}`;
  const testEmail = `pmo-dom-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'PMO Domains Org',
          'enterprise',
          'active',
        ]);
    await db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'PMODomainUser', 'ADMIN']
        );
    await db.run('INSERT INTO projects (id, organization_id, name, status) VALUES (?, ?, ?, ?)', [
          testProjectId,
          testOrgId,
          'PMO Domains Project',
          'active',
        ]);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toEqual(expect.any(String));
    authToken = loginRes.body.token;
  });

  describe('GET /api/pmo-domains', () => {
    it('should return all PMP domains', async () => {
      const res = await request(app)
        .get('/api/pmo-domains')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // If 200, verify structure
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      }
    });
  });

  describe('GET /api/pmo-domains/standards-mapping', () => {
    it('should return standards mapping', async () => {
      const res = await request(app)
        .get('/api/pmo-domains/standards-mapping')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/pmo-domains/projects/:projectId', () => {
    it('should return project domains', async () => {
      const res = await request(app)
        .get(`/api/pmo-domains/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });
});
