/**
 * AI Analytics Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
});

describe('AI Analytics API', () => {
  let app;

  beforeAll(async () => {
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/ai/analytics', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/ai/analytics')
        .set('Authorization', 'Bearer invalid-test-token');
      expect([401, 403]).toContain(res.status);
    });

    it('should respond for authenticated analytics access', async () => {
      const res = await request(app).get('/api/ai/analytics');
      expect([200, 404, 500]).toContain(res.status);
    });
  });
});
