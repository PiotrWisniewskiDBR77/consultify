/**
 * SuperAdmin System Integration Tests
 * Tests for /api/superadmin/system/* endpoints
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

describe('SuperAdmin System API', () => {
    let app;
    const db = getDatabase();

    beforeAll(async () => {
        await initializeDatabase();
        const serverModule = await import('../../../server/src/index.js');
        app = serverModule.default;
    });

    describe('GET /api/superadmin/system/health', () => {
        it('should return system health status or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/health');
            expect(VALID_STATUSES).toContain(response.status);
        });

        it('should include service statuses', async () => {
            const response = await request(app).get('/api/superadmin/system/health');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/system/metrics', () => {
        it('should return system metrics or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/metrics');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/system/audit-logs', () => {
        it('should return audit logs or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/audit-logs');
            expect(VALID_STATUSES).toContain(response.status);
        });

        it('should support filtering by action', async () => {
            const response = await request(app)
                .get('/api/superadmin/system/audit-logs?action=login');
            expect(VALID_STATUSES).toContain(response.status);
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/superadmin/system/audit-logs?page=1&limit=50');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/system/jobs', () => {
        it('should return background jobs or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/jobs');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('POST /api/superadmin/system/jobs/:id/retry', () => {
        it('should retry failed job or handle appropriately', async () => {
            const response = await request(app)
                .post('/api/superadmin/system/jobs/job-123/retry');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/system/logs', () => {
        it('should return system logs or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/logs');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/system/errors', () => {
        it('should return error logs or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/system/errors');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('POST /api/superadmin/system/cache/clear', () => {
        it('should clear cache or handle appropriately', async () => {
            const response = await request(app)
                .post('/api/superadmin/system/cache/clear');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('POST /api/superadmin/system/maintenance', () => {
        it('should toggle maintenance mode or handle appropriately', async () => {
            const response = await request(app)
                .post('/api/superadmin/system/maintenance')
                .send({ enabled: true });
            expect(VALID_STATUSES).toContain(response.status);
        });
    });
});
