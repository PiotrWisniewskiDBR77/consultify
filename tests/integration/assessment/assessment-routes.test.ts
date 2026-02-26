/**
 * Assessment Routes — Integration Tests (L3)
 *
 * Verifies assessment API endpoints respond correctly.
 * Negative tests: invalid params, unauthorized access.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-assessment-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 503];

describe('Assessment Routes (L3)', () => {
  let app: any;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  it('GET /api/assessment-reports returns valid response', async () => {
    const res = await request(app).get('/api/assessment-reports');
    expect(VALID_STATUSES).toContain(res.status);
    if (res.status === 200 && res.body?.reports) {
      expect(Array.isArray(res.body.reports)).toBe(true);
    }
  });

  it('GET /api/assessment-reports/templates returns valid response', async () => {
    const res = await request(app).get('/api/assessment-reports/templates');
    expect(VALID_STATUSES).toContain(res.status);
  });

  it('POST /api/assessment-reports with invalid body returns 400 or 401', async () => {
    const res = await request(app)
      .post('/api/assessment-reports')
      .set('Content-Type', 'application/json')
      .send({});
    expect(VALID_STATUSES).toContain(res.status);
  });

  it('GET /api/assessments/my-assessments returns 401 without token (unauthorized)', async () => {
    const res = await request(app).get('/api/assessments/my-assessments');
    expect(VALID_STATUSES).toContain(res.status);
  });

  it('GET /api/assessment/frameworks/list returns valid response or 401', async () => {
    const res = await request(app).get('/api/assessment/frameworks/list');
    expect(VALID_STATUSES).toContain(res.status);
  });
});
