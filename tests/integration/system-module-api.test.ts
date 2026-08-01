/**
 * L2-ish: System Health router wiring (honest integration test)
 *
 * This file used to be a fake integration (local app.get/app.post handlers).
 * Now it mounts our real router from server/src/routes and uses supertest against it.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../server/src/middleware/rateLimiting.middleware.js'
  )) as any;
  return {
    ...actual,
    defaultRateLimiter: (_req: any, _res: any, next: any) => next(),
  };
});

vi.mock('../../server/src/services/systemHealthService.js', () => ({
  default: {
    getDetailedHealth: vi.fn(async () => ({ status: 'ok' })),
    getMetrics: vi.fn(async () => ({ uptime: 123 })),
    getServiceStatus: vi.fn(async () => ({ db: { ok: true } })),
  },
}));

import systemHealthRouter from '../../server/src/routes/systemHealth.routes.js';

describe('systemHealth.routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use('/api/system-health', systemHealthRouter);
  });

  it('GET /api/system-health (base route) is gone — SEC-PUB-002', async () => {
    // It was the router's only route without verifySuperAdmin and it called the
    // same getDetailedHealth() as the guarded /detailed, so it served host,
    // runtime, database and AI-provider detail to anonymous callers. Deleted as a
    // duplicate; the guarded /detailed is the surviving surface.
    const res = await request(app).get('/api/system-health');
    expect(res.status).toBe(404);
  });

  it('GET /api/system-health/detailed works with mocked superadmin middleware', async () => {
    const res = await request(app).get('/api/system-health/detailed').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
