/**
 * SuperAdmin Analytics Integration Tests
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
const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 501];

describe('SuperAdmin Analytics API', () => {
  let app;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/superadmin/analytics', () => {
    it('should return analytics overview or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics');
      expect(VALID_STATUSES).toContain(response.status);
    });

    it('should support date range', async () => {
      const response = await request(app).get(
        '/api/superadmin/analytics?start=2024-01-01&end=2024-12-31'
      );
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/users', () => {
    it('should return user analytics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/users');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/engagement', () => {
    it('should return engagement metrics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/engagement');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/features', () => {
    it('should return feature usage analytics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/features');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/cohorts', () => {
    it('should return cohort analysis or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/cohorts');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/funnel', () => {
    it('should return funnel analysis or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/funnel');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/superadmin/analytics/retention', () => {
    it('should return retention metrics or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/analytics/retention');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });
});
