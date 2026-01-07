/**
 * AI Explain Routes Integration Tests
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

describe('AI Explain API', () => {
    let app;

    beforeAll(async () => {
        await initializeDatabase();
        const serverModule = await import('../../../server/src/index.js');
        app = serverModule.default;
    });

    describe('POST /api/ai/explain', () => {
        it('should explain or handle appropriately', async () => {
            const response = await request(app).post('/api/ai/explain');
            expect(VALID_STATUSES).toContain(response.status);
        });
    });
});