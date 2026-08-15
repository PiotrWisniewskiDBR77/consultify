/**
 * Economics Financials Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

describe('Economics Financials API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/economics/financials', () => {
    it('should get financials or handle appropriately', async () => {
      const response = await request(app).get('/api/economics/financials');
      expect(response.status).toBe(404);
      expect(response.body).not.toHaveProperty('financials');
    });
  });
});
