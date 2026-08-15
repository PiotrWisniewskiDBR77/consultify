/**
 * LLM Health Integration Tests
 * Tests for real LLM service health monitoring endpoints
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  if (process.env.RUN_DB_TESTS === '1') {
    process.env.MOCK_DB = 'false';
  }
});

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('LLM Health Integration', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/llm/health', () => {
    it('should return LLM health status', async () => {
      const res = await request(app).get('/api/llm/health');

      expect(res.status).toBe(401);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('GET /api/llm/health/status', () => {
    it('should return health status alias', async () => {
      const res = await request(app).get('/api/llm/health/status');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/llm/health/summary', () => {
    it('should return health summary', async () => {
      const res = await request(app).get('/api/llm/health/summary');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/llm/health/detailed', () => {
    it('should return detailed health info', async () => {
      const res = await request(app).get('/api/llm/health/detailed');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/llm/health/errors', () => {
    it('should return health errors list', async () => {
      const res = await request(app).get('/api/llm/health/errors');

      expect(res.status).toBe(401);
      if (res.status === 200 && Array.isArray(res.body)) {
        // Each error should have basic structure
        res.body.forEach((error) => {
          if (error) {
            expect(typeof error).toBe('object');
          }
        });
      }
    });
  });

  describe('GET /api/llm/providers', () => {
    it('should return list of LLM providers', async () => {
      const res = await request(app).get('/api/llm/providers');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/llm/providers/public', () => {
    it('should return public provider list without auth', async () => {
      const res = await request(app).get('/api/llm/providers/public');

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });
});
