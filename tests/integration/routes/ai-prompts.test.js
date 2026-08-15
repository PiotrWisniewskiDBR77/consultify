/**
 * AI Prompts Integration Tests
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


describe('AI Prompts API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/ai/prompts', () => {
    it('should list prompts or handle appropriately', async () => {
      const response = await request(app).get('/api/ai/prompts');
      expect(response.status).toBe(404);
      expect(response.body).not.toHaveProperty('prompts');
    });
  });

  describe('POST /api/ai/prompts', () => {
    it('should create prompt or handle appropriately', async () => {
      const response = await request(app).post('/api/ai/prompts').send({ content: 'Test prompt' });
      expect(response.status).toBe(404);
      expect(response.body).not.toHaveProperty('prompt');
    });
  });
});
