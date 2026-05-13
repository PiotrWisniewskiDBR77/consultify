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

  it('rejects with invalid confirmation type when confirmation is present but not boolean/string', async () => {
    const req = mockReq({ confirmation: 1 as any, reason: 'Typed confirmation is required' });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(428);
    expect(res.body.code).toBe('CONFIRMATION_INVALID_TYPE');
  });

  it('does not throw and returns confirmation required when req.body is null', async () => {
    const req = mockReq({}, { body: null });
    const res = mockRes();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(428);
    expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('does not throw and returns confirmation required when req.body is an array', async () => {
    const req = mockReq({}, { body: ['unexpected'] as any });
    const res = mockRes();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(428);
    expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('ignores inherited confirmation and reason properties from prototype chain', async () => {
    const prototypeBody = { confirmation: true, reason: 'prototype reason should be ignored' };
    const req = mockReq({}, { body: Object.create(prototypeBody) });
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

  it('rejects with invalid reason type when reason is present but non-string', async () => {
    const req = mockReq({ confirmation: true, reason: 12345 as any });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('REASON_INVALID_TYPE');
  });

  it('rejects with too-short reason', async () => {
    const req = mockReq({ confirmation: true, reason: 'ab' });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
  });

  it('rejects reason composed only of zero-width characters', async () => {
    const req = mockReq({ confirmation: true, reason: '\u200b\u200b\u200b' });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('REASON_REQUIRED');
  });

  it('rejects with too-long reason', async () => {
    const req = mockReq({ confirmation: true, reason: 'a'.repeat(4001) });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
    expect(res.body.code).toBe('REASON_TOO_LONG');
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

  it('accepts reason at max allowed length', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'a'.repeat(4000) });
    const res = mockRes();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('rejects confirmation string "false" as not explicitly confirmed', async () => {
    const req = mockReq({ confirmation: 'false', reason: 'Looks true but should fail' });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(428);
    expect(res.body.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('accepts confirmation string "true" with valid reason', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: 'true', reason: 'Explicit string confirmation path' });
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

  it('does not send AUDIT_UNAVAILABLE JSON when headers are already sent on audit failure', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'Fail-closed headers path' });
    const res = mockRes();
    const jsonSpy = vi.spyOn(res, 'json');
    (mockRun as any).mockImplementationOnce(async () => {
      (res as any).headersSent = true;
      throw new Error('DB down');
    });

    await expect(middleware(req, res, next)).resolves.toBeUndefined();

    expect(jsonSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('uses req.user.id fallback when req.userId accessor throws', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'Fallback admin id path' }, { userId: undefined });
    Object.defineProperty(req, 'userId', {
      configurable: true,
      get: () => {
        throw new Error('userId getter failed');
      },
    });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['admin-1', 'delete_organization'])
    );
  });

  it('blocks confirmed action when admin identity cannot be resolved', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq(
      { confirmation: true, reason: 'Identity is required for audit binding' },
      { userId: '   ', user: undefined }
    );
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('ADMIN_IDENTITY_REQUIRED');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('does not crash when req.params accessor throws', async () => {
    const req = mockReq({ confirmation: true, reason: 'Params accessor throw test' });
    Object.defineProperty(req, 'params', {
      configurable: true,
      get: () => {
        throw new Error('params getter failed');
      },
    });
    const res = mockRes();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('uses fallback metadata JSON when JSON.stringify throws', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('stringify failed');
    });
    const req = mockReq({ confirmation: true, reason: 'Fallback metadata path' });
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockRun).toHaveBeenCalledTimes(1);
    const params = (mockRun as any).mock.calls[0][1] as unknown[];
    expect(params[9]).toBe('{"method":"UNKNOWN","path":""}');
    stringifySpy.mockRestore();
  });

  it('truncates long method and path metadata values before audit insert', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const longPath = `/${'x'.repeat(5000)}`;
    const req = mockReq(
      { confirmation: true, reason: 'Metadata truncation path' },
      {
        method: 'VERYLONGFAKEMETHODSTRING',
        originalUrl: longPath,
      }
    );
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const params = (mockRun as any).mock.calls[0][1] as unknown[];
    const metadata = JSON.parse(params[9] as string);
    expect(metadata.method.length).toBeLessThanOrEqual(16);
    expect(metadata.path.length).toBeLessThanOrEqual(2048);
    expect(metadata.path).toBe(longPath.slice(0, 2048));
  });

  it('skips next when headers are already sent after audit write', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'Headers already sent path' });
    const res = mockRes();
    (mockRun as any).mockImplementationOnce(async () => {
      res.headersSent = true;
      return undefined;
    });

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('returns immediately when headers were already sent before middleware logic', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq({ confirmation: true, reason: 'Should be ignored' });
    const res = mockRes();
    (res as any).headersSent = true;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
    expect(res.body).toBeNull();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('uses first user-agent value when header arrives as string array', async () => {
    const { run: mockRun } = await import('../../../../server/src/utils/DbPromise.js');
    const req = mockReq(
      { confirmation: true, reason: 'Duplicate UA header path' },
      { headers: { 'user-agent': ['primary-ua', 'ignored-ua'] } }
    );
    const res = mockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    const params = (mockRun as any).mock.calls[0][1] as unknown[];
    expect(params[8]).toBe('primary-ua');
  });
});

describe('requireConfirmation factory validation', () => {
  it('throws for empty action type', () => {
    expect(() => requireConfirmation('')).toThrow();
    expect(() => requireConfirmation('   ')).toThrow();
  });

  it('throws for oversized action type', () => {
    expect(() => requireConfirmation('x'.repeat(129))).toThrow();
  });

  it('throws for invalid risk level', () => {
    expect(() => requireConfirmation('delete_organization', 'severe' as any)).toThrow();
  });
});
