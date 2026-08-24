import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import billingHistoryRoutes from '../admin/billing-history.routes.js';

const dbGet = vi.fn();
const dbAll = vi.fn();
let user: any = { id: 'user-1', organizationId: 'org-1', role: 'admin' };

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: (...args: any[]) => dbAll(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (req: any, res: any, next: any) =>
    ['admin', 'owner'].includes(req.user?.role) ? next() : res.status(403).json({ error: 'Admin access required' }),
}));

const app = () => {
  const instance = express();
  instance.use('/api/admin/billing-history', billingHistoryRoutes);
  return instance;
};

describe('billing history admin routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: 'user-1', organizationId: 'org-1', role: 'admin' };
    dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    dbAll.mockResolvedValue([]);
  });

  it('requires authentication', async () => {
    user = null;
    expect((await request(app()).get('/api/admin/billing-history')).status).toBe(401);
  });

  it('requires an active admin membership', async () => {
    dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    const response = await request(app()).get('/api/admin/billing-history');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ACCESS_REQUIRED');
  });

  it('scopes every history read to the token organization', async () => {
    const response = await request(app()).get('/api/admin/billing-history?limit=500&offset=2');
    expect(response.status).toBe(200);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('WHERE organization_id = ?'), ['org-1', 200, 2], { fallback: false });
    expect(response.body.pagination).toEqual({ limit: 200, offset: 2 });
  });

  it('never admits a foreign organization selector into the query', async () => {
    await request(app()).get('/api/admin/billing-history?organizationId=org-foreign');
    const params = dbAll.mock.calls[0][1];
    expect(params).toContain('org-1');
    expect(params).not.toContain('org-foreign');
  });
});
