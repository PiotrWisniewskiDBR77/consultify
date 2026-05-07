import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Help routes (no placeholders)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-help-routes-${workerId}.db`);
  const basePath = '/api/help';

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let router: any;

  const mount = () => makeTestApp({ mountPath: basePath, router });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    router = (await import('../../../server/src/routes/help.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  beforeEach(async () => {
    // Keep DB light: only clear help tables we manage.
    await db.exec(`
      DROP TABLE IF EXISTS help_playbook_steps;
      DROP TABLE IF EXISTS help_categories;
      DROP TABLE IF EXISTS help_articles;
      DROP TABLE IF EXISTS help_playbooks;
      DROP TABLE IF EXISTS help_events;
    `);
  });

  it('GET /api/help/categories returns db-backed list (empty when no data)', async () => {
    const res = await request(mount()).get(`${basePath}/categories`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it('GET /api/help/articles returns db-backed list (empty when no data)', async () => {
    const res = await request(mount()).get(`${basePath}/articles?q=hello`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [], query: 'hello' });
  });
});
