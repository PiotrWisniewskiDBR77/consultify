import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { canBindEphemeralPort, makeTestApp } from '../_helpers/testApp';

const getConnectionPool = vi.fn();
const getHealthMonitor = vi.fn();

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => getHealthMonitor(),
}));

describe('DB health: degraded when metrics failing (REAL integration)', () => {
  let canListen = true;
  let router: any;

  beforeAll(async () => {
    canListen = await canBindEphemeralPort();
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 10, active: 0, idle: 10, healthy: 1, unhealthy: 0 }),
    });
    getHealthMonitor.mockReturnValue({
      getMetrics: () => ({
        consecutiveFailures: 3,
        uptime: 90,
        averageResponseTime: 100,
        totalChecks: 10,
        totalFailures: 3,
        lastCheck: new Date().toISOString(),
      }),
    });
  });

  const makeApp = () => makeTestApp({ mountPath: '/api/health', router });

  it('GET /api/health/database returns 503 degraded', async function () {
    if (!canListen) this.skip();
    const res = await request(makeApp()).get('/api/health/database');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });
});
