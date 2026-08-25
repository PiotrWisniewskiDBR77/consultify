import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/legal-hold.routes.js';
const get = vi.fn();
let user: any = { id: 'u1', organizationId: 'org1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({ get: (...a: any[]) => get(...a) }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (q: any, s: any, n: any) => {
    if (!user) return s.status(401).end();
    q.user = user;
    n();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (_q: any, _s: any, n: any) => n(),
}));
const app = () => {
  const a = express();
  a.use('/api/admin/legal-hold', routes);
  return a;
};
describe('legal hold admin route', () => {
  beforeEach(() => {
    user = { id: 'u1', organizationId: 'org1', role: 'admin' };
    get.mockReset();
    get
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ legal_hold_enabled: 1 });
  });
  it('reads only token tenant and exposes no mutation', async () => {
    const r = await request(app()).get('/api/admin/legal-hold');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ legalHoldEnabled: true, matterRegistryAvailable: false });
    expect(get).toHaveBeenLastCalledWith(expect.stringContaining('organization_id=?'), ['org1'], {
      fallback: false,
    });
  });
});
