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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRes() {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
}

// ---------------------------------------------------------------------------
// v8FeatureGate  (global toggle — sync)
// ---------------------------------------------------------------------------
describe('v8FeatureGate', () => {
  const originalEnv = process.env.ENABLE_V8_GLOBAL;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ENABLE_V8_GLOBAL;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalEnv;
  });

  it('calls next() when ENABLE_V8_GLOBAL=true', () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 with V8_DISABLED when ENABLE_V8_GLOBAL=false', () => {
    process.env.ENABLE_V8_GLOBAL = 'false';
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_DISABLED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when ENABLE_V8_GLOBAL is undefined (not set)', () => {
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();

    v8FeatureGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// v8OrgGate  (post-auth, org-level, async)
// ---------------------------------------------------------------------------
describe('v8OrgGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.getV8Flags.mockResolvedValue({ enabled: true });
    mocks.isV8ShadowMode.mockResolvedValue(false);
  });

  it('returns 400 with V8_MISSING_ORG when organizationId is absent', async () => {
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_ORG' })
    );
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when organizationId is null', async () => {
    const req: any = { organizationId: null };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets v8ShadowMode when org is V8-enabled', async () => {
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.isV8ShadowMode.mockResolvedValue(false);
    const req: any = { organizationId: 'org-1' };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(mocks.isV8Enabled).toHaveBeenCalledWith('org-1');
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets v8ShadowMode=true when org is in shadow mode', async () => {
    mocks.isV8ShadowMode.mockResolvedValue(true);
    const req: any = { organizationId: 'org-shadow' };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(req.v8ShadowMode).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 404 with V8_ORG_DISABLED when org has flags but V8 not enabled', async () => {
    mocks.isV8Enabled.mockResolvedValue(false);
    mocks.getV8Flags.mockResolvedValue({ someFlag: true }); // non-empty flags → no fallback
    const req: any = { organizationId: 'org-2' };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_ORG_DISABLED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows pass-through (implicit fallback) when org has no flag rows in non-prod', async () => {
    // NODE_ENV=test → allowImplicitOrgRowsFallback() returns true
    mocks.isV8Enabled.mockResolvedValue(false);
    mocks.getV8Flags.mockResolvedValue({}); // empty → fallback triggers
    mocks.isV8ShadowMode.mockResolvedValue(false);
    const req: any = { organizationId: 'org-new' };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith(
      '[v8:featureGate] Allowing org without explicit V8 flag rows',
      expect.objectContaining({ organizationId: 'org-new' })
    );
  });

  it('sets v8ShadowMode=false and calls next() when service throws', async () => {
    mocks.isV8Enabled.mockRejectedValue(new Error('db error'));
    const req: any = { organizationId: 'org-1' };
    const res = makeRes();
    const next = vi.fn();

    await v8OrgGate(req, res, next);

    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createV8ModuleGate  (post-auth, per-module, async)
// ---------------------------------------------------------------------------
describe('createV8ModuleGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.getV8Flags.mockResolvedValue({ enabled: true });
    mocks.isV8ShadowMode.mockResolvedValue(false);
  });

  it('returns 400 with V8_MISSING_ORG when organizationId is absent', async () => {
    const req: any = {};
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_ORG' })
    );
    expect(mocks.isV8Enabled).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets v8ShadowMode when module is enabled for org', async () => {
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.isV8ShadowMode.mockResolvedValue(false);
    const req: any = { organizationId: 'org-1' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(mocks.isV8Enabled).toHaveBeenCalledWith('org-1', 'outputs');
    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 with V8_MODULE_DISABLED when module is not enabled and flags exist', async () => {
    mocks.isV8Enabled.mockResolvedValue(false);
    mocks.getV8Flags.mockResolvedValue({ someOtherModule: true }); // non-empty → no fallback
    const req: any = { organizationId: 'org-2' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MODULE_DISABLED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows pass-through (implicit fallback) when org has no flag rows in non-prod', async () => {
    mocks.isV8Enabled.mockResolvedValue(false);
    mocks.getV8Flags.mockResolvedValue({}); // empty flags → fallback triggers
    mocks.isV8ShadowMode.mockResolvedValue(false);
    const req: any = { organizationId: 'org-new' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith(
      '[v8:featureGate] Allowing module for org without explicit V8 flag rows',
      expect.objectContaining({ organizationId: 'org-new', module: 'outputs' })
    );
  });

  it('sets v8ShadowMode=false and calls next() when service throws', async () => {
    mocks.isV8Enabled.mockRejectedValue(new Error('db error'));
    const req: any = { organizationId: 'org-2' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(req.v8ShadowMode).toBe(false);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('sets v8ShadowMode=true when module is enabled and org is in shadow mode', async () => {
    mocks.isV8Enabled.mockResolvedValue(true);
    mocks.isV8ShadowMode.mockResolvedValue(true);
    const req: any = { organizationId: 'org-shadow' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('outputs');

    await gate(req, res, next);

    expect(req.v8ShadowMode).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes module name through to isV8Enabled', async () => {
    const req: any = { organizationId: 'org-1' };
    const res = makeRes();
    const next = vi.fn();
    const gate = createV8ModuleGate('customModule');

    await gate(req, res, next);

    expect(mocks.isV8Enabled).toHaveBeenCalledWith('org-1', 'customModule');
  });
});
