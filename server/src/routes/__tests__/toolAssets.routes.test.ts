import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateAssetStatus = vi.fn();

// Auth + rate limiting are pass-through; we exercise the REAL requireRole gate.
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../services/ToolAssetsService.js', () => ({
  default: {
    getAssetsByTool: vi.fn(),
    getAuditReport: vi.fn(),
    updateAssetStatus,
  },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    params: { toolSlug: 'mind-map', assetType: 'thumbnail' },
    body: { status: 'ready' },
    query: {},
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.headersSent = false;
  return res;
}

async function importRouter() {
  const mod = await import('../../routes/toolAssets.routes.js');
  return mod.default;
}

function findPutLayer(router: any) {
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === '/:toolSlug/:assetType' && entry.route?.methods?.put
  );
  expect(layer).toBeDefined();
  return layer;
}

describe('Tool Assets Routes — PUT /:toolSlug/:assetType role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a non-admin (user) with 403 and does NOT mutate the catalog', async () => {
    const router = await importRouter();
    const layer = findPutLayer(router);
    const handlers = layer.route.stack;

    // The first handler in the route stack is the requireRole gate.
    const gate = handlers[0].handle;
    const req = createMockReq({ userRole: 'member' });
    const res = createMockRes();
    const next = vi.fn();

    gate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(updateAssetStatus).not.toHaveBeenCalled();
  });

  it('allows an admin through the gate and reaches the controller (200)', async () => {
    updateAssetStatus.mockResolvedValue({ toolSlug: 'mind-map', assetType: 'thumbnail' });

    const router = await importRouter();
    const layer = findPutLayer(router);
    const handlers = layer.route.stack;

    const gate = handlers[0].handle;
    const controller = handlers[handlers.length - 1].handle;
    const req = createMockReq({ userRole: 'admin' });
    const res = createMockRes();
    const next = vi.fn();

    // Gate passes for admin.
    gate(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(403);

    // Controller then runs and returns the updated asset (200 default).
    await controller(req, res, vi.fn());
    expect(updateAssetStatus).toHaveBeenCalledWith('mind-map', 'thumbnail', { status: 'ready' });
    expect(res.json).toHaveBeenCalledWith({
      asset: { toolSlug: 'mind-map', assetType: 'thumbnail' },
    });
  });

  it('allows a superadmin through the gate', async () => {
    const router = await importRouter();
    const layer = findPutLayer(router);
    const gate = layer.route.stack[0].handle;

    const req = createMockReq({ userRole: 'super_admin' });
    const res = createMockRes();
    const next = vi.fn();

    gate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(403);
  });
});
