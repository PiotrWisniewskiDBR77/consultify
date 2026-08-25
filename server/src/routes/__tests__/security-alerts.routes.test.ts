import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/security-alerts.routes.js';
const get = vi.fn(),
  all = vi.fn(),
  run = vi.fn();
let user: any = { id: 'u1', organizationId: 'org1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: any[]) => get(...a),
  all: (...a: any[]) => all(...a),
  run: (...a: any[]) => run(...a),
}));
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
  a.use(express.json());
  a.use('/api/admin/security-alerts', routes);
  return a;
};
describe('security alerts admin route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: 'u1', organizationId: 'org1', role: 'admin' };
    get.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    all.mockResolvedValue([]);
    run.mockResolvedValue({ success: true });
  });
  it('requires auth and admin', async () => {
    user = null;
    expect((await request(app()).get('/api/admin/security-alerts')).status).toBe(401);
    user = { id: 'u1', organizationId: 'org1', role: 'admin' };
    get.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    expect((await request(app()).get('/api/admin/security-alerts')).status).toBe(403);
  });
  it('lists token tenant only', async () => {
    await request(app()).get('/api/admin/security-alerts');
    expect(all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE se.organization_id = ?'),
      ['org1'],
      { fallback: false }
    );
  });
  it('returns 404 for cross-tenant id and reads back own mutation', async () => {
    get.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }).mockResolvedValueOnce(undefined);
    expect((await request(app()).put('/api/admin/security-alerts/foreign/resolve')).status).toBe(
      404
    );
    get
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'own' });
    expect((await request(app()).put('/api/admin/security-alerts/own/resolve')).status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('organization_id = ?'),
      ['u1', 'own', 'org1'],
      { fallback: false }
    );
  });
});
