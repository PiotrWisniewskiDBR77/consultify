/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ApiGateway: stub routes are disabled in production by default', () => {
  it('does not mount stub routes when NODE_ENV=production', async () => {
    const origEnv = process.env.NODE_ENV;
    const origEnable = process.env.ENABLE_STUB_ROUTES;
    const origMockBilling = process.env.MOCK_BILLING;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_STUB_ROUTES;
    process.env.MOCK_BILLING = 'true';

    vi.resetModules();
    const { ApiGateway } = await import('../../../../server/src/Gateway.ts');
    const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;

    const app: any = { use: vi.fn() };
    ApiGateway.getInstance().initializeRoutes(app);

    const mountedPaths = app.use.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : null))
      .filter(Boolean);

    expect(mountedPaths).toContain('/api/auth');
    expect(mountedPaths).not.toContain('/api/help-analytics');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stub route disabled in production')
    );

    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origEnable === undefined) delete process.env.ENABLE_STUB_ROUTES;
    else process.env.ENABLE_STUB_ROUTES = origEnable;
    if (origMockBilling === undefined) delete process.env.MOCK_BILLING;
    else process.env.MOCK_BILLING = origMockBilling;
  });
});
