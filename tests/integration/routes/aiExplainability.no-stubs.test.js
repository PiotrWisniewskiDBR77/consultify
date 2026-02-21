import app from '../../../server/src/index.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-ai-explain-${workerId}.db`;
});

// @vitest-environment node

describe('AI explainability routes (honest 503)', () => {
  const db = getDatabase();
  let authToken;
  const testId = Date.now();
  const orgId = `ai-explain-org-${testId}`;
  const userId = `ai-explain-user-${testId}`;
  const email = `ai-explain-${testId}@test.com`;

  beforeAll(async () => {
    await initializeDatabase();
    await db.initPromise;

    const hash = bcrypt.hashSync('test123', 8);

    await new Promise((resolve) => {
      db.serialize(() => {
        db.run('INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)', [
          orgId,
          'AI Explainability Test Org',
          'free',
          'active',
        ]);
        db.run(
          'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, orgId, email, hash, 'Test', 'admin'],
          resolve
        );
      });
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'test123',
    });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await db.close();
  });

  it('GET /api/ai/explain/evidences returns 503', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/ai/explain/evidences')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('FEATURE_UNAVAILABLE');
  });

  it('GET /api/ai/explain/:entityType/:entityId returns 503', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/ai/explain/project/sample-entity')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('FEATURE_UNAVAILABLE');
  });

  it('GET /api/ai/explain/export/:entityType/:entityId returns 503', async () => {
    if (!authToken) return;
    const res = await request(app)
      .get('/api/ai/explain/export/project/sample-entity?format=pdf')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('FEATURE_UNAVAILABLE');
  });
});
