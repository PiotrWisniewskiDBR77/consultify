import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import routes from '../organization/teams.routes.js';

const get = vi.fn();
const run = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => get(...args),
  all: vi.fn(),
  run: (...args: unknown[]) => run(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u1', organizationId: 'org-1', role: 'ADMIN' };
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

const app = () => {
  const value = express();
  value.use(express.json());
  value.use('/api/teams', routes);
  return value;
};

describe('team deletion tenant boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue({ success: true, changes: 1 });
  });

  it('returns 404 without deleting memberships for a foreign team id', async () => {
    get.mockResolvedValue(undefined);
    expect((await request(app()).delete('/api/teams/foreign-team')).status).toBe(404);
    expect(get).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), [
      'foreign-team',
      'org-1',
    ]);
    expect(run).not.toHaveBeenCalled();
  });

  it('deletes children only after tenant ownership is proven', async () => {
    get.mockResolvedValue({ id: 'team-1' });
    expect((await request(app()).delete('/api/teams/team-1')).status).toBe(200);
    expect(run.mock.calls[0][0]).toContain('DELETE FROM team_members');
    expect(run.mock.calls[1][0]).toContain('organization_id = ?');
  });

  it('rejects a foreign lead before create or update mutations', async () => {
    get.mockResolvedValue(undefined);
    const created = await request(app())
      .post('/api/teams')
      .send({ name: 'Team', leadId: 'foreign-user' });
    const updated = await request(app()).put('/api/teams/team-1').send({ leadId: 'foreign-user' });
    expect(created.status).toBe(404);
    expect(updated.status).toBe(404);
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('users WHERE id = ? AND organization_id = ?'),
      ['foreign-user', 'org-1']
    );
    expect(run).not.toHaveBeenCalled();
  });
});
