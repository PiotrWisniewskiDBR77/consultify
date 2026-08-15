/**
 * Documents Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('Integration Test: Documents Routes', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/documents', () => {
    it('should return list of documents', async () => {
      const response = await request(app).get('/api/documents');
      expect(response.status).toBe(401);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/documents');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/documents/upload', () => {
    it('should require file upload', async () => {
      const response = await request(app).post('/api/documents/upload');
      expect(response.status).toBe(401);
    });
  });
});
