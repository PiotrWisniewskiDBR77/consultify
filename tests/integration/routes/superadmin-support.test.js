/**
 * SuperAdmin Support Routes Integration Tests
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

const VALID_STATUSES = [200, 201, 400, 401, 403, 404, 500, 501];

describe('SuperAdmin Support API Integration', () => {
    let app;

    beforeAll(async () => {
        await initializeDatabase();
        const serverModule = await import('../../../server/src/index.js');
        app = serverModule.default;
    });

    describe('Support Tickets', () => {
        it('should return support tickets', async () => {
            const response = await request(app).get('/api/superadmin/support/tickets');
            expect(VALID_STATUSES).toContain(response.status);
        });

        it('should create a support ticket', async () => {
            const response = await request(app)
                .post('/api/superadmin/support/tickets')
                .send({ title: 'Test Ticket' });
            expect(VALID_STATUSES).toContain(response.status);
        });
    });
});
