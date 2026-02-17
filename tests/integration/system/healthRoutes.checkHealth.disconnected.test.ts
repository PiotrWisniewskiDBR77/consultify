import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: vi.fn(async () => ({ rows: [{ ok: 1 }] })) }),
}));

vi.mock('../../../server/src/services/ai/redisClient.js', () => ({
  isRedisConnected: () => false,
}));

vi.mock('../../../server/src/utils/RedisClient.js', () => ({
  default: { isReady: false, isOpen: false },
}));

describe('HealthRoutes: redis disconnected (REAL integration)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origMockRedis = process.env.MOCK_REDIS;
  let canListen = true;
  let router: any;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_REDIS = 'false';
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

  it('GET /api/health reports redis disconnected', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ redis: 'disconnected' }));
  });
});
