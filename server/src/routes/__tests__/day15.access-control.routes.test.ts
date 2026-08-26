import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
let actor: { id: string; role: string; organizationId: string } | null;

vi.mock('../../utils/DbPromise.js', () => ({ all: dbAll, get: vi.fn(), run: vi.fn() }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!actor) return res.status(401).json({ error: 'No token' });
    req.user = actor;
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (req: any, res: any, next: () => void) =>
    ['admin', 'owner'].includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: 'Admin required' }),
}));
vi.mock('../../middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (req: any, res: any, next: () => void) =>
    req.user?.role === 'super_admin'
      ? next()
      : res.status(403).json({ error: 'Superadmin required' }),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../services/accessCodeService.js', () => ({ default: {} }));

async function app() {
  const { default: router } = await import('../access-control.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/access-control', router);
  return instance;
}

describe('Day 15 S.4 organization access requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor = { id: 'admin-a', role: 'admin', organizationId: 'org-a' };
  });

  it('returns 401 without a token', async () => {
    actor = null;
    expect(
      (await request(await app()).get('/api/access-control/requests/organization')).status
    ).toBe(401);
  });

  it('returns 403 for a member', async () => {
    actor = { id: 'member-a', role: 'member', organizationId: 'org-a' };
    expect(
      (await request(await app()).get('/api/access-control/requests/organization')).status
    ).toBe(403);
  });

  it('filters requests by the organization from the token', async () => {
    dbAll.mockResolvedValueOnce([{ id: 'request-a', organization_id: 'org-a' }]);
    const response = await request(await app()).get('/api/access-control/requests/organization');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'request-a', organization_id: 'org-a' }]);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'org-a',
      'pending',
    ]);
  });

  it('returns an honest empty list', async () => {
    dbAll.mockResolvedValueOnce([]);
    const response = await request(await app()).get(
      '/api/access-control/requests/organization?status=all'
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('keeps the platform-wide route superadmin-only', async () => {
    expect((await request(await app()).get('/api/access-control/requests')).status).toBe(403);
  });
});
