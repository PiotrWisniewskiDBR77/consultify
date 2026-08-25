import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/audit-export-history.routes.js';
const get = vi.fn(),
  all = vi.fn();
let user: any = { id: 'u1', organizationId: 'org1', role: 'admin' };
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: any[]) => get(...a),
  all: (...a: any[]) => all(...a),
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
  a.use('/api/admin/audit-export-history', routes);
  return a;
};
describe('audit export history', () => {
  beforeEach(() => {
    get.mockReset();
    all.mockReset();
    get.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    all.mockResolvedValue([]);
  });
  it('scopes receipt list to token tenant', async () => {
    expect((await request(app()).get('/api/admin/audit-export-history?limit=999')).status).toBe(
      200
    );
    expect(all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE organization_id=?'),
      ['org1', 200],
      { fallback: false }
    );
  });
});
