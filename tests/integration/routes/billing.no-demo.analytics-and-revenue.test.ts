import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Billing routes (no demo placeholders in analytics/revenue)', () => {
  const basePath = '/api/billing';
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-superadmin-1',
            organizationId: 'o-superadmin-1',
            role: 'SUPERADMIN',
            isSuperAdmin: true,
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
    router = (await import('../../../server/src/routes/billing/billing.routes.ts')).default;
  });

  it('GET /api/billing/analytics/mrr/trend is honest when schema missing', async () => {
    const res = await request(makeApp()).get(`${basePath}/analytics/mrr/trend?days=7`);
    expect(res.status).toBe(503);
  });

  it('GET /api/billing/analytics/churn is honest when schema missing', async () => {
    const res = await request(makeApp()).get(`${basePath}/analytics/churn`);
    expect(res.status).toBe(503);
  });

  it('GET /api/billing/analytics/cohorts is honest when schema missing', async () => {
    const res = await request(makeApp()).get(`${basePath}/analytics/cohorts`);
    expect(res.status).toBe(200);
  });

  it('GET /api/billing/analytics/expansion is honest when schema missing', async () => {
    const res = await request(makeApp()).get(`${basePath}/analytics/expansion`);
    expect(res.status).toBe(200);
  });

  it('GET /api/billing/revenue-recognitions does not return demo rr-demo ids', async () => {
    const res = await request(makeApp()).get(`${basePath}/revenue-recognitions`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('rr-demo-001');
  });

  it('GET /api/billing/revenue-forecasts does not return demo forecast-* ids', async () => {
    const res = await request(makeApp()).get(`${basePath}/revenue-forecasts`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('forecast-1');
  });

  it('GET /api/billing/admin/plans does not return hardcoded plan-enterprise', async () => {
    const res = await request(makeApp()).get(`${basePath}/admin/plans`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('plan-enterprise');
  });

  it('GET /api/billing/admin/user-plans is honest when not implemented', async () => {
    const res = await request(makeApp()).get(`${basePath}/admin/user-plans`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('user-standard');
  });

  it('GET /api/billing/usage does not seed demo usage records', async () => {
    const res = await request(makeApp()).get(`${basePath}/usage`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('45000');
  });

  it('GET /api/billing/usage-summary does not return sample names/emails', async () => {
    const res = await request(makeApp()).get(`${basePath}/usage-summary`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Piotr Wiśniewski');
    expect(JSON.stringify(res.body)).not.toContain('piotr@example.com');
  });

  it('POST /api/billing/tax/validate-vat does not simulate demo validation', async () => {
    const res = await request(makeApp())
      .post(`${basePath}/tax/validate-vat`)
      .send({ vatNumber: 'PL1234567890', countryCode: 'PL' });
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('Demo Company');
    expect(JSON.stringify(res.body)).not.toContain('validationSource');
  });

  it('GET /api/billing/tax-settings does not auto-seed placeholder tax data', async () => {
    const res = await request(makeApp()).get(`${basePath}/tax-settings`);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('PL1234567890');
    expect(JSON.stringify(res.body)).not.toContain('ACME-');
  });
});
