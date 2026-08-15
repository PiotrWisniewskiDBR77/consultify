import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(async () => []), get: (...args: any[]) => dbGet(...args), run: vi.fn(async () => ({ changes: 1 })),
}));
vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-1', organizationId: 'org-a', role: 'admin' };
    req.userRole = 'admin'; next();
  },
}));
vi.mock('../../../../server/src/services/adminAuditService.js', () => ({
  default: { logAction: vi.fn(), getLogs: vi.fn(async () => []) },
}));

describe('ADM-001 capability matrix route', () => {
  beforeEach(() => dbGet.mockReset());

  it('returns the tenant-scoped machine contract to a current admin', async () => {
    dbGet.mockResolvedValue({ role: 'ADMIN' });
    const routes = (await import('../../../../server/src/routes/adminP32.routes.ts')).default;
    const app = express(); app.use('/api/admin', routes);
    const response = await request(app).get('/api/admin/capabilities/matrix');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ schemaVersion: 1, owner: 'TENANT_ADMIN', organizationId: 'org-a' });
    expect(response.body.entries).toHaveLength(4);
  });

  it('fails closed when the current organization membership disappeared', async () => {
    dbGet.mockResolvedValue(undefined);
    const routes = (await import('../../../../server/src/routes/adminP32.routes.ts')).default;
    const app = express(); app.use('/api/admin', routes);
    const response = await request(app).get('/api/admin/capabilities/matrix');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ACCESS_REQUIRED');
  });
});
