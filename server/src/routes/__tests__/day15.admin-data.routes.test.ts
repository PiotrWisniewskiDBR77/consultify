import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
let actor: { id: string; role: string; organizationId: string } | null;

vi.mock('../../utils/DbPromise.js', () => ({ all: dbAll, get: dbGet, run: dbRun }));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!actor) return res.status(401).json({ error: 'No token' });
    req.user = actor;
    next();
  },
  requireRole:
    (...roles: string[]) =>
    (req: any, res: any, next: () => void) =>
      roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Forbidden' }),
}));
vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
  validateParams: () => (_req: any, _res: any, next: () => void) => next(),
  validateQuery: () => (_req: any, _res: any, next: () => void) => next(),
}));

async function app() {
  const { default: router } = await import('../admin-data.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/admin-data', router);
  return instance;
}

describe('Day 15 S.3 admin-data request isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor = { id: 'admin-a', role: 'admin', organizationId: 'org-a' };
    dbRun.mockResolvedValue({ success: true });
  });

  it('returns 404 and preserves a foreign security event', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-b' });
    const response = await request(await app())
      .put('/api/admin-data/security-events/event-b/resolve')
      .send({ resolved: true });
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('resolves a security event owned by the token organization', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-a' });
    const response = await request(await app())
      .put('/api/admin-data/security-events/event-a/resolve')
      .send({ resolved: true });
    expect(response.status).toBe(200);
    expect(dbRun).toHaveBeenCalledOnce();
  });

  it('returns 404 and preserves a foreign session', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-b' });
    const response = await request(await app()).delete('/api/admin-data/sessions/session-b');
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('deletes a session owned by the token organization with defense in depth', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-a' });
    const response = await request(await app()).delete('/api/admin-data/sessions/session-a');
    expect(response.status).toBe(200);
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('u.organization_id = ?'), [
      'session-a',
      'org-a',
    ]);
  });

  it('returns 404 and does not update a foreign scheduled event', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-b' });
    const response = await request(await app())
      .put('/api/admin-data/scheduled-events/event-b')
      .send({ title: 'Changed' });
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('returns 404 and does not delete a foreign scheduled event', async () => {
    dbGet.mockResolvedValueOnce({ organization_id: 'org-b' });
    const response = await request(await app()).delete('/api/admin-data/scheduled-events/event-b');
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('preserves the explicit superadmin cross-organization exception', async () => {
    actor = { id: 'root', role: 'super_admin', organizationId: 'platform' };
    dbGet.mockResolvedValueOnce({ organization_id: 'org-b' });
    const response = await request(await app()).delete('/api/admin-data/sessions/session-b');
    expect(response.status).toBe(200);
    expect(dbRun).toHaveBeenCalledWith('DELETE FROM user_sessions WHERE id = ?', ['session-b']);
  });
});
