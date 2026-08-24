import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/service-accounts.routes.js';
const dbGet = vi.fn(); const list = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({ get: (...args: any[]) => dbGet(...args) }));
vi.mock('../../middleware/auth.middleware.js', () => ({ verifyToken: (req: any, res: any, next: any) => { if (!user) return res.status(401).end(); req.user = user; next(); } }));
vi.mock('../../middleware/admin.middleware.js', () => ({ default: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/tablePlatform/ServiceAccountService.js', () => ({ serviceAccountService: { listServiceAccounts: (...args: any[]) => list(...args), createServiceAccount: vi.fn(), revokeServiceAccount: vi.fn() } }));
vi.mock('../../database/Database.js', () => ({ getDatabase: () => ({ query: vi.fn() }) }));
const app = () => { const a = express(); a.use(express.json()); a.use('/api/admin/service-accounts', routes); return a; };
describe('service accounts admin route', () => {
  beforeEach(() => { user = { id: 'u1', organizationId: 'org-1', role: 'admin' }; dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' }); list.mockResolvedValue([]); });
  it('requires auth', async () => { user = null; expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(401); });
  it('denies non-admin membership', async () => { dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' }); expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(403); });
  it('lists only the token organization', async () => { expect((await request(app()).get('/api/admin/service-accounts')).status).toBe(200); expect(list).toHaveBeenCalledWith('org-1'); });
});
