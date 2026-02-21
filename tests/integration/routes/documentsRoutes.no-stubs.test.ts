import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Documents routes (no stub responses)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-documents-${workerId}.db`);
  const basePath = '/api/documents';

  let resetConnection: (() => Promise<void>) | null = null;
  let router: any;

  const mount = () =>
    makeTestApp({
      mountPath: basePath,
      router,
      beforeMount: (app) => {
        // Provide a deterministic auth context without mocking verifyToken.
        app.use((req, _res, next) => {
          (req as any).user = {
            id: 'u-docs-1',
            organizationId: 'o-docs-1',
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

    router = (await import('../../../server/src/routes/documents.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('GET /api/documents returns 503 when DocumentService is unavailable (no fake [])', async () => {
    const res = await request(mount()).get(basePath);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('GET /api/documents/all returns 503 when service is unavailable (no fake [])', async () => {
    const res = await request(mount()).get(`${basePath}/all`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('GET /api/documents/user returns 503 when service is unavailable (no fake [])', async () => {
    const res = await request(mount()).get(`${basePath}/user`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('GET /api/documents/project/p-1 returns 503 when service is unavailable (no fake [])', async () => {
    const res = await request(mount()).get(`${basePath}/project/p-1`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('POST /api/documents/upload returns 400 when file missing', async () => {
    const res = await request(mount()).post(`${basePath}/upload`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('POST /api/documents/upload returns 503 when service missing (no fake 201)', async () => {
    const res = await request(mount())
      .post(`${basePath}/upload`)
      .attach('file', Buffer.from('hello'), { filename: 'hello.txt', contentType: 'text/plain' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
