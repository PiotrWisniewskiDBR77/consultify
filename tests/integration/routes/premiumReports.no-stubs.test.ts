import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

const { missingPremiumReports } = vi.hoisted(() => ({
  missingPremiumReports: vi
    .fn()
    .mockRejectedValue(
      Object.assign(new Error('relation "premium_reports" does not exist'), { code: '42P01' })
    ),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: missingPremiumReports,
  get: missingPremiumReports,
  run: vi.fn(),
}));

describe('Premium reports routes (no silent fallbacks)', () => {
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-premium-reports-${workerId}.db`);
  const basePath = '/api/reports/premium';

  let resetConnection: (() => Promise<void>) | null = null;
  let router: any;

  const makeApp = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-prem-1',
            organizationId: 'o-prem-1',
            role: 'admin',
          };
          next();
        });
      },
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();

    router = (await import('../../../server/src/routes/premiumReports.routes.ts')).default;
  });

  afterAll(async () => {
    await resetConnection?.();
  });

  it('GET /api/reports/premium returns 503 when schema missing (no fake empty list)', async () => {
    const res = await request(makeApp()).get(basePath);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: expect.any(String),
      })
    );
  });

  it('GET /api/reports/premium/:id returns 503 when schema missing (not 404)', async () => {
    const res = await request(makeApp()).get(`${basePath}/r1`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: expect.any(String),
      })
    );
  });
});
