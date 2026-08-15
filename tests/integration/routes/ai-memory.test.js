/**
 * AI Memory Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS === '1') {
    process.env.MOCK_DB = 'false';
  }
});


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('AI Memory API', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/ai/memory', () => {
    it('should get memory or handle appropriately', async () => {
      const response = await request(app).get('/api/ai/memory');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/ai/memory', () => {
    it('should store memory or handle appropriately', async () => {
      const response = await request(app).post('/api/ai/memory').send({ content: 'Test memory' });
      expect(response.status).toBe(401);
    });
  });
});
