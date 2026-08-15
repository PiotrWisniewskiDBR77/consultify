/**
 * Media Ingestion Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


// The legacy /api/media/ingest endpoint is not mounted. Canonical ingestion is
// Gateway-owned under /api/media-ingestion with explicit source-specific paths.
describe.skip('Media Ingestion API (retired route contract)', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('POST /api/media/ingest', () => {
    it('should handle ingestion or respond appropriately', async () => {
      const response = await request(app).post('/api/media/ingest');
      expect(response.status).toBe(401);
    });
  });
});
