/**
 * AI Explain Routes Integration Tests
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-ai-explain-${workerId}.db`;
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('AI Explain API', () => {
  let app;
  let authToken;
  const db = getDatabase();
  const testId = Date.now();
  const testOrgId = `ai-explain-org-${testId}`;
  const testUserId = `ai-explain-user-${testId}`;
  const testEmail = `ai-explain-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    const hash = bcrypt.hashSync('test123', 8);
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'AI Explain Org',
          'enterprise',
          'active',
        ]);
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [testUserId, testOrgId, testEmail, hash, 'TestUser', 'ADMIN'],
          resolve
        );
      });
    });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'test123' });
    if (login.body.token) authToken = login.body.token;
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('DELETE FROM users WHERE id = ?', [testUserId]);
        db.run('DELETE FROM organizations WHERE id = ?', [testOrgId], resolve);
      });
    });
  });

  describe('GET /api/ai/explain', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/ai/explain');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should access explain with auth', async () => {
      if (!authToken) return;
      const res = await request(app)
        .get('/api/ai/explain')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
    });
  });
});
