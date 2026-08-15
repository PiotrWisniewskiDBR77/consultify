/**
 * Assessment Routes — Integration Tests (L3)
 *
 * Verifies assessment API endpoints respond correctly.
 * Negative tests: invalid params, unauthorized access.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Exercise the production auth middleware rather than the global unit-test
// identity injector; these are explicitly unauthenticated route contracts.
vi.unmock('../../../server/src/middleware/auth.middleware.js');

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
  process.env.ENABLE_TEST_GATEWAY = 'true';
});

describe('Assessment Routes (L3)', () => {
  let app: any;

  beforeAll(async () => {
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await request(app).get('/api/ready')).status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  it('GET /api/assessment-reports returns valid response', async () => {
    const res = await request(app).get('/api/assessment-reports');
    expect(res.status).toBe(401);
    if (res.status === 200 && res.body?.reports) {
      expect(Array.isArray(res.body.reports)).toBe(true);
    }
  });

  it('GET /api/assessment-reports/templates returns valid response', async () => {
    const res = await request(app).get('/api/assessment-reports/templates');
    expect(res.status).toBe(401);
  });

  it('POST /api/assessment-reports with invalid body returns 400 or 401', async () => {
    const res = await request(app)
      .post('/api/assessment-reports')
      .set('Content-Type', 'application/json')
      .send({});
    expect(res.status).toBe(401);
  });

  it('GET /api/assessments/my-assessments returns 401 without token (unauthorized)', async () => {
    const res = await request(app).get('/api/assessments/my-assessments');
    expect(res.status).toBe(401);
  });

  it('GET /api/assessment/frameworks/list returns valid response or 401', async () => {
    const res = await request(app).get('/api/assessment/frameworks/list');
    expect(res.status).toBe(401);
  });
});
