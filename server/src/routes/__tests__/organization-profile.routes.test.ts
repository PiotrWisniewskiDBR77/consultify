import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/organization-profile.routes.js';

const dbGet = vi.fn();
const dbRun = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).end();
    req.user = user;
    next();
  },
}));
vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/admin/organization-profile', routes);
  return a;
};

describe('organization profile admin route', () => {
  beforeEach(() => {
    user = { id: 'u1', organizationId: 'org-1', role: 'admin' };
    dbGet.mockReset();
    dbRun.mockReset();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('requires auth', async () => {
    user = null;
    expect((await request(app()).get('/api/admin/organization-profile')).status).toBe(401);
  });

  it('denies non-admin membership', async () => {
    dbGet.mockResolvedValueOnce({ role: 'MEMBER', status: 'ACTIVE' });
    expect((await request(app()).get('/api/admin/organization-profile')).status).toBe(403);
  });

  it('reads the token organization only, ignoring any URL or body org hint', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }) // membership check
      .mockResolvedValueOnce({ default_timezone: 'Europe/Warsaw', default_language: 'pl' }) // org row
      .mockResolvedValueOnce({ setting_value: JSON.stringify({ dateFormat: 'DD/MM/YYYY' }) }); // branding
    const res = await request(app()).get('/api/admin/organization-profile');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      profile: {
        defaultTimezone: 'Europe/Warsaw',
        defaultLanguage: 'pl',
        dateFormat: 'DD/MM/YYYY',
      },
    });
    expect(dbGet).toHaveBeenNthCalledWith(
      2,
      'SELECT default_timezone, default_language FROM organizations WHERE id = ?',
      ['org-1'],
      { fallback: false }
    );
  });

  it('scopes the update to the token organization and preserves other branding fields', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }) // membership check
      .mockResolvedValueOnce({
        setting_value: JSON.stringify({ dateFormat: 'DD/MM/YYYY', logoUrl: 'https://x/logo.png' }),
      }); // branding read before merge
    const res = await request(app())
      .put('/api/admin/organization-profile')
      .send({ defaultTimezone: 'UTC', defaultLanguage: 'en', dateFormat: 'YYYY-MM-DD' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const orgUpdateCall = dbRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE organizations')
    );
    expect(orgUpdateCall?.[1]).toEqual(['UTC', 'en', 'org-1']);

    const brandingCall = dbRun.mock.calls.find((call) =>
      String(call[0]).includes('organization_settings')
    );
    expect(brandingCall?.[1][0]).toBe('org-1');
    expect(JSON.parse(brandingCall?.[1][1])).toEqual({
      dateFormat: 'YYYY-MM-DD',
      logoUrl: 'https://x/logo.png',
    });
  });

  it('never accepts an organization id from the request body', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    const res = await request(app())
      .put('/api/admin/organization-profile')
      .send({ organizationId: 'org-attacker', defaultTimezone: 'UTC' });
    expect(res.status).toBe(200);
    const orgUpdateCall = dbRun.mock.calls.find((call) =>
      String(call[0]).includes('UPDATE organizations')
    );
    expect(orgUpdateCall?.[1]).toEqual(['UTC', null, 'org-1']);
  });
});
