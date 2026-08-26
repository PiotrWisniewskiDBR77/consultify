import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
let authenticated = true;

vi.mock('../../utils/DbPromise.js', () => ({ all: dbAll, get: vi.fn(), run: vi.fn() }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!authenticated) return res.status(401).json({ error: 'No token' });
    req.user = { id: 'root', role: 'SUPERADMIN', organizationId: 'platform' };
    next();
  },
}));
vi.mock('../../middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: () => void) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/superadminAuditMonitor.middleware.js', () => ({
  superadminAuditMonitor: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
}));

async function app() {
  const { default: router } = await import('../superadmin.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/superadmin', router);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(500).json({ error: String(error?.message || error) })
  );
  return instance;
}

describe('Day 15 P.1 connector target catalog', () => {
  beforeEach(() => {
    authenticated = true;
    vi.clearAllMocks();
  });

  it('returns a named connector with the affected tenant count', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'slack', name: 'slack', affected_tenants: '3' }]);
    const response = await request(await app()).get('/api/superadmin/connectors');
    expect(response.status).toBe(200);
    expect(response.body.connectors).toEqual([{ id: 'slack', name: 'slack', affectedTenants: 3 }]);
  });

  it('returns an honest empty catalog', async () => {
    dbAll.mockResolvedValueOnce([]);
    expect((await request(await app()).get('/api/superadmin/connectors')).body.connectors).toEqual(
      []
    );
  });

  it('returns 401 without authentication', async () => {
    authenticated = false;
    expect((await request(await app()).get('/api/superadmin/connectors')).status).toBe(401);
  });

  it('does not disguise a database failure as an empty catalog', async () => {
    dbAll.mockRejectedValueOnce(new Error('catalog unavailable'));
    const response = await request(await app()).get('/api/superadmin/connectors');
    expect(response.status).toBe(500);
    expect(response.body.error).toContain('catalog unavailable');
  });
});
