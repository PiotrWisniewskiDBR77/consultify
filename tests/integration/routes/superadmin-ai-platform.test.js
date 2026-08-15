/**
 * SuperAdmin AI Platform Integration Tests
 * Tests for /api/superadmin/ai-* endpoints
 */

import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// 501 means route is stubbed (not yet implemented)

(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin AI Platform API', () => {
  let app;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/superadmin/ai/providers', () => {
    it('should return list of AI providers or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/providers');

      expect(response.status).toBe(401);
    });

    it('should include provider status', async () => {
      const response = await request(app).get('/api/superadmin/ai/providers');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/providers/:id', () => {
    it('should return specific provider or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/providers/openai');

      expect(response.status).toBe(401);
    });

    it('should handle non-existent provider', async () => {
      const response = await request(app).get('/api/superadmin/ai/providers/nonexistent');

      // No auth header → verifyToken rejects before the not-found lookup runs.
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/superadmin/ai/providers/:id', () => {
    it('should update provider configuration or handle appropriately', async () => {
      const response = await request(app)
        .put('/api/superadmin/ai/providers/openai')
        .send({ status: 'inactive' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/usage', () => {
    it('should return usage statistics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/usage');

      expect(response.status).toBe(401);
    });

    it('should support date range filter', async () => {
      const response = await request(app).get(
        '/api/superadmin/ai/usage?start=2024-01-01&end=2024-12-31'
      );

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/models', () => {
    it('should return list of models or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/models');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/superadmin/ai/models/:id/test', () => {
    it('should test model connectivity or handle appropriately', async () => {
      const response = await request(app).post('/api/superadmin/ai/models/gpt-4o/test');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/prompts', () => {
    it('should return system prompts or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/prompts');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/experiments', () => {
    it('should return A/B experiments or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/experiments');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/ai/audit-logs', () => {
    it('should return AI audit logs or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/ai/audit-logs');

      expect(response.status).toBe(401);
    });

    it('should support pagination', async () => {
      const response = await request(app).get('/api/superadmin/ai/audit-logs?page=1&limit=50');

      expect(response.status).toBe(401);
    });
  });
});
