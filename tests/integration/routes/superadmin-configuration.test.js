/**
 * SuperAdmin Configuration Integration Tests
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


(process.env.RUN_DB_TESTS === '1' ? describe : describe.skip)('SuperAdmin Configuration API', () => {
  let app;
  const db = getDatabase();

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../../server/src/index.js');
    app = serverModule.default;
  });

  describe('GET /api/superadmin/configuration', () => {
    it('should return system configuration or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration');
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/superadmin/configuration', () => {
    it('should update system configuration or handle appropriately', async () => {
      const response = await request(app)
        .put('/api/superadmin/configuration')
        .send({ theme: 'light' });
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/configuration/whitelabel', () => {
    it('should return whitelabel settings or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration/whitelabel');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/configuration/legal', () => {
    it('should return legal documents or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration/legal');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/configuration/feature-flags', () => {
    it('should return feature flags or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration/feature-flags');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/configuration/email-templates', () => {
    it('should return email templates or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration/email-templates');
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/superadmin/configuration/integrations', () => {
    it('should return integrations or handle appropriately', async () => {
      const response = await request(app).get('/api/superadmin/configuration/integrations');
      expect(response.status).toBe(401);
    });
  });
});
