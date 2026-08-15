import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [{ ok: 1 }] })) }),
}));

vi.mock('../../../server/src/services/metricsService.js', () => ({
  getMetricsService: () => ({ getMetrics: vi.fn(async () => 'ok') }),
}));

describe('HealthRoutes (REAL integration)', () => {
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

  it('GET /api/health/ping returns pong', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/ping');
    expect(res.status).toBe(200);
    expect(res.text).toBe('pong');
  });

  it('GET /api/health/live returns alive status', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      })
    );
  });

  it('GET /api/health returns base health payload', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'degraded',
        timestamp: expect.any(String),
        database: expect.any(String),
        environment: 'test',
      })
    );
    expect(res.body.redis).toBe('mocked-unavailable');
  });
});
