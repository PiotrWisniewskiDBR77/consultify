import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  process.env.MOCK_DB = 'true';
});

// @vitest-environment node

/**
 * Level 2: Integration Tests - LLM Routes
 * Tests LLM API endpoints
 */
describe('Integration Test: LLM Routes', () => {
  describe('GET /api/llm/providers', () => {
    it('should return list of LLM providers', async () => {
      const res = await request(app).get('/api/llm/providers');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || Array.isArray(res.body.providers)).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/llm/providers')
        .set('Authorization', 'Bearer invalid-test-token');

      expect([401, 403]).toContain(res.status);
    });
  });

  describe('GET /api/llm/providers/public', () => {
    it('should return public providers', async () => {
      const res = await request(app).get('/api/llm/providers/public');

      expect(res.status).toBe(200);
      if (res.status === 200) {
        expect(Array.isArray(res.body) || Array.isArray(res.body.providers)).toBe(true);
      }
    });
  });

  describe('POST /api/llm/test', () => {
    it('should test provider connection', async () => {
      const res = await request(app)
        .post('/api/llm/test')
        .send({
          provider: 'openai',
          api_key: 'test-key',
          model_id: 'gpt-3.5-turbo',
        });

      // POST /api/llm/test is guarded by verifySuperAdmin; no auth header → 401.
      expect(res.status).toBe(401);
      expect(res.body).toBeDefined();
    });

    it('should handle invalid provider', async () => {
      const res = await request(app)
        .post('/api/llm/test')
        .send({
          provider: 'invalid-provider',
          api_key: 'test-key',
        });

      // verifySuperAdmin runs before body validation; no auth header → 401.
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/llm/test-ollama', () => {
    it('should test Ollama connection', async () => {
      const res = await request(app)
        .post('/api/llm/test-ollama')
        .send({
          endpoint: 'http://localhost:11434',
        });

      // POST /api/llm/test-ollama is guarded by verifySuperAdmin; no auth header → 401.
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/llm/ollama-models', () => {
    it('should return Ollama models', async () => {
      const res = await request(app)
        .get('/api/llm/ollama-models')
        .query({ endpoint: 'http://localhost:11434' });

      // May fail if Ollama not running
      expect(res.status).toBe(200);
    });
  });
});
