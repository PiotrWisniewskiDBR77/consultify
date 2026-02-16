import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();
const getHealthMonitor = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => getHealthMonitor(),
}));

describe('DB health routes: /database healthy (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 10, active: 1, idle: 9, healthy: 1, unhealthy: 0 }),
    });
    getHealthMonitor.mockReturnValue({
      getMetrics: () => ({
        consecutiveFailures: 0,
        uptime: 99.9,
        averageResponseTime: 10,
        totalChecks: 10,
        totalFailures: 0,
        lastCheck: new Date().toISOString(),
      }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/database returns 200 healthy', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/database');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'healthy',
        pool: expect.any(Object),
        metrics: expect.any(Object),
        timestamp: expect.any(String),
      })
    );
  });
});
