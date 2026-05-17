import { beforeEach, describe, expect, it, vi } from 'vitest';

const usageServiceMock = vi.hoisted(() => ({
  checkQuota: vi.fn(),
  recordTokenUsage: vi.fn(),
  recordStorageUsage: vi.fn(),
}));

vi.mock('../../../../server/src/services/usageService.js', () => ({
  default: usageServiceMock,
}));

import {
  enforceStorageQuota,
  enforceTokenQuota,
  recordStorageAfterUpload,
  recordTokenUsageAfterResponse,
} from '../../../../server/src/middleware/quotaMiddleware';

describe('quotaMiddleware runtime hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usageServiceMock.checkQuota.mockResolvedValue({
      allowed: true,
      used: 1,
      limit: 100,
      percentage: 1,
    });
  });

  it('enforceTokenQuota supports legacy user.organization_id', async () => {
    const req: any = { user: { organization_id: 'org-legacy' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(usageServiceMock.checkQuota).toHaveBeenCalledWith('org-legacy', 'token');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('enforceTokenQuota does not throw when next is missing', async () => {
    const req: any = { user: { organizationId: 'org-missing-next' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };

    await expect(enforceTokenQuota(req, res, undefined as any)).resolves.toBeUndefined();

    expect(usageServiceMock.checkQuota).toHaveBeenCalledWith('org-missing-next', 'token');
  });

  it('enforceTokenQuota falls back to req.organizationId when req.user accessor throws', async () => {
    const req: any = { organizationId: 'org-req-fallback' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(usageServiceMock.checkQuota).toHaveBeenCalledWith('org-req-fallback', 'token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('enforceTokenQuota continues when res.set throws while warning headers are emitted', async () => {
    usageServiceMock.checkQuota.mockResolvedValueOnce({
      allowed: true,
      used: 80,
      limit: 100,
      percentage: 80,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      set: vi.fn(() => {
        throw new Error('set failed');
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('recordTokenUsageAfterResponse handles throwing path/body accessors', async () => {
    const req: any = { user: { organizationId: 'org-1', id: 'u-1' } };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });

    await expect(recordTokenUsageAfterResponse(req, {} as any, 42, 'chat')).resolves.toBeUndefined();
    expect(usageServiceMock.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'u-1',
      42,
      'chat',
      expect.objectContaining({ endpoint: 'unknown', model: 'default' })
    );
  });

  it('recordTokenUsageAfterResponse clamps very long model metadata', async () => {
    const req: any = {
      user: { organizationId: 'org-1', id: 'u-1' },
      body: { model: 'm'.repeat(400) },
    };

    await expect(recordTokenUsageAfterResponse(req, {} as any, 1, 'chat')).resolves.toBeUndefined();

    expect(usageServiceMock.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'u-1',
      1,
      'chat',
      expect.objectContaining({ model: 'm'.repeat(256) })
    );
  });

  it('recordTokenUsageAfterResponse falls back to req.userId when req.user accessor throws', async () => {
    const req: any = { organizationId: 'org-1', userId: 'u-fallback' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });

    await expect(recordTokenUsageAfterResponse(req, {} as any, 7, 'chat')).resolves.toBeUndefined();
    expect(usageServiceMock.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'u-fallback',
      7,
      'chat',
      expect.any(Object)
    );
  });

  it('recordStorageAfterUpload uses organizationId fallback and tolerates throwing filename accessor', async () => {
    const req: any = {
      user: { organizationId: 'org-1' },
      file: {},
    };
    Object.defineProperty(req.file, 'originalname', {
      configurable: true,
      get: () => {
        throw new Error('filename getter failed');
      },
    });

    await expect(recordStorageAfterUpload(req, 128, 'upload')).resolves.toBeUndefined();
    expect(usageServiceMock.recordStorageUsage).toHaveBeenCalledWith(
      'org-1',
      128,
      'upload',
      expect.objectContaining({ endpoint: 'unknown', filename: '' })
    );
  });

  it('recordStorageAfterUpload clamps very long filename metadata', async () => {
    const req: any = {
      user: { organizationId: 'org-1' },
      file: { originalname: 'f'.repeat(400) },
    };

    await expect(recordStorageAfterUpload(req, 128, 'upload')).resolves.toBeUndefined();

    expect(usageServiceMock.recordStorageUsage).toHaveBeenCalledWith(
      'org-1',
      128,
      'upload',
      expect.objectContaining({ filename: 'f'.repeat(256) })
    );
  });

  it('enforceStorageQuota returns 401 when organization accessors throw', async () => {
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('enforceTokenQuota calls next when headers are already sent for missing org', async () => {
    const req: any = { user: undefined };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('enforceTokenQuota calls next when headers are already sent for quota exceeded', async () => {
    usageServiceMock.checkQuota.mockResolvedValueOnce({
      allowed: false,
      used: 100,
      limit: 100,
      percentage: 100,
    });
    const req: any = { user: { organizationId: 'org-headers-sent' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('recordTokenUsageAfterResponse skips non-finite token counts', async () => {
    const req: any = { user: { organizationId: 'org-1', id: 'u-1' } };

    await expect(recordTokenUsageAfterResponse(req, {} as any, Number.POSITIVE_INFINITY, 'chat'))
      .resolves.toBeUndefined();

    expect(usageServiceMock.recordTokenUsage).not.toHaveBeenCalled();
  });

  it('recordStorageAfterUpload skips non-finite byte counts', async () => {
    const req: any = { user: { organizationId: 'org-1' } };

    await expect(recordStorageAfterUpload(req, Number.NaN, 'upload')).resolves.toBeUndefined();

    expect(usageServiceMock.recordStorageUsage).not.toHaveBeenCalled();
  });

  it('enforceTokenQuota fail-opens when response status writer throws', async () => {
    usageServiceMock.checkQuota.mockResolvedValueOnce({
      allowed: false,
      used: 100,
      limit: 100,
      percentage: 100,
    });
    const req: any = { user: { organizationId: 'org-status-throw' } };
    const res: any = {
      headersSent: false,
      status: vi.fn(() => {
        throw new Error('status failed');
      }),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('enforceStorageQuota tolerates malformed quota payload shape', async () => {
    usageServiceMock.checkQuota.mockResolvedValueOnce(null);
    const req: any = { user: { organizationId: 'org-malformed' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(429);
  });
});
