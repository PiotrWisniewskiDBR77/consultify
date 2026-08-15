import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Management reports export missing-resource contract', () => {
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-mgmt-reports-${workerId}.db`);
  const basePath = '/api/management-reports';

  let resetConnection: (() => Promise<void>) | null = null;
  let router: any;

  const makeApp = () => makeTestApp({ mountPath: basePath, router });

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

    router = (await import('../../../server/src/routes/managementReports.routes.ts')).default;
  });

  afterAll(async () => {
    await resetConnection?.();
  });

  it('GET /api/management-reports/:id/pptx returns 404 for an unknown report', async () => {
    const res = await request(makeApp()).get(`${basePath}/any-report-id/pptx`);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });
});
