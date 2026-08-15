/**
 * Interview Routes — Integration Tests (L3)
 *
 * Verifies interview API endpoints respond correctly.
 * Negative tests: invalid params, unauthorized access patterns.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.unmock('../../../server/src/middleware/auth.middleware.js');

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
  process.env.ENABLE_TEST_GATEWAY = 'true';
});

describe('Interview Routes (L3)', () => {
  let app: any;

  beforeAll(async () => {
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await request(app).get('/api/ready')).status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
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
    expect(res.status).toBe(401);
  });

  it('GET /api/interview/sessions/:id with invalid UUID returns 401 or 400', async () => {
    const res = await request(app).get('/api/interview/sessions/not-a-uuid');
    expect(res.status).toBe(401);
  });

  it('GET /api/interview/context returns 401 without token', async () => {
    const res = await request(app).get('/api/interview/context');
    expect(res.status).toBe(401);
  });
});
