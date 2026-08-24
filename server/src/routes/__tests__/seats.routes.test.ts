import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/seats.routes.js';
const dbGet = vi.fn(); const getConfig = vi.fn(); const getHistory = vi.fn(); const toggle = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({ get: (...args: any[]) => dbGet(...args) }));
vi.mock('../../middleware/auth.middleware.js', () => ({ verifyToken: (req: any, res: any, next: any) => { if (!user) return res.status(401).end(); req.user = user; next(); } }));
vi.mock('../../middleware/admin.middleware.js', () => ({ default: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../services/seatManagementService.js', () => ({ getSeatConfiguration: (...args: any[]) => getConfig(...args), getSeatHistory: (...args: any[]) => getHistory(...args), toggleAutoAddSeats: (...args: any[]) => toggle(...args) }));
const app = () => { const a = express(); a.use(express.json()); a.use('/api/admin/seats', routes); return a; };
describe('admin seats routes', () => {
  beforeEach(() => { vi.clearAllMocks(); user = { id: 'u1', organizationId: 'org-1', role: 'admin' }; dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' }); getConfig.mockResolvedValue({ seats_used: 2 }); getHistory.mockResolvedValue([]); toggle.mockResolvedValue({}); });
  it('requires authentication', async () => { user = null; expect((await request(app()).get('/api/admin/seats')).status).toBe(401); });
  it('requires tenant admin membership', async () => { dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' }); expect((await request(app()).get('/api/admin/seats')).status).toBe(403); });
  it('scopes every read to the token organization', async () => { expect((await request(app()).get('/api/admin/seats')).status).toBe(200); await request(app()).get('/api/admin/seats/history?limit=999'); expect(getConfig).toHaveBeenCalledWith('org-1'); expect(getHistory).toHaveBeenCalledWith('org-1', 200); });
  it('updates auto-add and performs tenant-scoped readback', async () => { const response = await request(app()).put('/api/admin/seats/auto-add').send({ enabled: true, threshold: 75 }); expect(response.status).toBe(200); expect(toggle).toHaveBeenCalledWith('org-1', true, 75); expect(getConfig).toHaveBeenCalledWith('org-1'); });
});
