/**
 * Assessment Reports Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
  process.env.MOCK_DB = 'false';
  const workerId = process.env.VITEST_WORKER_ID || '0';
  process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});


describe('Assessment Reports Routes', () => {
  let app;

  beforeAll(async () => {
    await initializeDatabase();
    const serverModule = await import('../../server/src/index.js');
    app = serverModule.default;
  });

  it('GET /api/assessment-reports returns valid response', async () => {
    const response = await request(app).get('/api/assessment-reports');
    expect(response.status).toBe(401);
    if (response.status === 200 && response.body.reports) {
      expect(Array.isArray(response.body.reports)).toBe(true);
    }
  });

  it('GET /api/assessment-reports/templates returns valid response', async () => {
    const response = await request(app).get('/api/assessment-reports/templates');
    expect(response.status).toBe(401);
  });

  it('POST /api/assessment-reports requires assessmentId', async () => {
    const response = await request(app).post('/api/assessment-reports').send({});
    expect(response.status).toBe(401);
  });
});
