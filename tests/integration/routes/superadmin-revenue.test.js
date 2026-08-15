/**
 * SuperAdmin Revenue Integration Tests
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin Revenue API', () => {
  let app;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/superadmin/revenue', () => {
    it('should return revenue overview or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/revenue');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/revenue/mrr', () => {
    it('should return MRR or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/revenue/mrr');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/revenue/subscriptions', () => {
    it('should return subscriptions or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/revenue/subscriptions');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/revenue/churn', () => {
    it('should return churn metrics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/revenue/churn');
      expect(response.status).toBe(401);
    });
  });
});
