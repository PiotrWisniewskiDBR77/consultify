import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [{ ok: 1 }] })) }),
}));

vi.mock('../../../server/src/services/metricsService.js', () => ({
  getMetricsService: () => ({ getMetrics: vi.fn(async () => 'ok') }),
}));

describe('HealthRoutes readiness: ready (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origMockRedis = process.env.MOCK_REDIS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'true';
  });

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/healthRoutes.ts')).default;
  });

  afterAll(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origMockRedis === undefined) delete process.env.MOCK_REDIS;
    else process.env.MOCK_REDIS = origMockRedis;
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/ready returns 200 when checks pass', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ready',
        checks: expect.objectContaining({
          database: true,
          redis: true,
          metrics: true,
        }),
        timestamp: expect.any(String),
      })
    );
  });
});
