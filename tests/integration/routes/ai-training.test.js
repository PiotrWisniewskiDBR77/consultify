/**
 * AI Training Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


describe('AI Training API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/ai/training', () => {
    it('should get training data or handle appropriately', async () => {
      const response = await request(app).get('/api/ai/training');
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('POST /api/ai/training', () => {
    it('should start training or handle appropriately', async () => {
      const response = await request(app).post('/api/ai/training').send({ type: 'fine-tune' });
      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty('success', true);
    });
  });
});
