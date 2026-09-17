/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  actor: { id: 'member-a', organizationId: 'org-a', role: 'MEMBER' },
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  queryRun: vi.fn(),
  dbAll: vi.fn(),
  dbGet: vi.fn(),
  dbRun: vi.fn(),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = state.actor;
    next();
  },
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...args: any[]) => state.queryOne(...args),
  queryAll: (...args: any[]) => state.queryAll(...args),
  queryRun: (...args: any[]) => state.queryRun(...args),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => state.dbAll(...args),
  get: (...args: any[]) => state.dbGet(...args),
  run: (...args: any[]) => state.dbRun(...args),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import usersRouter from '../user/users.routes.js';

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

describe('mounted /api/users organization directory payload', () => {
  beforeEach(() => {
    state.actor = { id: 'member-a', organizationId: 'org-a', role: 'MEMBER' };
    state.queryOne.mockReset();
    state.queryAll.mockReset();
    state.queryRun.mockReset();
    state.dbAll.mockReset();
    state.dbGet.mockReset();
    state.dbRun.mockReset();
  });

  it('returns a minimal same-org person without private or credential fields for MEMBER', async () => {
    state.queryOne.mockResolvedValueOnce(sameOrgUser);

    const res = await request(app()).get('/api/users/target-a');

    expect(res.status).toBe(200);
    const sql = String(state.queryOne.mock.calls[0][0]);
    expect(sql).toContain('WHERE id = ? AND organization_id = ?');
    expect(sql).not.toContain('SELECT *');
    expect(state.queryOne.mock.calls[0][1]).toEqual(['target-a', 'org-a']);
    expect(res.body).toMatchObject({
      id: 'target-a',
      userId: 'target-a',
      displayName: 'Tara Target',
      avatarUrl: 'avatar-a',
    });
    expect(JSON.stringify(res.body)).not.toMatch(
      /target@example\.test|password|mfa_secret|mfa_backup_codes/
    );
  });

  it('keeps email for OWNER but never selects or returns credential fields', async () => {
    state.actor = { id: 'owner-a', organizationId: 'org-a', role: 'OWNER' };
    state.queryOne.mockResolvedValueOnce(sameOrgUser);

    const res = await request(app()).get('/api/users/target-a');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: 'target-a',
      email: 'target@example.test',
      displayName: 'Tara Target',
      organizationId: 'org-a',
    });
    expect(String(state.queryOne.mock.calls[0][0])).not.toContain('SELECT *');
    expect(JSON.stringify(res.body)).not.toMatch(/password|mfa_secret|mfa_backup_codes/);
  });

  it('denies a MEMBER when the user id exists only outside the actor organization', async () => {
    state.queryOne.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 'target-b' });

    const res = await request(app()).get('/api/users/target-b');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('USERS_READ_FORBIDDEN');
    expect(state.queryOne.mock.calls[0][1]).toEqual(['target-b', 'org-a']);
  });

  it('keeps a genuinely missing id as 404', async () => {
    state.queryOne.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    const res = await request(app()).get('/api/users/missing');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  it('mounts /search before /:id and returns member-visible names without email', async () => {
    state.dbAll.mockResolvedValueOnce([
      {
        id: 'target-a',
        email: 'target@example.test',
        first_name: 'Tara',
        last_name: 'Target',
        avatar_url: 'avatar-a',
      },
    ]);

    const res = await request(app()).get('/api/users/search?q=tar&limit=8');

    expect(res.status).toBe(200);
    expect(state.queryOne).not.toHaveBeenCalled();
    expect(state.dbAll.mock.calls[0][1]).toEqual(['org-a', '%tar%', '%tar%', '%tar%', '%tar%', 8]);
    expect(res.body.users).toEqual([
      {
        id: 'target-a',
        name: 'Tara Target',
        displayName: 'Tara Target',
        avatarUrl: 'avatar-a',
      },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/target@example\.test|password|mfa_/);
  });
});
