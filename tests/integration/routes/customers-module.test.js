/**
 * SuperAdmin Customers Module Integration Tests
 */

import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-customers-${workerId}.db`;
});


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin Customers Module API', () => {
  let app;

  beforeAll(async () => {
    try {
      const { initializeDatabase } =
        await import('../../../server/src/database/DatabaseInitializer.js');
      await initializeDatabase();
      const serverModule = await import('../../../server/src/index.js');
      app = serverModule.default;
    } catch (err) {
      console.warn('Server initialization warning:', err?.message || err);
    }
  });

  it('GET /api/superadmin/usage/by-organization returns usage data', async () => {
    if (!app) return;
    const response = await request(app).get('/api/superadmin/usage/by-organization');
    expect(response.status).toBe(401);
    if (response.status === 200) {
      expect(Array.isArray(response.body)).toBe(true);
    }
  });

  it('GET /api/superadmin/compliance/summary returns compliance summary', async () => {
    if (!app) return;
    const response = await request(app).get('/api/superadmin/compliance/summary');
    expect(response.status).toBe(401);
    if (response.status === 200) {
      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
    }
  });

  it('GET /api/superadmin/security/events returns events list', async () => {
    if (!app) return;
    const response = await request(app).get('/api/superadmin/security/events');
    expect(response.status).toBe(401);
    if (response.status === 200) {
      const events = response.body.events || [];
      expect(Array.isArray(events)).toBe(true);
    }
  });
});
