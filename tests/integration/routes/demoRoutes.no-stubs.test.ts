import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

describe('Demo routes (no hardcoded demo data, honest availability)', () => {
  const prevEnv = { ...process.env };
  const workerId = process.env.VITEST_WORKER_ID || '0';
  const sqlitePath = path.join(os.tmpdir(), `consultify-demo-${workerId}.db`);
  const basePath = '/api/demo';

  let resetConnection: (() => Promise<void>) | null = null;
  let db: any;
  let router: any;

  const mount = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MOCK_DB = 'false';
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_PATH = sqlitePath;
    process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
    process.env.DEMO_ORG_ID = 'demo-org';
    process.env.DEMO_ORG_NAME = 'Demo Organization';

    vi.resetModules();
    const dbMod = await import('../../../server/src/database/Database.js');
    resetConnection = dbMod.resetConnection;
    await resetConnection();
    db = dbMod.getDatabase();

    await db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        organization_id TEXT
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        organization_id TEXT
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        organization_id TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        organization_id TEXT
      );
    `);

    await db.run(`INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)`, [
      process.env.DEMO_ORG_ID,
      'Consultify Demo',
    ]);

    await db.run(`INSERT OR REPLACE INTO initiatives (id, organization_id) VALUES (?, ?)`, [
      'i-1',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO initiatives (id, organization_id) VALUES (?, ?)`, [
      'i-2',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO tasks (id, organization_id) VALUES (?, ?)`, [
      't-1',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO tasks (id, organization_id) VALUES (?, ?)`, [
      't-2',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO tasks (id, organization_id) VALUES (?, ?)`, [
      't-3',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO decisions (id, organization_id) VALUES (?, ?)`, [
      'd-1',
      process.env.DEMO_ORG_ID,
    ]);
    await db.run(`INSERT OR REPLACE INTO users (id, organization_id) VALUES (?, ?)`, [
      'u-demo-1',
      process.env.DEMO_ORG_ID,
    ]);

    router = (await import('../../../server/src/routes/demo.routes.ts')).default;
  });

  afterAll(async () => {
    try {
      await resetConnection?.();
    } finally {
      process.env = prevEnv;
    }
  });

  it('GET /api/demo/organization returns real org + real counts', async () => {
    const res = await request(mount()).get(`${basePath}/organization`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        organization: expect.objectContaining({
          id: process.env.DEMO_ORG_ID,
          name: expect.any(String),
        }),
        stats: {
          initiatives: 2,
          tasks: 3,
          decisions: 1,
          users: 1,
        },
      })
    );
  });

  it('POST /api/demo/toggle enables demo mode and persists preference', async () => {
    const res = await request(mount()).post(`${basePath}/toggle`).send({ enabled: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        isDemoMode: true,
        demoOrganization: expect.objectContaining({
          id: process.env.DEMO_ORG_ID,
        }),
        stats: expect.any(Object),
      })
    );
  });

  it('GET /api/demo/status reflects persisted demo preference', async () => {
    await request(mount()).post(`${basePath}/toggle`).send({ enabled: true });
    const res = await request(mount()).get(`${basePath}/status`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, isDemoMode: true }));
  });

  it('POST /api/demo/toggle disables demo mode', async () => {
    const res = await request(mount()).post(`${basePath}/toggle`).send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ success: true, isDemoMode: false }));
  });

  it('GET /api/demo/tours returns 503 when DEMO_TOURS_JSON missing', async () => {
    delete process.env.DEMO_TOURS_JSON;
    const res = await request(mount()).get(`${basePath}/tours`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual(
      expect.objectContaining({ success: false, code: 'DEMO_TOURS_UNAVAILABLE' })
    );
  });

  it('GET /api/demo/tours returns parsed JSON when DEMO_TOURS_JSON set', async () => {
    process.env.DEMO_TOURS_JSON = JSON.stringify({ ok: true, items: [{ id: 'tour-1' }] });
    const res = await request(mount()).get(`${basePath}/tours`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, items: [{ id: 'tour-1' }] });
  });

  it('GET /api/demo/tours returns 500 when DEMO_TOURS_JSON invalid', async () => {
    process.env.DEMO_TOURS_JSON = '{not-json';
    const res = await request(mount()).get(`${basePath}/tours`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ success: false }));
  });
});

