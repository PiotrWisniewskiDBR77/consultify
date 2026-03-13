/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ApiGateway: stub routes can be enabled in production', () => {
  it('mounts stub routes when ENABLE_STUB_ROUTES=true', async () => {
    const origEnv = process.env.NODE_ENV;
    const origEnable = process.env.ENABLE_STUB_ROUTES;
    const origMockBilling = process.env.MOCK_BILLING;
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_STUB_ROUTES = 'true';
    process.env.MOCK_BILLING = 'true';

    vi.resetModules();
    const { ApiGateway } = await import('../../../../server/src/Gateway.ts');

    const app: any = { use: vi.fn(), get: vi.fn() };
    ApiGateway.getInstance().initializeRoutes(app);

    const mountedPaths = app.use.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : null))
      .filter(Boolean);

    expect(mountedPaths).toContain('/api/help-analytics');
    expect(mountedPaths).toContain('/api/help');

    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origEnable === undefined) delete process.env.ENABLE_STUB_ROUTES;
    else process.env.ENABLE_STUB_ROUTES = origEnable;
    if (origMockBilling === undefined) delete process.env.MOCK_BILLING;
    else process.env.MOCK_BILLING = origMockBilling;
  });
});
