import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('AI settings superadmin routes (honest 503 when unavailable)', () => {
  const basePath = '/api/ai-settings';

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    vi.doMock('../../../server/src/services/aiSettingsService.js', () => ({
      default: {},
    }));
    vi.doMock('../../../server/src/services/aiProactivityEngine.js', () => ({
      default: {},
    }));
  });

  const mount = async () => {
    const router = (await import('../../../server/src/routes/ai/ai-settings.routes.ts')).default;
    return makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'test-superadmin',
            role: 'superadmin',
            organizationId: 'test-org-id',
          };
          (req as any).userRole = 'SUPERADMIN';
          next();
        });
      },
    });
  };

  it('GET /superadmin returns 503 FEATURE_UNAVAILABLE when service is missing', async () => {
    const res = await request(await mount()).get(`${basePath}/superadmin`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ type: 'not_configured' }));
  });
});
