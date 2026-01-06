import app from '../../../server/src/index.js';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

const mockDb = {
    all: vi.fn((sql, params, callback) => callback(null, [])),
    get: vi.fn((sql, params, callback) => callback(null, null)),
    run: vi.fn(function(sql, params, callback) { callback.call({ changes: 1, lastID: 1 }, null); })
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('../../../server/middleware/authMiddleware', () => ({
    default: (req, res, next) => {
        req.user = { id: 'user-1', organizationId: 'org-1' };
        req.userId = 'user-1';
        req.organizationId = 'org-1';
        next();
    }
}));

describe('Daily Brief Routes', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        app = express();
        app.use(express.json());
        const dailyBriefRouter = (await import('../../../server/routes/daily-brief.js')).default;
        app.use('/api/daily-brief', dailyBriefRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/daily-brief', () => {
    const db = getDatabase();
    beforeAll(async () => {
        await initializeDatabase();
    });

        it('should generate daily brief', async () => {
            mockDb.all.mockResolvedValue($2);

            const response = await request(app)
                .get('/api/daily-brief')
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body.decisions).toBeDefined();
            expect(response.body.tasks).toBeDefined();
            expect(response.body.initiatives).toBeDefined();
        });

        it('should filter by project', async () => {
            mockDb.all.mockResolvedValue($2);

            await request(app)
                .get('/api/daily-brief?projectId=project-123')
                .expect(200);

            expect(mockDb.all).toHaveBeenCalled();
        });
    });
});