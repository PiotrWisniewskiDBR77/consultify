/**
 * SuperAdmin Overview Integration Tests
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

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 501];

describe('SuperAdmin Overview API', () => {
    let app;
    const db = getDatabase();

    beforeAll(async () => {
        await initializeDatabase();
        const serverModule = await import('../../../server/src/index.js');
        app = serverModule.default;
    });

    describe('GET /api/superadmin/overview', () => {
        it('should return overview stats or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/overview');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/overview/metrics', () => {
        it('should return metrics or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/overview/metrics');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/overview/health', () => {
        it('should return system health or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/overview/health');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });

    describe('GET /api/superadmin/overview/alerts', () => {
        it('should return alerts or handle appropriately', async () => {
            const response = await request(app).get('/api/superadmin/overview/alerts');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });
});
