import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'user-dbr77',
      email: 'piotr.wisniewski@dbr77.com',
      organizationId: 'dbr77',
    };
    next();
  },
}));

const ORIGINAL_ENV = { ...process.env };

async function loadHealthRouter() {
  return (await import('../../../server/src/routes/health.routes.ts')).default;
}

describe('GET /api/health/data-context', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RAILWAY_SERVICE_ID;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    process.env.DATABASE_URL = 'postgresql://user:pass@pgvector.railway.internal:5432/railway';
    process.env.DATABASE_PUBLIC_URL = 'postgresql://user:pass@caboose.proxy.rlwy.net:15646/railway';
    process.env.DB_READONLY = '1';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.clearAllMocks();
  });

  it('returns resolved database and active org context', async () => {
    const router = await loadHealthRouter();
    const app = makeTestApp({
      mountPath: '/api/health',
      router,
      beforeMount: (expressApp) => {
        expressApp.use((req: any, _res, next) => {
          req.organizationId = 'dbr77';
          next();
        });
      },
    });

    const res = await request(app).get('/api/health/data-context');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        database: expect.objectContaining({
          source: 'DATABASE_PUBLIC_URL',
          host: 'caboose.proxy.rlwy.net',
          name: 'railway',
          readonly: true,
        }),
        organization: expect.objectContaining({
          activeOrganizationId: 'dbr77',
          userOrganizationId: 'dbr77',
        }),
        user: expect.objectContaining({
          id: 'user-dbr77',
          email: 'piotr.wisniewski@dbr77.com',
        }),
      })
    );
  });

  it('reports demo context and header state when present', async () => {
    const router = await loadHealthRouter();
    const app = makeTestApp({
      mountPath: '/api/health',
      router,
      beforeMount: (expressApp) => {
        expressApp.use((req: any, _res, next) => {
          req.organizationId = 'dbr77';
          req.demo = {
            enabled: true,
            organizationId: 'atelier',
          };
          next();
        });
      },
    });

    const res = await request(app).get('/api/health/data-context').set('X-Demo-Mode', 'true');

    expect(res.status).toBe(200);
    expect(res.body.demo).toEqual({
      enabled: true,
      organizationId: 'atelier',
      headerActive: true,
    });
  });
});
