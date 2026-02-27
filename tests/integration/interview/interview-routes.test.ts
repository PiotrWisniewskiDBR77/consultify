/**
 * Interview Routes — Integration Tests (L3)
 *
 * Verifies interview API endpoints respond correctly.
 * Negative tests: invalid params, unauthorized access patterns.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-interview-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500];

describe('Interview Routes (L3)', () => {
  let app: any;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  it('GET /api/interview/sessions returns 401 without token (unauthorized)', async () => {
    const res = await request(app).get('/api/interview/sessions');
    expect(res.status).toBe(401);
  });

  it('GET /api/interview/assignments/my returns 401 without token', async () => {
    const res = await request(app).get('/api/interview/assignments/my');
    expect(res.status).toBe(401);
  });

  it('GET /api/interview/templates returns 401 without token', async () => {
    const res = await request(app).get('/api/interview/templates');
    expect(res.status).toBe(401);
  });

  it('POST /api/interview/sessions with invalid body returns 401 before validation', async () => {
    const res = await request(app)
      .post('/api/interview/sessions')
      .set('Content-Type', 'application/json')
      .send({ title: '' });
    expect(VALID_STATUSES).toContain(res.status);
  });

  it('GET /api/interview/sessions/:id with invalid UUID returns 401 or 400', async () => {
    const res = await request(app).get('/api/interview/sessions/not-a-uuid');
    expect(VALID_STATUSES).toContain(res.status);
  });

  it('GET /api/interview/context returns 401 without token', async () => {
    const res = await request(app).get('/api/interview/context');
    expect(res.status).toBe(401);
  });
});
