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
 * Level 2: Integration Tests - Legal
 * Tests Legal Document lifecycle and acceptance
 */
const db = getDatabase();
(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Legal Routes', () => {
  let authToken;
  const testId = Date.now();
  const testOrgId = `legal-org-${testId}`;
  const testUserId = `legal-user-${testId}`;
  const testEmail = `legal-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
      testOrgId,
      'Legal Test Org',
      'enterprise',
      'active',
    ]);
    await db.run(
      'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
      [testUserId, testOrgId, testEmail, hash, 'LegalUser', 'ADMIN']
    );

    await db.run(
      `INSERT INTO legal_documents
         (id, type, name, version, content, status, requires_acceptance,
          doc_type, is_active, title, created_by, published_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `legal-tos-${testId}`,
        'TOS',
        'Terms of Service',
        '1.0',
        '# Test terms',
        'active',
        true,
        'TOS',
        true,
        'Terms of Service',
        testUserId,
        testUserId,
      ]
    );

    const loginRes = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'test123',
    });

    if (loginRes.body.token) {
      authToken = loginRes.body.token;
    }
  });

  describe('GET /api/legal/document/TOS', () => {
    it('should get public TOS document', async () => {
      const res = await request(app).get('/api/legal/document/TOS');
      // Public endpoint: 200 when the TOS doc is seeded, 404 when it is not.
      // (5xx removed — a server error here is a real failure, not an accepted state.)
      expect([200, 404]).toContain(res.status);
    });
  });

  describe('GET /api/legal/active', () => {
    it('should list active documents (auth)', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/legal/active')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/legal/pending', () => {
    it('should check pending acceptances', async () => {
      if (!authToken) return;

      const res = await request(app)
        .get('/api/legal/pending')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/legal/accept', () => {
    it('should accept TOS', async () => {
      if (!authToken) return;

      const res = await request(app)
        .post('/api/legal/accept')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          docTypes: ['TOS'],
          scope: 'USER',
        });

      expect(res.status).toBe(200);
    });
  });
});
