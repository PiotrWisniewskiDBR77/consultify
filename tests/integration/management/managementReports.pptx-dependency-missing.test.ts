import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

vi.mock('../../../server/src/services/managementReportsService.js', () => ({
  default: {
    generateExport: vi.fn(async () => {
      const error = new Error('pptx dependency is not installed') as Error & {
        code: string;
        dependency: string;
      };
      error.code = 'DEPENDENCY_MISSING';
      error.dependency = 'pptxgenjs';
      throw error;
    }),
  },
}));

describe('Management reports export missing-resource contract', () => {
  const basePath = '/api/management-reports';

  let router: any;

  const makeApp = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'true';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    vi.resetModules();
    router = (await import('../../../server/src/routes/managementReports.routes.ts')).default;
  });

  afterAll(async () => {
    delete process.env.ENABLE_TEST_AUTH_BYPASS;
  });

  it('GET /api/management-reports/:id/pptx fails closed when the exporter is unavailable', async () => {
    const res = await request(makeApp()).get(`${basePath}/any-report-id/pptx`);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ type: 'not_configured', status: false });
    expect(JSON.stringify(res.body)).not.toContain('stack');
    expect(JSON.stringify(res.body)).not.toContain('pptxgenjs');
  });
});
