import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('planLimits.middleware', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses legacy user.organization_id when organizationId accessor throws', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    checkAccess.mockResolvedValue({ allowed: true });
    const middleware = checkPlanLimit('max_projects');

    const req: any = { user: { organization_id: 'org-legacy' } };
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkAccess).toHaveBeenCalledWith('org-legacy', 'create_project');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when organization context is unavailable due to throwing accessors', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = {};
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
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
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      errorCode: 'ORG_CONTEXT_REQUIRED',
      code: 'ORG_CONTEXT_REQUIRED',
    });
    expect(next).not.toHaveBeenCalled();
    expect(checkAccess).not.toHaveBeenCalled();
  });

  it('returns 503 when access policy service has no callable checkAccess', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({} as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit service unavailable',
      errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 for malformed checkAccess response shape', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue(null);
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit service unavailable',
      errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns stable 429 payload when reason/errorCode are malformed', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi
      .fn()
      .mockResolvedValue({ allowed: false, reason: { bad: true }, errorCode: 404 });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit reached',
      errorCode: 'PLAN_LIMIT_REACHED',
      code: 'PLAN_LIMIT_REACHED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when checkAccess returns non-boolean allowed', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: 'false' });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit service unavailable',
      errorCode: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
      code: 'PLAN_LIMIT_CHECK_UNAVAILABLE',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when limit key is empty after trim', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('   ');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit misconfigured',
      errorCode: 'PLAN_LIMIT_KEY_INVALID',
      code: 'PLAN_LIMIT_KEY_INVALID',
    });
    expect(checkAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when limit key exceeds max length after normalization', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('x'.repeat(129));

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Plan limit misconfigured',
      errorCode: 'PLAN_LIMIT_KEY_INVALID',
      code: 'PLAN_LIMIT_KEY_INVALID',
    });
    expect(checkAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 and skips access check when organizationId exceeds max length', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'o'.repeat(129) };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      errorCode: 'ORG_CONTEXT_REQUIRED',
      code: 'ORG_CONTEXT_REQUIRED',
    });
    expect(checkAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not throw when json writer fails on terminal response path', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: false });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('caps oversized deny reason and errorCode strings in 429 payload', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({
      allowed: false,
      reason: 'r'.repeat(2000),
      errorCode: 'e'.repeat(200),
    });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    const payload = res.json.mock.calls[0]?.[0];
    expect(typeof payload.error).toBe('string');
    expect(typeof payload.errorCode).toBe('string');
    expect(typeof payload.code).toBe('string');
    expect(payload.error.length).toBe(512);
    expect(payload.errorCode.length).toBe(64);
    expect(payload.code.length).toBe(64);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards catch-path error when fallback 503 json writer fails and headers remain open', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const boom = new Error('boom');
    const checkAccess = vi.fn().mockRejectedValue(boom);
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    await expect(middleware(req, res, next)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBe(boom);
  });

  it('does not call next and skips checkAccess when response is already committed on allow path', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = {
      headersSent: true,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('skips access policy check when response is already committed before check', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const checkAccess = vi.fn().mockResolvedValue({ allowed: true });
    const { checkPlanLimit, setAccessPolicyServiceForTests } = await import(
      '../../../../server/src/middleware/planLimits.middleware.ts'
    );
    setAccessPolicyServiceForTests({ checkAccess } as any);
    const middleware = checkPlanLimit('max_projects');

    const req: any = { organizationId: 'org-1' };
    const res: any = {
      headersSent: true,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkAccess).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next for unknown limit key when response is already committed', async () => {
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.js');
    vi.doUnmock('../../../../server/src/middleware/planLimits.middleware.ts');

    const { checkPlanLimit } = await import('../../../../server/src/middleware/planLimits.middleware.ts');
    const middleware = checkPlanLimit('unknown_limit_key');

    const req: any = { organizationId: 'org-1' };
    const res: any = {
      headersSent: true,
      writableEnded: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
