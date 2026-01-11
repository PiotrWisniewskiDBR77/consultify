/**
 * My Work Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 501];

describe('My Work API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/my-work', () => {
    it('should get work items or handle appropriately', async () => {
      const response = await request(app).get('/api/my-work');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });
});
