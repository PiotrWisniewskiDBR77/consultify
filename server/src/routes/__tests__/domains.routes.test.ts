import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import routes, { clearDomainVerificationRateLimitsForTests } from '../admin/domains.routes.js';

const dbGet = vi.fn();
const dbAll = vi.fn();
const dbRun = vi.fn();
const verify = vi.fn();
const audit = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'admin' };

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
  all: (...args: any[]) => dbAll(...args),
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
vi.mock('../../services/domainVerificationService.js', () => ({
  verifyDomainTxt: (...args: any[]) => verify(...args),
}));
vi.mock('../../services/auditService.js', () => ({
  logAdminAction: (...args: any[]) => audit(...args),
}));

const app = () => {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/admin/domains', routes);
  return instance;
};

describe('admin domains route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDomainVerificationRateLimitsForTests();
    user = { id: 'u1', organizationId: 'org-1', role: 'admin' };
    dbGet.mockResolvedValue({ role: 'ADMIN', status: 'ACTIVE' });
    dbAll.mockResolvedValue([]);
    dbRun.mockResolvedValue(undefined);
  });

  it('denies a user without an active admin membership', async () => {
    dbGet.mockResolvedValue({ role: 'MEMBER', status: 'ACTIVE' });
    expect((await request(app()).get('/api/admin/domains')).status).toBe(403);
  });

  it('lists only domains for the organization from the token', async () => {
    const response = await request(app()).get('/api/admin/domains');
    expect(response.status).toBe(200);
    expect(dbAll).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), ['org-1'], {
      fallback: false,
    });
  });

  it('returns 404 when a domain id belongs to another organization', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' }).mockResolvedValueOnce(null);
    const response = await request(app()).post('/api/admin/domains/foreign/verify');
    expect(response.status).toBe(404);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    ['post', '/api/admin/domains', { domain: 'example.com', autoJoin: true }, 'domain_created'],
    ['put', '/api/admin/domains/d1', { autoJoin: true }, 'domain_auto_join_updated'],
    ['delete', '/api/admin/domains/d1', undefined, 'domain_deleted'],
  ] as const)('audits the successful %s mutation', async (method, path, body, action) => {
    dbGet.mockReset();
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce(
        method === 'post' ? null : { id: 'd1', domain: 'example.com', auto_join: 0, verified: 1 }
      );
    const call = request(app())[method](path);
    const response = body ? await call.send(body) : await call;
    expect(response.status).toBe(method === 'post' ? 201 : method === 'delete' ? 204 : 200);
    expect(audit).toHaveBeenCalledWith(
      action,
      'approved_domain',
      expect.objectContaining({ organizationId: 'org-1', result: 'success' })
    );
  });

  it('persists verification and audits only after a real match', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'd1', domain: 'example.com', verification_token: 'abc' });
    verify.mockResolvedValue({
      status: 'verified',
      checkedNames: ['_consultify-verification.example.com', 'example.com'],
      foundRecordCount: 1,
      checkedAt: '2026-08-25T05:00:00.000Z',
    });
    expect((await request(app()).post('/api/admin/domains/d1/verify')).status).toBe(200);
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('verified = 1'), ['d1', 'org-1'], {
      fallback: false,
    });
    expect(audit).toHaveBeenCalledOnce();
  });

  it('does not persist a mismatch and rate-limits another immediate check', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'd1', domain: 'example.com', verification_token: 'abc' })
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    verify.mockResolvedValue({
      status: 'token_mismatch',
      checkedNames: [],
      foundRecordCount: 1,
      checkedAt: '2026-08-25T05:00:00.000Z',
    });
    expect((await request(app()).post('/api/admin/domains/d1/verify')).status).toBe(200);
    expect(dbRun).not.toHaveBeenCalledWith(
      expect.stringContaining('verified = 1'),
      expect.anything(),
      expect.anything()
    );
    expect((await request(app()).post('/api/admin/domains/d1/verify')).status).toBe(429);
  });
});
