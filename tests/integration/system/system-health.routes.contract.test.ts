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

    const res = await request(app).get('/api/system-health');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SYSTEM_HEALTH_SERVICE_NOT_CONFIGURED');
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

    const summary = await request(app).get('/api/system-health');
    expect(summary.status).toBe(503);
    expect(summary.body.code).toBe('SYSTEM_HEALTH_SUMMARY_READ_FAILED');
    expect(JSON.stringify(summary.body)).not.toContain('internal db secret');

    const detailed = await request(app).get('/api/system-health/detailed');
    expect(detailed.status).toBe(503);
    expect(detailed.body.code).toBe('SYSTEM_HEALTH_DETAILED_READ_FAILED');

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
