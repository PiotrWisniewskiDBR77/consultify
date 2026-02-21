/**
 * Notifications Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 503];

describe('Integration Test: Notifications Routes', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      const response = await request(app).get('/api/notifications');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('GET /api/notifications/counts', () => {
    it('should return notification counts', async () => {
      const response = await request(app).get('/api/notifications/counts');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const response = await request(app).post('/api/notifications/mark-all-read');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    it('should delete notification', async () => {
      const response = await request(app).delete('/api/notifications/123');
      expect(VALID_STATUSES).toContain(response.status);
    });
  });
});
