import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Partner portal routes (honest 503 when unavailable)', () => {
  const basePath = '/api/partners';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            ...(req as any).user,
            partnerOrgId: 'partner-org-test',
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/partners.routes.ts')).default;
  });

  const cases = [
    { method: 'get', path: '/metrics' },
    { method: 'get', path: '/clients' },
    { method: 'post', path: '/clients', body: { name: 'Acme' } },
    { method: 'get', path: '/clients/client-1' },
    { method: 'get', path: '/employees' },
    { method: 'post', path: '/employees', body: { name: 'Test', email: 'test@example.com' } },
    { method: 'get', path: '/stats' },
    { method: 'post', path: '/access-links', body: { type: 'client' } },
    { method: 'get', path: '/projects' },
    { method: 'get', path: '/certifications' },
    { method: 'get', path: '/certifications/cert-1/modules' },
    {
      method: 'post',
      path: '/certifications/cert-1/modules/module-1/progress',
      body: { progress: 10, status: 'in_progress' },
    },
    { method: 'get', path: '/licenses' },
    { method: 'post', path: '/licenses/order', body: { quantity: 3, type: 'enterprise' } },
    { method: 'get', path: '/commissions' },
    { method: 'get', path: '/invoices' },
    { method: 'get', path: '/invoices/INV-1/download' },
    { method: 'get', path: '/resources' },
    { method: 'get', path: '/resources/res-1/download' },
    { method: 'get', path: '/tiers' },
  ];

  for (const testCase of cases) {
    it(`${testCase.method.toUpperCase()} ${basePath}${testCase.path} returns 503 with FEATURE_UNAVAILABLE`, async () => {
      let req = request(makeApp())[testCase.method](basePath + testCase.path);
      if (testCase.body) {
        req = req.send(testCase.body);
      }
      const res = await req;
      expect(res.status).toBe(503);
      expect(res.body?.code).toBe('FEATURE_UNAVAILABLE');
    });
  }
});
