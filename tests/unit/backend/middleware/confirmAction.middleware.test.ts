import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  run: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('uuid', () => ({ v4: () => 'audit-uuid-001' }));

import { requireConfirmation } from '../../../../server/src/middleware/confirmAction.middleware.js';

function mockReq(body: Record<string, any> = {}, overrides: Record<string, any> = {}) {
  return {
    body,
    userId: 'admin-1',
    user: { id: 'admin-1' },
    params: {},
    method: 'DELETE',
    originalUrl: '/api/superadmin/organizations/org-1',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 0,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
  };
  return res;
}

describe('requireConfirmation', () => {
  const next = vi.fn();
  const middleware = requireConfirmation('delete_organization', 'critical');

  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects without confirmation flag', async () => {
    const req = mockReq({ reason: 'Cleaning up' });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(428);
    expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('rejects without reason', async () => {
    const req = mockReq({ confirmation: true });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('REASON_REQUIRED');
  });

  it('rejects with too-short reason', async () => {
    const req = mockReq({ confirmation: true, reason: 'ab' });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
  });

  it('passes through with confirmation + reason', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'Org is no longer active' });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO superadmin_confirmed_actions'),
      expect.arrayContaining(['audit-uuid-001', 'admin-1', 'delete_organization'])
    );
  });

  it('blocks the action if audit DB write fails (fail-closed)', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    (mockRun as any).mockRejectedValueOnce(new Error('DB down'));
    const req = mockReq({ confirmation: true, reason: 'Testing resilience' });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('AUDIT_UNAVAILABLE');
  });
});
