import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ApiGateway: stub routes are mounted outside production', () => {
  it('mounts stub routes when NODE_ENV!=production', async () => {
    const origEnv = process.env.NODE_ENV;
    const origEnable = process.env.ENABLE_STUB_ROUTES;
    process.env.NODE_ENV = 'test';
    delete process.env.ENABLE_STUB_ROUTES;

    vi.resetModules();
    const { ApiGateway } = await import('../../../../server/src/Gateway.ts');

    const app: any = { use: vi.fn() };
    ApiGateway.getInstance().initializeRoutes(app);

    const mountedPaths = app.use.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : null))
      .filter(Boolean);

    expect(mountedPaths).toContain('/api/auth');
    expect(mountedPaths).toContain('/api/help-analytics');

    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origEnable === undefined) delete process.env.ENABLE_STUB_ROUTES;
    else process.env.ENABLE_STUB_ROUTES = origEnable;
  });
});
