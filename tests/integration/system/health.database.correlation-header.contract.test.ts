import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import { correlationMiddleware } from '../../../server/src/utils/RequestStore.js';

const { getConnectionPool, getHealthMonitor } = vi.hoisted(() => ({
  getConnectionPool: vi.fn(),
  getHealthMonitor: vi.fn(),
}));

vi.mock('../../../server/src/database/index.js', () => ({
  getConnectionPool: () => getConnectionPool(),
  getHealthMonitor: () => getHealthMonitor(),
}));

vi.mock('../../../server/src/config/databaseTargetResolver.js', () => ({
  resolveReachableDatabaseUrl: vi.fn(),
}));

vi.mock('../../../server/src/config/demoPolicy.js', () => ({
  resolveDemoPolicy: vi.fn(),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: unknown, next: () => void) => next(),
  requireSuperAdmin: (_req: any, _res: unknown, next: () => void) => next(),
}));

describe('health database correlation header contract', () => {
  let router: any;

  beforeAll(async () => {
    router = (await import('../../../server/src/routes/health.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getConnectionPool.mockReturnValue({
      getStats: () => ({ total: 10, active: 2, idle: 8, healthy: 2, unhealthy: 0 }),
    });
    getHealthMonitor.mockReturnValue({
      getMetrics: () => ({
        uptime: 99.5,
        averageResponseTime: 10,
        consecutiveFailures: 0,
        totalChecks: 20,
        totalFailures: 0,
        lastCheck: new Date().toISOString(),
      }),
    });
  });

  function makeApp() {
    const app = express();
    app.use(correlationMiddleware);
    app.use('/api/health', router);
    return app;
  }

  it('echoes correlation header on healthy database response', async () => {
    const res = await request(makeApp())
      .get('/api/health/database')
      .set('X-Correlation-ID', 'pack08s5-db-health-ok-1');

    expect(res.status).toBe(200);
    expect(res.headers['x-correlation-id']).toBe('pack08s5-db-health-ok-1');
  });

  it('echoes correlation header on coded database probe failure', async () => {
    getConnectionPool.mockImplementationOnce(() => {
      throw new Error('db probe failed');
    });

    const res = await request(makeApp())
      .get('/api/health/database')
      .set('X-Correlation-ID', 'pack08s5-db-health-fail-1');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('HEALTH_DATABASE_PROBE_FAILED');
    expect(res.headers['x-correlation-id']).toBe('pack08s5-db-health-fail-1');
  });
});
