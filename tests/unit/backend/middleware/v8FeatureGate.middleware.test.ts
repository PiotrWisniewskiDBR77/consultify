import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isV8Enabled: vi.fn(),
  getV8Flags: vi.fn(),
  isV8ShadowMode: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/featureFlagService.js', () => ({
  isV8Enabled: mocks.isV8Enabled,
  getV8Flags: mocks.getV8Flags,
  isV8ShadowMode: mocks.isV8ShadowMode,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    warn: mocks.warn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  createV8ModuleGate,
  v8FeatureGate,
  v8OrgGate,
} from '../../../../server/src/middleware/v8FeatureGate.middleware.ts';

describe('v8FeatureGate.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.getV8Flags.mockResolvedValue({ enabled: true });
    mocks.isV8ShadowMode.mockResolvedValue(false);
  });

  it('v8OrgGate uses legacy user.organization_id when organizationId accessor throws', async () => {
    const req: any = { user: { organization_id: 'org-legacy' } };
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organization getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(mocks.isV8Enabled).toHaveBeenCalledWith('org-legacy');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('module gate returns 400 when all org accessors throw', async () => {
    const req: any = {};
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organization getter failed');
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

    const moduleGate = createV8ModuleGate('outputs');
    await moduleGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('v8OrgGate logs warning and fails open when feature service throws', async () => {
    mocks.isV8Enabled.mockRejectedValueOnce(new Error('flag service down'));
    const req: any = { organizationId: 'org-1' };
    const res: any = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8ShadowMode).toBe(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      '[v8:featureGate] V8 org gate evaluation failed',
      expect.objectContaining({
        organizationId: 'org-1',
        code: 'V8_GATE_EVAL_FAILED',
      })
    );
  });

  it('v8OrgGate does not call next when headers are already sent in catch path', async () => {
    mocks.isV8Enabled.mockRejectedValueOnce(new Error('flag service down'));
    const req: any = { organizationId: 'org-1' };
    const res: any = { headersSent: true, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('module gate logs warning and fails open when feature service throws', async () => {
    mocks.isV8Enabled.mockRejectedValueOnce(new Error('module flag service down'));
    const req: any = { organizationId: 'org-2' };
    const res: any = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    const moduleGate = createV8ModuleGate('outputs');

    await moduleGate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8ShadowMode).toBe(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      '[v8:featureGate] V8 module gate evaluation failed',
      expect.objectContaining({
        organizationId: 'org-2',
        module: 'outputs',
        code: 'V8_MODULE_GATE_EVAL_FAILED',
      })
    );
  });

  it('module gate does not call next when headers are already sent in catch path', async () => {
    mocks.isV8Enabled.mockRejectedValueOnce(new Error('module flag service down'));
    const req: any = { organizationId: 'org-2' };
    const res: any = { headersSent: true, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    const moduleGate = createV8ModuleGate('outputs');

    await moduleGate(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('v8FeatureGate avoids writes when global toggle is off and headers already sent', () => {
    const original = process.env.ENABLE_V8_GLOBAL;
    process.env.ENABLE_V8_GLOBAL = 'false';
    const req: any = {};
    const res: any = { headersSent: true, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    if (original === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = original;
  });

  it('v8FeatureGate does not call next when global enabled but headers already sent', () => {
    const original = process.env.ENABLE_V8_GLOBAL;
    process.env.ENABLE_V8_GLOBAL = 'true';
    const req: any = {};
    const res: any = { headersSent: true, status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    if (original === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = original;
  });

  it('v8FeatureGate logs warning when deny response writer throws', () => {
    const original = process.env.ENABLE_V8_GLOBAL;
    process.env.ENABLE_V8_GLOBAL = 'false';
    const req: any = {};
    const res: any = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(() => {
        throw new Error('json failed');
      }),
    };
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(mocks.warn).toHaveBeenCalledWith(
      '[v8:featureGate] V8 gate response write failed',
      expect.objectContaining({
        code: 'V8_GATE_RESPONSE_WRITE_FAILED',
        statusCode: 404,
      })
    );
    expect(next).not.toHaveBeenCalled();
    if (original === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = original;
  });

  it('v8OrgGate forwards synchronous next errors to next(error)', async () => {
    const err = new Error('downstream sync failure');
    const req: any = { organizationId: 'org-ok' };
    const res: any = { headersSent: false, status: vi.fn().mockReturnThis(), json: vi.fn() };
    let callCount = 0;
    const next = vi.fn((maybeErr?: unknown) => {
      callCount += 1;
      if (callCount === 1 && maybeErr === undefined) {
        throw err;
      }
    });

    await v8OrgGate(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[1]?.[0]).toBe(err);
  });

  it('v8OrgGate treats placeholder organizationId as missing context', async () => {
    const req: any = { organizationId: ' undefined ' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('v8OrgGate returns 400 when organizationId exceeds max length', async () => {
    const req: any = { organizationId: 'o'.repeat(129) };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('v8OrgGate returns 400 when organizationId contains control characters', async () => {
    const req: any = { organizationId: 'org-\u0000-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('module gate returns 400 when organizationId exceeds max length', async () => {
    const req: any = { organizationId: 'o'.repeat(129) };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    const moduleGate = createV8ModuleGate('outputs');

    await moduleGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
