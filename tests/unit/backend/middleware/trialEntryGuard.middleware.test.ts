import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requireOrgContext,
  trialEntryGuard,
} from '../../../../server/src/middleware/trialEntryGuard.middleware.ts';

const mockDbGet = vi.hoisted(() => vi.fn());

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: mockDbGet,
}));

describe('trialEntryGuard.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues when user id accessor throws', async () => {
    const req: any = { user: {} };
    Object.defineProperty(req.user, 'id', {
      configurable: true,
      get: () => {
        throw new Error('id getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks blocked route for trial entry users', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('treats normalized trial_entry status from DB as trial and blocks', async () => {
    mockDbGet.mockResolvedValue({ user_status: '  trial_entry  ' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks mounted route using baseUrl plus path', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      baseUrl: '/api',
      path: '/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks route when path has duplicate slashes', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '//api//initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('coerces numeric user id and applies trial restrictions', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 999 },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).toHaveBeenCalledWith(expect.any(String), ['999']);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('coerces numeric user id and allows non-trial users', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'ACTIVE' });
    const req: any = {
      user: { id: 1234 },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).toHaveBeenCalledWith(expect.any(String), ['1234']);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('coerces bigint user id and applies trial restrictions', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: BigInt(42) },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).toHaveBeenCalledWith(expect.any(String), ['42']);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('skips trial lookup for OPTIONS requests', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'OPTIONS',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips trial lookup for HEAD requests', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'HEAD',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips trial lookup for TRACE requests', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'TRACE',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('skips trial lookup for oversized normalized user id', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: ` ${'u'.repeat(513)} ` },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks route when path includes query string', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/initiatives?foo=bar',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when trial user sends oversized request path', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: `/${'a'.repeat(8200)}`,
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'REQUEST_URI_TOO_LONG',
      })
    );
    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for oversized request path without trial lookup for active users', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'ACTIVE' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: `/${'b'.repeat(8200)}`,
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'REQUEST_URI_TOO_LONG',
      })
    );
    expect(mockDbGet).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for trial users when method normalizes to empty string', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: '   ',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_HTTP_METHOD',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for active users when method normalizes to empty string without DB lookup', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'ACTIVE' });
    const req: any = {
      user: { id: 'u-1' },
      method: '   ',
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_HTTP_METHOD',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when method exceeds max supported length without DB lookup', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: `P${'O'.repeat(100)}ST`,
      path: '/api/initiatives',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(mockDbGet).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'HTTP_METHOD_TOO_LONG',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks organization invite route with single org segment', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/organizations/org-1/invite',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks organization invite route with nested org segments', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/organizations/parent/child/invite',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('blocks reports export route for trial users', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'GET',
      path: '/api/reports/r-1/export',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not block when path accessor throws', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
    };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks route when originalUrl carries blocked path and mounted path is benign', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      baseUrl: '/health',
      path: '/ok',
      originalUrl: '/api/initiatives?source=proxy',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgContext denies when organizationId accessor throws', async () => {
    const req: any = { user: {} };
    Object.defineProperty(req.user, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await requireOrgContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgContext handles throwing isTrialEntry accessor and falls through to org check', async () => {
    const req: any = { user: { organizationId: 'org-1' } };
    Object.defineProperty(req, 'isTrialEntry', {
      configurable: true,
      get: () => {
        throw new Error('isTrialEntry getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await requireOrgContext(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireOrgContext forwards to next(error) when next throws unexpectedly', async () => {
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('next failed');
      })
      .mockImplementationOnce(() => undefined);

    await requireOrgContext(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[1][0]).toBeInstanceOf(Error);
  });

  it('does not write response when blocked trial route already sent headers', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await trialEntryGuard(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireOrgContext does not write when headers are already sent', async () => {
    const req: any = { isTrialEntry: true, user: {} };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await requireOrgContext(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not throw when response json writer fails on blocked trial route', async () => {
    mockDbGet.mockResolvedValue({ user_status: 'TRIAL_ENTRY' });
    const req: any = {
      user: { id: 'u-1' },
      method: 'POST',
      path: '/api/initiatives',
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(trialEntryGuard(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toContain('TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
  });

  it('requireOrgContext forwards to next(error) when org-required response writer fails', async () => {
    const req: any = { isTrialEntry: true, user: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(requireOrgContext(req, res, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toContain('TRIAL_ENTRY_GUARD_RESPONSE_FAILED');
  });
});
