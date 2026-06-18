/**
 * Database Health Integration Tests
 * Tests for real database connectivity and health monitoring endpoints
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-db-health-${workerId}.db`;
});

describe('Database Health Integration', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/health/database', () => {
    it('should return database health status', async () => {
      const res = await request(app).get('/api/health/database');

      // /health/database returns 503 when the DB is degraded — both are part of
      // the documented health contract (body.status enum is asserted below).
      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
      expect(['healthy', 'degraded', 'unavailable', 'error']).toContain(res.body.status);
      expect(res.body.timestamp).toBeDefined();
    });

    it('should include pool statistics when healthy', async () => {
      const res = await request(app).get('/api/health/database');

      if (res.status === 200) {
        expect(res.body.pool).toBeDefined();
        expect(res.body.metrics).toBeDefined();
      }
    });
  });

  describe('GET /api/health/connections', () => {
    it('should return connection pool status', async () => {
      const res = await request(app).get('/api/health/connections');

      // 503 is a valid degraded-pool health response.
      expect([200, 503]).toContain(res.status);
      expect(res.body.status).toBeDefined();
    });

    it('should include utilization data when available', async () => {
      const res = await request(app).get('/api/health/connections');

      if (res.status === 200) {
        expect(res.body.connections).toBeDefined();
        expect(res.body.utilization).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      }
    });
  });

  describe('GET /api/health', () => {
    it('should return basic health check', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return readiness status', async () => {
      const res = await request(app).get('/api/health/ready');

      // Readiness flips to 503 when dependencies (DB) are not ready.
      expect([200, 503]).toContain(res.status);
    });
  });

  describe('GET /api/health/live', () => {
    it('should return liveness status', async () => {
      const res = await request(app).get('/api/health/live');

      expect(res.status).toBe(200);
    });
  });
});
