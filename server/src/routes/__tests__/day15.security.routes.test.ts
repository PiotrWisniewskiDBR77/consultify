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
}));

async function app() {
  const { default: router } = await import('../security.routes.js');
  const instance = express();
  instance.use(express.json());
  instance.use('/api/security', router);
  return instance;
}

describe('Day 15 S.1/S.2 security request guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actor = { id: 'admin-a', role: 'admin', organizationId: 'org-a' };
  });

  it('returns 401 for the organization session list without a token', async () => {
    actor = null;
    expect((await request(await app()).get('/api/security/sessions/all')).status).toBe(401);
  });

  it('returns 403 for a member requesting all organization sessions', async () => {
    actor = { id: 'member-a', role: 'member', organizationId: 'org-a' };
    dbGet.mockResolvedValueOnce({ role: 'MEMBER' });
    expect((await request(await app()).get('/api/security/sessions/all')).status).toBe(403);
    expect(dbAll).not.toHaveBeenCalled();
  });

  it('returns only sessions selected for the admin token organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
    dbAll.mockResolvedValueOnce([{ id: 'session-a', user_id: 'user-a' }]);
    const response = await request(await app()).get('/api/security/sessions/all');
    expect(response.status).toBe(200);
    expect(response.body.sessions).toHaveLength(1);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('u.organization_id = ?'), ['org-a']);
  });

  it('returns 404 and does not delete a session owned by another organization', async () => {
    dbGet.mockResolvedValueOnce(undefined);
    const response = await request(await app()).delete('/api/security/sessions/session-b');
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('allows deleting the caller own session in the token organization', async () => {
    actor = { id: 'user-a', role: 'member', organizationId: 'org-a' };
    dbGet.mockResolvedValueOnce({ user_id: 'user-a' });
    dbRun.mockResolvedValueOnce({ success: true });
    const response = await request(await app()).delete('/api/security/sessions/session-a');
    expect(response.status).toBe(200);
    expect(dbRun).toHaveBeenCalledOnce();
  });

  it('requires an org admin to delete another local user session', async () => {
    actor = { id: 'member-a', role: 'member', organizationId: 'org-a' };
    dbGet.mockResolvedValueOnce({ user_id: 'user-a' }).mockResolvedValueOnce({ role: 'MEMBER' });
    const response = await request(await app()).delete('/api/security/sessions/session-a');
    expect(response.status).toBe(403);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it('returns 404 and preserves sessions for a user in another organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' }).mockResolvedValueOnce(undefined);
    const response = await request(await app()).delete('/api/security/sessions/user/user-b');
    expect(response.status).toBe(404);
    expect(dbRun).not.toHaveBeenCalled();
  });

  it.each(['/api/security/audit-logs', '/api/security/api-keys/usage'])(
    'returns 403 for a member requesting %s',
    async (path) => {
      actor = { id: 'member-a', role: 'member', organizationId: 'org-a' };
      dbGet.mockResolvedValueOnce({ role: 'MEMBER' });
      expect((await request(await app()).get(path)).status).toBe(403);
      expect(dbAll).not.toHaveBeenCalled();
    }
  );

  it('filters audit logs by the token organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
    dbAll.mockResolvedValueOnce([{ id: 'log-a', organization_id: 'org-a' }]);
    const response = await request(await app()).get('/api/security/audit-logs');
    expect(response.status).toBe(200);
    expect(response.body.logs).toHaveLength(1);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('al.organization_id = ?'), [
      'org-a',
    ]);
  });

  it('returns an honest empty audit-log state', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER' });
    dbAll.mockResolvedValueOnce([]);
    expect((await request(await app()).get('/api/security/audit-logs')).body.logs).toEqual([]);
  });

  it('filters API usage by the token organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
    dbAll.mockResolvedValueOnce([{ api_key_id: 'key-a', total_calls: 2 }]);
    const response = await request(await app()).get('/api/security/api-keys/usage');
    expect(response.status).toBe(200);
    expect(response.body.usage).toHaveLength(1);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('WHERE organization_id = ?'), [
      'org-a',
    ]);
  });

  it('returns an honest empty API-usage state', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER' });
    dbAll.mockResolvedValueOnce([]);
    expect((await request(await app()).get('/api/security/api-keys/usage')).body.usage).toEqual([]);
  });
});
