import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => null,
}));

describe('DB health routes: /connections ok (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 10, active: 2, idle: 8, healthy: 2, unhealthy: 0 }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/connections returns utilization', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/connections');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        connections: expect.any(Object),
        utilization: expect.objectContaining({
          active: expect.any(String),
          idle: expect.any(String),
        }),
        timestamp: expect.any(String),
      })
    );
  });
});
