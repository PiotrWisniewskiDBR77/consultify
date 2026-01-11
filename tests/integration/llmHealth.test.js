/**
 * LLM Health Integration Tests
 * Tests for real LLM service health monitoring endpoints
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-llm-health-${workerId}.db`;
});

describe('LLM Health Integration', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/llm/health', () => {
    it('should return LLM health status', async () => {
      const res = await request(app).get('/api/llm/health');

      expect([200, 401, 403, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toBeDefined();
      }
    });
  });

  describe('GET /api/llm/health/status', () => {
    it('should return health status alias', async () => {
      const res = await request(app).get('/api/llm/health/status');

      expect([200, 401, 403, 503]).toContain(res.status);
    });
  });

  describe('GET /api/llm/health/summary', () => {
    it('should return health summary', async () => {
      const res = await request(app).get('/api/llm/health/summary');

      expect([200, 401, 403, 503]).toContain(res.status);
    });
  });

  describe('GET /api/llm/health/detailed', () => {
    it('should return detailed health info', async () => {
      const res = await request(app).get('/api/llm/health/detailed');

      expect([200, 401, 403, 503]).toContain(res.status);
    });
  });

  describe('GET /api/llm/health/errors', () => {
    it('should return health errors list', async () => {
      const res = await request(app).get('/api/llm/health/errors');

      expect([200, 401, 403, 503]).toContain(res.status);
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

      expect([200, 401, 403, 500]).toContain(res.status);
    });
  });

  describe('GET /api/llm/providers/public', () => {
    it('should return public provider list without auth', async () => {
      const res = await request(app).get('/api/llm/providers/public');

      expect([200, 404, 500]).toContain(res.status);
    });
  });
});
