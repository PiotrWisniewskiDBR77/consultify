/* @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('ApiGateway: stub routes are disabled in production by default', () => {
  it('does not mount stub routes when NODE_ENV=production (no live demo UI caller)', async () => {
    const origEnv = process.env.NODE_ENV;
    const origEnable = process.env.ENABLE_STUB_ROUTES;
    const origMockBilling = process.env.MOCK_BILLING;
    const origEncryptionSalt = process.env.ENCRYPTION_SALT;
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_STUB_ROUTES;
    process.env.MOCK_BILLING = 'true';
    process.env.ENCRYPTION_SALT = 'test-encryption-salt';

    vi.resetModules();
    const { ApiGateway } = await import('../../../../server/src/Gateway.ts');
    const logger = (await import('../../../../server/src/utils/Logger.js')).default as any;

    const app: any = { use: vi.fn() };
    ApiGateway.getInstance().initializeRoutes(app);

    const mountedPaths = app.use.mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : null))
      .filter(Boolean);

    expect(mountedPaths).toContain('/api/auth');
    // D-01 (2026-07-19): confirmed via FE grep that no live demo UI calls this
    // path — it correctly stays fully unmounted (no honest-501 either), same
    // as before this fix. See apiGateway.stubRoutes.d01HonestStub.test.ts for
    // the paths that DO have a live caller and now get an honest 501.
    expect(mountedPaths).not.toContain('/api/daily-brief');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Stub route disabled in production')
    );

    if (origEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origEnv;
    if (origEnable === undefined) delete process.env.ENABLE_STUB_ROUTES;
    else process.env.ENABLE_STUB_ROUTES = origEnable;
    if (origMockBilling === undefined) delete process.env.MOCK_BILLING;
    else process.env.MOCK_BILLING = origMockBilling;
    if (origEncryptionSalt === undefined) delete process.env.ENCRYPTION_SALT;
    else process.env.ENCRYPTION_SALT = origEncryptionSalt;
  });
});
