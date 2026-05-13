import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enforceStorageQuota,
  enforceTokenQuota,
  recordStorageAfterUpload,
  recordTokenUsageAfterResponse,
  setDependencies,
} from '../../../../server/src/middleware/quota.middleware.ts';

const { mockUsageService, mockAccessPolicyService, mockLogger } = vi.hoisted(() => ({
  mockUsageService: {
    checkQuota: vi.fn(),
    recordTokenUsage: vi.fn(),
    recordStorageUsage: vi.fn(),
  },
  mockAccessPolicyService: {
    checkAccess: vi.fn(),
  },
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/accessPolicyService.js', () => ({
  default: mockAccessPolicyService,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: mockLogger,
}));

describe('quota.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDependencies({
      usageService: mockUsageService as any,
    });
    mockAccessPolicyService.checkAccess.mockResolvedValue({ allowed: true });
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: true,
      used: 10,
      limit: 100,
      percentage: 10,
    });
  });

  it('returns 401 when organization accessor throws in enforceTokenQuota', async () => {
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to req.organizationId when req.user accessor throws in enforceTokenQuota', async () => {
    const req: any = { organizationId: 'org-fallback' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(mockUsageService.checkQuota).toHaveBeenCalledWith('org-fallback', 'token');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('continues when quota warning header writes throw', async () => {
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: true,
      used: 90,
      limit: 100,
      percentage: 90,
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
    expect(res.status).not.toHaveBeenCalledWith(503);
  });

  it('writes quota warning headers via setHeader fallback when set is unavailable', async () => {
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: true,
      used: 90,
      limit: 100,
      percentage: 90,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const setHeader = vi.fn();
    const res: any = {
      setHeader,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(setHeader).toHaveBeenCalledWith('X-Quota-Warning', 'true');
    expect(setHeader).toHaveBeenCalledWith('X-Quota-Percentage', '90');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not emit warning headers when quota percentage is NaN', async () => {
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: true,
      used: 90,
      limit: 100,
      percentage: Number.NaN,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const setHeader = vi.fn();
    const res: any = {
      setHeader,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('records token usage with safe model fallback when body accessor throws', async () => {
    const req: any = {
      user: { organizationId: 'org-1', id: 'user-1' },
      path: '/api/ai',
    };
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    const res: any = {};

    await recordTokenUsageAfterResponse(req, res, 25, 'ai_call');

    expect(mockUsageService.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      25,
      'ai_call',
      expect.objectContaining({ endpoint: '/api/ai', model: 'default' })
    );
  });

  it('records token usage with req.userId fallback when req.user accessor throws', async () => {
    const req: any = {
      organizationId: 'org-fallback',
      userId: 'user-fallback',
      path: '/api/ai',
      body: { model: 'gpt-5' },
    };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = {};

    await recordTokenUsageAfterResponse(req, res, 42, 'ai_call');

    expect(mockUsageService.recordTokenUsage).toHaveBeenCalledWith(
      'org-fallback',
      'user-fallback',
      42,
      'ai_call',
      expect.objectContaining({ endpoint: '/api/ai', model: 'gpt-5' })
    );
  });

  it('does not record token usage when token count is Infinity', async () => {
    const req: any = {
      user: { organizationId: 'org-1', id: 'user-1' },
      path: '/api/ai',
      body: { model: 'gpt-5' },
    };

    await recordTokenUsageAfterResponse(req, {} as any, Number.POSITIVE_INFINITY, 'ai_call');

    expect(mockUsageService.recordTokenUsage).not.toHaveBeenCalled();
  });

  it('clamps token usage when token count is excessively high', async () => {
    const req: any = {
      user: { organizationId: 'org-1', id: 'user-1' },
      path: '/api/ai',
      body: { model: 'gpt-5' },
    };

    await recordTokenUsageAfterResponse(req, {} as any, 60_000_000, 'ai_call');

    expect(mockUsageService.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      50_000_000,
      'ai_call',
      expect.objectContaining({ endpoint: '/api/ai', model: 'gpt-5' })
    );
  });

  it('truncates recorded token usage action and metadata strings to safety caps', async () => {
    const req: any = {
      user: { organizationId: 'org-1', id: 'user-1' },
      path: `/api/${'x'.repeat(700)}`,
      body: { model: `model-${'y'.repeat(700)}` },
    };

    await recordTokenUsageAfterResponse(req, {} as any, 50, `action-${'z'.repeat(300)}`);

    expect(mockUsageService.recordTokenUsage).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      50,
      expect.stringMatching(/^action-/),
      expect.objectContaining({
        endpoint: expect.any(String),
        model: expect.any(String),
      })
    );
    const call = mockUsageService.recordTokenUsage.mock.calls[0];
    expect(call[3].length).toBe(128);
    expect((call[4] as { endpoint: string; model: string }).endpoint.length).toBe(512);
    expect((call[4] as { endpoint: string; model: string }).model.length).toBe(512);
  });

  it('records storage usage with safe filename when file accessor throws', async () => {
    const req: any = {
      path: '/api/upload',
      user: { organizationId: 'org-1' },
    };
    Object.defineProperty(req, 'file', {
      configurable: true,
      get: () => {
        throw new Error('file getter failed');
      },
    });

    await recordStorageAfterUpload(req, 1024, 'upload');

    expect(mockUsageService.recordStorageUsage).toHaveBeenCalledWith(
      'org-1',
      1024,
      'upload',
      expect.objectContaining({ endpoint: '/api/upload', filename: undefined })
    );
  });

  it('does not record storage usage when bytes is Infinity', async () => {
    const req: any = {
      path: '/api/upload',
      user: { organizationId: 'org-1' },
    };

    await recordStorageAfterUpload(req, Number.POSITIVE_INFINITY, 'upload');

    expect(mockUsageService.recordStorageUsage).not.toHaveBeenCalled();
  });

  it('truncates recorded storage usage action and metadata strings to safety caps', async () => {
    const req: any = {
      path: `/upload/${'x'.repeat(700)}`,
      user: { organizationId: 'org-1' },
      file: { originalname: `file-${'y'.repeat(700)}.txt` },
    };

    await recordStorageAfterUpload(req, 2048, `upload-${'z'.repeat(300)}`);

    expect(mockUsageService.recordStorageUsage).toHaveBeenCalledWith(
      'org-1',
      2048,
      expect.stringMatching(/^upload-/),
      expect.objectContaining({
        endpoint: expect.any(String),
        filename: expect.any(String),
      })
    );
    const call = mockUsageService.recordStorageUsage.mock.calls[0];
    expect(call[2].length).toBe(128);
    expect((call[3] as { endpoint: string; filename: string }).endpoint.length).toBe(512);
    expect((call[3] as { endpoint: string; filename: string }).filename.length).toBe(512);
  });

  it('falls back to req.organizationId when req.user accessor throws in enforceStorageQuota', async () => {
    const req: any = { organizationId: 'org-storage-fallback' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(mockUsageService.checkQuota).toHaveBeenCalledWith('org-storage-fallback', 'storage');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(401);
  });

  it('does not attempt token 503 response when headers are already sent', async () => {
    mockUsageService.checkQuota.mockRejectedValue(new Error('quota service down'));
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not attempt storage 503 response when headers are already sent', async () => {
    mockUsageService.checkQuota.mockImplementation(
      async (_orgId: string, type: 'token' | 'storage') => {
        if (type === 'storage') throw new Error('storage quota service down');
        return { allowed: true, used: 1, limit: 100, percentage: 1 };
      }
    );
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(503);
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns finite storage usage values when quota payload contains NaN numbers', async () => {
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: false,
      used: Number.NaN,
      limit: Number.NaN,
      percentage: Number.NaN,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: {
          usedGB: '0.00',
          limitGB: '0.00',
          percentage: 0,
        },
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns finite token usage values when quota payload contains NaN numbers', async () => {
    mockUsageService.checkQuota.mockResolvedValue({
      allowed: false,
      used: Number.NaN,
      limit: Number.NaN,
      percentage: Number.NaN,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        usage: {
          used: 0,
          limit: 0,
          percentage: 0,
        },
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when token quota payload is malformed', async () => {
    mockUsageService.checkQuota.mockResolvedValueOnce(null as any);
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'QUOTA_CHECK_UNAVAILABLE' })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[QuotaMiddleware] Invalid token quota payload',
      expect.objectContaining({ orgId: 'org-1' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when token access policy payload is malformed', async () => {
    mockAccessPolicyService.checkAccess.mockResolvedValueOnce(null);
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceTokenQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACCESS_POLICY_UNAVAILABLE' })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[QuotaMiddleware] Invalid access policy payload',
      expect.objectContaining({ orgId: 'org-1' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when storage quota payload is malformed', async () => {
    mockUsageService.checkQuota.mockImplementation(async (_orgId: string, type: 'token' | 'storage') => {
      if (type === 'storage') return undefined as any;
      return { allowed: true, used: 1, limit: 100, percentage: 1 };
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'STORAGE_QUOTA_CHECK_UNAVAILABLE' })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[QuotaMiddleware] Invalid storage quota payload',
      expect.objectContaining({ orgId: 'org-1' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when storage access policy payload is malformed', async () => {
    mockAccessPolicyService.checkAccess.mockResolvedValueOnce({ allowed: 'yes' });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await enforceStorageQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'ACCESS_POLICY_UNAVAILABLE' })
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      '[QuotaMiddleware] Invalid access policy payload',
      expect.objectContaining({ orgId: 'org-1' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('records storage usage with req.organizationId fallback when req.user accessor throws', async () => {
    const req: any = { organizationId: 'org-upload-fallback', path: '/api/upload' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });

    await recordStorageAfterUpload(req, 2048, 'upload');

    expect(mockUsageService.recordStorageUsage).toHaveBeenCalledWith(
      'org-upload-fallback',
      2048,
      'upload',
      expect.objectContaining({ endpoint: '/api/upload' })
    );
  });
});
