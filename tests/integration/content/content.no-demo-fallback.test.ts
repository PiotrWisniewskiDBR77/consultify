import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Content routes (no demo fallback)', () => {
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-content-${workerId}.db`);
  const basePath = '/api/content';

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

    router = (await import('../../../server/src/routes/content.routes.ts')).default;
  });

  it('GET /api/content/categories does not return hardcoded demo categories', async () => {
    const res = await request(makeApp()).get(`${basePath}/categories?contentType=EMAIL`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.categories)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('cat_email_welcome');
  });

  it('GET /api/content/tags does not return hardcoded demo tags', async () => {
    const res = await request(makeApp()).get(`${basePath}/tags?contentType=EMAIL`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.tags)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('tag_critical');
  });

  // Best-effort cleanup
  afterAll(async () => {
    await resetConnection?.();
  });
});
