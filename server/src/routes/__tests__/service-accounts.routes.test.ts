import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/service-accounts.routes.js';
const dbGet = vi.fn();
const list = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({ get: (...args: any[]) => dbGet(...args) }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).end();
    req.user = user;
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));
const revoke = vi.fn();
vi.mock('../../services/tablePlatform/ServiceAccountService.js', () => ({
  serviceAccountService: {
    listServiceAccounts: (...args: any[]) => list(...args),
    createServiceAccount: vi.fn(),
    revokeServiceAccount: (...args: any[]) => revoke(...args),
  },
}));
const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/admin/service-accounts', routes);
  return a;
};
describe('service accounts admin route', () => {
  beforeEach(() => {
    user = { id: 'u1', organizationId: 'org-1', role: 'admin' };
    dbGet.mockReset();
    dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    list.mockResolvedValue([]);
    revoke.mockReset();
  });
  it('requires auth', async () => {
    user = null;
    expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(401);
  });
  it('denies non-admin membership', async () => {
    dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(403);
  });
  it('lists only the token organization', async () => {
    expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(200);
    expect(list).toHaveBeenCalledWith('org-1');
  });

  it('deletes a service account owned by the token organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }); // membership check
    dbGet.mockResolvedValueOnce({ id: 'sa-1' }); // ownership lookup, scoped with ?
    const res = await request(app()).delete('/api/admin/service-accounts/sa-1');
    expect(res.status).toBe(204);
    expect(revoke).toHaveBeenCalledWith('sa-1');
    expect(dbGet).toHaveBeenLastCalledWith(
      'SELECT id FROM tp_service_accounts WHERE id = ? AND organization_id = ?',
      ['sa-1', 'org-1'],
      { fallback: false }
    );
  });

  it('returns 404 and never revokes when the account belongs to another organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }); // membership check
    dbGet.mockResolvedValueOnce(null); // ownership lookup finds nothing for this org
    const res = await request(app()).delete('/api/admin/service-accounts/sa-2');
    expect(res.status).toBe(404);
    expect(revoke).not.toHaveBeenCalled();
  });
});
