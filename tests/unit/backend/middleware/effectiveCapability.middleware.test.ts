import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockResolveEffectiveAccess,
  mockHasEffectiveCapability,
  mockQueryOne,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveEffectiveAccess: vi.fn(),
  mockHasEffectiveCapability: vi.fn(),
  mockQueryOne: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: mockResolveEffectiveAccess,
  hasEffectiveCapability: mockHasEffectiveCapability,
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: mockQueryOne,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

import {
  requireAnyProjectCapability,
  requireProjectCapability,
  resolveProjectIdFromRequest,
  resolveTaskProjectId,
} from '../../../../server/src/middleware/effectiveCapability.middleware.ts';

describe('effectiveCapability.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'true';
    delete process.env.EFFECTIVE_ACCESS_SHADOW;
    mockResolveEffectiveAccess.mockResolvedValue({ scope: 'ok' });
    mockHasEffectiveCapability.mockReturnValue(true);
    mockQueryOne.mockResolvedValue(null);
  });

  it('resolves project id from params/body/query in priority order', async () => {
    const req: any = {
      params: { projectId: 'p-1', id: 'p-fallback' },
      body: { projectId: 'p-body' },
      query: { projectId: 'p-query' },
    };
    await expect(resolveProjectIdFromRequest(req)).resolves.toBe('p-1');
  });

  it('returns 401 when user context is missing', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {};
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when project context is missing and allowWithoutProject=false', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when requireProjectCapability receives whitespace capability', async () => {
    const middleware = requireProjectCapability('   ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CAPABILITY_INVALID' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockResolveEffectiveAccess).not.toHaveBeenCalled();
  });

  it('allows request and attaches effectiveAccess when capability is present', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
      user: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockResolveEffectiveAccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', organizationId: 'org-1', projectId: 'p-1' })
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.effectiveAccess).toEqual({ scope: 'ok' });
  });

  it('returns 403 when capability is missing in enforce mode', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('enforces when EFFECTIVE_ACCESS_ENFORCE has mixed casing and whitespace', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = ' TRUE ';
    delete process.env.EFFECTIVE_ACCESS_SHADOW;
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when custom project resolver returns non-string truthy value', async () => {
    const middleware = requireProjectCapability('PROJECT_READ', async () => 123 as unknown as string);
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROJECT_CONTEXT_REQUIRED' })
    );
    expect(mockResolveEffectiveAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not attempt deny write when response is already committed', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] response already committed; skipping json write',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
  });

  it('does not attempt deny write when response state accessors throw (assume committed)', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    Object.defineProperty(res, 'headersSent', {
      configurable: true,
      get: () => {
        throw new Error('headersSent getter failed');
      },
    });
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] response already committed; skipping json write',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
  });

  it('does not attempt deny write when response writableFinished is already true', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      headersSent: false,
      writableFinished: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] response already committed; skipping json write',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
  });

  it('does not attempt deny write when response finished is already true', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      headersSent: false,
      finished: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] response already committed; skipping json write',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
  });

  it('stays fail-open in shadow mode when capability is missing', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs next() sync throws on allow path without rethrowing', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('next sync throw');
      })
      .mockImplementationOnce(() => undefined);

    await expect(middleware(req, res, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[1]?.[0]).toBeInstanceOf(Error);
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] next() threw synchronously',
      expect.objectContaining({ phase: 'allow', capability: 'PROJECT_READ' })
    );
  });

  it('logs next() promise rejections on allow path without rethrowing', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const rejection = new Error('next rejected');
    const next = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(rejection))
      .mockImplementationOnce(() => undefined);

    await expect(middleware(req, res, next)).resolves.toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();

    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[1]?.[0]).toBe(rejection);
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] next() returned rejected promise',
      expect.objectContaining({ phase: 'allow', capability: 'PROJECT_READ' })
    );
  });

  it('enables shadow mode when EFFECTIVE_ACCESS_SHADOW has mixed casing', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'TrUe';
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('resolveTaskProjectId falls back to direct project resolver when task id missing', async () => {
    const req: any = { params: { projectId: 'p-direct' }, body: {}, query: {} };
    await expect(resolveTaskProjectId(req)).resolves.toBe('p-direct');
  });

  it('resolveTaskProjectId skips db lookup when task id is oversized and falls back to direct project id', async () => {
    const req: any = {
      params: { taskId: 't'.repeat(129), projectId: 'p-direct' },
      body: {},
      query: {},
    };
    await expect(resolveTaskProjectId(req)).resolves.toBe('p-direct');
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('resolveProjectIdFromRequest rejects ambiguous multi-value query projectId', async () => {
    const req: any = {
      params: {},
      body: {},
      query: { projectId: ['p-a', 'p-b'] },
    };
    await expect(resolveProjectIdFromRequest(req)).resolves.toBeNull();
  });

  it('returns 400 when project context is ambiguous multi-value query projectId in enforce mode', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: { projectId: ['p-a', 'p-b'] },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROJECT_CONTEXT_REQUIRED' })
    );
    expect(mockResolveEffectiveAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('resolveProjectIdFromRequest tolerates throwing params/body/query accessors', async () => {
    const req: any = {};
    Object.defineProperty(req, 'params', {
      configurable: true,
      get: () => {
        throw new Error('params getter failed');
      },
    });
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    Object.defineProperty(req, 'query', {
      configurable: true,
      get: () => {
        throw new Error('query getter failed');
      },
    });
    await expect(resolveProjectIdFromRequest(req)).resolves.toBeNull();
  });

  it('requireProjectCapability returns 401 when user accessor throws', async () => {
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('shadow mode logs with empty path when path accessor throws', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    Object.defineProperty(req, 'path', {
      configurable: true,
      get: () => {
        throw new Error('path getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] shadow capability mismatch',
      expect.objectContaining({ path: '' })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when resolveEffectiveAccess rejects in enforce mode', async () => {
    mockResolveEffectiveAccess.mockRejectedValueOnce(new Error('access service down'));
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EFFECTIVE_ACCESS_CHECK_FAILED' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('stays fail-open in shadow mode when resolveEffectiveAccess rejects', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    mockResolveEffectiveAccess.mockRejectedValueOnce(new Error('access service down'));
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('returns 503 when custom project resolver throws in enforce mode', async () => {
    const middleware = requireProjectCapability('PROJECT_READ', async () => {
      throw new Error('project resolver failed');
    });
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EFFECTIVE_ACCESS_CHECK_FAILED' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] resolveProjectId failed',
      expect.objectContaining({ capability: 'PROJECT_READ' })
    );
  });

  it('stays fail-open in shadow mode when custom project resolver throws', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    const middleware = requireProjectCapability('PROJECT_READ', async () => {
      throw new Error('project resolver failed');
    });
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] resolveProjectId failed',
      expect.objectContaining({ capability: 'PROJECT_READ' })
    );
  });

  it('returns 503 when hasEffectiveCapability throws in enforce mode', async () => {
    mockHasEffectiveCapability.mockImplementationOnce(() => {
      throw new Error('capability evaluator failed');
    });
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EFFECTIVE_ACCESS_CHECK_FAILED' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('returns 503 when any-capability resolver throws in enforce mode', async () => {
    const middleware = requireAnyProjectCapability(['PROJECT_READ', 'PROJECT_WRITE'], async () => {
      throw new Error('project resolver failed');
    });
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EFFECTIVE_ACCESS_CHECK_FAILED' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] resolveProjectId failed',
      expect.objectContaining({ capabilities: ['PROJECT_READ', 'PROJECT_WRITE'] })
    );
  });

  it('stays fail-open in shadow mode when any-capability resolver throws', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    const middleware = requireAnyProjectCapability(['PROJECT_READ', 'PROJECT_WRITE'], async () => {
      throw new Error('project resolver failed');
    });
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: {},
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] resolveProjectId failed',
      expect.objectContaining({ capabilities: ['PROJECT_READ', 'PROJECT_WRITE'] })
    );
  });

  it('logs and swallows response writer errors on deny path', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      headersSent: false,
      status: vi.fn(() => {
        throw new Error('status failed');
      }),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] failed to write json response',
      expect.objectContaining({ status: 403, phase: 'deny', path: '' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('skips deny write when response becomes committed between pre-check and write attempt', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    let headersSentReads = 0;
    const res: any = {
      get headersSent() {
        headersSentReads += 1;
        return headersSentReads >= 2;
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[effectiveCapability] response committed before json write; skipping',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
  });

  it('logs and skips deny response when res.status is non-callable', async () => {
    mockHasEffectiveCapability.mockReturnValue(false);
    const middleware = requireProjectCapability('PROJECT_WRITE');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = {
      headersSent: false,
      status: 123,
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();
    expect(mockLoggerError).toHaveBeenCalledWith(
      '[effectiveCapability] response object missing status/json handlers',
      expect.objectContaining({ status: 403, phase: 'deny' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('stays fail-open in shadow mode when hasEffectiveCapability throws', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    mockHasEffectiveCapability.mockImplementationOnce(() => {
      throw new Error('capability evaluator failed');
    });
    const middleware = requireProjectCapability('PROJECT_READ');
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('requireAnyProjectCapability returns 400 for empty capabilities list', async () => {
    const middleware = requireAnyProjectCapability([]);
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CAPABILITY_LIST_INVALID' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockResolveEffectiveAccess).not.toHaveBeenCalled();
  });

  it('requireAnyProjectCapability returns 400 for empty capabilities list in shadow mode', async () => {
    process.env.EFFECTIVE_ACCESS_ENFORCE = 'false';
    process.env.EFFECTIVE_ACCESS_SHADOW = 'true';
    const middleware = requireAnyProjectCapability([]);
    const req: any = {
      userId: 'u-1',
      organizationId: 'org-1',
      userRole: 'ADMIN',
      params: { projectId: 'p-1' },
      body: {},
      query: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(mockResolveEffectiveAccess).not.toHaveBeenCalled();
  });
});
