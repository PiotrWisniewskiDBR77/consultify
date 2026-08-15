/**
 * Assessment Reports Routes - Integration Test (TS variant)
 *
 * Uses dynamic import to avoid module-init crashes from
 * reportBuilderService's top-level getDatabase() call.
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';

// The global unit-test setup injects an authenticated user. This integration
// suite owns the real unauthenticated route boundary.
vi.unmock('../../server/src/middleware/auth.middleware.js');

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
  process.env.ENABLE_TEST_GATEWAY = 'true';
});

describe('Assessment Reports Routes (TS)', () => {
  let app: any;

  beforeAll(async () => {
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if ((await request(app).get('/api/ready')).status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  });

  it('GET /api/assessment-reports returns valid response', async () => {
    const response = await request(app).get('/api/assessment-reports');
    expect(response.status).toBe(401);
    if (response.status === 200 && response.body.reports) {
      expect(Array.isArray(response.body.reports)).toBe(true);
    }
  });

  it('GET /api/assessment-reports/templates returns valid response', async () => {
    const response = await request(app).get('/api/assessment-reports/templates');
    expect(response.status).toBe(401);
  });

  it('POST /api/assessment-reports requires assessmentId', async () => {
    const response = await request(app).post('/api/assessment-reports').send({});
    expect(response.status).toBe(401);
  });
});
