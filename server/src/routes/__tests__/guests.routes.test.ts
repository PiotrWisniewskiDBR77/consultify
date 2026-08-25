import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/guests.routes.js';
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
  a.use('/api/admin/guests', routes);
  return a;
};
describe('admin guests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    user = { id: 'u1', organizationId: 'org1', role: 'admin' };
    get.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    all.mockResolvedValue([]);
  });
  it('lists tenant guests only', async () => {
    await request(app()).get('/api/admin/guests');
    expect(all).toHaveBeenCalledWith(
      expect.stringContaining("m.organization_id=? AND UPPER(m.role)='GUEST'"),
      ['org1'],
      { fallback: false }
    );
  });
  it('hides foreign guest as 404', async () => {
    get.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }).mockResolvedValueOnce(undefined);
    expect((await request(app()).delete('/api/admin/guests/u2')).status).toBe(404);
    expect(run).not.toHaveBeenCalled();
  });
  it('revokes owned guest and reads back', async () => {
    get
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ user_id: 'u2' });
    expect((await request(app()).delete('/api/admin/guests/u2')).status).toBe(200);
    expect(run).toHaveBeenCalledWith(
      expect.stringContaining('organization_id=? AND user_id=?'),
      ['org1', 'u2'],
      { fallback: false }
    );
  });
});
