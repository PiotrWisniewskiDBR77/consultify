import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

describe('system health routes fail-closed contracts', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    app = express();
  });

  it('returns coded 503 when health service capability is missing', async () => {
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {},
    }));

    const router = (await import('../../../server/src/routes/systemHealth.routes.ts')).default;
    app.use('/api/system-health', router);

    // SEC-PUB-002 deleted the unguarded base route; `/detailed` is the guarded
    // equivalent and carries the same fail-closed contract, which is what this
    // case is really about.
    const res = await request(app).get('/api/system-health/detailed');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED');

    // And the base route is gone for good.
    const base = await request(app).get('/api/system-health');
    expect(base.status).toBe(404);
  });

  it('returns coded 503 contracts for service read failures', async () => {
    vi.doMock('../../../server/src/services/systemHealthService.js', () => ({
      default: {
        getDetailedHealth: async () => {
          throw new Error('internal db secret');
        },
        getMetrics: async () => {
          throw new Error('internal db secret');
        },
        getServiceStatus: async () => {
          throw new Error('internal db secret');
        },
      },
    }));

    const router = (await import('../../../server/src/routes/systemHealth.routes.ts')).default;
    app.use('/api/system-health', router);

    // The base-route summary no longer exists (SEC-PUB-002). Its fail-closed
    // property — a service error must not leak driver text — is asserted on the
    // guarded routes below, which is where the behaviour now lives.
    const removedBase = await request(app).get('/api/system-health');
    expect(removedBase.status).toBe(404);

    const detailed = await request(app).get('/api/system-health/detailed');
    expect(detailed.status).toBe(503);
    expect(detailed.body.code).toBe('SYSTEM_HEALTH_DETAILED_READ_FAILED');
    expect(JSON.stringify(detailed.body)).not.toContain('internal db secret');

    const metrics = await request(app).get('/api/system-health/metrics');
    expect(metrics.status).toBe(503);
    expect(metrics.body.code).toBe('SYSTEM_HEALTH_METRICS_READ_FAILED');

    const services = await request(app).get('/api/system-health/services');
    expect(services.status).toBe(503);
    expect(services.body.code).toBe('SYSTEM_HEALTH_SERVICES_READ_FAILED');

    const refresh = await request(app).post('/api/system-health/refresh');
    expect(refresh.status).toBe(503);
    expect(refresh.body.code).toBe('SYSTEM_HEALTH_REFRESH_FAILED');
  });
});
