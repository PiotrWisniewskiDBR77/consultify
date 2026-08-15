/**
 * RapidLean Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


// The current router owns /api/rapidlean/assessments; the bare legacy endpoint
// intentionally has no runtime contract.
describe.skip('RapidLean Routes Integration (retired bare route)', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/rapidlean', () => {
    it('should get rapidlean data or handle appropriately', async () => {
      const response = await request(app).get('/api/rapidlean');
      expect(response.status).toBe(401);
    });
  });
});
