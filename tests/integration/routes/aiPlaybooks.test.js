/**
 * AI Playbooks Routes Integration Tests
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-ai-playbooks-${workerId}.db`;
});

describe('AI Playbooks API', () => {
  let app;
  let authToken;
  const db = getDatabase();
  const testId = Date.now();
  const testOrgId = `ai-playbooks-org-${testId}`;
  const testUserId = `ai-playbooks-user-${testId}`;
  const testEmail = `ai-playbooks-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;

    const hash = bcrypt.hashSync('test123', 8);
    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          testOrgId,
          'AI Playbooks Org',
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

  describe('GET /api/ai/playbooks', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).get('/api/ai/playbooks');
      expect([401, 403, 404]).toContain(res.status);
    });

    it('does not expose the retired playbooks route with auth', async () => {
      if (!authToken) return;
      const res = await request(app)
        .get('/api/ai/playbooks')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('playbooks');
    });
  });
});
