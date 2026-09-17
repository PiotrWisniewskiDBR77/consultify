/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actor: { id: 'member-a', organizationId: 'org-a', role: 'MEMBER' },
  dbGet: vi.fn(),
  dbAll: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = state.actor;
    next();
  },
  requireRole:
    (..._roles: string[]) =>
    (_req: any, _res: any, next: any) =>
      next(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => state.dbGet(...args),
  all: (...args: any[]) => state.dbAll(...args),
  run: (...args: any[]) => state.dbRun(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import usersRouter from '../users.routes.js';

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/users', usersRouter);
  return server;
}

const sameOrgUser = {
  id: 'target-a',
  email: 'target@example.test',
  first_name: 'Tara',
  last_name: 'Target',
  role: 'MEMBER',
  avatar_url: 'avatar-a',
  status: 'active',
  created_at: '2026-09-17T00:00:00.000Z',
  organization_id: 'org-a',
};

describe('GET /api/users/:id organization directory payload', () => {
  beforeEach(() => {
    state.actor = { id: 'member-a', organizationId: 'org-a', role: 'MEMBER' };
    state.dbGet.mockReset();
    state.dbAll.mockReset();
    state.dbRun.mockReset();
  });

  it('returns minimal same-org person payload without email for MEMBER', async () => {
    state.dbGet.mockResolvedValueOnce(sameOrgUser);

    const res = await request(app()).get('/api/users/target-a');

    expect(res.status).toBe(200);
    expect(state.dbGet.mock.calls[0][0]).toContain('WHERE id = ? AND organization_id = ?');
    expect(state.dbGet.mock.calls[0][1]).toEqual(['target-a', 'org-a']);
    expect(res.body.data).toMatchObject({
      id: 'target-a',
      userId: 'target-a',
      displayName: 'Tara Target',
      avatarUrl: 'avatar-a',
    });
    expect(JSON.stringify(res.body.data)).not.toContain('target@example.test');
  });

  it('keeps full same-org person payload for OWNER', async () => {
    state.actor = { id: 'owner-a', organizationId: 'org-a', role: 'OWNER' };
    state.dbGet.mockResolvedValueOnce(sameOrgUser);

    const res = await request(app()).get('/api/users/target-a');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 'target-a',
      email: 'target@example.test',
      displayName: 'Tara Target',
      organizationId: 'org-a',
    });
  });

  it('denies a MEMBER when the user id exists only outside the actor organization', async () => {
    state.dbGet.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'target-b' });

    const res = await request(app()).get('/api/users/target-b');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('USERS_READ_FORBIDDEN');
    expect(state.dbGet.mock.calls[0][0]).toContain('WHERE id = ? AND organization_id = ?');
    expect(state.dbGet.mock.calls[0][1]).toEqual(['target-b', 'org-a']);
  });
});
