/**
 * Initiative Generator Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Initiative Generator API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('POST /api/initiatives/generate', () => {
    it('should generate initiatives or handle appropriately', async () => {
      const response = await request(app)
        .post('/api/initiatives/generate')
        .send({ type: 'quick_wins' });
      expect(response.status).toBe(401);
    });
  });
});
