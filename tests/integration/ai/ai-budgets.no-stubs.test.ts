import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('AI budgets routes (no stubs)', () => {
  const basePath = '/api/ai-budgets';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use(basePath, (req, _res, next) => {
          (req as any).user = {
            id: 'u-ai-budgets-1',
            organizationId: 'o-ai-budgets-1',
            role: 'admin',
          };
          (req as any).userRole = 'admin';
          (req as any).organizationId = 'o-ai-budgets-1';
          (req as any).userId = 'u-ai-budgets-1';
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    vi.resetModules();
    router = (await import('../../../server/src/routes/ai/ai-budgets.routes.ts')).default;
  });

  it('GET /api/ai-budgets/budgets returns 503 when service is unavailable (no 501 stubs)', async () => {
    const res = await request(makeApp()).get(`${basePath}/budgets`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, error: expect.any(String) }));
  });

  it('POST /api/ai-budgets/budgets returns 503 when service is unavailable (no 501 stubs)', async () => {
    const res = await request(makeApp()).post(`${basePath}/budgets`).send({
      budgetType: 'monthly',
      period: '2026-02',
      budgetLimit: 10,
    });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ success: false, error: expect.any(String) }));
  });
});
